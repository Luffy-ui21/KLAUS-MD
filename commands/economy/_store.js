// Shared economy store for WOLFBOT.
// Persists user balances, jobs, streaks and cooldowns to ./data/economy/users.json.
// Per-user record lives under a single key (clean phone number, no suffix) so the
// same wallet works across DM and groups. Group-scoped data (e.g. leaderboards)
// can read the same file and filter by membership at call site.

import fs from 'fs';
import path from 'path';

const DATA_DIR = './data/economy';
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let cache = null;
let saveTimer = null;

function load() {
    if (cache) return cache;
    try {
        if (!fs.existsSync(USERS_FILE)) {
            cache = { users: {} };
            return cache;
        }
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        cache = parsed && typeof parsed === 'object' && parsed.users ? parsed : { users: {} };
        return cache;
    } catch (err) {
        console.error('[ECONOMY] Load error:', err.message);
        cache = { users: {} };
        return cache;
    }
}

function scheduleSave() {
    if (saveTimer) return;
    // Debounce — many commands may write within the same tick (e.g. work + level up).
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(cache, null, 2));
        } catch (err) {
            console.error('[ECONOMY] Save error:', err.message);
        }
    }, 200);
}

export function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(cache || { users: {} }, null, 2));
    } catch (err) {
        console.error('[ECONOMY] Save error:', err.message);
    }
}

// Strip device suffix (":12") and trailing "@…" so all callers reference the same wallet.
export function cleanId(jid) {
    if (!jid) return '';
    return String(jid).split('@')[0].split(':')[0];
}

function defaultUser() {
    return {
        wallet: 0,
        bank: 0,
        bankCap: 5000,
        xp: 0,
        level: 1,
        job: null,
        streak: 0,
        lastDaily: 0,
        lastWork: 0,
        lastRob: 0,
        wins: 0,
        losses: 0,
        createdAt: Date.now()
    };
}

export function getUser(jid) {
    const id = cleanId(jid);
    const db = load();
    if (!db.users[id]) {
        db.users[id] = defaultUser();
        scheduleSave();
    } else {
        // Forward-compat: backfill any new fields added after the user's record was created.
        const proto = defaultUser();
        for (const k of Object.keys(proto)) {
            if (!(k in db.users[id])) db.users[id][k] = proto[k];
        }
    }
    return db.users[id];
}

export function updateUser(jid, patchFn) {
    const user = getUser(jid);
    patchFn(user);
    addXpInternal(user);
    scheduleSave();
    return user;
}

// Each economic action grants a small XP nudge so levels rise organically.
// Level curve: 100 * level XP needed → 1, 200, 300, ... linear & predictable.
function addXpInternal(user) {
    while (user.xp >= 100 * user.level) {
        user.xp -= 100 * user.level;
        user.level += 1;
        user.bankCap += 1000; // bigger vault as you level
    }
}

export function addXp(jid, amount) {
    const user = getUser(jid);
    user.xp += Math.max(0, Math.floor(amount));
    addXpInternal(user);
    scheduleSave();
    return user;
}

export function getAllUsers() {
    return load().users;
}

// Format coins with thousands separator. Currency emoji is fixed across the bot.
export const COIN = '🪙';
export function fmt(n) {
    return Number(n || 0).toLocaleString('en-US');
}

// Parse "1000", "1k", "all", "half" against a max balance.
export function parseAmount(input, maxAvail) {
    if (input === undefined || input === null) return NaN;
    const s = String(input).trim().toLowerCase();
    if (!s) return NaN;
    if (s === 'all' || s === 'max') return maxAvail;
    if (s === 'half') return Math.floor(maxAvail / 2);
    const m = s.match(/^([\d.]+)\s*([kmb]?)$/);
    if (!m) return NaN;
    const base = parseFloat(m[1]);
    if (!isFinite(base)) return NaN;
    const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
    return Math.floor(base * mult);
}

// Pretty-print remaining cooldown, e.g. "2h 14m 03s".
export function formatCooldown(ms) {
    if (ms <= 0) return '0s';
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m || h) parts.push(`${m}m`);
    parts.push(`${String(s).padStart(2, '0')}s`);
    return parts.join(' ');
}

// Resolve sender JID exactly the way other commands do (DM vs group).
export function getSender(msg) {
    return msg?.key?.participant || msg?.key?.remoteJid || '';
}

// Resolve a mentioned/replied target user — returns clean id or null.
export function getMentionTarget(msg) {
    const ctx = msg?.message?.extendedTextMessage?.contextInfo;
    const mentioned = ctx?.mentionedJid?.[0];
    if (mentioned) return cleanId(mentioned);
    const replied = ctx?.participant;
    if (replied) return cleanId(replied);
    return null;
}
