import fs from 'fs';
import path from 'path';
import { getSessionStats } from '../../lib/authState.js';
import { getClient }       from '../../lib/database.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
    const s  = Math.floor(ms / 1000);
    const d  = Math.floor(s / 86400);
    const h  = Math.floor((s % 86400) / 3600);
    const m  = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (!parts.length) parts.push(`${sc}s`);
    return parts.join(' ');
}

function fmtDate(ms) {
    const d = new Date(ms);
    return d.toUTCString().replace(' GMT', ' UTC');
}

function parsePhone(jid) {
    // "254713046497:26@s.whatsapp.net"  →  { phone: '+254713046497', slot: '26' }
    const raw = (jid || '').split('@')[0];
    const [num, slot] = raw.split(':');
    return { phone: `+${num}`, slot: slot || '0' };
}

function parseCreds() {
    try {
        const raw = fs.readFileSync('./session/creds.json', 'utf8');
        return JSON.parse(raw);
    } catch { return null; }
}

function sessionLabel() {
    const raw = process.env.SESSION_ID || '';
    // Format: "KLAUS MD:~<base64>" or legacy "KLAUS MD:~<base64>" — extract the label before the separator
    const sep = raw.indexOf(':~');
    if (sep > 0) return raw.slice(0, sep);
    // Also handle the new "KLAUS MD:<base64>" format (no ~ separator)
    const klaussMatch = raw.match(/^(KLAUS MD:|KLAUS MD:)/);
    if (klaussMatch) return raw.slice(0, klaussMatch[0].length - 1);
    if (raw.length > 0) return raw.slice(0, 12) + (raw.length > 12 ? '…' : '');
    return 'N/A';
}

function credsBirthMs() {
    try {
        return fs.statSync('./session/creds.json').birthtimeMs;
    } catch { return null; }
}

// ── Command ───────────────────────────────────────────────────────────────────
export default {
    name:        'sessioninfo',
    alias:       ['sinfo', 'session', 'sessionstatus', 'sessiondetails'],
    category:    'utility',
    ownerOnly:   true,
    description: 'Show detailed info about the current WhatsApp session',

    async execute(sock, msg, args, PREFIX, extra = {}) {
        const chatId = msg.key.remoteJid;
        const reply  = text => sock.sendMessage(chatId, { text }, { quoted: msg });

        // ── Gather data ───────────────────────────────────────────────────────

        const creds     = parseCreds();
        const me        = creds?.me?.id || sock.user?.id || '';
        const { phone, slot } = parsePhone(me);
        const waPlatform = (creds?.platform || 'unknown').charAt(0).toUpperCase()
                         + (creds?.platform || 'unknown').slice(1);

        // lastAccountSyncTimestamp is in seconds
        const lastSyncSec = creds?.lastAccountSyncTimestamp;
        const linkedAt    = lastSyncSec ? lastSyncSec * 1000 : null;
        const linkedStr   = linkedAt ? fmtDate(linkedAt) : 'Unknown';
        const sessionAge  = linkedAt ? fmtDuration(Date.now() - linkedAt) : 'Unknown';

        // Creds file birth time as a secondary "session created" indicator
        const fileMs     = credsBirthMs();
        const fileAgeStr = fileMs ? fmtDuration(Date.now() - fileMs) : 'Unknown';

        // Bot uptime
        const uptimeMs   = process.uptime() * 1000;
        const uptimeStr  = fmtDuration(uptimeMs);

        // Registration ID
        const regId      = creds?.registrationId ?? 'N/A';

        // Session keys (from SQLite)
        const db        = getClient();
        const stats     = db ? getSessionStats(db) : { hasCreds: !!creds, totalKeys: '—', byType: [] };

        const keyBreak  = stats.byType.length
            ? stats.byType.map(r => `    • ${r.type || 'misc'}: ${r.c}`).join('\n')
            : '    • —';

        // Session label from SESSION_ID env
        const label = sessionLabel();

        // ── Format output ──────────────────────────────────────────────────────

        const text =
            `╭─⌈ 🔐 *SESSION INFO* ⌋\n` +
            `│\n` +
            `│ 📛 *Label:*       ${label}\n` +
            `│ 📱 *Phone:*       ${phone}\n` +
            `│ 🔢 *Device Slot:* :${slot}\n` +
            `│ 📲 *WA Platform:* ${waPlatform}\n` +
            `│ 🆔 *Reg ID:*      ${regId}\n` +
            `│\n` +
            `│ ┄┄┄ Session Time ┄┄┄\n` +
            `│ 📅 *Linked at:*   ${linkedStr}\n` +
            `│ ⏳ *Session age:* ${sessionAge}\n` +
            `│ 📂 *Creds file:*  ${fileAgeStr} old\n` +
            `│\n` +
            `│ ┄┄┄ Runtime ┄┄┄\n` +
            `│ 🤖 *Bot uptime:*  ${uptimeStr}\n` +
            `│ 📦 *Version:*     v${extra.VERSION || global.VERSION || '?'}\n` +
            `│\n` +
            `│ ┄┄┄ Keys in DB ┄┄┄\n` +
            `│ 🔑 *Total keys:*  ${stats.totalKeys}\n` +
            `│ 🗂 *Creds saved:* ${stats.hasCreds ? '✅ Yes' : '❌ No'}\n` +
            `${keyBreak}\n` +
            `│\n` +
            `╰⊷ *Owner-only command*`;

        await reply(text);
    }
};
