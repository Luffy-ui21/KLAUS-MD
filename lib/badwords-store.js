import db from './database.js';

const DB_KEY = 'badwords_data';

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 1000;

function loadData() {
    const now = Date.now();
    if (_cache !== null && (now - _cacheTime) < CACHE_TTL) return _cache;
    const stored = db.getConfigSync(DB_KEY, null);

    let data;
    if (!stored || typeof stored !== 'object') {
        data = { words: {}, config: {} };
    } else if (Array.isArray(stored.words)) {
        // Migrate old flat array → scope-keyed object (old words become DM/global words)
        data = { words: { global: stored.words }, config: stored.config || {} };
        db.setConfigSync(DB_KEY, data);
    } else {
        data = { words: stored.words || {}, config: stored.config || {} };
    }

    _cache = data;
    _cacheTime = now;
    return _cache;
}

function saveData(data) {
    db.setConfigSync(DB_KEY, data);
    _cache = data;
    _cacheTime = Date.now();
}

// ─── Word management (scope-isolated) ────────────────────────────────────────

export function addBadWord(word, scope = 'global') {
    const data = loadData();
    const clean = word.toLowerCase().trim();
    if (!data.words[scope]) data.words[scope] = [];
    if (!data.words[scope].includes(clean)) {
        data.words[scope].push(clean);
        saveData(data);
        return true;
    }
    return false;
}

export function removeBadWord(word, scope = 'global') {
    const data = loadData();
    const clean = word.toLowerCase().trim();
    if (!data.words[scope]) return false;
    const idx = data.words[scope].indexOf(clean);
    if (idx !== -1) {
        data.words[scope].splice(idx, 1);
        saveData(data);
        return true;
    }
    return false;
}

// Returns words for a specific scope only
export function getBadWords(scope = 'global') {
    return loadData().words[scope] || [];
}

// Returns a summary of all scopes that have words, for owner overview
export function getAllScopedWords() {
    return loadData().words;
}

// ─── Text normalization ───────────────────────────────────────────────────────

function normalizeText(text) {
    if (!text) return '';
    return text
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u200B-\u200D\u00AD\uFEFF\u200E\u200F]/g, '')
        .replace(/[*_~`]/g, '')
        .toLowerCase();
}

// Check message against the word list for a specific scope only
export function checkMessageForBadWord(text, scope = 'global') {
    if (!text) return null;
    const normalized = normalizeText(text);
    const plain = normalized.replace(/\s+/g, ' ');
    const nospace = normalized.replace(/\s/g, '');
    const words = getBadWords(scope);
    for (const word of words) {
        if (plain.includes(word) || nospace.includes(word)) return word;
    }
    return null;
}

// ─── Enable/action config (unchanged — per-scope on/off and action) ───────────

export function isGroupEnabled(groupJid) {
    const data = loadData();
    if (groupJid === 'global') return data.config['global']?.enabled || false;
    if (data.config['global']?.enabled) return true;
    return data.config[groupJid]?.enabled !== false && (data.config[groupJid]?.enabled === true || false);
}

export function setGroupConfig(groupJid, enabled, action = 'warn') {
    const data = loadData();
    data.config[groupJid] = { enabled, action };
    saveData(data);
}

export function getGroupAction(groupJid) {
    const data = loadData();
    return data.config[groupJid]?.action || data.config['global']?.action || 'warn';
}

export function getFullConfig() {
    return loadData().config;
}
