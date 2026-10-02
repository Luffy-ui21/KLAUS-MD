// Shared per-chat game session store for WOLFBOT.
// Sessions are keyed by chatId + game type. Persisted to disk so games survive restarts.
// Debounced save coalesces rapid moves (typical in Wordle/Hangman).

import fs from 'fs';
import path from 'path';

const DATA_DIR = './data/games';
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let cache = null;
let saveTimer = null;

function load() {
    if (cache) return cache;
    try {
        if (!fs.existsSync(SESSIONS_FILE)) {
            cache = {};
            return cache;
        }
        cache = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        if (!cache || typeof cache !== 'object') cache = {};
    } catch (err) {
        console.error('[GAMES] Load error:', err.message);
        cache = {};
    }
    return cache;
}

function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(cache, null, 2));
        } catch (err) {
            console.error('[GAMES] Save error:', err.message);
        }
    }, 250);
}

function key(chatId, type) {
    return `${type}::${chatId}`;
}

export function getSession(chatId, type) {
    const db = load();
    return db[key(chatId, type)] || null;
}

export function setSession(chatId, type, data) {
    const db = load();
    db[key(chatId, type)] = { ...data, updatedAt: Date.now() };
    scheduleSave();
    return db[key(chatId, type)];
}

export function clearSession(chatId, type) {
    const db = load();
    delete db[key(chatId, type)];
    scheduleSave();
}

// Auto-expire any session older than `maxAgeMs` so abandoned games don't linger forever.
export function pruneOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
    const db = load();
    const now = Date.now();
    let pruned = 0;
    for (const k of Object.keys(db)) {
        if (db[k]?.updatedAt && now - db[k].updatedAt > maxAgeMs) {
            delete db[k];
            pruned++;
        }
    }
    if (pruned) scheduleSave();
    return pruned;
}

export function getSender(msg) {
    return msg?.key?.participant || msg?.key?.remoteJid || '';
}
