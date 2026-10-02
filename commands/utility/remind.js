// commands/utility/remind.js
import supabase from '../../lib/database.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const CONFIG_KEY = 'reminders_config';

// ── Persistent store ─────────────────────────────────────────────────────────
function loadData() {
    try {
        const d = supabase.getConfigSync(CONFIG_KEY, {});
        return {
            reminders:  Array.isArray(d.reminders)  ? d.reminders  : [],
            utcOffset:  typeof d.utcOffset === 'number' ? d.utcOffset : 1,
            nextId:     typeof d.nextId    === 'number' ? d.nextId    : 1
        };
    } catch { return { reminders: [], utcOffset: 1, nextId: 1 }; }
}

function saveData(data) {
    supabase.setConfig(CONFIG_KEY, data).catch(() => {});
}

// ── Time helpers ─────────────────────────────────────────────────────────────

// Wall clock "now" expressed as a Date where .getUTC* gives wall-clock values
function wallNow(utcOffset) {
    return new Date(Date.now() + utcOffset * 3600000);
}

// Convert a wall-clock HH:MM (on today + addDays in the owner's timezone) to real UTC ms.
// Correct approach: build the wall time as if it were UTC, then subtract the offset.
function wallClockToUtcMs(hh, mm, utcOffset, addDays = 0) {
    const wn = wallNow(utcOffset);
    // Midnight of the target wall-clock day, expressed as a UTC timestamp
    const midnight = Date.UTC(wn.getUTCFullYear(), wn.getUTCMonth(), wn.getUTCDate() + addDays);
    // Add target HH:MM in ms (still in wall-clock space), then subtract offset to get real UTC
    return midnight + hh * 3600000 + mm * 60000 - utcOffset * 3600000;
}

// Current wall-clock time as "HH:MM" string
function wallTimeStr(utcOffset) {
    const wn = wallNow(utcOffset);
    return `${String(wn.getUTCHours()).padStart(2,'0')}:${String(wn.getUTCMinutes()).padStart(2,'0')}`;
}

// ── Time parser helpers ───────────────────────────────────────────────────────
function _relative(raw, fullMatch, ms) {
    const fireAt  = Date.now() + ms;
    const totalM  = Math.round(ms / 60000);
    const h = Math.floor(totalM / 60), m = totalM % 60;
    const label   = h > 0 ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${totalM} min`;
    return { fireAt, label, remainder: raw.slice(fullMatch.length).trim() };
}

function _absolute(raw, fullMatch, hh, mm, utcOffset) {
    let fireAt = wallClockToUtcMs(hh, mm, utcOffset, 0);
    if (fireAt <= Date.now() + 30000) fireAt = wallClockToUtcMs(hh, mm, utcOffset, 1);
    const wall = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    return { fireAt, label: `at ${wall}`, remainder: raw.slice(fullMatch.length).trim() };
}

// ── Natural language time parser ─────────────────────────────────────────────
// Supports:
//   in 30 minutes / in 30 mins / in 30m
//   in 2 hours / in 2 hrs / in 2h
//   in 2 hours 30 minutes / in 2h 30m
//   tomorrow at 8am / tomorrow at 08:30
//   at 10pm / at 10:00 pm / at 10:00pm
//   10pm / 10:30pm / 10:30 pm
//   at 22:00 / at 9:30 / at 9          ← 24h with "at"
//   22:00 / 09:30                       ← bare 24h HH:MM
function parseTime(text, utcOffset) {
    const raw = text.trim();
    let m;

    // "in X hours and Y minutes" / "in 2h 30m"
    m = raw.match(/^in\s+(\d+)\s*(?:hours?|hrs?|h)\s*(?:and\s+)?(\d+)\s*(?:minutes?|mins?|m)\b/i);
    if (m) return _relative(raw, m[0], parseInt(m[1]) * 3600000 + parseInt(m[2]) * 60000);

    // "in X hours"
    m = raw.match(/^in\s+(\d+)\s*(?:hours?|hrs?|h)\b/i);
    if (m) return _relative(raw, m[0], parseInt(m[1]) * 3600000);

    // "in X minutes"
    m = raw.match(/^in\s+(\d+)\s*(?:minutes?|mins?|m)\b/i);
    if (m) return _relative(raw, m[0], parseInt(m[1]) * 60000);

    // "tomorrow at HH:MM [am/pm]" / "tomorrow at 8am"
    m = raw.match(/^tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (m) {
        let hh = parseInt(m[1]), mm = parseInt(m[2] || '0');
        const ap = (m[3] || '').toLowerCase();
        if (ap === 'pm' && hh < 12) hh += 12;
        if (ap === 'am' && hh === 12) hh = 0;
        const fireAt = wallClockToUtcMs(hh, mm, utcOffset, 1);
        const wall   = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
        return { fireAt, label: `tomorrow at ${wall}`, remainder: raw.slice(m[0].length).trim() };
    }

    // 12-hour clock (with optional "at"): "at 10:30 pm", "10pm", "10:30pm", "10:30 pm"
    m = raw.match(/^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (m) {
        let hh = parseInt(m[1]), mm = parseInt(m[2] || '0');
        const ap = m[3].toLowerCase();
        if (ap === 'pm' && hh < 12) hh += 12;
        if (ap === 'am' && hh === 12) hh = 0;
        return _absolute(raw, m[0], hh, mm, utcOffset);
    }

    // 24-hour clock with "at": "at 22:00", "at 9:30", "at 9"
    m = raw.match(/^at\s+(\d{1,2})(?::(\d{2}))?\b/i);
    if (m) {
        const hh = parseInt(m[1]), mm = parseInt(m[2] || '0');
        if (hh > 23 || mm > 59) return null;
        return _absolute(raw, m[0], hh, mm, utcOffset);
    }

    // Bare 24-hour clock: "22:00 Message", "09:30 Call boss"
    m = raw.match(/^(\d{1,2}):(\d{2})\b/);
    if (m) {
        const hh = parseInt(m[1]), mm = parseInt(m[2]);
        if (hh > 23 || mm > 59) return null;
        return _absolute(raw, m[0], hh, mm, utcOffset);
    }

    return null;
}

// ── Formatter ────────────────────────────────────────────────────────────────
function formatFireAt(ms, utcOffset) {
    const d = new Date(ms + utcOffset * 3600000);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const today = nowInOffset(utcOffset);
    const isTomorrow = d.getUTCDate() !== today.getUTCDate();
    return isTomorrow ? `tomorrow ${hh}:${mm}` : `${hh}:${mm}`;
}

function msUntil(ms) {
    const diff = ms - Date.now();
    if (diff <= 0) return 'now';
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim();
    return `${m} min`;
}

// ── In-process scheduler ─────────────────────────────────────────────────────
let _sock    = null;
let _interval = null;

export function startReminderScheduler(sock) {
    _sock = sock;
    if (_interval) return;
    _interval = setInterval(_tick, 30000);
}

export function updateReminderSock(sock) {
    _sock = sock;
}

async function _tick() {
    if (!_sock) return;
    const data = loadData();
    if (!data.reminders.length) return;

    const now    = Date.now();
    const fired  = [];
    const pending = [];

    for (const r of data.reminders) {
        if (r.fireAt <= now) {
            fired.push(r);
        } else {
            pending.push(r);
        }
    }

    if (!fired.length) return;

    data.reminders = pending;
    saveData(data);

    for (const r of fired) {
        try {
            const text =
                `╭─⌈ ⏰ *REMINDER* ⌋\n│\n` +
                `│ 📝 ${r.text}\n│\n` +
                `╰⊷ *${getOwnerName().toUpperCase()} TECH*`;
            await _sock.sendMessage(r.chatId, { text });
        } catch {}
    }
}

// ── Command ──────────────────────────────────────────────────────────────────
export default {
    name:      'remind',
    alias:     ['rem', 'reminder', 'remindme'],
    desc:      'Set a personal reminder — fires at the specified time',
    category:  'utility',
    ownerOnly: false,

    async execute(sock, msg, args, prefix, extras) {
        const chatId = msg.key.remoteJid;
        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        const sub = (args[0] || '').toLowerCase();

        // ── list ──────────────────────────────────────────────────────────────
        if (sub === 'list' || sub === 'ls') {
            const data = loadData();
            if (!data.reminders.length) return reply(`📭 *No pending reminders.*\n\nSet one: *${prefix}rem at 10:00 pm Your message*`);
            let text = `╭─⌈ ⏰ *PENDING REMINDERS* ⌋\n│\n`;
            data.reminders.forEach((r, i) => {
                const timeStr = formatFireAt(r.fireAt, data.utcOffset);
                const left    = msUntil(r.fireAt);
                text += `│ *${i + 1}.* ${r.text}\n│    🕐 ${timeStr}  (in ${left})\n│\n`;
            });
            text += `╰⊷ Cancel: *${prefix}rem cancel <number>*`;
            return reply(text);
        }

        // ── cancel ────────────────────────────────────────────────────────────
        if (sub === 'cancel' || sub === 'delete' || sub === 'del') {
            const idx = parseInt(args[1]) - 1;
            const data = loadData();
            if (isNaN(idx) || idx < 0 || idx >= data.reminders.length)
                return reply(`❌ Invalid number. Use *${prefix}rem list* to see your reminders.`);
            const removed = data.reminders.splice(idx, 1)[0];
            saveData(data);
            return reply(`🗑️ Cancelled: *${removed.text}*`);
        }

        // ── clear ─────────────────────────────────────────────────────────────
        if (sub === 'clear' || sub === 'reset') {
            const data = loadData();
            const count = data.reminders.length;
            data.reminders = [];
            saveData(data);
            return reply(`🗑️ Cleared *${count}* reminder(s).`);
        }

        // ── timezone ──────────────────────────────────────────────────────────
        if (sub === 'timezone' || sub === 'tz') {
            const raw = args[1] || '';
            const offset = parseFloat(raw.replace(/^UTC/i, ''));
            if (isNaN(offset) || offset < -12 || offset > 14)
                return reply(`❌ Usage: *${prefix}rem timezone +1*\nPass your UTC offset, e.g. +1 for WAT, +3 for EAT, +0 for GMT.`);
            const data = loadData();
            data.utcOffset = offset;
            saveData(data);
            return reply(`✅ Timezone set to *UTC${offset >= 0 ? '+' : ''}${offset}*`);
        }

        // ── help ──────────────────────────────────────────────────────────────
        if (!args.length || sub === 'help') {
            const data = loadData();
            const count = data.reminders.length;
            return reply(
                `╭─⌈ ⏰ *REMINDER* ⌋\n│\n` +
                `│ Pending : ${count}\n` +
                `│ Timezone: UTC${data.utcOffset >= 0 ? '+' : ''}${data.utcOffset}\n│\n` +
                `├─⊷ *${prefix}rem at 10:00 pm Watching a movie*\n│  └⊷ Remind at a specific time\n` +
                `├─⊷ *${prefix}rem in 30 minutes Call boss*\n│  └⊷ Remind after X minutes\n` +
                `├─⊷ *${prefix}rem in 2 hours Gym time*\n│  └⊷ Remind after X hours\n` +
                `├─⊷ *${prefix}rem tomorrow at 8am Gym*\n│  └⊷ Remind tomorrow\n` +
                `├─⊷ *${prefix}rem list*\n│  └⊷ Show all pending reminders\n` +
                `├─⊷ *${prefix}rem cancel 1*\n│  └⊷ Cancel reminder by number\n` +
                `├─⊷ *${prefix}rem clear*\n│  └⊷ Clear all reminders\n` +
                `├─⊷ *${prefix}rem timezone +1*\n│  └⊷ Set your UTC offset (current: UTC${data.utcOffset >= 0 ? '+' : ''}${data.utcOffset})\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        // ── set reminder ──────────────────────────────────────────────────────
        const fullText = args.join(' ');
        const data = loadData();
        const parsed = parseTime(fullText, data.utcOffset);

        if (!parsed) {
            return reply(
                `❌ Couldn't understand the time.\n\n` +
                `*Examples:*\n` +
                `• *${prefix}rem at 10:00 pm I will be watching*\n` +
                `• *${prefix}rem in 30 minutes Call boss*\n` +
                `• *${prefix}rem in 2 hours Meeting*\n` +
                `• *${prefix}rem tomorrow at 8am Gym*`
            );
        }

        const reminderText = parsed.remainder || '(no message)';
        const id = data.nextId++;
        data.reminders.push({
            id,
            text:      reminderText,
            fireAt:    parsed.fireAt,
            chatId:    chatId,
            createdAt: Date.now()
        });
        saveData(data);

        const timeStr  = formatFireAt(parsed.fireAt, data.utcOffset);
        const left     = msUntil(parsed.fireAt);
        const nowStr   = wallTimeStr(data.utcOffset);
        const tzLabel  = `UTC${data.utcOffset >= 0 ? '+' : ''}${data.utcOffset}`;

        return reply(
            `╭─⌈ ⏰ *REMINDER SET* ⌋\n│\n` +
            `│ 📝 *Message:* ${reminderText}\n` +
            `│ 🕐 *Fires at:* ${timeStr}\n` +
            `│ ⏳ *In:*       ${left}\n` +
            `│ 🌐 *Bot clock:* ${nowStr} (${tzLabel})\n│\n` +
            `│ _If clock looks wrong, set: *${prefix}rem timezone +1*_\n│\n` +
            `╰⊷ Cancel: *${prefix}rem cancel ${data.reminders.length}*`
        );
    }
};
