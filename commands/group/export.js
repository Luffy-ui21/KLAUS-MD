import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage } from 'wolfsocket';
import { getBotName } from '../../lib/botname.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Queue config ─────────────────────────────────────────────────────────────
const QUEUE_FILE  = path.join(__dirname, '../../data/exportqueue.json');
const BATCH_SIZE  = 1;               // members added per tick
const BATCH_MS    = 60 * 60 * 1000; // 1 hour between batches
const INITIAL_ADD = 1;               // members added immediately on first run

// ─── Queue state ──────────────────────────────────────────────────────────────
let _exportTimer = null;

function readQueue() {
    try { if (fs.existsSync(QUEUE_FILE)) return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch {}
    return null;
}
function writeQueue(q) {
    try { fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true }); fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); } catch {}
}
function clearQueue() {
    try { if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE); } catch {}
}
function etaString(n) {
    const min = Math.ceil(n / BATCH_SIZE) * (BATCH_MS / 60000);
    if (min < 60) return `~${Math.ceil(min)} min`;
    return `~${Math.floor(min / 60)}h ${Math.ceil(min % 60)}m`;
}

async function processBatch(sock) {
    const q = readQueue();
    if (!q || !q.pending?.length) { clearQueue(); stopExportQueue(); return; }

    const batch = q.pending.splice(0, BATCH_SIZE);
    writeQueue(q);

    try {
        await sock.groupParticipantsUpdate(q.groupJid, batch, 'add');
        q.added = (q.added || 0) + batch.length;
        writeQueue(q);

        if (q.pending.length === 0) {
            clearQueue(); stopExportQueue();
            try {
                await sock.sendMessage(q.reportJid, {
                    text: `✅ *Export complete!*\n\n` +
                          `👥 Group: *${q.groupName || q.groupJid}*\n` +
                          `📊 Total exported: *${q.added}* members`
                });
            } catch {}
        } else {
            q.batchesDone = (q.batchesDone || 0) + 1;
            if (q.batchesDone % 5 === 0) {
                try {
                    await sock.sendMessage(q.reportJid, {
                        text: `⏳ *Export in progress...*\n\n` +
                              `✅ Added: *${q.added}*\n` +
                              `⌛ Pending: *${q.pending.length}*\n` +
                              `🕐 ETA: *${etaString(q.pending.length)}*`
                    });
                } catch {}
            }
        }
    } catch (err) {
        console.error('[EXPORT-QUEUE] batch error:', err?.message);
    }
}

function startExportQueue(sock) {
    if (_exportTimer) return;
    _exportTimer = setInterval(() => processBatch(sock), BATCH_MS);
    console.log(`[EXPORT-QUEUE] Started — ${BATCH_SIZE} members per ${BATCH_MS / 60000} min`);
}
function stopExportQueue() {
    if (_exportTimer) { clearInterval(_exportTimer); _exportTimer = null; }
    console.log('[EXPORT-QUEUE] Stopped.');
}

export function resumeExportQueueIfPending(sock) {
    const q = readQueue();
    if (q?.pending?.length) {
        console.log(`[EXPORT-QUEUE] Resuming: ${q.pending.length} members pending for "${q.groupName || q.groupJid}"`);
        startExportQueue(sock);
    }
}

// ─── VCF parsing ──────────────────────────────────────────────────────────────
function parseVcardNumbers(vcard) {
    const numbers = [];
    for (const line of vcard.split(/\r?\n/)) {
        if (!line.toUpperCase().startsWith('TEL')) continue;
        const parts = line.split(':');
        if (parts.length < 2) continue;
        const raw = parts[parts.length - 1].trim().replace(/[+\s()\-]/g, '');
        if (/^\d{7,15}$/.test(raw)) numbers.push(raw);
    }
    return numbers;
}
function isVcfDocument(doc) {
    if (!doc) return false;
    const mime = (doc.mimetype || '').toLowerCase();
    const name = (doc.fileName  || '').toLowerCase();
    return mime.includes('vcard') || mime.includes('x-vcard') || name.endsWith('.vcf');
}
async function downloadVcfBuffer(sock, msgObj) {
    try {
        const silent = { info:()=>{}, error:()=>{}, warn:()=>{}, debug:()=>{}, trace:()=>{}, child() { return this; } };
        const buf = await downloadMediaMessage(msgObj, 'buffer', {}, { logger: silent, reuploadRequest: sock.updateMediaMessage });
        return buf ? buf.toString('utf8') : null;
    } catch { return null; }
}
async function extractNumbers(sock, m) {
    const raw   = m.message || {};
    const inner = raw.ephemeralMessage?.message || raw.viewOnceMessage?.message || raw.documentWithCaptionMessage?.message || raw;

    if (inner.contactMessage?.vcard)               return parseVcardNumbers(inner.contactMessage.vcard);
    if (inner.contactsArrayMessage?.contacts?.length) {
        const nums = [];
        for (const c of inner.contactsArrayMessage.contacts) if (c.vcard) nums.push(...parseVcardNumbers(c.vcard));
        return nums;
    }
    if (inner.documentMessage && isVcfDocument(inner.documentMessage)) {
        const txt = await downloadVcfBuffer(sock, { key: m.key, message: { documentMessage: inner.documentMessage } });
        if (txt) return parseVcardNumbers(txt);
    }

    const ctx = inner.extendedTextMessage?.contextInfo  ||
                inner.imageMessage?.contextInfo         ||
                inner.videoMessage?.contextInfo         ||
                inner.documentMessage?.contextInfo      ||
                inner.audioMessage?.contextInfo         ||
                inner.stickerMessage?.contextInfo;

    const ctxMsg = ctx?.quotedMessage;
    if (ctxMsg) {
        if (ctxMsg.contactMessage?.vcard) return parseVcardNumbers(ctxMsg.contactMessage.vcard);
        if (ctxMsg.contactsArrayMessage?.contacts?.length) {
            const nums = [];
            for (const c of ctxMsg.contactsArrayMessage.contacts) if (c.vcard) nums.push(...parseVcardNumbers(c.vcard));
            return nums;
        }
        const quotedDoc = ctxMsg.documentMessage || ctxMsg.documentWithCaptionMessage?.message?.documentMessage;
        if (quotedDoc && isVcfDocument(quotedDoc)) {
            const qMsg = {
                key: { remoteJid: m.key.remoteJid, fromMe: false, id: ctx.stanzaId,
                       participant: m.key.remoteJid.endsWith('@g.us') ? (ctx.participant || m.key.remoteJid) : undefined },
                message: { documentMessage: quotedDoc }
            };
            const txt = await downloadVcfBuffer(sock, qMsg);
            if (txt) { const nums = parseVcardNumbers(txt); if (nums.length) return nums; }
        }
    }
    return [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeGroupJid(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    // Already a full group JID
    if (trimmed.endsWith('@g.us')) return trimmed;
    // Strip everything except digits
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (digits.length > 10) return digits + '@g.us';
    return null;
}
const react = (sock, m, e) => sock.sendMessage(m.key.remoteJid, { react: { text: e, key: m.key } }).catch(() => {});

// ─── Command ───────────────────────────────────────────────────────────────────
export default {
    name: 'export',
    aliases: ['exportvcf', 'addvcf', 'importvcf'],
    category: 'owner',
    ownerOnly: true,
    description: 'Export VCF contacts into an existing group slowly (ban-safe intervals)',
    usage: 'reply to VCF → /export <groupJid>  |  queuestatus  |  cancelqueue',

    async execute(sock, m, args, PREFIX, extra) {
        const jid   = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });

        if (!extra?.jidManager?.isOwner(m)) return reply('❌ Owner only command.');

        const sub = (args[0] || '').toLowerCase();

        // ── Status ──
        if (sub === 'queuestatus') {
            const q = readQueue();
            if (!q?.pending?.length) return reply('📭 No active export queue running.');
            return reply(
                `╭─⌈ ⏳ *EXPORT QUEUE* ⌋\n│\n` +
                `│ ✧ *Group:* ${q.groupName || q.groupJid}\n` +
                `│ ✧ *Added so far:* ${q.added || 0}\n` +
                `│ ✧ *Still pending:* ${q.pending.length}\n` +
                `│ ✧ *Batch:* ${BATCH_SIZE} per ${BATCH_MS / 60000} min\n` +
                `│ ✧ *ETA:* ${etaString(q.pending.length)}\n│\n` +
                `╰⊷ Use *${PREFIX}export cancelqueue* to stop`
            );
        }

        // ── Cancel ──
        if (sub === 'cancelqueue') {
            const q = readQueue();
            if (!q) return reply('📭 No active export queue to cancel.');
            stopExportQueue(); clearQueue();
            return reply(`🛑 Export queue cancelled.\n\n_Was exporting to *${q.groupName || q.groupJid}* (${q.pending?.length || 0} still pending)_`);
        }

        // ── Help ──
        if (!args.length || sub === 'help') {
            return reply(
                `╭─⌈ 📤 *EXPORT VCF TO GROUP* ⌋\n│\n` +
                `│ ✧ Reply to a VCF file and run:\n` +
                `│   \`${PREFIX}export <groupJid>\`\n│\n` +
                `│ ✧ *groupJid* examples:\n` +
                `│   120363xxxxxxxx@g.us\n` +
                `│   120363xxxxxxxx  (auto-completes)\n│\n` +
                `│ ✧ First *${INITIAL_ADD}* added immediately\n` +
                `│ ✧ Rest added *${BATCH_SIZE} per ${BATCH_MS / 60000} min*\n│\n` +
                `├─⊷ Check: *${PREFIX}export queuestatus*\n` +
                `├─⊷ Stop:  *${PREFIX}export cancelqueue*\n` +
                `╰⊷ *Powered by ${getBotName().toUpperCase()}*`
            );
        }

        // ── Validate group JID ──
        const groupJid = normalizeGroupJid(args[0]);
        if (!groupJid) {
            return reply(
                `❌ *Invalid group JID*\n\n` +
                `Provide the group ID like:\n` +
                `\`${PREFIX}export 120363xxxxxxxx@g.us\`\n\n` +
                `To get a group's ID: forward any message from the group to the bot and check logs, or use \`${PREFIX}groupinfo\` inside the group.`
            );
        }

        // ── Extract numbers from VCF ──
        await react(sock, m, '⏳');
        const numbers = await extractNumbers(sock, m);

        if (!numbers.length) {
            await react(sock, m, '❌');
            return reply(
                `❌ No numbers found.\n\n` +
                `Make sure you *reply to a VCF file* before running this command:\n` +
                `\`${PREFIX}export ${args[0]}\``
            );
        }

        // ── Check if already a queue running ──
        if (readQueue()?.pending?.length) {
            await react(sock, m, '❌');
            return reply(
                `⚠️ An export queue is already running.\n\n` +
                `Check it: *${PREFIX}export queuestatus*\n` +
                `Cancel it first: *${PREFIX}export cancelqueue*`
            );
        }

        // ── Fetch group name ──
        let groupName = groupJid;
        try { const meta = await sock.groupMetadata(groupJid); groupName = meta.subject || groupJid; } catch {}

        await react(sock, m, '⚙️');

        // ── Deduplicate ──
        const unique = [...new Set(numbers)];
        const initialNums = unique.slice(0, INITIAL_ADD);
        const queuedNums  = unique.slice(INITIAL_ADD);

        const initialJids = initialNums.map(n => n + '@s.whatsapp.net');
        const pendingJids = queuedNums.map(n => n + '@s.whatsapp.net');

        // ── Add initial batch immediately ──
        let initialAdded = 0;
        try {
            await sock.groupParticipantsUpdate(groupJid, initialJids, 'add');
            initialAdded = initialJids.length;
        } catch (err) {
            await react(sock, m, '❌');
            return reply(`❌ Failed to add initial members: ${err.message}\n\nCheck the group JID is correct and the bot is a member/admin.`);
        }

        await react(sock, m, '✅');

        if (!pendingJids.length) {
            return reply(
                `╭─⌈ ✅ *EXPORT COMPLETE* ⌋\n│\n` +
                `│ ✧ *Group:* ${groupName}\n` +
                `│ ✧ *Exported:* ${initialAdded} member(s)\n│\n` +
                `╰⊷ *Powered by ${getBotName().toUpperCase()}*`
            );
        }

        // ── Save queue and start slow-add ──
        writeQueue({
            groupJid,
            groupName,
            reportJid: jid,
            pending: pendingJids,
            added: initialAdded,
            total: unique.length,
            batchesDone: 0
        });
        startExportQueue(sock);

        await reply(
            `╭─⌈ 📤 *EXPORT STARTED (SAFE MODE)* ⌋\n│\n` +
            `│ ✧ *Group:* ${groupName}\n` +
            `│ ✧ *Added now:* ${initialAdded}\n` +
            `│ ✧ *Queued:* ${pendingJids.length} more\n` +
            `│ ✧ *Speed:* ${BATCH_SIZE} per ${BATCH_MS / 60000} min\n` +
            `│ ✧ *ETA:* ${etaString(pendingJids.length)}\n│\n` +
            `├─⊷ Progress: *${PREFIX}export queuestatus*\n` +
            `├─⊷ Cancel:   *${PREFIX}export cancelqueue*\n` +
            `╰⊷ You'll get a message when done `
        );
    }
};
