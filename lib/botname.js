// ====== lib/botname.js ======
// Manages the bot's display name (e.g. "WOLFBOT").
// The name is read from bot_name.json, then environment variable BOT_NAME,
// then finally defaults to "WOLFBOT". A short 5-second in-memory cache
// avoids re-reading the file on every message.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Resolve the path to the project root regardless of where Node was launched
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Write (or update) a single key=value line in .env.
// .env is in .gitignore so git pull / reinstalls never touch it —
// making this the most resilient storage layer for Pterodactyl servers.
function _writeToEnv(key, value) {
    try {
        const envPath = join(PROJECT_ROOT, '.env');
        let content = '';
        try { content = readFileSync(envPath, 'utf8'); } catch {}
        const line = `${key}=${value}`;
        const regex = new RegExp(`^${key}=.*$`, 'm');
        content = regex.test(content)
            ? content.replace(regex, line)
            : content.trimEnd() + '\n' + line + '\n';
        writeFileSync(envPath, content, 'utf8');
        process.env[key] = String(value);
    } catch { /* silent — non-critical */ }
}

// Path where the name is persisted so it survives bot restarts
const BOT_NAME_FILE = join(PROJECT_ROOT, 'bot_name.json');

// Fallback when no name has been set anywhere
const DEFAULT_NAME = 'WOLFBOT';

// ── In-memory cache ───────────────────────────────────────────────────────
// Prevents re-reading the file on every single message — the file only
// changes when the owner runs ?setbotname, so 5 s is more than enough.
let _cachedName = null;
let _cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

// ── Private helpers ────────────────────────────────────────────────────────

// Read bot_name.json and return the name string, or null if missing/corrupt.
export function readBotNameFile() {
    try {
        if (existsSync(BOT_NAME_FILE)) {
            const data = JSON.parse(readFileSync(BOT_NAME_FILE, 'utf8'));
            if (data.botName && data.botName.trim()) {
                return data.botName.trim();
            }
        }
    } catch {}
    return null;
}

// Write a new name to bot_name.json (atomic write via overwrite).
// Returns true on success, false if the file system denied the write.
export function writeBotNameFile(name) {
    try {
        writeFileSync(BOT_NAME_FILE, JSON.stringify({ botName: name, updatedAt: new Date().toISOString() }, null, 2));
        return true;
    } catch (err) {
        console.warn('⚠️ Could not save bot name to file:', err.message);
        return false;
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

// Return the current bot name.  Priority:
//   1. In-memory cache (fastest — no I/O)
//   2. bot_name.json file
//   3. BOT_NAME environment variable
//   4. Hard-coded default "WOLFBOT"
// Also sets global.BOT_NAME so the rest of the code can just read `BOT_NAME`.
export function getBotName() {
    const now = Date.now();

    // Return cached value if it is still fresh
    if (_cachedName && (now - _cacheTime) < CACHE_TTL) {
        return _cachedName;
    }

    // Try the JSON file first
    const fromFile = readBotNameFile();
    if (fromFile) {
        _cachedName = fromFile;
        _cacheTime = now;
        global.BOT_NAME = fromFile;
        return _cachedName;
    }

    // Fall back to the environment variable (useful in hosted environments)
    if (process.env.BOT_NAME && process.env.BOT_NAME.trim()) {
        const envName = process.env.BOT_NAME.trim();
        _cachedName = envName;
        _cacheTime = now;
        global.BOT_NAME = envName;
        // Persist it so subsequent starts don't need the env var
        writeBotNameFile(envName);
        return _cachedName;
    }

    // Last resort: use the hard-coded default and persist it for next time
    _cachedName = DEFAULT_NAME;
    _cacheTime = now;
    global.BOT_NAME = DEFAULT_NAME;
    writeBotNameFile(DEFAULT_NAME);
    return _cachedName;
}

// Invalidate the cache so the next call to getBotName() re-reads the file.
// Called automatically after saveBotName() so the change is visible immediately.
export function clearBotNameCache() {
    _cachedName = null;
    _cacheTime = 0;
}

// Persist a new bot name and update the cache + global in one call.
// Used by the ?setbotname command.
export function saveBotName(name) {
    writeBotNameFile(name);
    global.BOT_NAME = name;
    _cachedName = name;
    _cacheTime = Date.now();
    // Write to .env so the name survives Pterodactyl reinstalls.
    // getBotName() already reads BOT_NAME from env as fallback #3, so on the
    // next start the name is available even before bot_name.json is written.
    _writeToEnv('BOT_NAME', name);
    return true;
}

// Called once at startup to ensure global.BOT_NAME is set before any
// command handler or message handler reads it.
export function loadBotName() {
    const name = readBotNameFile();
    if (name) {
        global.BOT_NAME = name;
        _cachedName = name;
        _cacheTime = Date.now();
        return name;
    }

    // No file yet — initialise from env var or default and write the file
    const fallback = (process.env.BOT_NAME && process.env.BOT_NAME.trim()) || DEFAULT_NAME;
    global.BOT_NAME = fallback;
    _cachedName = fallback;
    _cacheTime = Date.now();
    writeBotNameFile(fallback);
    console.log(`✅ Bot name initialized: "${fallback}" (saved to bot_name.json)`);
    return fallback;
}
