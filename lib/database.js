// ====== lib/database.js ======
// Central data-persistence layer for the bot.
//
// Everything that needs to survive a restart — bot settings, sudo list,
// warnings, chatbot conversations, antidelete messages, group features —
// is stored here in a local SQLite database (data/bot.sqlite).
//
// Two SQLite drivers are supported in order of preference:
//   1. better-sqlite3  — native compiled binary, fastest, zero overhead.
//   2. sql.js          — pure-JS WASM build; no native compiler needed.
//      Falls back to this automatically on hosts (e.g. Pterodactyl, Koyeb)
//      that cannot run native binaries.
//
// Critical tables (bot_configs, sudoers, sudo_config, warnings,
//   warning_limits, auto_configs) are also backed up to
//   data/critical_backup.json every 5 minutes so a database corruption or
//   accidental wipe can be recovered from without losing important settings.
//
// The module also manages:
//   • An in-memory media cache (capped at 30 entries / ~90 MB)
//   • Periodic cleanup timers (antidelete TTL, row-count cap, WAL checkpoints,
//     VACUUM, proactive minor GC)
//   • Prepared-statement cache to prevent repeated Statement allocations under
//     heavy message load (~10 MB/30 s V8 heap growth was traced to this)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Worker } from 'worker_threads';

// CommonJS require() — needed to load better-sqlite3 and sql.js from ESM
const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// All data files live inside the data/ directory next to lib/
const DB_DIR  = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'bot.sqlite');

// JSON snapshot used to recover critical data after a DB wipe/corruption
const BACKUP_PATH = path.join(DB_DIR, 'critical_backup.json');

// The database connection (set by initTables)
let db = null;
let isConnected = false;

// The bot's phone number, used to scope rows in multi-bot setups
let configBotId = 'default';

// Two paths for last_bot_id persistence — primary inside data/ and fallback
// in the project root.  Pterodactyl restarts are process-only (files survive),
// but having a root-level copy means settings are restored even if data/ is
// accidentally wiped by an egg install script or a git-clean operation.
const LAST_BOT_ID_PATH      = path.join(DB_DIR, 'last_bot_id.json');
const LAST_BOT_ID_ROOT_PATH = path.join(__dirname, '..', 'last_bot_id.json');

// Restore the last known bot_id immediately so `getConfig` uses the right
// phone-number scope even during the pre-connection startup phase.
// Priority order:
//   1. data/last_bot_id.json  — primary (process-only restarts)
//   2. ./last_bot_id.json     — root fallback (survives data/ wipes)
//   3. process.env.OWNER_NUMBER — Replit Secret / env var, survives full
//      filesystem resets because secrets are stored outside the container.
//      This is the key that makes PostgreSQL settings restore correctly after
//      a hard container wipe — the correct bot_id is known before WhatsApp
//      connects, so reloadConfigCaches() finds the right DB rows immediately.
try {
    const _candidates = [LAST_BOT_ID_PATH, LAST_BOT_ID_ROOT_PATH];
    for (const _p of _candidates) {
        if (fs.existsSync(_p)) {
            const saved = JSON.parse(fs.readFileSync(_p, 'utf8'));
            if (saved?.botId && /^\d+$/.test(saved.botId)) {
                configBotId = saved.botId;
                break;
            }
        }
    }
    // Fallback 3: OWNER_NUMBER env var — truly persistent (Replit Secrets,
    // Heroku Config Vars, Railway env, etc.). Only used when both JSON files
    // are missing (e.g. after a full container reset).
    if (configBotId === 'default' && process.env.OWNER_NUMBER) {
        const _cleaned = String(process.env.OWNER_NUMBER).replace(/[^0-9]/g, '');
        if (_cleaned.length >= 7) configBotId = _cleaned;
    }
} catch { /* ignore — falls back to 'default' */ }

// ══════════════════════════════════════════════════════════════════════════
// SECTION 1 — sql.js WASM adapter
// ══════════════════════════════════════════════════════════════════════════
// sql.js uses a different API from better-sqlite3, so this adapter wraps it
// in the same synchronous interface that the rest of this module expects.
// Statements are freed after each call (sql.js doesn't support persistent
// prepared statements the same way better-sqlite3 does).
// The adapter auto-flushes the in-memory database to disk every 3 seconds
// and also flushes on process exit.
class SqlJsAdapter {
    constructor(sqlJsDb, dbPath) {
        this._db  = sqlJsDb;
        this._dbPath = dbPath;
        this._dirty  = false; // true = changes pending that haven't been flushed

        // Periodic flush every 1 second to minimise data loss window on crashes
        this._timer = setInterval(() => { try { this._flush(); } catch {} }, 1000);

        // Flush on clean shutdown and on SIGTERM (Pterodactyl sends SIGTERM before SIGKILL)
        const _boundFlush = () => { try { this._flushForce(); } catch {} };
        process.on('exit',   _boundFlush);
        process.on('SIGTERM', _boundFlush);
    }

    // Write the in-memory database to disk using an atomic temp-file rename.
    // Only writes if the in-memory state has changed since the last flush.
    _flush() {
        if (!this._dirty) return;
        this._flushForce();
    }

    // Write to disk unconditionally — used on shutdown to guarantee the file
    // reflects the current in-memory state even if _dirty was already cleared
    // by the last periodic flush.
    _flushForce() {
        const data = this._db.export(); // export as Uint8Array
        const dir  = path.dirname(this._dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmp = this._dbPath + '.tmp';
        fs.writeFileSync(tmp, Buffer.from(data));
        fs.renameSync(tmp, this._dbPath); // atomic on POSIX
        this._dirty = false;
    }

    // Flush and release the underlying sql.js database.
    close() {
        try { this._flushForce(); } catch {}
        clearInterval(this._timer);
        try { this._db.close(); } catch {}
    }

    // Run a PRAGMA statement (e.g. journal_mode, synchronous).
    // Errors are silently ignored because some PRAGMAs aren't supported by sql.js.
    pragma(str) { try { this._db.run(`PRAGMA ${str}`); } catch {} }

    // Execute a SQL statement (DDL, INSERT, UPDATE, DELETE).
    // Marks the adapter dirty so the next flush writes the change to disk.
    exec(sql) {
        try { this._db.run(sql); } catch (e) {
            if (!/pragma/i.test(sql)) throw e; // ignore PRAGMA errors
        }
        this._dirty = true;
    }

    // Prepare a SQL statement and return a thin object with .get(), .all(), .run().
    // Each method compiles, executes, and frees the statement in one call.
    prepare(sql) {
        const self = this;

        // Helper: bind positional parameters, handling both flat and nested arrays
        const _bind = (stmt, args) => {
            const flat = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
            if (flat.length) stmt.bind(flat.map(v => (v === undefined ? null : v)));
        };

        return {
            // Return the first matching row as a plain object, or undefined
            get(...args) {
                const stmt = self._db.prepare(sql);
                try { _bind(stmt, args); return stmt.step() ? stmt.getAsObject() : undefined; }
                finally { stmt.free(); }
            },
            // Return all matching rows as an array of plain objects
            all(...args) {
                const stmt = self._db.prepare(sql);
                try {
                    _bind(stmt, args);
                    const rows = [];
                    while (stmt.step()) rows.push({ ...stmt.getAsObject() });
                    return rows;
                } finally { stmt.free(); }
            },
            // Execute a write statement and return { changes, lastInsertRowid }
            run(...args) {
                const stmt = self._db.prepare(sql);
                try {
                    _bind(stmt, args);
                    stmt.step();
                    self._dirty = true;
                    return { changes: self._db.getRowsModified(), lastInsertRowid: null };
                } finally { stmt.free(); }
            }
        };
    }

    // Wrap a function in an explicit BEGIN/COMMIT transaction.
    // Rolls back automatically if the function throws.
    transaction(fn) {
        const self = this;
        return function(...args) {
            self._db.run('BEGIN');
            try {
                const result = fn(...args);
                self._db.run('COMMIT');
                self._dirty = true;
                return result;
            } catch (e) {
                try { self._db.run('ROLLBACK'); } catch {}
                throw e;
            }
        };
    }
}

// Open (or create) the SQLite database using the WASM sql.js driver.
// If bot.sqlite already exists, its content is loaded into memory.
async function _openSqlJsDb() {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    let sqlJsDb;
    if (fs.existsSync(DB_PATH)) {
        sqlJsDb = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
        sqlJsDb = new SQL.Database();
    }
    return new SqlJsAdapter(sqlJsDb, DB_PATH);
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Prepared statement cache
// ══════════════════════════════════════════════════════════════════════════
// Calling db.prepare(sql) on every query allocates a new Statement object each
// time.  Under message load this caused ~10 MB/30 s V8 heap growth because
// the Statement objects were not being GC'd fast enough.
// The cache maps each SQL string to a single reused Statement object.
const _stmtCache = new Map();
function _prepare(sql) {
    let stmt = _stmtCache.get(sql);
    if (!stmt) {
        stmt = db.prepare(sql);
        _stmtCache.set(sql, stmt);
    }
    return stmt;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 3 — In-memory media cache
// ══════════════════════════════════════════════════════════════════════════
// Temporarily stores recently received media buffers (images, audio, etc.)
// so antidelete can replay them without hitting the network again.
// Hard-capped at 30 entries to stay under ~90 MB RAM.
const _mediaCache = new Map();
const MEDIA_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MEDIA_CACHE_MAX = 30;              // max 30 entries at ≤3 MB each

// ══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Critical backup
// ══════════════════════════════════════════════════════════════════════════
// A JSON snapshot of the 6 most important tables is written to disk every
// 5 minutes.  If the SQLite file is corrupted or wiped, restoreFromBackup()
// re-inserts any rows that are in the snapshot but missing from the DB.
const CRITICAL_TABLES = ['bot_configs', 'sudoers', 'sudo_config', 'warnings', 'warning_limits', 'auto_configs'];
let _backupTimer = null;
let _backupDirty = false; // true = data changed since last backup write

// Mark the backup as needing a refresh (called after writes to critical tables)
function markBackupDirty() { _backupDirty = true; }

// Write the JSON backup synchronously.  Called at process.exit so the last
// state is captured even without a graceful shutdown cycle.
function saveBackup() {
    if (!db || !_backupDirty) return;
    try {
        const snapshot = {};
        for (const table of CRITICAL_TABLES) {
            try { snapshot[table] = db.prepare(`SELECT * FROM ${table}`).all(); }
            catch { snapshot[table] = []; }
        }
        if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
        const tmp = BACKUP_PATH + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
        fs.renameSync(tmp, BACKUP_PATH); // atomic rename
        _backupDirty = false;
    } catch (err) {
        console.error('⚠️ Backup save error:', err.message);
    }
}

// Async version used by the periodic timer — avoids blocking the event loop.
async function saveBackupAsync() {
    if (!db || !_backupDirty) return;
    try {
        const snapshot = {};
        for (const table of CRITICAL_TABLES) {
            try { snapshot[table] = db.prepare(`SELECT * FROM ${table}`).all(); }
            catch { snapshot[table] = []; }
        }
        _backupDirty = false;
        const tmp = BACKUP_PATH + '.tmp';
        await fs.promises.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
        await fs.promises.rename(tmp, BACKUP_PATH);
    } catch (err) {
        console.error('⚠️ Backup save error:', err.message);
    }
}

// Re-insert any rows from the JSON backup that are missing from the live DB.
// Uses INSERT OR IGNORE so existing rows are never overwritten.
function restoreFromBackup() {
    if (!db || !fs.existsSync(BACKUP_PATH)) return;
    try {
        const snapshot = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
        let restored = 0;
        const restoreTx = db.transaction(() => {
            for (const table of CRITICAL_TABLES) {
                const rows = snapshot[table];
                if (!Array.isArray(rows) || rows.length === 0) continue;
                for (const row of rows) {
                    const keys = Object.keys(row);
                    if (keys.length === 0) continue;
                    const placeholders = keys.map(() => '?').join(', ');
                    try {
                        db.prepare(
                            `INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
                        ).run(...Object.values(row));
                        restored++;
                    } catch {}
                }
            }
        });
        restoreTx();
    } catch (err) {
        console.error('⚠️ Backup restore error:', err.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Bot ID scoping
// ══════════════════════════════════════════════════════════════════════════
// Every DB row includes a bot_id column so a single database file can be
// shared by multiple bot numbers (e.g. a primary and a backup number).

// Set the active bot ID (called once at startup with the bot's phone number).
// Persists to BOTH data/last_bot_id.json AND ./last_bot_id.json (project root)
// so settings survive even if the data/ directory is wiped between restarts.
export function setConfigBotId(botId) {
    if (botId) {
        const cleaned = botId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        configBotId = cleaned || botId.split('@')[0] || 'default';
        const payload = JSON.stringify({ botId: configBotId, savedAt: new Date().toISOString() });
        // Write to primary location (data/)
        try {
            if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
            fs.writeFileSync(LAST_BOT_ID_PATH, payload);
        } catch { /* non-fatal */ }
        // Write to root-level fallback — survives data/ wipes
        try {
            fs.writeFileSync(LAST_BOT_ID_ROOT_PATH, payload);
        } catch { /* non-fatal */ }
        // Mirror to PostgreSQL under a universal sentinel key so the phone
        // number can be recovered on a cold restart (e.g. Heroku dyno wipe)
        // even when last_bot_id.json and OWNER_NUMBER are both missing.
        if (configBotId !== 'default' && globalThis.pg?.isReady) {
            globalThis.pg.query(
                `INSERT INTO bot_configs (bot_id, key, value, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
                ['default', '__bot_phone__', configBotId]
            ).catch(() => {});
        }
    }
}

export function getConfigBotId() { return configBotId; }

// ══════════════════════════════════════════════════════════════════════════
// SECTION 6 — Table schemas
// ══════════════════════════════════════════════════════════════════════════
// All tables are created with CREATE TABLE IF NOT EXISTS so the schema is
// automatically applied on first run and on bot updates that add new tables.
const TABLE_SCHEMAS = {
    // General key-value config store (bot name, prefix, mode, feature toggles…)
    bot_configs: `
        CREATE TABLE IF NOT EXISTS bot_configs (
            key TEXT NOT NULL,
            value TEXT NOT NULL DEFAULT '{}',
            bot_id TEXT NOT NULL DEFAULT 'default',
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (key, bot_id)
        )`,
    // Per-group, per-user warning counts and reasons
    warnings: `
        CREATE TABLE IF NOT EXISTS warnings (
            group_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            count INTEGER DEFAULT 0,
            reasons TEXT DEFAULT '[]',
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (group_id, user_id, bot_id)
        )`,
    // Per-group maximum warning limit before auto-kick
    warning_limits: `
        CREATE TABLE IF NOT EXISTS warning_limits (
            group_id TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            max_warnings INTEGER DEFAULT 3,
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (group_id, bot_id)
        )`,
    // Trusted (sudo) phone numbers
    sudoers: `
        CREATE TABLE IF NOT EXISTS sudoers (
            phone_number TEXT NOT NULL,
            jid TEXT,
            bot_id TEXT NOT NULL DEFAULT 'default',
            added_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (phone_number, bot_id)
        )`,
    // Sudomode on/off flag
    sudo_config: `
        CREATE TABLE IF NOT EXISTS sudo_config (
            id TEXT NOT NULL DEFAULT 'main',
            bot_id TEXT NOT NULL DEFAULT 'default',
            sudomode INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (id, bot_id)
        )`,
    // WhatsApp Linked Device ID → phone number mapping (see sudo-store.js)
    lid_map: `
        CREATE TABLE IF NOT EXISTS lid_map (
            lid TEXT PRIMARY KEY,
            phone_number TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        )`,
    // Per-user chatbot conversation history (last 20 messages kept)
    chatbot_conversations: `
        CREATE TABLE IF NOT EXISTS chatbot_conversations (
            user_id TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            conversation TEXT DEFAULT '[]',
            last_updated TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, bot_id)
        )`,
    // Chatbot mode and model preferences
    chatbot_config: `
        CREATE TABLE IF NOT EXISTS chatbot_config (
            key TEXT NOT NULL DEFAULT 'main',
            bot_id TEXT NOT NULL DEFAULT 'default',
            config TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (key, bot_id)
        )`,
    // Messages cached for the antidelete feature (replayed when sender deletes)
    antidelete_messages: `
        CREATE TABLE IF NOT EXISTS antidelete_messages (
            message_id TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            chat_id TEXT,
            sender_id TEXT,
            message_data TEXT,
            timestamp INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (message_id, bot_id)
        )`,
    // Status updates cached for antidelete (replayed when sender deletes status)
    antidelete_statuses: `
        CREATE TABLE IF NOT EXISTS antidelete_statuses (
            status_id TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            sender_id TEXT,
            sender_number TEXT,
            push_name TEXT,
            status_type TEXT,
            status_data TEXT,
            media_meta TEXT,
            has_media INTEGER DEFAULT 0,
            text_content TEXT,
            timestamp INTEGER,
            deleted INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (status_id, bot_id)
        )`,
    // Per-group welcome/goodbye message customisation
    welcome_goodbye: `
        CREATE TABLE IF NOT EXISTS welcome_goodbye (
            group_id TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            welcome TEXT DEFAULT NULL,
            goodbye TEXT DEFAULT NULL,
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (group_id, bot_id)
        )`,
    // Per-group feature toggles (antilink, antibug, antispam, etc.)
    group_features: `
        CREATE TABLE IF NOT EXISTS group_features (
            group_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            config TEXT NOT NULL DEFAULT '{}',
            enabled INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (group_id, feature, bot_id)
        )`,
    // Automation-related config (autoread, autotyping, autoreact settings)
    auto_configs: `
        CREATE TABLE IF NOT EXISTS auto_configs (
            key TEXT NOT NULL,
            bot_id TEXT NOT NULL DEFAULT 'default',
            value TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (key, bot_id)
        )`
};

// Whitelist of table and column names that are allowed in dynamic queries.
// Any name not on this list causes validateTable/validateColumn to throw,
// preventing SQL injection from reaching the database.
const ALLOWED_TABLES  = new Set(Object.keys(TABLE_SCHEMAS));
const ALLOWED_COLUMNS = new Set([
    'key', 'value', 'updated_at', 'group_id', 'user_id', 'count', 'reasons',
    'max_warnings', 'phone_number', 'jid', 'added_at', 'id', 'sudomode',
    'lid', 'conversation', 'last_updated', 'config', 'message_id', 'chat_id',
    'sender_id', 'message_data', 'timestamp', 'created_at', 'status_id',
    'sender_number', 'push_name', 'status_type', 'status_data', 'media_meta',
    'has_media', 'text_content', 'deleted', 'welcome', 'goodbye', 'feature',
    'enabled', 'bot_id'
]);

// Throw if `name` is not a known table — prevents SQL injection
function validateTable(name) {
    if (!ALLOWED_TABLES.has(name)) throw new Error(`Unknown table: ${name}`);
    return name;
}

// Throw if `name` is not a known column (or looks safe) — prevents SQL injection
function validateColumn(name) {
    if (!ALLOWED_COLUMNS.has(name) && !(/^[a-z_][a-z0-9_]*$/).test(name)) {
        throw new Error(`Invalid column: ${name}`);
    }
    return name;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 7 — Value serialization helpers
// ══════════════════════════════════════════════════════════════════════════

// Convert a JS value to something SQLite can store:
//   objects/arrays → JSON string
//   booleans       → 1 or 0
//   null/undefined → NULL
function serializeValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && !(v instanceof Buffer) && !(v instanceof Uint8Array)) return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
}

// Convert a raw SQLite row back to a JS-friendly object:
//   JSON strings  → parsed objects/arrays
//   0/1 integers  → booleans (for well-known boolean columns)
function deserializeRow(row) {
    if (!row) return null;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        let val = v;
        // Auto-parse JSON-encoded strings
        if (typeof val === 'string') {
            if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                try { val = JSON.parse(val); } catch {}
            }
        }
        // Convert known boolean columns from integer (0/1) to boolean
        if (k === 'has_media' || k === 'deleted' || k === 'enabled' || k === 'sudomode') {
            val = !!val;
        }
        out[k] = val;
    }
    return out;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 8 — Database initialisation
// ══════════════════════════════════════════════════════════════════════════

let _usingWasm = false; // true when sql.js is used instead of better-sqlite3

// Open the database, trying native better-sqlite3 first.
// Falls back to the WASM sql.js driver if native binary loading fails.
async function _openDb() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

    // Attempt 1: fast native binary
    try {
        const Database = require('better-sqlite3');
        const instance = new Database(DB_PATH);
        // Performance PRAGMAs: WAL journal, normal sync, in-memory temp tables,
        // memory-mapped I/O (30 MB), 8 MB page cache
        instance.pragma('journal_mode = WAL');
        instance.pragma('synchronous = NORMAL');
        instance.pragma('foreign_keys = ON');
        instance.pragma('temp_store = MEMORY');
        instance.pragma('mmap_size = 30000000');
        instance.pragma('cache_size = -8000');
        _usingWasm = false;
        return instance;
    } catch {
        // Native binary unavailable (containerised host, wrong arch, etc.)
        // Fall back to the WASM build which works everywhere
        _usingWasm = true;
        return await _openSqlJsDb();
    }
}

// Create all tables, indexes, restore from backup, and start maintenance timers.
// This is the one function called by index.js at startup.
export async function initTables() {
    // Attempt to open the DB — if the file is corrupt, delete it and retry once
    try { db = await _openDb(); }
    catch (firstErr) {
        try {
            if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
            db = await _openDb();
        } catch (secondErr) {
            isConnected = false;
            throw new Error(`SQLite: cannot open database — ${secondErr.message}`);
        }
    }

    // Create tables that don't exist yet (safe on every run — IF NOT EXISTS)
    for (const [name, sql] of Object.entries(TABLE_SCHEMAS)) {
        try { db.exec(sql); }
        catch (err) { console.error(`⚠️ SQLite: table ${name}:`, err.message); }
    }

    // Speed-up indexes for the most frequently queried columns
    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_antidelete_messages_timestamp ON antidelete_messages(timestamp)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_antidelete_statuses_timestamp ON antidelete_statuses(timestamp)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_antidelete_messages_chat ON antidelete_messages(chat_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_group_features_group ON group_features(group_id)');
    } catch {}

    // Recover any rows that were backed up but are missing from the fresh DB
    restoreFromBackup();

    // If both last_bot_id.json files were lost but the DB already has settings
    // stored under a real phone number, auto-detect and restore the bot_id.
    // This ensures settings survive even if the data/ directory was wiped.
    if (configBotId === 'default') {
        try {
            const row = db.prepare(
                `SELECT bot_id FROM bot_configs WHERE bot_id != 'default' AND bot_id GLOB '[0-9]*' ORDER BY updated_at DESC LIMIT 1`
            ).get();
            if (row?.bot_id && /^\d{6,}$/.test(row.bot_id)) {
                configBotId = row.bot_id;
                const payload = JSON.stringify({ botId: configBotId, savedAt: new Date().toISOString(), autoDetected: true });
                try { fs.writeFileSync(LAST_BOT_ID_PATH, payload); } catch {}
                try { fs.writeFileSync(LAST_BOT_ID_ROOT_PATH, payload); } catch {}
                console.log(`♻️  Restored bot_id from DB: ${configBotId}`);
            }
        } catch { /* non-critical */ }
    }

    isConnected = true;

    // Start the periodic backup flush (every 5 minutes)
    if (_backupTimer) clearInterval(_backupTimer);
    _backupTimer = setInterval(() => saveBackupAsync().catch(() => {}), 5 * 60 * 1000);

    // Start periodic cleanup timers (antidelete TTL, WAL checkpoint, VACUUM, GC)
    startPeriodicCleanup();

    return true;
}

// Expose the raw DB client for low-level access (used by cleanup in index.js)
export function getClient() { return db; }

// Quick liveness check — runs a trivial SELECT 1 query
export async function checkHealth() {
    if (!db || !isConnected) return false;
    try { _prepare('SELECT 1').get(); return true; } catch { return false; }
}

// Returns true when the database is open and ready for queries
export function isAvailable() { return isConnected && !!db; }

// Returns true when sql.js WASM is being used (native binary unavailable)
export function isUsingWasm()  { return _usingWasm; }

// ══════════════════════════════════════════════════════════════════════════
// SECTION 9 — CRUD helpers
// ══════════════════════════════════════════════════════════════════════════
// These thin helpers wrap the prepared-statement cache and validation.
// All public functions are async to match the old Supabase API surface.

// Fetch a single row by a key column value.
// `keyColumn` defaults to 'key' (the primary lookup column for bot_configs).
export async function get(table, key, keyColumn = 'key') {
    try {
        if (!isConnected || !db) return null;
        const t = validateTable(table);
        const col = validateColumn(keyColumn);
        const row = _prepare(`SELECT * FROM ${t} WHERE ${col} = ? LIMIT 1`).get(key);
        return deserializeRow(row) || null;
    } catch { return null; }
}

// Fetch all rows from a table, optionally filtered by one or more column=value pairs.
export async function getAll(table, filters = {}) {
    try {
        if (!isConnected || !db) return null;
        const t = validateTable(table);
        const keys = Object.keys(filters);
        let sql = `SELECT * FROM ${t}`;
        const params = [];
        if (keys.length > 0) {
            const conditions = keys.map(k => `${validateColumn(k)} = ?`);
            sql += ` WHERE ${conditions.join(' AND ')}`;
            params.push(...Object.values(filters));
        }
        const rows = _prepare(sql).all(...params);
        return rows.map(deserializeRow);
    } catch { return null; }
}

// Insert or update a row.
// `onConflict` is a comma-separated list of columns that form the conflict key.
// Columns NOT in the conflict key are updated; conflict-key columns are ignored.
// E.g. upsert('bot_configs', { key:'prefix', value:'?', bot_id:'123' }, 'key,bot_id')
export async function upsert(table, data, onConflict = undefined) {
    try {
        if (!isConnected || !db) return false;
        const t = validateTable(table);
        const keys = Object.keys(data).map(k => validateColumn(k));
        const values = Object.values(data).map(serializeValue);
        const placeholders = keys.map(() => '?');

        const conflictCols = onConflict
            ? onConflict.split(',').map(c => validateColumn(c.trim()))
            : [keys[0]];
        const conflictTarget = conflictCols.join(', ');
        const conflictSet = new Set(conflictCols);
        const updateCols = keys.filter(k => !conflictSet.has(k));
        const updateSet = updateCols.map(k => `${k} = excluded.${k}`).join(', ');

        let sql;
        if (updateCols.length > 0) {
            // Conflict → update non-key columns
            sql = `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})
                   ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateSet}`;
        } else {
            // Conflict → do nothing (all columns are conflict-key columns)
            sql = `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})
                   ON CONFLICT (${conflictTarget}) DO NOTHING`;
        }

        _prepare(sql).run(...values);
        // Flag critical tables so the next backup cycle includes this change
        if (CRITICAL_TABLES.includes(t)) markBackupDirty();
        return true;
    } catch { return false; }
}

// Delete a single row identified by a key column value.
export async function remove(table, key, keyColumn = 'key') {
    try {
        if (!isConnected || !db) return false;
        const t = validateTable(table);
        const col = validateColumn(keyColumn);
        _prepare(`DELETE FROM ${t} WHERE ${col} = ?`).run(key);
        if (CRITICAL_TABLES.includes(t)) markBackupDirty();
        return true;
    } catch { return false; }
}

// Delete rows matching multiple column=value conditions (AND logic).
export async function removeWhere(table, filters = {}) {
    try {
        if (!isConnected || !db) return false;
        const t = validateTable(table);
        const keys = Object.keys(filters);
        if (keys.length === 0) return false;
        const conditions = keys.map(k => `${validateColumn(k)} = ?`);
        _prepare(`DELETE FROM ${t} WHERE ${conditions.join(' AND ')}`).run(...Object.values(filters));
        if (CRITICAL_TABLES.includes(t)) markBackupDirty();
        return true;
    } catch { return false; }
}

// Count rows in a table, optionally filtered.  Returns null on error.
export async function count(table, filters = {}) {
    try {
        if (!isConnected || !db) return null;
        const t = validateTable(table);
        const keys = Object.keys(filters);
        let sql = `SELECT COUNT(*) AS cnt FROM ${t}`;
        const params = [];
        if (keys.length > 0) {
            const conditions = keys.map(k => `${validateColumn(k)} = ?`);
            sql += ` WHERE ${conditions.join(' AND ')}`;
            params.push(...Object.values(filters));
        }
        const row = _prepare(sql).get(...params);
        return row ? row.cnt : null;
    } catch { return null; }
}

// Delete rows in a table whose `timestampColumn` value is older than `maxAgeMs` ms.
// Used by runPeriodicCleanup() to purge old antidelete data.
export async function cleanOlderThan(table, timestampColumn, maxAgeMs) {
    try {
        if (!isConnected || !db) return 0;
        const t = validateTable(table);
        const col = validateColumn(timestampColumn);
        const cutoff = Date.now() - maxAgeMs;
        const botId = configBotId;
        const result = _prepare(`DELETE FROM ${t} WHERE ${col} < ? AND bot_id = ?`).run(cutoff, botId);
        return result.changes || 0;
    } catch { return 0; }
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 10 — JSON file helpers
// ══════════════════════════════════════════════════════════════════════════
// Convenience wrappers used by parts of the code that still store state in
// plain JSON files rather than the database (e.g. wolfai config, music mode).

// Read and parse a JSON file.  Returns `defaultValue` if the file is absent or corrupt.
export function readJSON(filePath, defaultValue = {}) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {}
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
}

// Write an object as pretty-printed JSON, creating parent directories as needed.
export function writeJSON(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 11 — Config helpers
// ══════════════════════════════════════════════════════════════════════════
// High-level wrappers for the two config tables.
// bot_configs  — general settings (prefix, mode, feature flags, …)
// auto_configs — automation settings (autoread, autotyping, autoreact, …)

// Read a config value.  `key` is the setting name; returns `defaultValue` if unset.
// Falls back to the 'default' bot_id entry when no row exists for the current bot_id,
// so settings that were migrated from JSON files at startup (stored under 'default')
// remain accessible after the phone-number bot_id is set on connection.
export async function getConfig(key, defaultValue = {}) {
    const botId = getConfigBotId();
    try {
        if (!isConnected || !db) return defaultValue;
        const row = _prepare(`SELECT value FROM bot_configs WHERE key = ? AND bot_id = ? LIMIT 1`).get(key, botId);
        if (row) {
            const v = row.value;
            if (typeof v === 'string') {
                try { return JSON.parse(v); } catch { return v; }
            }
            return v;
        }
        // Fallback: if a specific bot_id is set but has no entry, try the 'default' row.
        // This covers settings that were migrated from JSON files at startup before the
        // real phone-number bot_id was known.
        if (botId !== 'default') {
            const fallback = _prepare(`SELECT value FROM bot_configs WHERE key = ? AND bot_id = 'default' LIMIT 1`).get(key);
            if (fallback) {
                const v = fallback.value;
                if (typeof v === 'string') {
                    try { return JSON.parse(v); } catch { return v; }
                }
                return v;
            }
        }
    } catch {}
    return defaultValue;
}

// Write (or update) a config value.
export async function setConfig(key, value) {
    const botId = getConfigBotId();
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await upsert('bot_configs', {
        key,
        value: jsonValue,
        bot_id: botId,
        updated_at: new Date().toISOString()
    }, 'key,bot_id');

    // Mirror to PostgreSQL async (fire-and-forget — never blocks SQLite)
    if (globalThis.pg?.isReady) {
        globalThis.pg.query(
            `INSERT INTO bot_configs (bot_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
             ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
            [botId, key, jsonValue]
        ).catch(() => {});
    }

    return result;
}

// Read an automation config value.
// Same 'default' fallback as getConfig — see comment there.
export async function getAutoConfig(key, defaultValue = {}) {
    const botId = getConfigBotId();
    try {
        if (!isConnected || !db) return defaultValue;
        const row = _prepare(`SELECT value FROM auto_configs WHERE key = ? AND bot_id = ? LIMIT 1`).get(key, botId);
        if (row) {
            const v = row.value;
            if (typeof v === 'string') {
                try { return JSON.parse(v); } catch { return v; }
            }
            return v;
        }
        if (botId !== 'default') {
            const fallback = _prepare(`SELECT value FROM auto_configs WHERE key = ? AND bot_id = 'default' LIMIT 1`).get(key);
            if (fallback) {
                const v = fallback.value;
                if (typeof v === 'string') {
                    try { return JSON.parse(v); } catch { return v; }
                }
                return v;
            }
        }
    } catch {}
    return defaultValue;
}

// Write (or update) an automation config value.
export async function setAutoConfig(key, value) {
    const botId = getConfigBotId();
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await upsert('auto_configs', {
        key,
        value: jsonValue,
        bot_id: botId,
        updated_at: new Date().toISOString()
    }, 'key,bot_id');

    // Mirror to pg bot_configs with a prefix so it survives Heroku dyno resets
    if (globalThis.pg?.isReady) {
        globalThis.pg.query(
            `INSERT INTO bot_configs (bot_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
             ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
            [botId, `auto_config:${key}`, jsonValue]
        ).catch(() => {});
    }

    return result;
}

// ── Synchronous variants (use these in modules that can't be made async) ───
// These read/write directly via the better-sqlite3 synchronous API.
// Safe to call any time after initTables() has resolved.
// Return defaultValue / false when the database is not yet ready.

export function getConfigSync(key, defaultValue = {}) {
    if (!isConnected || !db) return defaultValue;
    try {
        const botId = getConfigBotId();
        const row = db.prepare(`SELECT value FROM bot_configs WHERE key = ? AND bot_id = ? LIMIT 1`).get(key, botId);
        if (row) {
            const v = row.value;
            if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
            return v;
        }
        if (botId !== 'default') {
            const fb = db.prepare(`SELECT value FROM bot_configs WHERE key = ? AND bot_id = 'default' LIMIT 1`).get(key);
            if (fb) {
                const v = fb.value;
                if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
                return v;
            }
        }
    } catch {}
    return defaultValue;
}

export function setConfigSync(key, value) {
    if (!isConnected || !db) return false;
    try {
        const botId = getConfigBotId();
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        db.prepare(
            `INSERT INTO bot_configs (key, value, bot_id, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (key, bot_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).run(key, jsonValue, botId, new Date().toISOString());
        markBackupDirty();

        // Mirror to PostgreSQL async (fire-and-forget — never blocks SQLite)
        if (globalThis.pg?.isReady) {
            globalThis.pg.query(
                `INSERT INTO bot_configs (bot_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
                [botId, key, jsonValue]
            ).catch(() => {});
        }

        return true;
    } catch { return false; }
}

export function getAutoConfigSync(key, defaultValue = {}) {
    if (!isConnected || !db) return defaultValue;
    try {
        const botId = getConfigBotId();
        const row = db.prepare(`SELECT value FROM auto_configs WHERE key = ? AND bot_id = ? LIMIT 1`).get(key, botId);
        if (row) {
            const v = row.value;
            if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
            return v;
        }
        if (botId !== 'default') {
            const fb = db.prepare(`SELECT value FROM auto_configs WHERE key = ? AND bot_id = 'default' LIMIT 1`).get(key);
            if (fb) {
                const v = fb.value;
                if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
                return v;
            }
        }
    } catch {}
    return defaultValue;
}

export function setAutoConfigSync(key, value) {
    if (!isConnected || !db) return false;
    try {
        const botId = getConfigBotId();
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        db.prepare(
            `INSERT INTO auto_configs (key, value, bot_id, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (key, bot_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).run(key, jsonValue, botId, new Date().toISOString());

        // Mirror to pg bot_configs with a prefix so it survives Heroku dyno resets
        if (globalThis.pg?.isReady) {
            globalThis.pg.query(
                `INSERT INTO bot_configs (bot_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
                [botId, `auto_config:${key}`, jsonValue]
            ).catch(() => {});
        }

        return true;
    } catch { return false; }
}

// One-time migration: import a JSON config file into bot_configs.
// No-op if the key already exists in the database (prevents duplicate migrations).
// Also skips migration if the file contains empty/meaningless data ({} or no keys).
export async function migrateJSONToConfig(filePath, configKey) {
    if (!isConnected || !db) return false;
    try {
        const botId = getConfigBotId();
        const existing = _prepare('SELECT 1 FROM bot_configs WHERE key = ? AND bot_id = ? LIMIT 1').get(configKey, botId);
        if (existing) return true; // already migrated
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            // Skip if data is null, not an object, or completely empty — avoids polluting
            // the DB with empty rows that mask meaningful defaults.
            if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return false;
            await setConfig(configKey, data);
            console.log(`✅ SQLite: Migrated ${filePath} → bot_configs.${configKey}`);
            return true;
        }
    } catch (err) {
        console.error(`⚠️ SQLite: Migration error for ${filePath}:`, err.message);
    }
    return false;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 12 — In-memory media store
// ══════════════════════════════════════════════════════════════════════════
// Temporarily holds media buffers (images, audio, video) so the antidelete
// feature can replay a message that was deleted before the user could see it.

// Store a media buffer.  Enforces the MEDIA_CACHE_MAX cap by evicting the
// oldest entry before adding a new one.
export async function uploadMedia(msgId, buffer, mimetype, folder = 'messages') {
    try {
        const ext = mimetype?.split('/')[1]?.split(';')[0] || 'bin';
        const filePath = `${folder}/${msgId}.${ext}`;
        // Evict the oldest entry when the cache is full
        if (_mediaCache.size >= MEDIA_CACHE_MAX) {
            const oldest = _mediaCache.keys().next().value;
            _mediaCache.delete(oldest);
        }
        _mediaCache.set(filePath, {
            data: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
            mimetype: mimetype || 'application/octet-stream',
            ts: Date.now()
        });
        return filePath;
    } catch (err) {
        console.error('⚠️ Media cache: Upload failed:', err.message);
        return null;
    }
}

// Retrieve a previously stored media buffer.  Returns null if not in cache.
export async function downloadMedia(storagePath) {
    try {
        const entry = _mediaCache.get(storagePath);
        if (entry) return entry.data;
        return null;
    } catch { return null; }
}

// Remove a specific media buffer from the cache.
export async function deleteMedia(storagePath) {
    _mediaCache.delete(storagePath);
    return true;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 13 — Antidelete helpers
// ══════════════════════════════════════════════════════════════════════════
// Store and retrieve message/status data so the bot can forward a copy
// back into the chat when the sender deletes their original message.

// Save a message snapshot before it could be deleted.
export async function storeAntideleteMessage(msgId, messageData) {
    try {
        const botId = configBotId;
        return await upsert('antidelete_messages', {
            message_id: msgId,
            bot_id: botId,
            chat_id: messageData.chatJid || null,
            sender_id: messageData.senderJid || null,
            message_data: JSON.stringify(messageData),
            timestamp: messageData.timestamp || Date.now(),
            created_at: new Date().toISOString()
        }, 'message_id,bot_id');
    } catch { return false; }
}

// Retrieve a stored message snapshot by message ID.
export async function getAntideleteMessage(msgId) {
    try {
        const botId = configBotId;
        const rows = await getAll('antidelete_messages', { message_id: msgId, bot_id: botId });
        const row = rows?.[0];
        if (!row) return null;
        const data = row.message_data;
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch { return null; }
}

// Delete a stored message snapshot (called after replaying it).
export async function deleteAntideleteMessage(msgId) {
    try {
        const botId = configBotId;
        return await removeWhere('antidelete_messages', { message_id: msgId, bot_id: botId });
    } catch { return false; }
}

// Save a WhatsApp status update before it could be deleted.
export async function storeAntideleteStatus(statusId, statusData) {
    try {
        const botId = configBotId;
        return await upsert('antidelete_statuses', {
            status_id: statusId,
            bot_id: botId,
            sender_id: statusData.senderJid || null,
            sender_number: statusData.senderNumber || null,
            push_name: statusData.pushName || null,
            status_type: statusData.type || null,
            status_data: JSON.stringify(statusData),
            media_meta: statusData.hasMedia ? JSON.stringify({ mimetype: statusData.mimetype, type: statusData.type }) : null,
            has_media: statusData.hasMedia ? 1 : 0,
            text_content: statusData.text || null,
            timestamp: statusData.timestamp || Date.now(),
            deleted: 0,
            created_at: new Date().toISOString()
        }, 'status_id,bot_id');
    } catch { return false; }
}

// Retrieve a stored status snapshot by status ID.
export async function getAntideleteStatus(statusId) {
    try {
        const botId = configBotId;
        const rows = await getAll('antidelete_statuses', { status_id: statusId, bot_id: botId });
        const row = rows?.[0];
        if (!row) return null;
        const data = row.status_data;
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch { return null; }
}

// Delete a stored status snapshot.
export async function deleteAntideleteStatus(statusId) {
    try {
        const botId = configBotId;
        return await removeWhere('antidelete_statuses', { status_id: statusId, bot_id: botId });
    } catch { return false; }
}

// Wipe ALL antidelete data (messages + statuses + in-memory media buffers).
// Called by ?clearantidelete or ?cleardb.
export async function clearAllAntideleteData() {
    const results = { tables: 0, files: 0, errors: [] };
    try {
        if (!isConnected || !db) { results.errors.push('SQLite not connected'); return results; }
        const botId = configBotId;
        try {
            const r1 = db.prepare('DELETE FROM antidelete_messages WHERE bot_id = ?').run(botId);
            results.tables += r1.changes;
        } catch (err) { results.errors.push(`messages: ${err.message}`); }
        try {
            const r2 = _prepare('DELETE FROM antidelete_statuses WHERE bot_id = ?').run(botId);
            results.tables += r2.changes;
        } catch (err) { results.errors.push(`statuses: ${err.message}`); }
        // Also clear the in-memory media buffers
        results.files += _mediaCache.size;
        _mediaCache.clear();
        return results;
    } catch (err) {
        results.errors.push(err.message);
        return results;
    }
}

// Wipe every row from every table (nuclear option — used by ?cleardb).
export async function wipeAllTables() {
    const results = { tables: {}, totalRows: 0, errors: [] };
    if (!isConnected || !db) { results.errors.push('SQLite not connected'); return results; }
    for (const table of Object.keys(TABLE_SCHEMAS)) {
        try {
            const r = db.prepare(`DELETE FROM ${table}`).run();
            results.tables[table] = r.changes;
            results.totalRows += r.changes;
        } catch (err) {
            results.tables[table] = 0;
            results.errors.push(`${table}: ${err.message}`);
        }
    }
    _mediaCache.clear();
    markBackupDirty();
    saveBackup(); // write backup immediately so the wipe is recorded
    return results;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 14 — Periodic cleanup
// ══════════════════════════════════════════════════════════════════════════
// Several maintenance tasks run on recurring timers:
//   • Every 5 min  — delete antidelete rows older than 2 hours
//   • Every 5 min  — cap antidelete tables at MAX_ANTIDELETE_ROWS rows each
//   • Every 5 min  — evict expired in-memory media cache entries (30 min TTL)
//   • Every 30 min — WAL checkpoint (prevents the WAL file growing unboundedly)
//   • Every 24 h   — VACUUM (reclaims disk space from deleted rows)
//   • Every 10 min — proactive minor GC (counters the Baileys v7 memory leak)
//   • Once per day — prune stale Signal session keys older than 30 days

const CLEANUP_INTERVAL        = 5 * 60 * 1000;       // 5 minutes
const MAX_ANTIDELETE_AGE_MS   = 2 * 60 * 60 * 1000;  // 2 hours
const MAX_ANTIDELETE_ROWS     = 150;                   // hard cap per bot per table
const VACUUM_INTERVAL         = 24 * 60 * 60 * 1000;  // 24 hours
const WAL_CHECKPOINT_INTERVAL = 30 * 60 * 1000;       // 30 minutes
const KEY_PRUNE_INTERVAL      = 24 * 60 * 60 * 1000;  // 24 hours (Signal keys)

let cleanupTimer = null;
let vacuumTimer  = null;
let walTimer     = null;
let gcTimer      = null;
let _lastKeyPrune = 0;

// Run the main cleanup pass — called by the timer AND once manually 60 s after startup.
export async function runPeriodicCleanup() {
    if (!isConnected || !db) return;
    try {
        // 1. Delete antidelete rows older than 2 hours
        const msgCleaned    = await cleanOlderThan('antidelete_messages', 'timestamp', MAX_ANTIDELETE_AGE_MS);
        const statusCleaned = await cleanOlderThan('antidelete_statuses', 'timestamp', MAX_ANTIDELETE_AGE_MS);

        // 2. Enforce row-count cap: delete oldest rows above the 150-row limit
        let rowLimitCleaned = 0;
        try {
            const botId = configBotId;
            const msgCount = db.prepare('SELECT COUNT(*) AS c FROM antidelete_messages WHERE bot_id = ?').get(botId)?.c || 0;
            if (msgCount > MAX_ANTIDELETE_ROWS) {
                const excess = msgCount - MAX_ANTIDELETE_ROWS;
                const r = db.prepare(
                    `DELETE FROM antidelete_messages WHERE bot_id = ? AND message_id IN
                     (SELECT message_id FROM antidelete_messages WHERE bot_id = ? ORDER BY timestamp ASC LIMIT ?)`
                ).run(botId, botId, excess);
                rowLimitCleaned += r.changes;
            }
            const statusCount = db.prepare('SELECT COUNT(*) AS c FROM antidelete_statuses WHERE bot_id = ?').get(botId)?.c || 0;
            if (statusCount > MAX_ANTIDELETE_ROWS) {
                const excess = statusCount - MAX_ANTIDELETE_ROWS;
                const r = db.prepare(
                    `DELETE FROM antidelete_statuses WHERE bot_id = ? AND status_id IN
                     (SELECT status_id FROM antidelete_statuses WHERE bot_id = ? ORDER BY timestamp ASC LIMIT ?)`
                ).run(botId, botId, excess);
                rowLimitCleaned += r.changes;
            }
        } catch {}

        // 3. Evict in-memory media cache entries older than 30 minutes
        const now = Date.now();
        let mediaCleaned = 0;
        for (const [k, v] of _mediaCache.entries()) {
            if (now - v.ts > MEDIA_CACHE_TTL) { _mediaCache.delete(k); mediaCleaned++; }
        }

        // 4. Prune stale Signal session keys (run once per 24 hours)
        let keysPruned = 0;
        const now2 = Date.now();
        if (now2 - _lastKeyPrune > KEY_PRUNE_INTERVAL) {
            try {
                const cutoff = now2 - 30 * 24 * 60 * 60 * 1000; // 30 days
                const prunable = ['pre-key', 'sender-key', 'sender-key-memory', 'session'];
                for (const type of prunable) {
                    try {
                        const r = db.prepare(
                            `DELETE FROM session_keys WHERE type = ? AND updated_at < ?`
                        ).run(type, cutoff);
                        keysPruned += r.changes;
                    } catch {}
                }
                _lastKeyPrune = now2;
            } catch {}
        }

        const total = msgCleaned + statusCleaned + rowLimitCleaned + mediaCleaned + keysPruned;
        if (total > 0) {
            // If anything was deleted from critical tables, refresh the backup
            saveBackupAsync().catch(() => {});
            const parts = [`msgs: ${msgCleaned}`, `statuses: ${statusCleaned}`, `rowLimit: ${rowLimitCleaned}`, `media: ${mediaCleaned}`];
            if (keysPruned > 0) parts.push(`session keys: ${keysPruned}`);
            console.log(`🧹 DB Cleanup: removed ${total} old records (${parts.join(', ')})`);
        }
    } catch (err) {
        console.error('⚠️ DB Cleanup error:', err.message);
    }
}

// Run a WAL checkpoint in a dedicated worker thread so the main event loop is
// never blocked. Even PASSIVE mode checkpoints can take noticeable time when
// the WAL file is large (many Signal session keys / antidelete rows), causing
// the classic "EVENT-LOOP lag detected" warning.
function runWalCheckpoint() {
    if (!isConnected || !db || _usingWasm) return;
    try {
        const workerPath = path.join(__dirname, 'wal-checkpoint-worker.cjs');
        const w = new Worker(workerPath, { workerData: { dbPath: DB_PATH } });
        w.on('message', (result) => {
            if (!result.ok) console.error('⚠️ DB WAL checkpoint error:', result.err);
        });
        w.on('error', (err) => {
            console.error('⚠️ DB WAL checkpoint worker error:', err.message);
        });
    } catch (err) {
        // Fallback: run synchronously if worker fails to spawn
        try {
            db.exec('PRAGMA wal_checkpoint(PASSIVE)');
        } catch {}
    }
}

// Run VACUUM in a dedicated worker thread so the main event loop is never
// blocked.  VACUUM rewrites the entire database file which can take several
// seconds on large databases (e.g. 16 k+ auth signal keys).  Running it
// synchronously on the main thread would freeze message processing during
// that window — the classic "bot goes silent for a few seconds" symptom.
// The worker opens its own read-write connection; SQLite's WAL mode allows
// this safely alongside the main connection.
function runVacuum() {
    if (!isConnected || !db || _usingWasm) return; // sql.js is in-memory, no file to vacuum
    try {
        const workerPath = path.join(__dirname, 'vacuum-worker.cjs');
        const w = new Worker(workerPath, { workerData: { dbPath: DB_PATH } });
        w.on('message', (result) => {
            if (result.ok) console.log('🧹 DB: VACUUM completed (reclaimed disk space)');
            else console.error('⚠️ DB VACUUM error:', result.err);
        });
        w.on('error', (err) => {
            console.error('⚠️ DB VACUUM worker error:', err.message);
        });
    } catch (err) {
        console.error('⚠️ DB VACUUM failed to start worker:', err.message);
    }
}

// Register all recurring maintenance timers.
// Called once by initTables() after the database is successfully opened.
export function startPeriodicCleanup() {
    // Main cleanup: antidelete TTL + row cap + media cache expiry
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = setInterval(runPeriodicCleanup, CLEANUP_INTERVAL);
    setTimeout(runPeriodicCleanup, 60000); // also run 1 min after startup

    // WAL checkpoint every 30 minutes to keep the WAL file small
    if (walTimer) clearInterval(walTimer);
    walTimer = setInterval(runWalCheckpoint, WAL_CHECKPOINT_INTERVAL);
    setTimeout(runWalCheckpoint, 10 * 60 * 1000); // first checkpoint 10 min in

    // Daily VACUUM (run 1 h after startup so it doesn't slow the initial load)
    if (vacuumTimer) clearInterval(vacuumTimer);
    vacuumTimer = setInterval(runVacuum, VACUUM_INTERVAL);
    setTimeout(runVacuum, 60 * 60 * 1000);

    // Proactive minor GC every 10 minutes.
    // Baileys v7.0.0-rc.9 has a known receive-message memory leak
    // (~0.1 MB per message) that V8's automatic GC does not reclaim fast
    // enough on its own.  Explicitly triggering a minor (scavenge) GC sweeps
    // the short-lived object generation cheaply (<5 ms) and prevents the
    // heap from growing to the 450 MB emergency threshold.
    if (gcTimer) clearInterval(gcTimer);
    gcTimer = setInterval(() => {
        try {
            if (typeof global.gc === 'function') {
                // Prefer the lighter "minor" scavenge GC; fall back to full GC
                try { global.gc({ type: 'minor' }); } catch { global.gc(); }
            }
        } catch {}
    }, 10 * 60 * 1000);
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 15 — Process exit hooks
// ══════════════════════════════════════════════════════════════════════════
// Ensure the backup JSON and WAL are flushed before the process dies,
// regardless of how it exits (normal exit, Ctrl-C, or SIGTERM from the host).

function shutdown() {
    // Force-save the backup JSON regardless of _backupDirty so the latest
    // in-memory state is captured even if the 5-minute timer hasn't fired yet.
    _backupDirty = true;
    saveBackup();
    if (db) {
        // For better-sqlite3, checkpoint and close normally.
        // For sql.js (SqlJsAdapter), close() flushes the in-memory DB to disk.
        try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
        try { db.close(); } catch {}
    }
}

process.on('exit',   shutdown);
process.on('SIGINT',  () => { shutdown(); process.exit(0); });
// SIGTERM is also handled by SqlJsAdapter._flushForce() registered in its
// constructor, but we call shutdown() here too for the backup JSON and WAL.
process.on('SIGTERM', () => { shutdown(); process.exit(0); });

// ══════════════════════════════════════════════════════════════════════════
// SECTION 16 — Default export
// ══════════════════════════════════════════════════════════════════════════
// Mirrors the old supabase.js API surface so code that imported supabase.js
// works without any changes after the migration to SQLite.
// Force-flush the in-memory snapshot to critical_backup.json immediately.
// Called before process.exit() so the latest state is captured even if the
// 5-minute periodic timer hasn't fired yet.
export function forceBackup() {
    _backupDirty = true;
    saveBackup();
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 15 — PostgreSQL → SQLite restore (Heroku ephemeral filesystem fix)
// ══════════════════════════════════════════════════════════════════════════
// On Heroku every dyno restart wipes data/bot.sqlite AND
// data/critical_backup.json (ephemeral filesystem).  PostgreSQL persists
// across restarts.  This function reads back from pg and re-populates the
// fresh SQLite DB so settings are never lost on Heroku.
//
// Safe to call on every platform — uses INSERT OR IGNORE everywhere, so
// existing rows are never overwritten.  Only runs when pg.isReady is true.
//
// Called once at startup inside initDatabase(), AFTER initTables() and
// BEFORE initSudo()/runDataMigrations().

export async function restoreFromPg() {
    if (!globalThis.pg?.isReady) return { restored: 0, skipped: 'pg_not_ready' };
    if (!isConnected || !db) return { restored: 0, skipped: 'sqlite_not_ready' };

    const botId = getConfigBotId();
    let total = 0;

    try {
        // ── 1. bot_configs (+ embedded auto_configs + sudomode) ──────────
        const cfgResult = await globalThis.pg.query(
            `SELECT key, value, updated_at FROM bot_configs WHERE bot_id = $1`,
            [botId]
        );

        if (cfgResult?.rows?.length) {
            const now = new Date().toISOString();
            for (const row of cfgResult.rows) {
                const ts = row.updated_at ? new Date(row.updated_at).toISOString() : now;

                if (row.key.startsWith('auto_config:')) {
                    // Stored in pg bot_configs with prefix — restore into SQLite auto_configs
                    const realKey = row.key.slice('auto_config:'.length);
                    try {
                        db.prepare(
                            `INSERT OR IGNORE INTO auto_configs (key, value, bot_id, updated_at) VALUES (?, ?, ?, ?)`
                        ).run(realKey, row.value, botId, ts);
                        total++;
                    } catch {}

                } else if (row.key === '__sudomode__') {
                    // Restore sudomode flag into SQLite sudo_config
                    try {
                        const modeVal = row.value === 'true' || row.value === '1' ? 1 : 0;
                        db.prepare(
                            `INSERT OR IGNORE INTO sudo_config (id, bot_id, sudomode, updated_at) VALUES (?, ?, ?, ?)`
                        ).run('main', botId, modeVal, ts);
                        total++;
                    } catch {}

                } else {
                    // Regular bot_configs row
                    try {
                        db.prepare(
                            `INSERT OR IGNORE INTO bot_configs (key, value, bot_id, updated_at) VALUES (?, ?, ?, ?)`
                        ).run(row.key, row.value, botId, ts);
                        total++;
                    } catch {}
                }
            }
        }

        // ── 2. sudoers ────────────────────────────────────────────────────
        // pg columns: (bot_id, phone, added_at)
        // SQLite columns: (phone_number, jid, bot_id, added_at)
        const sudoResult = await globalThis.pg.query(
            `SELECT phone, added_at FROM sudoers WHERE bot_id = $1`,
            [botId]
        );

        if (sudoResult?.rows?.length) {
            for (const row of sudoResult.rows) {
                try {
                    const ts = row.added_at ? new Date(row.added_at).toISOString() : new Date().toISOString();
                    db.prepare(
                        `INSERT OR IGNORE INTO sudoers (phone_number, bot_id, added_at) VALUES (?, ?, ?)`
                    ).run(row.phone, botId, ts);
                    total++;
                } catch {}
            }
        }

        // ── 3. lid_map ────────────────────────────────────────────────────
        // pg columns: (lid, phone, updated_at)
        // SQLite columns: (lid, phone_number, updated_at)
        const lidResult = await globalThis.pg.query(
            `SELECT lid, phone FROM lid_map LIMIT 10000`
        );

        if (lidResult?.rows?.length) {
            const now2 = new Date().toISOString();
            for (const row of lidResult.rows) {
                try {
                    db.prepare(
                        `INSERT OR IGNORE INTO lid_map (lid, phone_number, updated_at) VALUES (?, ?, ?)`
                    ).run(row.lid, row.phone, now2);
                    total++;
                } catch {}
            }
        }

        if (total > 0) {
            markBackupDirty();
            saveBackup(); // write backup immediately so the restored data is captured
            console.log(`[PG→SQLite] ♻️  Restored ${total} rows from PostgreSQL into fresh SQLite DB`);
        } else {
            console.log(`[PG→SQLite] Nothing to restore (pg has no data for bot_id="${botId}")`);
        }

        return { restored: total };

    } catch (err) {
        console.error(`[PG→SQLite] Restore error: ${err.message}`);
        return { restored: total, error: err.message };
    }
}

export default {
    getClient,
    checkHealth,
    initTables,
    isAvailable,
    forceBackup,
    get,
    getAll,
    upsert,
    remove,
    removeWhere,
    count,
    cleanOlderThan,
    readJSON,
    writeJSON,
    getConfig,
    setConfig,
    getAutoConfig,
    setAutoConfig,
    getConfigSync,
    setConfigSync,
    getAutoConfigSync,
    setAutoConfigSync,
    migrateJSONToConfig,
    setConfigBotId,
    getConfigBotId,
    TABLE_SCHEMAS,
    uploadMedia,
    downloadMedia,
    deleteMedia,
    storeAntideleteMessage,
    getAntideleteMessage,
    deleteAntideleteMessage,
    storeAntideleteStatus,
    getAntideleteStatus,
    deleteAntideleteStatus,
    clearAllAntideleteData,
    wipeAllTables,
    startPeriodicCleanup,
    runPeriodicCleanup,
    restoreFromPg
};
