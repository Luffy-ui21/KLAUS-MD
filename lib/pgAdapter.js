// ====== lib/pgAdapter.js ======
// Optional PostgreSQL layer for WOLFBOT.
//
// If DATABASE_URL is set in .env, this module opens a connection pool to
// that PostgreSQL server and creates the standard bot tables.
// If DATABASE_URL is NOT set, every exported function is a safe no-op so
// the rest of the bot (which uses SQLite via database.js) is completely
// unaffected.
//
// Usage in other modules:
//   import pg from './pgAdapter.js';
//
//   if (pg.isReady) {
//       await pg.query('INSERT INTO bot_logs (event) VALUES ($1)', ['started']);
//   }
//
// Supported DATABASE_URL formats:
//   postgresql://user:password@host:5432/dbname
//   postgres://user:password@host:5432/dbname?sslmode=require   (Neon / Supabase / Railway)


// ── State ──────────────────────────────────────────────────────────────────

let pool        = null;   // pg.Pool instance, null when disabled
let _ready      = false;  // true once tables are verified
let _tableCount = 0;      // number of tables confirmed in public schema
let _lastError  = null;   // last connection error message (shown in startup banner)

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
    // ── Ensure .env is loaded ─────────────────────────────────────────────────
    // pgAdapter is a static import that evaluates before index.js's body runs.
    // On platforms like Pterodactyl where DATABASE_URL lives in a .env file
    // (rather than as a real process env var), dotenv.config() hasn't been
    // called yet when this function fires.  We call it ourselves — it's
    // idempotent so calling it twice is completely safe.
    try {
        const _dotenv = (await import('dotenv')).default ?? (await import('dotenv'));
        const path    = (await import('path')).default ?? (await import('path'));
        const fs      = (await import('fs')).default ?? (await import('fs'));
        // Try common .env locations
        const envCandidates = ['.env', '../.env'].map(p => path.resolve(p));
        for (const ep of envCandidates) {
            if (fs.existsSync(ep)) { _dotenv.config({ path: ep }); break; }
        }
        _dotenv.config(); // fallback: let dotenv scan default location
    } catch {}

    const url = process.env.DATABASE_URL;
    // No DATABASE_URL — PostgreSQL is fully optional, run silently on SQLite only
    if (!url) return;

    // ── Load pg via dynamic import (ESM-native, works on all platforms) ──────
    let Pool;
    try {
        // pg is a CommonJS package; dynamic import wraps it — .default holds the module exports
        const pgMod = await import('pg');
        Pool = pgMod.default?.Pool ?? pgMod.Pool;
        if (!Pool) throw new Error('Pool constructor not found in pg module');
    } catch (_firstErr) {
        // pg not found in this environment — try to install it once at runtime.
        // This handles platforms (Railway, Koyeb, Render) that cache node_modules
        // from an earlier build before pg was added to package.json.
        console.log('[PG] pg not found — attempting runtime install ...');
        try {
            const { execSync } = await import('child_process');
            const path         = await import('path');
            const fs           = await import('fs');

            // Build a list of npm candidates to try in order:
            //   1. next to the node binary (most reliable on any platform)
            //   2. common unix system paths
            //   3. bare "npm" (relies on PATH — last resort)
            const nodeDir = path.dirname(process.execPath);
            const npmCandidates = [
                path.join(nodeDir, 'npm'),
                path.join(nodeDir, 'npm.cmd'),         // Windows
                '/usr/local/bin/npm',
                '/usr/bin/npm',
                '/app/.heroku/node/bin/npm',            // Heroku buildpack path
                'npm',                                  // system PATH fallback
            ];

            let installed = false;
            for (const npmBin of npmCandidates) {
                // Skip absolute paths that don't exist (saves spawning failed processes)
                if (npmBin !== 'npm' && !fs.existsSync(npmBin)) continue;

                console.log(`[PG] trying: ${npmBin}`);
                try {
                    execSync(`"${npmBin}" install pg --no-save --legacy-peer-deps`, {
                        stdio: 'inherit',
                        timeout: 90_000,
                    });
                    installed = true;
                    break;
                } catch (_e) {
                    console.log(`[PG] failed with: ${npmBin}`);
                }
            }

            if (!installed) throw new Error('no working npm found — add pg manually');

            const pgMod = await import('pg');
            Pool = pgMod.default?.Pool ?? pgMod.Pool;
            if (!Pool) throw new Error('Pool not found after install');
            console.log('[PG] pg installed successfully — proceeding with connection');
        } catch (installErr) {
            const reason = (installErr.message || String(installErr)).split('\n')[0].trim();
            _lastError = `pg unavailable · add "pg" to package.json`;
            console.log(`[PG] Runtime install failed: ${reason}`);
            console.log('[PG] Fix: ensure "pg" is in your package.json dependencies and redeploy');
            console.log('[PG] Falling back to SQLite only');
            return;
        }
    }

    // Build a list of connection configs to try in order.
    // Some platforms (Render, Railway, Koyeb) embed a role in DATABASE_URL
    // that lacks LOGIN privilege, but also expose individual PG* env vars
    // with the correct credentials. We try both.
    const explicitNoSsl = url.includes('sslmode=disable');

    // Pterodactyl / self-hosted setups almost always run Postgres on localhost
    // without TLS.  Detect this so we try no-SSL first instead of last.
    let urlHost = '';
    try { urlHost = new URL(url.replace(/^postgres:\/\//, 'postgresql://')).hostname; } catch {}
    const isLocalhost = /^(localhost|127\.|::1|0\.0\.0\.0)/.test(urlHost);

    const sslForUrl = explicitNoSsl ? false : { rejectUnauthorized: false };

    const configs = [];

    // On localhost (Pterodactyl / self-hosted): no-SSL first, then SSL fallback.
    // On cloud (Neon / Supabase / Heroku): SSL first, no-SSL fallback.
    if (isLocalhost || explicitNoSsl) {
        configs.push({ connectionString: url, ssl: false,        max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
        if (!explicitNoSsl)
        configs.push({ connectionString: url, ssl: sslForUrl,    max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
    } else {
        // 1. Honour DATABASE_URL as-is (Heroku, Neon, Supabase, Railway standard)
        configs.push({ connectionString: url, ssl: sslForUrl,    max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
        // 3. Try the URL again without SSL (some self-hosted / local pg setups)
        configs.push({ connectionString: url, ssl: false,        max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
    }

    // 2. If individual PG* vars exist, try them (Render sets PGUSER/PGPASSWORD
    //    separately with the correct LOGIN role even when DATABASE_URL role differs)
    if (process.env.PGHOST || process.env.PGUSER) {
        configs.push({
            host:     process.env.PGHOST,
            port:     parseInt(process.env.PGPORT || '5432', 10),
            database: process.env.PGDATABASE,
            user:     process.env.PGUSER,
            password: process.env.PGPASSWORD,
            ssl: { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
        });
    }

    let lastErr = null;
    for (const cfg of configs) {
        try {
            const candidate = new Pool(cfg);
            const client = await candidate.connect();
            client.release();

            pool = candidate;
            await createTables();
            _ready = true;
            console.log('[PG] ✅ PostgreSQL connected and tables verified');
            return; // success — stop trying
        } catch (err) {
            lastErr = err;
            const msg = (err.message || '').toLowerCase();
            // Give a precise diagnosis for the most common failure modes
            if (msg.includes('not permitted to log in')) {
                // Extract the role name from the error for a clear diagnostic
                const roleMatch = err.message.match(/role "([^"]+)"/);
                const role = roleMatch ? roleMatch[1] : 'unknown';
                console.log(`[PG] ❌ Role "${role}" cannot log in.`);
                console.log(`[PG]    ➜ Your DATABASE_URL contains user "${role}" but that role has no LOGIN privilege on the server.`);
                console.log(`[PG]    ➜ Fix: use the "App" or "Internal" database URL your platform provides, not the owner/admin URL.`);
            } else if (msg.includes('not permitted') || msg.includes('password') || msg.includes('auth')) {
                console.log(`[PG] ⚠️  Auth failed (${err.message.split('\n')[0].trim()}) — trying next config`);
            }
        }
    }

    // All configs exhausted
    const rawMsg    = (lastErr?.message || String(lastErr));
    const firstLine = rawMsg.split('\n')[0].trim();
    _lastError = firstLine;
    console.log(`[PG] ❌ PostgreSQL connection failed: ${firstLine}`);
    console.log('[PG] Falling back to SQLite only');
    pool   = null;
    _ready = false;
}

// ── Table setup ────────────────────────────────────────────────────────────

async function createTables() {
    const ddl = `
        -- Bot-wide settings (mirrors SQLite bot_configs)
        CREATE TABLE IF NOT EXISTS bot_configs (
            bot_id      TEXT    NOT NULL,
            key         TEXT    NOT NULL,
            value       TEXT,
            updated_at  TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (bot_id, key)
        );

        -- Sudo (trusted admin) users
        CREATE TABLE IF NOT EXISTS sudoers (
            bot_id      TEXT    NOT NULL,
            phone       TEXT    NOT NULL,
            added_at    TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (bot_id, phone)
        );

        -- Per-user warnings
        CREATE TABLE IF NOT EXISTS warnings (
            bot_id      TEXT    NOT NULL,
            chat_id     TEXT    NOT NULL,
            phone       TEXT    NOT NULL,
            count       INTEGER NOT NULL DEFAULT 0,
            updated_at  TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (bot_id, chat_id, phone)
        );

        -- Group-level feature flags (antilink, antidelete, etc.)
        CREATE TABLE IF NOT EXISTS group_features (
            bot_id      TEXT    NOT NULL,
            chat_id     TEXT    NOT NULL,
            feature     TEXT    NOT NULL,
            enabled     BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at  TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (bot_id, chat_id, feature)
        );

        -- LID → phone number mapping
        CREATE TABLE IF NOT EXISTS lid_map (
            lid         TEXT PRIMARY KEY,
            phone       TEXT NOT NULL,
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        );

        -- General event / audit log
        CREATE TABLE IF NOT EXISTS bot_logs (
            id          BIGSERIAL PRIMARY KEY,
            bot_id      TEXT,
            event       TEXT        NOT NULL,
            detail      TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        );
    `;

    await pool.query(ddl);

    // Confirm which tables were created — expose count for startup block
    const check = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const names = check.rows.map(r => r.tablename).join(', ');
    _tableCount = check.rows.length;
    console.log(`[PG] 🗄️  Tables in DB: ${names || '(none — check Neon branch)'}`);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run a parameterised query against PostgreSQL.
 * Returns null (not an error) when PostgreSQL is disabled.
 *
 * @param {string} text   - SQL query with $1 … $N placeholders
 * @param {any[]}  params - parameter values
 * @returns {Promise<import('pg').QueryResult | null>}
 */
async function query(text, params = []) {
    if (!pool || !_ready) return null;
    try {
        return await pool.query(text, params);
    } catch (err) {
        console.log(`[PG] Query error: ${err.message}\n  SQL: ${text}`);
        return null;
    }
}

/**
 * Acquire a raw pg client for multi-statement transactions.
 * Always call client.release() when done.
 * Returns null when PostgreSQL is disabled.
 *
 * @returns {Promise<import('pg').PoolClient | null>}
 */
async function getClient() {
    if (!pool || !_ready) return null;
    try {
        return await pool.connect();
    } catch (err) {
        console.log(`[PG] getClient error: ${err.message}`);
        return null;
    }
}

/**
 * Gracefully close the connection pool.
 * Called on process exit.
 */
async function close() {
    if (pool) {
        await pool.end().catch(() => {});
        pool   = null;
        _ready = false;
    }
}

// ── Start ──────────────────────────────────────────────────────────────────

// Boot immediately — module is loaded once at startup
init().catch(() => {});

// Clean shutdown
process.on('exit',    () => { close(); });
process.on('SIGTERM', () => { close(); });

// ── waitForReady ────────────────────────────────────────────────────────────

/**
 * Wait until PostgreSQL is connected and tables are ready, or until the
 * timeout elapses.  Used at startup so restoreFromPg() can safely run after
 * pg.init() (which is fire-and-forget) finishes its async work.
 *
 * @param {number} timeoutMs - Max ms to wait (default 12 000)
 * @returns {Promise<boolean>} true if pg became ready within the timeout
 */
async function waitForReady(timeoutMs = 12000) {
    if (_ready) return true;
    const deadline = Date.now() + timeoutMs;
    while (!_ready && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 350));
    }
    return _ready;
}

// ── Exports ────────────────────────────────────────────────────────────────

export default {
    /** true only after a successful connection + table setup */
    get isReady() { return _ready; },

    /** Number of tables confirmed in the public schema at startup */
    get tableCount() { return _tableCount; },

    /** Last connection error message, null if never failed */
    get lastError() { return _lastError; },

    /** Run a parameterised SQL query. Returns null if PG is disabled. */
    query,

    /** Get a raw pool client for transactions. Returns null if PG is disabled. */
    getClient,

    /** Close the pool gracefully */
    close,

    /**
     * Block until pg is ready (or timeout).
     * Useful at startup before attempting restoreFromPg().
     */
    waitForReady,

    /** The raw pg Pool — use only if you need low-level access */
    get pool() { return pool; },
};
