// ── WOLFBOT MySettings persistence layer ────────────────────────────────────
// Single canonical settings file at <repo>/mysettings.json.
//
// ▸ On boot:   if mysettings.json exists, every value is restored to its
//              native location (JSON file on disk and/or SQLite config key)
//              BEFORE the rest of the bot reads its configs. The bot then
//              loads its caches normally — no other code paths change.
//
// ▸ On change: known JSON files are watched, and db.setConfig is wrapped, so
//              any update to a tracked setting triggers a debounced snapshot
//              that rewrites mysettings.json with the latest values.
//
// To add a new persisted setting, append an entry to SCHEMA below. Each entry
// supports either `file` (path inside the repo), `dbKey` (SQLite config key),
// or both — when both are present, restore writes to BOTH and snapshot reads
// the file first then falls back to the DB.
//
// mysettings.json is intentionally gitignored so that `git pull` / `update`
// can never overwrite the operator's live configuration.

import fs from 'fs';
import path from 'path';

const ROOT               = process.cwd();
const MY_SETTINGS_PATH   = path.join(ROOT, 'mysettings.json');
const SCHEMA_VERSION     = 1;
const SNAPSHOT_DEBOUNCE  = 1500;   // ms
const RESTORE_QUIET_MS   = 8000;   // suppress watcher-driven snapshots after restore

const SCHEMA = [
    // ── BOT CORE ──
    { id: 'bot_name',                file: 'bot_name.json',                               dbKey: 'bot_name' },
    { id: 'bot_mode',                file: 'bot_mode.json',                               dbKey: 'bot_mode' },
    { id: 'bot_settings',            file: 'bot_settings.json',                           dbKey: 'bot_settings' },
    { id: 'bot_language',            file: 'bot_language.json' },
    { id: 'prefix_config',           file: 'prefix_config.json',                          dbKey: 'prefix_config' },
    { id: 'prefix_data',             file: 'data/prefix.json' },
    { id: 'owner_data',              file: 'owner.json',                                  dbKey: 'owner_data' },
    { id: 'username_pref',                                                                dbKey: 'username_pref' },
    { id: 'menu_style',              file: 'commands/menus/current_style.json' },
    { id: 'menu_image',              file: 'data/menuimage.json' },
    { id: 'menu_image_legacy',       file: 'data/menu_image.json' },
    { id: 'footer_config',           file: 'data/footer.json',                            dbKey: 'footer_config' },
    { id: 'group_invite_codes',      file: 'group.json' },

    // ── ACCESS LISTS ──
    { id: 'whitelist',               file: 'whitelist.json',                              dbKey: 'whitelist' },
    { id: 'blocked_users',           file: 'blocked_users.json',                          dbKey: 'blocked_users' },
    { id: 'banned_users',                                                                 dbKey: 'banned_users' },

    // ── AUTOMATION ──
    { id: 'autoview',                file: 'data/autoViewConfig.json',                    dbKey: 'autoview_config' },
    { id: 'autoreact',               file: 'data/autoReactConfig.json',                   dbKey: 'autoreact_config' },
    { id: 'channelreact',            file: 'data/channelReactConfig.json',                dbKey: 'channelreact_config' },
    { id: 'autodownload_status',     file: 'data/autoDownloadStatusConfig.json',          dbKey: 'autodownloadstatus_config' },
    { id: 'presence',                file: 'data/presence/config.json',                   dbKey: 'presence_config' },
    { id: 'autotyping',              file: 'data/autotyping/config.json',                 dbKey: 'autotyping_config' },
    { id: 'autorecording',           file: 'data/autorecording/config.json',              dbKey: 'autorecording_config' },
    { id: 'autorecordtyping',                                                             dbKey: 'autorecordtyping_config' },
    { id: 'autoread',                file: 'autoread_settings.json',                      dbKey: 'autoread_config' },
    { id: 'member_detection',        file: 'data/member_detection.json',                  dbKey: 'member_detection' },
    { id: 'music_mode',              file: 'data/musicmode.json',                         dbKey: 'music_mode' },
    { id: 'autoreply',                                                                    dbKey: 'autoreply_config' },
    { id: 'reactowner',                                                                   dbKey: 'reactowner_config' },
    { id: 'autobio',                                                                      dbKey: 'autobio_config' },
    { id: 'autofollow_channels',     file: 'data/autofollow/extra_channels.json' },

    // ── PROTECTION (anti-*) ──
    { id: 'anticall_data',           file: 'data/anticall.json',                          dbKey: 'anticall_config' },
    { id: 'anticall_root',           file: 'anticall.json',                               dbKey: 'anticall_config_root' },
    { id: 'disp',                    file: 'disp_settings.json',                          dbKey: 'disp_config' },
    { id: 'antibot',                                                                      dbKey: 'antibot_config' },
    { id: 'antidisp',                                                                     dbKey: 'antidisp_config' },
    { id: 'antibug',                                                                      dbKey: 'antibug_config' },
    { id: 'antilink',                                                                     dbKey: 'antilink_config' },
    { id: 'antispam',                                                                     dbKey: 'antispam_config' },
    { id: 'antiforward',                                                                  dbKey: 'antiforward_config' },
    { id: 'antidelete',                                                                   dbKey: 'antidelete_settings' },
    { id: 'antidelete_status',                                                            dbKey: 'antidelete_status_settings' },
    { id: 'antiedit',                                                                     dbKey: 'antiedit_settings' },
    { id: 'antidemote',                                                                   dbKey: 'antidemote_config' },
    { id: 'antipromote_db',                                                               dbKey: 'antipromote_config' },
    { id: 'antipromote_file',        file: 'data/antipromote/config.json' },
    { id: 'antichat',                file: 'data/antichat/config.json' },
    { id: 'antiaudio',               file: 'antiaudio.json' },
    { id: 'antiimage',               file: 'antiimage.json' },
    { id: 'antivideo',               file: 'antivideo.json' },
    { id: 'antisticker',             file: 'antisticker.json' },
    { id: 'antimention',             file: 'antimention.json' },
    { id: 'antigrouplink',           file: 'antigrouplink.json' },
    { id: 'antigroupcall',           file: 'data/antigroupcall.json' },
    { id: 'antigroupstatus',         file: 'data/antigroupstatus.json' },
    { id: 'antistatusmention',       file: 'data/antistatusmention/config.json' },
    { id: 'badwords',                                                                     dbKey: 'badwords_data' },

    // ── GROUP FEATURES ──
    { id: 'welcome',                 file: 'data/welcome_data.json',                      dbKey: 'welcome_data' },
    { id: 'goodbye',                 file: 'data/goodbye_data.json',                      dbKey: 'goodbye_data' },
    { id: 'joinapproval',                                                                 dbKey: 'joinapproval_data' },

    // ── AI / CHATBOT ──
    { id: 'chatbot_settings',                                                             dbKey: 'chatbot_settings' },
    // Per-owner chatbot configs land in data/chatbot/chatbot_config_<id>.json — a
    // glob so each owner's file is captured under one key (mapping basename → contents).
    { id: 'chatbot_per_owner',       glob: 'data/chatbot/chatbot_config_*.json' },

    // ── STICKERS ──
    { id: 'sticker_config',          file: 'sticker_config.json' },
    { id: 'stickers_packs',          file: 'stickers_packs.json' },

    // ── MISC ──
    { id: 'read_receipts',                                                                dbKey: 'read_receipts_pref' },
    { id: 'timezone',                                                                     dbKey: 'timezone_config' },
    { id: 'font_config',                                                                  dbKey: 'font_config' },
    { id: 'vv_preferences',                                                               dbKey: 'vv_preferences' },
    { id: 'vv_caption_prefs',                                                             dbKey: 'vv_caption_prefs' },
    { id: 'emoji_trigger',           file: 'emoji_trigger.json' },
];

// Build a lookup of dbKey → schema-id for the setConfig wrapper.
const DB_KEY_INDEX = new Map(
    SCHEMA.filter(e => e.dbKey).map(e => [e.dbKey, e.id])
);

let _db            = null;
let _pg            = null;   // optional pg adapter for cross-restart blob storage
let _ready         = false;
let _snapshotTimer = null;
let _watchers      = [];
let _suppressUntil = 0;

// Key used to store the full mysettings.json blob in PG bot_configs.
// Scoped to bot_id so multi-bot deployments don't collide.
const PG_BLOB_KEY = '__mysettings_snapshot__';

function _now()  { return Date.now(); }
function _abs(p) { return path.join(ROOT, p); }

function _readJsonSafe(absPath) {
    try {
        if (!fs.existsSync(absPath)) return null;
        const txt = fs.readFileSync(absPath, 'utf8');
        if (!txt.trim()) return null;
        return JSON.parse(txt);
    } catch { return null; }
}

function _writeJsonSafe(absPath, value) {
    try {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, JSON.stringify(value, null, 2));
        return true;
    } catch { return false; }
}

function _isEmpty(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string' && v === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    if (typeof v === 'object' && Object.keys(v).length === 0) return true;
    return false;
}

// ── Simple glob helpers ────────────────────────────────────────────────────
// Supports a single '*' wildcard inside a basename. e.g.
//   'data/chatbot/chatbot_config_*.json'
function _parseGlob(pattern) {
    const dir   = path.dirname(pattern);
    const base  = path.basename(pattern);
    const stars = base.split('*').length - 1;
    if (stars !== 1) return null;            // contract: exactly one '*' in basename
    const star  = base.indexOf('*');
    const prefix = base.slice(0, star);
    const suffix = base.slice(star + 1);
    return { dir, prefix, suffix };
}

function _globBasenameMatch(g, name) {
    if (typeof name !== 'string' || !name) return false;
    // Reject anything that isn't a pure basename — blocks path traversal
    // when restoring keys from an untrusted mysettings.json.
    if (name.includes('/') || name.includes('\\')) return false;
    if (name === '.' || name === '..') return false;
    if (path.basename(name) !== name) return false;
    return name.startsWith(g.prefix) && name.endsWith(g.suffix)
        && name.length >= g.prefix.length + g.suffix.length;
}

function _globList(g) {
    const absDir = _abs(g.dir);
    let names = [];
    try { names = fs.readdirSync(absDir); } catch { return []; }
    return names
        .filter(n => _globBasenameMatch(g, n))
        .map(n => path.join(absDir, n));
}

// ── SNAPSHOT ───────────────────────────────────────────────────────────────
// Reads every tracked source and rewrites mysettings.json.
// If a pg adapter is available, also saves the blob to PG so it survives
// full disk wipes (Heroku, Railway, Render ephemeral filesystems).
export async function snapshotNow() {
    if (!_ready) return false;
    const out = {
        _meta: {
            version:   SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
        },
    };
    for (const entry of SCHEMA) {
        let value = null;

        if (entry.glob) {
            const g = _parseGlob(entry.glob);
            if (g) {
                const map = {};
                for (const abs of _globList(g)) {
                    const v = _readJsonSafe(abs);
                    if (!_isEmpty(v)) map[path.basename(abs)] = v;
                }
                if (!_isEmpty(map)) value = map;
            }
        } else {
            if (entry.file) {
                value = _readJsonSafe(_abs(entry.file));
            }
            if (_isEmpty(value) && entry.dbKey && _db?.getConfig) {
                try { value = await _db.getConfig(entry.dbKey, null); } catch {}
            }
        }

        if (!_isEmpty(value)) out[entry.id] = value;
    }
    const ok = _writeJsonSafe(MY_SETTINGS_PATH, out);

    // ── Mirror the full snapshot to PostgreSQL ──────────────────────────────
    // This is the only thing that truly survives an ephemeral-disk wipe.
    // We store it as a single TEXT row in bot_configs so restoreFromPg() and
    // init() can reconstruct mysettings.json before any other startup code runs.
    if (_pg?.isReady) {
        try {
            const botId = _db?.getConfigBotId?.() || 'default';
            const blob  = JSON.stringify(out);
            await _pg.query(
                `INSERT INTO bot_configs (bot_id, key, value, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (bot_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [botId, PG_BLOB_KEY, blob]
            );
        } catch { /* non-critical — SQLite is still the source of truth locally */ }
    }

    return ok;
}

function _scheduleSnapshot() {
    if (!_ready) return;
    if (_now() < _suppressUntil) return;
    if (_snapshotTimer) clearTimeout(_snapshotTimer);
    _snapshotTimer = setTimeout(() => { snapshotNow().catch(() => {}); }, SNAPSHOT_DEBOUNCE);
}

// ── RESTORE ────────────────────────────────────────────────────────────────
// Reads mysettings.json and writes every value back to its native source(s).
// File writes are synchronous; DB writes are awaited so callers can sequence
// startup work after this resolves.
export async function restoreFromMySettings() {
    const data = _readJsonSafe(MY_SETTINGS_PATH);
    if (!data || typeof data !== 'object') return { restored: 0, total: 0 };

    _suppressUntil = _now() + RESTORE_QUIET_MS;

    let restored = 0;
    for (const entry of SCHEMA) {
        const value = data[entry.id];
        if (value === undefined || value === null) continue;
        let did = false;

        if (entry.glob && value && typeof value === 'object') {
            const g = _parseGlob(entry.glob);
            if (g) {
                const absDir = _abs(g.dir);
                const dirGuard = path.resolve(absDir) + path.sep;
                try { fs.mkdirSync(absDir, { recursive: true }); } catch {}
                for (const [basename, contents] of Object.entries(value)) {
                    if (!_globBasenameMatch(g, basename)) continue;
                    const target = path.resolve(absDir, basename);
                    // Belt-and-suspenders: ensure the resolved path stays inside the glob dir.
                    if (target !== path.resolve(absDir, path.basename(basename))) continue;
                    if (!(target + path.sep).startsWith(dirGuard) && path.dirname(target) + path.sep !== dirGuard) continue;
                    if (_writeJsonSafe(target, contents)) did = true;
                }
            }
        } else {
            if (entry.file) {
                if (_writeJsonSafe(_abs(entry.file), value)) did = true;
            }
            if (entry.dbKey && _db?.setConfig) {
                try {
                    await _db.setConfig(entry.dbKey, value);
                    did = true;
                } catch {}
            }
        }

        if (did) restored++;
    }
    // Keep _suppressUntil in place a little longer so any async file-flush
    // ripples don't immediately re-trigger a snapshot.
    return { restored, total: Object.keys(data).filter(k => k !== '_meta').length };
}

// ── WATCHERS ───────────────────────────────────────────────────────────────
// fs.watch on each parent directory; matches by basename so it survives
// atomic rename-style writes (write-temp + rename).
function _setupWatchers() {
    for (const w of _watchers) { try { w.close(); } catch {} }
    _watchers = [];

    // Group entries by parent dir so we open one watcher per dir.
    //   dirs.get(dir) = { exact: Set<basename>, globs: [{prefix, suffix}, ...] }
    const dirs = new Map();
    const ensure = (dir) => {
        if (!dirs.has(dir)) dirs.set(dir, { exact: new Set(), globs: [] });
        return dirs.get(dir);
    };

    for (const entry of SCHEMA) {
        if (entry.file) {
            const abs  = _abs(entry.file);
            const dir  = path.dirname(abs);
            try { fs.mkdirSync(dir, { recursive: true }); } catch {}
            ensure(dir).exact.add(path.basename(abs));
        }
        if (entry.glob) {
            const g = _parseGlob(entry.glob);
            if (!g) continue;
            const absDir = _abs(g.dir);
            try { fs.mkdirSync(absDir, { recursive: true }); } catch {}
            ensure(absDir).globs.push({ prefix: g.prefix, suffix: g.suffix });
        }
    }

    for (const [dir, spec] of dirs) {
        try {
            const watcher = fs.watch(dir, { persistent: false }, (_event, filename) => {
                if (!filename) return;
                if (spec.exact.has(filename)) { _scheduleSnapshot(); return; }
                for (const g of spec.globs) {
                    if (_globBasenameMatch(g, filename)) { _scheduleSnapshot(); return; }
                }
            });
            watcher.on('error', () => {});
            _watchers.push(watcher);
        } catch {}
    }
}

// ── DB HOOK ────────────────────────────────────────────────────────────────
function _wrapDbSetConfig() {
    if (!_db || _db.__mySettingsWrapped) return;
    const originalAsync = typeof _db.setConfig === 'function' ? _db.setConfig.bind(_db) : null;
    const originalSync  = typeof _db.setConfigSync === 'function' ? _db.setConfigSync.bind(_db) : null;

    if (originalAsync) {
        _db.setConfig = async function (key, value) {
            const r = await originalAsync(key, value);
            if (DB_KEY_INDEX.has(key)) _scheduleSnapshot();
            return r;
        };
    }
    if (originalSync) {
        _db.setConfigSync = function (key, value) {
            const r = originalSync(key, value);
            if (DB_KEY_INDEX.has(key)) _scheduleSnapshot();
            return r;
        };
    }
    _db.__mySettingsWrapped = true;
}

// ── PUBLIC INIT ────────────────────────────────────────────────────────────
// Call once, very early — before any module reads its config.
//   await mySettings.init({ db: supabaseDb, pg: pgAdapter });
//
// Pass `pg` (the pgAdapter singleton) so that:
//   • Every snapshot is also saved as a blob to PG (survives full disk wipes).
//   • On cold start (mysettings.json missing) we attempt to fetch that blob
//     from PG and write it to disk BEFORE restoring — so file-only settings
//     (like bot_name.json) are recovered along with everything else.
export async function init({ db, pg } = {}) {
    _db    = db || null;
    _pg    = pg || null;
    _ready = true;

    // ── Cold-start recovery from PG blob ─────────────────────────────────
    // If mysettings.json was wiped (ephemeral filesystem restart) but PG is
    // available, fetch the last good snapshot and write it to disk so the
    // restore below finds it. This must happen before restoreFromMySettings().
    if (!fs.existsSync(MY_SETTINGS_PATH) && _pg?.isReady) {
        try {
            const botId = _db?.getConfigBotId?.() || 'default';
            // Try real botId first, then 'default' as fallback (handles cold starts
            // where the phone number wasn't known yet when the blob was last saved).
            let row = await _pg.query(
                `SELECT value FROM bot_configs WHERE bot_id = $1 AND key = $2 LIMIT 1`,
                [botId, PG_BLOB_KEY]
            );
            if (!row?.rows?.[0]?.value && botId !== 'default') {
                row = await _pg.query(
                    `SELECT value FROM bot_configs WHERE bot_id = $1 AND key = $2 LIMIT 1`,
                    ['default', PG_BLOB_KEY]
                );
            }
            const blob = row?.rows?.[0]?.value;
            if (blob) {
                const parsed = JSON.parse(blob);
                if (parsed && typeof parsed === 'object') {
                    _writeJsonSafe(MY_SETTINGS_PATH, parsed);
                    console.log('[MySettings] ♻️  Recovered mysettings.json from PostgreSQL blob');
                }
            }
        } catch { /* non-critical — will fall through to snapshot path below */ }
    }

    let result = { restored: 0, total: 0 };
    if (fs.existsSync(MY_SETTINGS_PATH)) {
        result = await restoreFromMySettings();
    } else {
        // First run with no prior snapshot anywhere — capture current state
        // from disk/SQLite into mysettings.json, then restore from it so that
        // PG-restored SQLite values are written back to their JSON files.
        await snapshotNow();
        if (fs.existsSync(MY_SETTINGS_PATH)) {
            result = await restoreFromMySettings();
        }
    }
    _setupWatchers();
    _wrapDbSetConfig();
    return { ...result, file: MY_SETTINGS_PATH };
}

export default { init, restoreFromMySettings, snapshotNow };
