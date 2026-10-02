// ====== lib/channelMode.js ======
// Tracks whether "Channel Mode" is currently active.
//
// When Channel Mode is ON, every bot response is forwarded as a message
// from a WhatsApp Channel (newsletter JID) instead of being sent directly.
// This makes replies appear to come from the configured channel rather than
// the bot's own number — useful for broadcast-style bots.
//
// State (on/off + channel JID + channel name) is persisted in
// bot_channel_mode.json so it survives restarts.
// An in-memory cache (2 s TTL) avoids disk reads on every message.

import db from './database.js';

const DB_KEY = 'channel_mode';
const DEFAULTS = { enabled: false, channelJid: '120363426705024581@newsletter', channelName: 'WOLF TECH' };

// ── In-memory cache ────────────────────────────────────────────────────────
let _cachedData = null;
let _cacheTime = 0;
const CACHE_TTL = 2000;

function _load() {
    const now = Date.now();
    if (_cachedData !== null && (now - _cacheTime) < CACHE_TTL) return _cachedData;
    const stored = db.getConfigSync(DB_KEY, null);
    // Merge but always keep DEFAULTS.channelJid and channelName as the baseline
    // unless the user explicitly changed them via setchannel (userSetChannel flag)
    if (stored && typeof stored === 'object') {
        const channelJid = stored.userSetChannel ? stored.channelJid : DEFAULTS.channelJid;
        const channelName = stored.userSetChannel ? stored.channelName : DEFAULTS.channelName;
        _cachedData = { ...DEFAULTS, ...stored, channelJid, channelName };
    } else {
        _cachedData = { ...DEFAULTS };
    }
    _cacheTime = now;
    return _cachedData;
}

// ── Public API ─────────────────────────────────────────────────────────────

// Returns true if Channel Mode is currently active.
// Checks global.CHANNEL_MODE first (set at runtime by setChannelMode), then
// falls back to reading the JSON file.
export function isChannelModeEnabled() {
    if (global.CHANNEL_MODE === true) return true;
    return _load().enabled === true;
}

// Returns the currently configured channel's JID and display name.
// The channel JID ends in @newsletter — WhatsApp's newsletter/channel format.
export function getChannelInfo() {
    const d = _load();
    return {
        jid: d.channelJid || '120363426705024581@newsletter',
        name: d.channelName || 'WOLF TECH'
    };
}

// Enable or disable Channel Mode.
// Merges the new state with the existing data (preserving channelJid/name),
// writes to disk, and updates the cache and global flag.
export function setChannelMode(enabled, setBy = 'Unknown') {
    const existing = _load();
    const data = { ...existing, enabled, setBy, setAt: new Date().toISOString(), timestamp: Date.now() };
    db.setConfigSync(DB_KEY, data);
    global.CHANNEL_MODE = enabled;
    _cachedData = data;
    _cacheTime = Date.now();
}

export function setChannelInfo(jid, name, setBy = 'Unknown') {
    const existing = _load();
    const data = { ...existing, channelJid: jid, channelName: name, updatedBy: setBy, updatedAt: new Date().toISOString() };
    db.setConfigSync(DB_KEY, data);
    _cachedData = data;
    _cacheTime = Date.now();
}

// Invalidate the in-memory cache so the next read re-loads from disk.
export function clearChannelModeCache() {
    _cachedData = null;
    _cacheTime = 0;
}
