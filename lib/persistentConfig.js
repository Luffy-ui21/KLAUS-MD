// ============================================================================
// lib/persistentConfig.js
// ----------------------------------------------------------------------------
// Settings-mirror layer — keeps every important JSON config file in sync with
// the persistent database (PostgreSQL via DATABASE_URL when available, else
// the local SQLite store).
//
// The bot's commands historically write their settings to a scattered set of
// JSON files inside ./data and the project root. Those files do NOT survive a
// Pterodactyl egg reinstall, a `git pull --hard`, or any container that wipes
// the working directory on update. The result: prefix resets to "?", anticall
// goes back to OFF, mode flips to public, etc.
//
// This module fixes that without touching command code:
//
//   1. On boot — walk the registry. If a file is MISSING but the database has
//      its value, write the file back from the DB. Settings re-appear instantly
//      after any wipe.
//
//   2. Every 30 s — walk the registry. If a file's mtime moved since the last
//      sync, read it and store the entire file contents under its DB key. New
//      changes get mirrored to the persistent DB automatically.
//
//   3. On graceful shutdown — flush any pending mirror writes.
//
// To add a new setting to the safety net, add an entry to REGISTRY below.
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Registry of every JSON config we want to keep persistent ────────────────
//
// Each entry is:
//   { file: relative path from project root,
//     key:  DB key (must be unique across the bot),
//     desc: human-readable label, used only in logs }
//
// Multi-key files (like anticall.json which contains many sub-settings under
// one root object) are stored as a single blob under one key — the bot reads
// the file in one go anyway, so this is lossless.
//
const REGISTRY = [
    // ── Core bot settings ────────────────────────────────────────────────
    { file: 'bot_mode.json',                                key: 'json_bot_mode',           desc: 'Bot mode'              },
    { file: 'data/prefix.json',                             key: 'json_prefix',             desc: 'Prefix'                },
    { file: 'data/footer.json',                             key: 'json_footer',             desc: 'Menu footer'           },
    { file: 'data/menuimage.json',                          key: 'json_menuimage',          desc: 'Menu image (new)'      },
    { file: 'data/menu_image.json',                         key: 'json_menu_image',         desc: 'Menu image (legacy)'   },
    { file: 'commands/menus/current_style.json',            key: 'json_menu_style',         desc: 'Menu style'            },

    // ── Automation ───────────────────────────────────────────────────────
    { file: 'data/autotyping/config.json',                  key: 'json_autotyping',         desc: 'Autotyping'            },
    { file: 'data/autorecording/config.json',               key: 'json_autorecording',      desc: 'Autorecording'         },
    { file: 'autoread_settings.json',                       key: 'json_autoread',           desc: 'Autoread'              },
    { file: 'data/autoViewConfig.json',                     key: 'json_autoview',           desc: 'Auto-view status'      },
    { file: 'data/autoDownloadStatusConfig.json',           key: 'json_autodlstatus',       desc: 'Auto-download status'  },
    { file: 'data/autoReactConfig.json',                    key: 'json_autoreact',          desc: 'Autoreact'             },
    { file: 'data/musicmode.json',                          key: 'json_musicmode',          desc: 'Music mode'            },
    { file: 'data/presence/config.json',                    key: 'json_presence',           desc: 'Online presence'       },

    // ── Protection / moderation ──────────────────────────────────────────
    { file: 'anticall.json',                                key: 'json_anticall',           desc: 'Anticall'              },
    { file: 'disp_settings.json',                           key: 'json_disp',               desc: 'Disappearing msgs'     },
    { file: 'data/antipromote/config.json',                 key: 'json_antipromote',        desc: 'Antipromote'           },
    { file: 'data/channelReactConfig.json',                 key: 'json_channelreact',       desc: 'Channel react'         },

    // ── Misc safety nets ─────────────────────────────────────────────────
    { file: 'owner.json',                                   key: 'json_owner',              desc: 'Owner record'          },
];

// ── State ────────────────────────────────────────────────────────────────────

const _lastMtime  = new Map();    // jsonPath → ms epoch of last mirrored mtime
const _lastHash   = new Map();    // jsonPath → quick content-hash to dedupe
let   _hydrated   = false;
let   _started    = false;
let   _intervalId = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function abs(file) {
    return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function tryReadFile(file) {
    try {
        const p = abs(file);
        if (!fs.existsSync(p)) return null;
        const raw = fs.readFileSync(p, 'utf8');
        if (!raw || !raw.trim()) return null;
        return raw;
    } catch {
        return null;
    }
}

function tryParseJSON(raw) {
    try { return JSON.parse(raw); } catch { return null; }
}

function quickHash(s) {
    // tiny non-crypto hash, just to detect content drift cheaply
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
}

function ensureDirFor(file) {
    try {
        const dir = path.dirname(abs(file));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
}

async function dbHas(key) {
    try {
        const v = await db.getConfig(key, null);
        return v !== null && v !== undefined;
    } catch { return false; }
}

async function dbRead(key) {
    try { return await db.getConfig(key, null); }
    catch { return null; }
}

async function dbWrite(key, value) {
    try { await db.setConfig(key, value); return true; }
    catch { return false; }
}

// ── Boot-time hydration ──────────────────────────────────────────────────────
// For every registered file: if the file is MISSING but the DB has the value,
// restore the file from the DB. This makes settings reappear after a wipe.
//
export async function hydrateAll(logger, { force = false } = {}) {
    if (_hydrated && !force) return;
    _hydrated = true;

    let restored = 0;
    let skipped  = 0;

    let pushed = 0;

    for (const { file, key, desc } of REGISTRY) {
        const fullPath = abs(file);
        const exists   = fs.existsSync(fullPath);

        if (exists) {
            // File present — make sure the DB knows about it. The local file
            // is the source of truth at boot (it's what the user/commands set
            // most recently), so push it up to the persistent DB.
            try {
                const raw = fs.readFileSync(fullPath, 'utf8');
                if (raw && raw.trim()) {
                    const parsed = tryParseJSON(raw);
                    const value  = (parsed === null) ? raw : parsed;

                    // Only push if DB doesn't already have an identical value
                    const existing = await dbRead(key);
                    const same = JSON.stringify(existing) === JSON.stringify(value);
                    if (!same) {
                        await dbWrite(key, value);
                        pushed++;
                    }
                    const stat = fs.statSync(fullPath);
                    _lastMtime.set(fullPath, stat.mtimeMs);
                    _lastHash.set(fullPath, quickHash(raw));
                }
            } catch {}
            skipped++;
            continue;
        }

        const stored = await dbRead(key);
        if (stored === null || stored === undefined) {
            skipped++;
            continue;
        }

        // Restore the file from DB
        try {
            ensureDirFor(file);
            // Stored as either an object (most cases) or a string blob
            const raw = (typeof stored === 'string')
                ? stored
                : JSON.stringify(stored, null, 2);
            fs.writeFileSync(fullPath, raw, 'utf8');

            const stat = fs.statSync(fullPath);
            _lastMtime.set(fullPath, stat.mtimeMs);
            _lastHash.set(fullPath, quickHash(raw));

            restored++;
            (logger || console.log)(`[CFG] Restored ${desc} from DB → ${file}`);
        } catch (err) {
            (logger || console.log)(`[CFG] Failed to restore ${file}: ${err.message}`);
        }
    }

    (logger || console.log)(`[CFG] Hydration done — restored ${restored}, pushed ${pushed}, intact ${skipped}`);
}

// ── Periodic mirror ──────────────────────────────────────────────────────────
// For every registered file: if the file was modified since the last sync,
// read it and write its contents under the DB key. Keeps PG up-to-date.
//
async function mirrorOnce() {
    for (const { file, key } of REGISTRY) {
        const fullPath = abs(file);
        if (!fs.existsSync(fullPath)) continue;

        let stat;
        try { stat = fs.statSync(fullPath); } catch { continue; }

        const lastSeen = _lastMtime.get(fullPath) || 0;
        if (stat.mtimeMs <= lastSeen) continue;  // unchanged since last sync

        const raw = tryReadFile(file);
        if (raw === null) continue;

        // Skip if content hash didn't actually change (defends against
        // touch-without-content-change writes).
        const h = quickHash(raw);
        if (_lastHash.get(fullPath) === h) {
            _lastMtime.set(fullPath, stat.mtimeMs);
            continue;
        }

        // Prefer parsed JSON object so PG stores typed JSONB; fall back to raw
        // string if the file isn't valid JSON for some reason.
        const parsed = tryParseJSON(raw);
        const value  = (parsed === null) ? raw : parsed;

        const ok = await dbWrite(key, value);
        if (ok) {
            _lastMtime.set(fullPath, stat.mtimeMs);
            _lastHash.set(fullPath, h);
        }
    }
}

export function startMirror(intervalMs = 30_000) {
    if (_started) return;
    _started = true;
    // Run once immediately so first-boot writes get captured fast
    setTimeout(() => { mirrorOnce().catch(() => {}); }, 5_000);
    _intervalId = setInterval(() => {
        mirrorOnce().catch(() => {});
    }, intervalMs);
    _intervalId.unref?.();
}

export async function flushMirror() {
    try { await mirrorOnce(); } catch {}
}

// Make sure pending changes hit the DB on graceful shutdown
process.on('SIGINT',  () => { flushMirror(); });
process.on('SIGTERM', () => { flushMirror(); });
process.on('beforeExit', () => { flushMirror(); });

// ── Convenience export — per-bot scoped config registry info ────────────────
export function getRegistry() {
    return REGISTRY.map(r => ({ ...r, fullPath: abs(r.file) }));
}

export default {
    hydrateAll,
    startMirror,
    flushMirror,
    getRegistry,
};
