const sessions = new Map();
const TTL = 5 * 60 * 1000;
const SWEEP_INTERVAL = 60 * 1000;

export function setActionSession(key, data) {
    sessions.set(key, { ...data, ts: Date.now() });
}

export function getActionSession(key) {
    const s = sessions.get(key);
    if (!s) return null;
    if (Date.now() - s.ts > TTL) { sessions.delete(key); return null; }
    return s;
}

export function deleteActionSession(key) {
    sessions.delete(key);
}

// Active sweeper — without this, sessions never read again would linger in memory
// (lazy expiration only). Runs every 60s and is unref'd so it doesn't block exit.
const _sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of sessions) {
        if (now - v.ts > TTL) sessions.delete(k);
    }
}, SWEEP_INTERVAL);
if (typeof _sweeper.unref === 'function') _sweeper.unref();
