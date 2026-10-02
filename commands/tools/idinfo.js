import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const GROUP_LINK_RE   = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/i;
const CHANNEL_LINK_RE = /(?:https?:\/\/)?(?:www\.)?(?:whatsapp\.com|wa\.me)\/channel\/([A-Za-z0-9_-]{10,})/i;
const INVITE_CODE_RE  = /^[A-Za-z0-9_-]{10,}$/;

function fmtDate(ts) {
  if (!ts) return 'Unknown';
  const ms = Number(ts);
  const d  = new Date(ms > 1e12 ? ms : ms * 1000);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-US');
}

export default {
  name: 'idinfo',
  description: 'Show info about a group or channel by link, JID or invite code',
  category: 'utility',
  aliases: ['chatinfo', 'whois', 'idcheck'],

  async execute(sock, m, args) {
    const chatJid = m.key.remoteJid;

    try {
      const raw =
        (args && args.join(' ').trim()) ||
        (m.quoted?.text || '').trim() ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim() ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text?.trim() ||
        '';

      // --- Decide what we're looking up -----------------------------------
      let kind = null;          // 'group' | 'channel'
      let inviteCode = null;
      let targetJid = null;

      const channelMatch = raw.match(CHANNEL_LINK_RE);
      const groupMatch   = raw.match(GROUP_LINK_RE);

      if (channelMatch) {
        kind = 'channel';
        inviteCode = channelMatch[1];
      } else if (groupMatch) {
        kind = 'group';
        inviteCode = groupMatch[1];
      } else if (raw.endsWith('@newsletter')) {
        kind = 'channel';
        targetJid = raw;
      } else if (raw.endsWith('@g.us')) {
        kind = 'group';
        targetJid = raw;
      } else if (raw && INVITE_CODE_RE.test(raw)) {
        // Bare code — try group first, fall back to channel
        inviteCode = raw;
      } else if (!raw && chatJid.endsWith('@g.us')) {
        kind = 'group';
        targetJid = chatJid;
      } else if (!raw && chatJid.endsWith('@newsletter')) {
        kind = 'channel';
        targetJid = chatJid;
      }

      if (!kind && !inviteCode && !targetJid) {
        return sock.sendMessage(chatJid, {
          text: `╭─⌈ 🆔 *ID INFO* ⌋\n├─⊷ *.idinfo <link / jid / code>*\n│  └⊷ Group or channel info\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }

      await sock.sendMessage(chatJid, { react: { text: '⏳', key: m.key } });

      // --- Fetch metadata -------------------------------------------------
      let info = null;

      if (kind === 'group') {
        info = await this.fetchGroup(sock, { inviteCode, targetJid });
      } else if (kind === 'channel') {
        info = await this.fetchChannel(sock, { inviteCode, targetJid });
      } else {
        // Bare code with unknown kind — try group first, then fall back to channel.
        // Both null-return AND thrown errors must trigger the channel attempt.
        try {
          info = await this.fetchGroup(sock, { inviteCode });
          if (info) kind = 'group';
        } catch {
          info = null;
        }
        if (!info) {
          try {
            info = await this.fetchChannel(sock, { inviteCode });
            if (info) kind = 'channel';
          } catch {
            info = null;
          }
        }
      }

      if (!info) {
        await sock.sendMessage(chatJid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(chatJid, {
          text: `❌ Could not fetch info — link expired, revoked, or private.`
        }, { quoted: m });
      }

      await sock.sendMessage(chatJid, { react: { text: '✅', key: m.key } });
      await this.sendInfo(sock, m, kind, info);

    } catch (err) {
      await sock.sendMessage(chatJid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(chatJid, { text: `❌ ${err.message}` }, { quoted: m });
    }
  },

  // ---------- Fetchers --------------------------------------------------
  async fetchGroup(sock, { inviteCode, targetJid }) {
    let meta;
    if (targetJid) {
      meta = await sock.groupMetadata(targetJid);
    } else if (inviteCode) {
      meta = await sock.groupGetInviteInfo(inviteCode);
      // Invite info gives id, subject, size, creation, owner — try a richer
      // groupMetadata if we can join the metadata table without joining the group.
      if (meta?.id) {
        try {
          const richer = await sock.groupMetadata(meta.id);
          if (richer) meta = { ...meta, ...richer };
        } catch {} // not a member → keep invite info only
      }
    }
    if (!meta?.id) return null;

    const participants = meta.participants || [];
    const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

    return {
      id:       meta.id,
      name:     meta.subject || 'Unnamed group',
      desc:     (meta.desc?.toString?.() || meta.desc || ''),
      members:  meta.size ?? participants.length ?? null,
      admins:   admins.length || null,
      creation: meta.creation || meta.createdAt || null,
      owner:    meta.owner || (participants.find(p => p.admin === 'superadmin')?.id) || null,
      restrict: meta.restrict ?? null,
      announce: meta.announce ?? null,
    };
  },

  async fetchChannel(sock, { inviteCode, targetJid }) {
    let meta;
    if (targetJid) {
      meta = await sock.newsletterMetadata('jid', targetJid);
    } else if (inviteCode) {
      meta = await sock.newsletterMetadata('invite', inviteCode);
    }
    if (!meta) return null;

    // Baileys exposes channel info under varying keys depending on version
    const id        = meta.id || meta.jid || meta.newsletter_id || null;
    const name      = meta.name || meta.subject || meta.title || 'Unnamed channel';
    const desc      = meta.description || meta.desc || '';
    const followers = meta.subscribers
                   ?? meta.subscribers_count
                   ?? meta.subscriberCount
                   ?? meta.followersCount
                   ?? meta.followers
                   ?? null;
    const creation  = meta.creation_time || meta.creation || meta.createdAt || null;
    const verified  = meta.verification === 'VERIFIED' || meta.verified === true;

    if (!id) return null;
    return { id, name, desc, followers, creation, verified };
  },

  // ---------- Output ----------------------------------------------------
  async sendInfo(sock, m, kind, info) {
    const chatJid = m.key.remoteJid;
    const owner   = getOwnerName().toUpperCase();
    const SEP     = '━━━━━━━━━━━━━━━━━';

    const lines = [];
    if (kind === 'group') {
      lines.push(`👥 *GROUP INFO*`);
      lines.push(SEP);
      lines.push(`📛 *Name:* ${info.name}`);
      lines.push(`🆔 *JID:* ${info.id}`);
      lines.push(`👥 *Members:* ${fmtNum(info.members)}`);
      if (info.admins   != null) lines.push(`⭐ *Admins:* ${fmtNum(info.admins)}`);
      if (info.creation != null) lines.push(`📅 *Created:* ${fmtDate(info.creation)}`);
      if (info.owner)            lines.push(`👑 *Owner:* ${info.owner.split('@')[0]}`);
      if (info.desc)             lines.push(`📜 *Desc:* ${String(info.desc).slice(0, 200)}`);
    } else {
      lines.push(`📣 *CHANNEL INFO*${info.verified ? ' ✅' : ''}`);
      lines.push(SEP);
      lines.push(`📛 *Name:* ${info.name}`);
      lines.push(`🆔 *JID:* ${info.id}`);
      lines.push(`🫂 *Followers:* ${fmtNum(info.followers)}`);
      if (info.creation != null) lines.push(`📅 *Created:* ${fmtDate(info.creation)}`);
      if (info.desc)             lines.push(`📜 *Desc:* ${String(info.desc).slice(0, 200)}`);
    }
    lines.push(SEP);
    lines.push(`${getFooter(m.key.participant || m.key.remoteJid)}`);
    const body = lines.join('\n');

    // Try to send with profile picture
    let pic = null;
    try { pic = await sock.profilePictureUrl(info.id, 'image'); } catch {}

    if (pic) {
      try {
        const res = await fetch(pic);
        const buf = Buffer.from(await res.arrayBuffer());
        await sock.sendMessage(chatJid, { image: buf, caption: body }, { quoted: m });
        return;
      } catch {}
    }
    await sock.sendMessage(chatJid, { text: body }, { quoted: m });
  }
};
