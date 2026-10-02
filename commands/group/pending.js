/**
 * .pending — list a group's pending join requests.
 *
 * Uses Baileys' groupRequestParticipantsList(jid). Each entry is the raw
 * attrs of a <membership_approval_request/> node, typically:
 *   { jid, request_method, request_time }
 *
 * In modern WhatsApp groups the jid is usually @lid (internal Linked Identity),
 * NOT a phone number. We resolve those via sock.signalRepository.lidMapping
 * to recover the real +phone number when possible.
 */

import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const PAGE_SIZE = 50;   // safety cap per message — groups can have hundreds pending

function digitsOf(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0];
}

function isLid(jid) {
  return typeof jid === 'string' && jid.endsWith('@lid');
}

/**
 * Resolve a possibly-LID jid to a real phone number string.
 * Returns: { phone: '254700111222' | null, lid: '12345…' | null, raw }
 */
async function resolveJid(sock, rawJid) {
  if (!rawJid) return { phone: null, lid: null, raw: rawJid };

  // Plain phone JID — already what we want
  if (rawJid.endsWith('@s.whatsapp.net') || rawJid.endsWith('@hosted')) {
    return { phone: digitsOf(rawJid), lid: null, raw: rawJid };
  }

  // LID — try Baileys' lid-mapping store
  if (isLid(rawJid)) {
    const lidDigits = digitsOf(rawJid);
    try {
      const store = sock?.signalRepository?.lidMapping;
      if (store && typeof store.getPNForLID === 'function') {
        const pnJid = await store.getPNForLID(rawJid);
        if (pnJid) return { phone: digitsOf(pnJid), lid: lidDigits, raw: rawJid };
      }
    } catch { /* fall through */ }
    return { phone: null, lid: lidDigits, raw: rawJid };
  }

  // Unknown domain — best effort
  return { phone: digitsOf(rawJid), lid: null, raw: rawJid };
}

function timeAgo(unixSecs) {
  const n = Number(unixSecs);
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  const diff = Math.max(0, Date.now() / 1000 - n);
  if (diff < 60)         return `${Math.floor(diff)}s ago`;
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

function methodIcon(method) {
  switch ((method || '').toLowerCase()) {
    case 'invite_link':    return '🔗';
    case 'link':           return '🔗';
    case 'whatsapp_link':  return '🔗';
    case 'admin_invite':   return '✉️';
    case 'invite':         return '✉️';
    default:               return '👤';
  }
}

export default {
  name: 'pending',
  alias: ['pendingrequest', 'pendingrequests', 'pendinglist', 'requests', 'joinrequests'],
  description: 'List pending join requests for the group',
  category: 'group',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      return;
    }

    /* ── Sender admin check ─────────────────────────────────────── */
    let groupMetadata;
    try {
      groupMetadata = await sock.groupMetadata(jid);
    } catch {
      await sock.sendMessage(jid, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
      return;
    }

    const participants = groupMetadata.participants || [];
    const stripDevice  = j => (j ? String(j).split(':')[0] : '');
    const numberOf     = j => (j ? String(j).split('@')[0].split(':')[0] : '');

    const senderRaw = msg.key.participant || jid;
    const senderPart = participants.find(p => {
      const ids = [p.id, p.jid, p.lid, p.phoneNumber].filter(Boolean);
      return ids.some(id =>
        id === senderRaw ||
        stripDevice(id) === stripDevice(senderRaw) ||
        numberOf(id) === numberOf(senderRaw)
      );
    });
    const isAdmin = senderPart?.admin === 'admin' || senderPart?.admin === 'superadmin';
    if (!isAdmin) {
      await sock.sendMessage(jid, { text: '🛑 Only group admins can view pending join requests.' }, { quoted: msg });
      return;
    }

    /* ── Fetch pending list ─────────────────────────────────────── */
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    let pending;
    try {
      pending = await sock.groupRequestParticipantsList(jid);
    } catch (err) {
      console.error('[PENDING] fetch error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, {
        text: `❌ Couldn't fetch pending requests.\n\n${err.message || 'Unknown error'}`
      }, { quoted: msg });
      return;
    }

    if (!Array.isArray(pending) || pending.length === 0) {
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      await sock.sendMessage(jid, {
        text:
          `╭─⌈ 📋 *PENDING REQUESTS* ⌋\n` +
          `├─⊷ *${groupMetadata.subject || 'this group'}*\n` +
          `├─⊷ ✨ No pending join requests right now\n` +
          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
      return;
    }

    /* ── Format & send ──────────────────────────────────────────── */
    // Sort newest first so admins see fresh requests at the top
    pending.sort((a, b) => Number(b.request_time || 0) - Number(a.request_time || 0));

    const total = pending.length;
    const shown = pending.slice(0, PAGE_SIZE);

    // Build mention list using the RAW jids (lid or phone). WhatsApp's
    // client resolves @<digits> in the text to the display name on its own.
    const mentions = shown.map(p => p.jid).filter(Boolean);

    let body = '';
    shown.forEach((p, i) => {
      const icon  = methodIcon(p.request_method);
      const when  = timeAgo(p.request_time);
      const tag   = digitsOf(p.jid);
      // @<digits> + matching jid in mentions[] = WhatsApp renders a name pill
      body += `│  *${i + 1}.* ${icon} @${tag}  _·_  ${when}\n`;
    });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    await sock.sendMessage(jid, {
      text:
        `╭─⌈ 📋 *PENDING REQUESTS* ⌋\n` +
        `├─⊷ *${groupMetadata.subject || 'this group'}*\n` +
        `│\n` +
        body +
        `│\n` +
        `├─⊷ Use *approveall* to approve or *rejectall* to reject\n` +
        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
      mentions
    }, { quoted: msg });
  }
};
