import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

let _proto = null;
let _BufferJSON = null;
let _initAuthCreds = null;

async function getBaileysDeps() {
    if (_proto && _BufferJSON && _initAuthCreds) return;
    const baileys = await import('wolfsocket');
    _proto = baileys.proto;
    _BufferJSON = baileys.BufferJSON;
    _initAuthCreds = baileys.initAuthCreds;
}

// ─── Schema additions (called by database.js initTables) ──────────────────
export const AUTH_TABLE_SCHEMAS = {
    session_creds: `
        CREATE TABLE IF NOT EXISTS session_creds (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        )`,
    session_keys: `
        CREATE TABLE IF NOT EXISTS session_keys (
            type TEXT NOT NULL,
            id   TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (type, id)
        )`
};

// ─── Per-db statement cache (avoids re-preparing on every call) ───────────
const _authStmtCache = new Map();
function _prep(db, sql) {
    let stmt = _authStmtCache.get(sql);
    if (!stmt) {
        stmt = db.prepare(sql);
        _authStmtCache.set(sql, stmt);
    }
    return stmt;
}

// Cached transaction for writing multiple keys at once — created once per db
let _writeManyTx = null;
let _writeManyDb = null;
function getWriteManyTx(db, BufferJSON) {
    if (_writeManyTx && _writeManyDb === db) return _writeManyTx;
    const stmt = _prep(db,
        `INSERT INTO session_keys (type, id, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT (type, id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    _writeManyTx = db.transaction((entries) => {
        for (const { type, id, value } of entries) {
            try {
                const json = JSON.stringify(value, BufferJSON.replacer);
                stmt.run(type, id, json);
            } catch {}
        }
    });
    _writeManyDb = db;
    return _writeManyTx;
}

// ─── File-based fallback (used when SQLite is unavailable) ────────────────
async function useFileAuthState(sessionDir) {
    await getBaileysDeps();
    const proto = _proto;
    const BufferJSON = _BufferJSON;
    const initAuthCreds = _initAuthCreds;

    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const credsPath = path.join(sessionDir, 'creds.json');

    function readCreds() {
        try {
            if (!fs.existsSync(credsPath)) return null;
            return JSON.parse(fs.readFileSync(credsPath, 'utf8'), BufferJSON.reviver);
        } catch { return null; }
    }

    function writeCreds(data) {
        try { fs.writeFileSync(credsPath, JSON.stringify(data, BufferJSON.replacer), 'utf8'); } catch {}
    }

    function keyPath(type, id) {
        const safe = id.replace(/\//g, '__').replace(/:/g, '-');
        return path.join(sessionDir, `${type}-${safe}.json`);
    }

    function readKey(type, id) {
        try {
            const p = keyPath(type, id);
            if (!fs.existsSync(p)) return null;
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'), BufferJSON.reviver);
            if (type === 'app-state-sync-key' && raw)
                return proto.Message.AppStateSyncKeyData.create(raw);
            return raw;
        } catch { return null; }
    }

    let creds = readCreds() || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) data[id] = readKey(type, id);
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            try {
                                if (value) {
                                    fs.writeFileSync(keyPath(type, id), JSON.stringify(value, BufferJSON.replacer), 'utf8');
                                } else {
                                    const p = keyPath(type, id);
                                    if (fs.existsSync(p)) fs.unlinkSync(p);
                                }
                            } catch {}
                        }
                    }
                }
            }
        },
        saveCreds: () => { writeCreds(creds); }
    };
}

// ─── Main factory ─────────────────────────────────────────────────────────
export async function useSQLiteAuthState(db, sessionDir = './session') {
    await getBaileysDeps();

    if (!db) {
        throw new Error('AuthState: SQLite db not available — cannot initialize session storage');
    }

    const proto = _proto;
    const BufferJSON = _BufferJSON;
    const initAuthCreds = _initAuthCreds;

    // Ensure auth tables exist
    for (const sql of Object.values(AUTH_TABLE_SCHEMAS)) {
        try { db.exec(sql); } catch {}
    }

    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_session_keys_type ON session_keys(type)');
    } catch {}

    // ── Helpers (all use cached statements) ────────────────────────────────
    function readKey(type, id) {
        try {
            const row = _prep(db, 'SELECT value FROM session_keys WHERE type = ? AND id = ? LIMIT 1').get(type, id);
            if (!row) return null;
            return JSON.parse(row.value, BufferJSON.reviver);
        } catch { return null; }
    }

    function writeKey(type, id, value) {
        try {
            const json = JSON.stringify(value, BufferJSON.replacer);
            _prep(db,
                `INSERT INTO session_keys (type, id, value, updated_at)
                 VALUES (?, ?, ?, datetime('now'))
                 ON CONFLICT (type, id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            ).run(type, id, json);
        } catch {}
    }

    function deleteKey(type, id) {
        try {
            _prep(db, 'DELETE FROM session_keys WHERE type = ? AND id = ?').run(type, id);
        } catch {}
    }

    function readCreds() {
        try {
            const row = _prep(db, "SELECT value FROM session_creds WHERE key = 'creds' LIMIT 1").get();
            if (!row) return null;
            return JSON.parse(row.value, BufferJSON.reviver);
        } catch { return null; }
    }

    function writeCreds(creds) {
        try {
            const json = JSON.stringify(creds, BufferJSON.replacer);
            _prep(db,
                `INSERT INTO session_creds (key, value, updated_at)
                 VALUES ('creds', ?, datetime('now'))
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            ).run(json);
        } catch (err) {
            console.error('⚠️ AuthState: Failed to save creds:', err.message);
        }
    }

    // ── Migrate existing file-based session into DB (one-time) ────────────
    async function migrateFromFiles() {
        try {
            const credsPath = path.join(sessionDir, 'creds.json');
            if (!fs.existsSync(credsPath)) return;

            const existing = _prep(db, "SELECT 1 FROM session_creds WHERE key = 'creds' LIMIT 1").get();
            if (existing) return;

            console.log('📦 AuthState: Migrating existing session files → SQLite...');
            let migrated = 0;

            // Migrate creds.json
            try {
                const raw = fs.readFileSync(credsPath, 'utf8');
                const data = JSON.parse(raw, BufferJSON.reviver);
                writeCreds(data);
                migrated++;
            } catch {}

            // Migrate all key files
            const files = fs.readdirSync(sessionDir);
            const keyFiles = files.filter(f => f.endsWith('.json') && f !== 'creds.json');

            const insertOnce = _prep(db,
                `INSERT OR IGNORE INTO session_keys (type, id, value, updated_at)
                 VALUES (?, ?, ?, datetime('now'))`
            );
            const insertMany = db.transaction((entries) => {
                for (const { type, id, value } of entries) {
                    insertOnce.run(type, id, value);
                }
            });

            const entries = [];
            for (const file of keyFiles) {
                try {
                    const nameNoExt = file.replace('.json', '').replace(/__/g, '/').replace(/-/g, ':');
                    const dashIdx = nameNoExt.indexOf(':');
                    if (dashIdx === -1) continue;

                    const rawFile = file.replace('.json', '');
                    const firstDash = rawFile.indexOf('-');
                    if (firstDash === -1) continue;
                    const type = rawFile.substring(0, firstDash);
                    const id = rawFile.substring(firstDash + 1).replace(/__/g, '/').replace(/-/g, ':');

                    const raw = fs.readFileSync(path.join(sessionDir, file), 'utf8');
                    entries.push({ type, id, value: raw });
                    migrated++;
                } catch {}
            }
            if (entries.length > 0) insertMany(entries);

            console.log(`✅ AuthState: Migrated ${migrated} session entries to SQLite`);

            // Rename session dir so it's no longer used
            try {
                fs.renameSync(sessionDir, sessionDir + '_migrated_backup');
                console.log(`📁 AuthState: Session folder renamed to ${sessionDir}_migrated_backup`);
            } catch {}
        } catch (err) {
            console.error('⚠️ AuthState: Migration error:', err.message);
        }
    }

    await migrateFromFiles();

    // Load or init creds
    let creds = readCreds() || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = readKey(type, id);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.create(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    const toWrite = [];
                    const toDelete = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) {
                                toWrite.push({ type, id, value });
                            } else {
                                toDelete.push({ type, id });
                            }
                        }
                    }

                    if (toWrite.length > 0) {
                        getWriteManyTx(db, BufferJSON)(toWrite);
                    }

                    for (const { type, id } of toDelete) {
                        deleteKey(type, id);
                    }
                }
            }
        },
        saveCreds: () => {
            writeCreds(creds);
        }
    };
}

// ── Utility: count keys in DB (for diagnostics) ───────────────────────────
export function getSessionStats(db) {
    try {
        const keys = _prep(db, 'SELECT COUNT(*) AS c FROM session_keys').get()?.c || 0;
        const hasCreds = !!_prep(db, "SELECT 1 FROM session_creds WHERE key = 'creds' LIMIT 1").get();
        const byType = _prep(db, 'SELECT type, COUNT(*) AS c FROM session_keys GROUP BY type').all();
        return { hasCreds, totalKeys: keys, byType };
    } catch { return { hasCreds: false, totalKeys: 0, byType: [] }; }
}

// ── Export current creds as a portable session-ID string ───────────────────
// Reads creds from SQLite (primary) or creds.json (fallback), JSON-stringifies
// using Baileys' BufferJSON reviver (so binary keys survive the round-trip),
// then base64-encodes and prepends the KLAUS MD: prefix.
//
// Returns null if creds are unavailable.
export async function exportSessionIdString(db, sessionDir = './session') {
    await getBaileysDeps();
    const BufferJSON = _BufferJSON;

    let creds = null;

    // 1. Try SQLite first (the primary store after a fresh local pair)
    if (db) {
        try {
            const row = _prep(db, "SELECT value FROM session_creds WHERE key = 'creds' LIMIT 1").get();
            if (row?.value) creds = JSON.parse(row.value, BufferJSON.reviver);
        } catch {}
    }

    // 2. Fall back to creds.json (used when SESSION_ID was applied from .env)
    if (!creds) {
        try {
            const credsPath = path.join(sessionDir, 'creds.json');
            if (fs.existsSync(credsPath)) {
                const raw = fs.readFileSync(credsPath, 'utf8');
                creds = JSON.parse(raw, BufferJSON.reviver);
            }
        } catch {}
    }

    if (!creds) return null;

    const json = JSON.stringify(creds, BufferJSON.replacer);
    const base64 = Buffer.from(json, 'utf8').toString('base64');
    return `KLAUS MD:${base64}`;
}

// ── Prune stale Signal session keys (unused for 30+ days) ─────────────────
// Signal pre-keys and sender-keys for contacts/groups you haven't messaged
// in a month will never be used again — safe to remove.
export function pruneStaleSessionKeys(db) {
    try {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        // Only prune pre-keys and sender-keys — never touch 'app-state-sync-*' or 'creds'
        const prunable = ['pre-key', 'sender-key', 'sender-key-memory', 'session'];
        let total = 0;
        for (const type of prunable) {
            try {
                const r = _prep(db,
                    `DELETE FROM session_keys WHERE type = ? AND updated_at < ?`
                ).run(type, cutoff);
                total += r.changes;
            } catch {}
        }
        if (total > 0) {
            console.log(`🔑 Session keys pruned: ${total} stale entries removed`);
        }
        return total;
    } catch { return 0; }
}
