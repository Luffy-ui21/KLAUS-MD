import fs from 'fs';
import path from 'path';

const FILE = path.resolve('./data/groupActivity/activity.json');
const DIR  = path.dirname(FILE);

let data = {};        // { groupJid: { participantJid: lastSeenTs } }
let dirty = false;
let loaded = false;

function ensureDir() {
    try { fs.mkdirSync(DIR, { recursive: true }); } catch {}
}

function load() {
    if (loaded) return;
    loaded = true;
    ensureDir();
    try {
        if (fs.existsSync(FILE)) {
            const raw = fs.readFileSync(FILE, 'utf8');
            data = JSON.parse(raw) || {};
        }
    } catch {
        data = {};
    }
}

function persist() {
    if (!dirty) return;
    dirty = false;
    ensureDir();
    try {
        fs.writeFileSync(FILE, JSON.stringify(data), 'utf8');
    } catch {}
}

// Persist every 30s if dirty (avoids constant disk writes)
setInterval(persist, 30_000).unref?.();
process.on('exit', persist);

export function recordActivity(groupJid, participantJid, ts = Date.now()) {
    if (!groupJid || !groupJid.endsWith('@g.us') || !participantJid) return;
    load();
    if (!data[groupJid]) data[groupJid] = {};
    // Always update — keep most recent
    data[groupJid][participantJid] = ts;
    dirty = true;
}

export function getGroupActivity(groupJid) {
    load();
    return data[groupJid] || {};
}

export function getLastSeen(groupJid, participantJid) {
    load();
    return data[groupJid]?.[participantJid] || 0;
}

export function pruneGroup(groupJid, keepJids) {
    load();
    if (!data[groupJid]) return;
    const keep = new Set(keepJids);
    for (const jid of Object.keys(data[groupJid])) {
        if (!keep.has(jid)) delete data[groupJid][jid];
    }
    dirty = true;
}

export function trackingStartedAt(groupJid) {
    load();
    const g = data[groupJid];
    if (!g) return 0;
    let min = Infinity;
    for (const ts of Object.values(g)) if (ts < min) min = ts;
    return min === Infinity ? 0 : min;
}
