import fs from "fs";
import { getBotName } from '../../lib/botname.js';
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage } from 'wolfsocket';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Queue config ────────────────────────────────────────────────────────────
const QUEUE_FILE   = path.join(__dirname, '../../data/groupqueue.json');
const BATCH_SIZE   = 1;          // members added per tick
const BATCH_MS     = 60 * 60 * 1000;  // 1 hour between batches
const SAFE_LIMIT   = 5;          // if vcf has ≤ this many numbers, add all at once (safe)
const INITIAL_ADD  = 1;          // members added at group creation time

// ─── Queue state (in-memory, backed by file) ─────────────────────────────────
let _queueTimer = null;

function readQueue() {
    try {
        if (fs.existsSync(QUEUE_FILE)) return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch {}
    return null;
}

function writeQueue(q) {
    try {
        fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    } catch {}
}

function clearQueue() {
    try { if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE); } catch {}
}

function etaString(pendingCount) {
    const batches = Math.ceil(pendingCount / BATCH_SIZE);
    const totalMin = batches * (BATCH_MS / 60000);
    if (totalMin < 60) return `~${Math.ceil(totalMin)} min`;
    const h = Math.floor(totalMin / 60);
    const m = Math.ceil(totalMin % 60);
    return `~${h}h ${m}m`;
}

// Called on each tick — add next batch
async function processBatch(sock) {
    const q = readQueue();
    if (!q || !q.pending || q.pending.length === 0) {
        clearQueue();
        stopQueue();
        return;
    }

    const batch = q.pending.splice(0, BATCH_SIZE);
    writeQueue(q);

    try {
        const result = await sock.groupParticipantsUpdate(q.groupJid, batch, 'add');
        const added   = batch.filter(j => result?.find?.(r => r.jid === j && r.status === '200') ?? true).length;
        q.added = (q.added || 0) + added;
        writeQueue(q);

        if (q.pending.length === 0) {
            // Done!
            clearQueue();
            stopQueue();
            try {
                await sock.sendMessage(q.reportJid, {
                    text: `✅ *Group fill complete!*\n\n` +
                          `👥 *${q.groupName}*\n` +
                          `📊 Total added: *${q.added}* members\n` +
                          `🔗 ${q.inviteLink || 'Check group for link'}`
                });
            } catch {}
        } else {
            // Progress update every 5 batches
            q.batchesDone = (q.batchesDone || 0) + 1;
            if (q.batchesDone % 5 === 0) {
                try {
                    const remaining = q.pending.length;
                    await sock.sendMessage(q.reportJid, {
                        text: `⏳ *Adding members to ${q.groupName}*\n\n` +
                              `✅ Added so far: *${q.added}*\n` +
                              `⌛ Still pending: *${remaining}*\n` +
                              `🕐 ETA: *${etaString(remaining)}*`
                    });
                } catch {}
            }
        }
    } catch (err) {
        console.error('[CREATEGROUP-QUEUE] batch error:', err?.message);
        // On rate-limit, double the wait — queue keeps running next tick
    }
}

function startQueue(sock) {
    if (_queueTimer) return; // already running
    _queueTimer = setInterval(() => processBatch(sock), BATCH_MS);
    console.log(`[CREATEGROUP-QUEUE] Slow-add queue started (${BATCH_SIZE} per ${BATCH_MS / 60000} min)`);
}

function stopQueue() {
    if (_queueTimer) { clearInterval(_queueTimer); _queueTimer = null; }
    console.log('[CREATEGROUP-QUEUE] Queue stopped.');
}

// Resume on bot restart
export function resumeQueueIfPending(sock) {
    const q = readQueue();
    if (q && q.pending && q.pending.length > 0) {
        console.log(`[CREATEGROUP-QUEUE] Resuming queue: ${q.pending.length} members pending for "${q.groupName}"`);
        startQueue(sock);
    }
}

// ─── VCF helpers (unchanged) ─────────────────────────────────────────────────
function parseVcardNumbers(vcard) {
    const numbers = [];
    const lines = vcard.split(/\r?\n/);
    for (const line of lines) {
        if (!line.toUpperCase().startsWith('TEL')) continue;
        const parts = line.split(':');
        if (parts.length < 2) continue;
        const raw = parts[parts.length - 1].trim().replace(/[+\s()\-]/g, '');
        if (/^\d{7,15}$/.test(raw)) numbers.push(raw);
    }
    return numbers;
}

function isVcfDocument(docMsg) {
    if (!docMsg) return false;
    const mime = (docMsg.mimetype || '').toLowerCase();
    const name = (docMsg.fileName || '').toLowerCase();
    return mime.includes('vcard') || mime.includes('x-vcard') || name.endsWith('.vcf');
}

async function downloadVcfBuffer(sock, msgObj) {
    try {
        const silentLogger = {
            info: () => {}, error: () => {}, warn: () => {},
            debug: () => {}, trace: () => {}, child: function() { return this; }
        };
        const buffer = await downloadMediaMessage(
            msgObj, 'buffer', {},
            { logger: silentLogger, reuploadRequest: sock.updateMediaMessage }
        );
        return buffer ? buffer.toString('utf8') : null;
    } catch { return null; }
}

async function extractNumbersFromQuotedVcf(sock, m) {
    const msgContent = m.message || {};
    const inner =
        msgContent.ephemeralMessage?.message ||
        msgContent.viewOnceMessage?.message ||
        msgContent.documentWithCaptionMessage?.message ||
        msgContent;

    if (inner.contactMessage?.vcard) return parseVcardNumbers(inner.contactMessage.vcard);
    if (inner.contactsArrayMessage?.contacts?.length) {
        const nums = [];
        for (const c of inner.contactsArrayMessage.contacts) {
            if (c.vcard) nums.push(...parseVcardNumbers(c.vcard));
        }
        return nums;
    }
    if (inner.documentMessage && isVcfDocument(inner.documentMessage)) {
        const vcfText = await downloadVcfBuffer(sock, {
            key: m.key,
            message: { documentMessage: inner.documentMessage }
        });
        if (vcfText) return parseVcardNumbers(vcfText);
    }

    const ctxInfo =
        inner.extendedTextMessage?.contextInfo ||
        inner.imageMessage?.contextInfo ||
        inner.videoMessage?.contextInfo ||
        inner.documentMessage?.contextInfo ||
        inner.audioMessage?.contextInfo ||
        inner.stickerMessage?.contextInfo ||
        inner.buttonsResponseMessage?.contextInfo;

    const ctxMsg = ctxInfo?.quotedMessage;
    if (ctxMsg) {
        if (ctxMsg.contactMessage?.vcard) return parseVcardNumbers(ctxMsg.contactMessage.vcard);
        if (ctxMsg.contactsArrayMessage?.contacts?.length) {
            const nums = [];
            for (const c of ctxMsg.contactsArrayMessage.contacts) {
                if (c.vcard) nums.push(...parseVcardNumbers(c.vcard));
            }
            return nums;
        }
        const quotedDoc =
            ctxMsg.documentMessage ||
            ctxMsg.documentWithCaptionMessage?.message?.documentMessage;
        if (quotedDoc && isVcfDocument(quotedDoc)) {
            const quotedMsgObj = {
                key: {
                    remoteJid: m.key.remoteJid,
                    fromMe: false,
                    id: ctxInfo.stanzaId,
                    participant: m.key.remoteJid.endsWith('@g.us')
                        ? (ctxInfo.participant || m.key.remoteJid)
                        : undefined
                },
                message: { documentMessage: quotedDoc }
            };
            const vcfText = await downloadVcfBuffer(sock, quotedMsgObj);
            if (vcfText) {
                const nums = parseVcardNumbers(vcfText);
                if (nums.length > 0) return nums;
            }
        }
    }
    return [];
}

async function sendGroupLinkButton(sock, targetJid, quotedMsg, groupName, inviteLink, memberCount) {
    const caption =
        `╭─⌈ ✅ *GROUP CREATED* ⌋\n│\n` +
        `│ ✧ *Name:* ${groupName}\n` +
        `│ ✧ *Members:* ${memberCount}\n` +
        `│ ✧ *Link:* ${inviteLink}\n│\n` +
        `╰⊷ *Powered by ${getBotName().toUpperCase()}*`;

    const buttons = [
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: '👥 View Group',
                url: inviteLink,
                merchant_url: inviteLink
            })
        },
        {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text: '📋 Copy Link',
                copy_code: inviteLink
            })
        }
    ];

    try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const { sendInteractiveMessage } = require('wolfbtns');
        await sendInteractiveMessage(sock, targetJid, {
            text: caption, footer: ` ${getBotName()}`, interactiveButtons: buttons
        });
    } catch {
        await sock.sendMessage(targetJid, { text: caption }, { quoted: quotedMsg });
    }
}

const react = (sock, m, emoji) =>
    sock.sendMessage(m.key.remoteJid, { react: { text: emoji, key: m.key } }).catch(() => {});

// ─── Main command ─────────────────────────────────────────────────────────────
export default {
  name: "creategroup",
  description: "Create WhatsApp groups safely from a VCF file (slow-add mode for large lists)",
  category: "owner",
  ownerOnly: true,
  aliases: ["cg", "makegroup", "newgroup"],
  usage: "<GroupName>  |  reply to VCF: <GroupName>  |  queuestatus  |  cancelqueue",

  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const { jidManager } = extra;
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });

    if (!jidManager.isOwner(m)) return reply(`❌ *Owner only command.*`);

    // ── Sub-commands ──
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'queuestatus' || sub === 'queuestatus') {
        const q = readQueue();
        if (!q || !q.pending?.length) return reply('📭 No active queue. Nothing is being added slowly right now.');
        const remaining = q.pending.length;
        return reply(
            `╭─⌈ ⏳ *SLOW-ADD QUEUE* ⌋\n│\n` +
            `│ ✧ *Group:* ${q.groupName}\n` +
            `│ ✧ *Added so far:* ${q.added || 0}\n` +
            `│ ✧ *Still pending:* ${remaining}\n` +
            `│ ✧ *Batch size:* ${BATCH_SIZE} per ${BATCH_MS / 60000} min\n` +
            `│ ✧ *ETA:* ${etaString(remaining)}\n│\n` +
            `╰⊷ Use *${PREFIX}creategroup cancelqueue* to stop`
        );
    }

    if (sub === 'cancelqueue') {
        const q = readQueue();
        if (!q) return reply('📭 No active queue to cancel.');
        stopQueue();
        clearQueue();
        return reply(`🛑 Slow-add queue cancelled.\n\n_Was filling: *${q.groupName}* (${q.pending?.length || 0} members were still pending)_`);
    }

    if (args.length === 0 || sub === 'help') {
      return reply(
        `╭─⌈ 👥 *CREATE GROUP* ⌋\n│\n` +
        `├─⊷ *Name only (just you):*\n│  └⊷ \`${PREFIX}creategroup WOLF\`\n` +
        `├─⊷ *Reply to VCF file:*\n│  └⊷ \`${PREFIX}creategroup GroupName\`\n` +
        `├─⊷ *Manual numbers:*\n│  └⊷ \`${PREFIX}creategroup 254xxx GroupName\`\n` +
        `├─⊷ *Check slow-add progress:*\n│  └⊷ \`${PREFIX}creategroup queuestatus\`\n` +
        `├─⊷ *Cancel slow-add:*\n│  └⊷ \`${PREFIX}creategroup cancelqueue\`\n` +
        `│\n` +
        `├─⊷ *-d "description"* — Set group description\n` +
        `├─⊷ *-a* — Announce-only mode\n` +
        `├─⊷ *-r* — Admin-only settings\n` +
        `│\n` +
        `├─⊷ ⚠️ *Large VCF files* are added in batches of ${BATCH_SIZE}\n` +
        `│   every ${BATCH_MS / 60000} min to avoid bans.\n` +
        `╰⊷ *Powered by ${getBotName().toUpperCase()}*`
      );
    }

    try {
      // ── Parse args ──
      const phoneRegex = /^\+?[\d]{7,15}$/;
      const rawNumbers = [];
      const nameWords = [];
      let description = "";
      let announcementsOnly = false;
      let restrict = false;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-d' && args[i + 1]) { description = args[i + 1].replace(/"/g, '').trim(); i++; continue; }
        if (arg === '-a') { announcementsOnly = true; continue; }
        if (arg === '-r') { restrict = true; continue; }
        const stripped = arg.replace(/[+\s()\-]/g, '');
        if (phoneRegex.test(stripped) && stripped.length >= 7) rawNumbers.push(stripped);
        else nameWords.push(arg.replace(/"/g, ''));
      }

      const groupName = nameWords.join(' ').trim() || `${getBotName()} Group`;

      await react(sock, m, '⏳');
      const vcfNumbers = await extractNumbersFromQuotedVcf(sock, m);
      for (const n of vcfNumbers) { if (!rawNumbers.includes(n)) rawNumbers.push(n); }

      if (groupName.length > 25) {
        return reply(`❌ Group name too long (max 25 chars, yours: ${groupName.length})`);
      }

      await react(sock, m, '⚙️');

      const useSlow = rawNumbers.length > SAFE_LIMIT;

      // Separate initial batch from queue
      const initialNums  = useSlow ? rawNumbers.slice(0, INITIAL_ADD) : rawNumbers;
      const queuedNums   = useSlow ? rawNumbers.slice(INITIAL_ADD)    : [];

      const participants = initialNums.map(n => n + '@s.whatsapp.net');

      // ── Create group ──
      const group = await sock.groupCreate(groupName, participants);
      const groupJid = group?.gid || group?.id || group?.data?.id;
      if (!groupJid) throw new Error("No group ID returned — creation may have failed.");

      await react(sock, m, '✅');

      // ── Configure ──
      try { if (sock.user?.id) await sock.groupParticipantsUpdate(groupJid, [sock.user.id], 'promote'); } catch {}
      if (description) { try { await sock.groupUpdateDescription(groupJid, description); } catch {} }
      try {
        await sock.groupSettingUpdate(groupJid, announcementsOnly ? 'announcement' : 'not_announcement');
        await sock.groupSettingUpdate(groupJid, restrict ? 'locked' : 'unlocked');
      } catch {}

      await sock.sendMessage(groupJid, {
        text: `👋 *Welcome to ${groupName}!*\n\nCreated with ${getBotName()}.\n🤖 Prefix: ${PREFIX}`
      });

      let inviteLink = null;
      try {
        const code = await sock.groupInviteCode(groupJid);
        if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
      } catch {}

      const memberCount = participants.length + 1;

      if (useSlow) {
        // ── Save queue and start slow-add ──
        const pendingJids = queuedNums.map(n => n + '@s.whatsapp.net');
        writeQueue({
            groupJid,
            groupName,
            reportJid: jid,
            inviteLink: inviteLink || null,
            pending: pendingJids,
            added: memberCount,
            total: rawNumbers.length + 1,
            batchesDone: 0
        });
        startQueue(sock);

        const eta = etaString(pendingJids.length);
        await reply(
            `╭─⌈ ✅ *GROUP CREATED (SAFE MODE)* ⌋\n│\n` +
            `│ ✧ *Name:* ${groupName}\n` +
            `│ ✧ *Initial members:* ${memberCount}\n` +
            `│ ✧ *Queued to add:* ${pendingJids.length} more\n` +
            `│ ✧ *Speed:* ${BATCH_SIZE} members every ${BATCH_MS / 60000} min\n` +
            `│ ✧ *Estimated finish:* ${eta}\n` +
            `│ ✧ *Link:* ${inviteLink || 'Promote bot to admin for link'}\n│\n` +
            `├─⊷ Check progress: *${PREFIX}creategroup queuestatus*\n` +
            `├─⊷ Cancel: *${PREFIX}creategroup cancelqueue*\n` +
            `╰⊷ You'll get a message when done `
        );
      } else {
        if (inviteLink) {
            await sendGroupLinkButton(sock, jid, m, groupName, inviteLink, memberCount);
        } else {
            await reply(
                `╭─⌈ ✅ *GROUP CREATED* ⌋\n│\n` +
                `│ ✧ *Name:* ${groupName}\n` +
                `│ ✧ *Members:* ${memberCount}\n` +
                `│ ✧ *Link:* Unavailable (promote bot to admin)\n│\n` +
                `╰⊷ *Powered by ${getBotName().toUpperCase()}*`
            );
        }
      }

      // ── Log ──
      try {
        const logDir = path.join(__dirname, "../../logs");
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, "groups.json");
        const existing = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
        existing.push({
          id: groupJid, name: groupName,
          created: new Date().toISOString(),
          members: rawNumbers.length + 1,
          slowMode: useSlow,
          vcfSource: vcfNumbers.length > 0,
          invite: inviteLink || 'unavailable'
        });
        fs.writeFileSync(logFile, JSON.stringify(existing, null, 2));
      } catch {}

    } catch (error) {
      await react(sock, m, '❌');
      let msg = `❌ *Failed to create group*\n\n`;
      if (error.message?.includes("bad-request") || error.message?.includes("400")) {
        msg += `WhatsApp rejected the request.\n\n*Common fixes:*\n• Numbers must be on WhatsApp\n• Include country code (e.g. \`254703397679\`)\n• Try with fewer numbers first`;
      } else if (error.message?.includes("rate") || error.message?.includes("429")) {
        msg += `Rate limited — wait a few minutes and retry.`;
      } else {
        msg += error.message;
      }
      await reply(msg);
    }
  },
};
