import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

function classifyJid(jid) {
  if (!jid) return 'unknown';
  if (jid === 'status@broadcast')   return 'status';
  if (jid.endsWith('@g.us'))        return 'group';
  if (jid.endsWith('@newsletter'))  return 'channel';
  if (jid.endsWith('@broadcast'))   return 'broadcast';
  if (jid.endsWith('@lid'))         return 'user_lid';
  if (jid.endsWith('@s.whatsapp.net')) return 'user';
  if (jid.endsWith('@call'))        return 'call';
  return 'unknown';
}

function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-US');
}

export default {
  name: 'jidinfo',
  description: 'Identify a JID — group, channel, or user — and show its link',
  category: 'utility',
  aliases: ['whatjid', 'jidtype', 'jidcheck'],

  async execute(sock, m, args) {
    const chatJid = m.key.remoteJid;
    const owner   = getOwnerName().toUpperCase();
    const SEP     = '━━━━━━━━━━━━━━━━━';

    try {
      // Resolve target JID — args, quoted text, mentioned jid, or current chat
      let target =
        (args && args.join(' ').trim()) ||
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        (m.quoted?.text || '').trim() ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim() ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text?.trim() ||
        '';

      // If still nothing, fall back to the current chat JID
      if (!target) target = chatJid;

      // If the user passed a plain phone number, build a user JID for them
      if (/^\+?\d{7,15}$/.test(target.replace(/\D/g, '')) && !target.includes('@')) {
        const num = target.replace(/\D/g, '');
        target = `${num}@s.whatsapp.net`;
      }

      const type = classifyJid(target);

      const lines = [];
      lines.push(`🆔 *JID INFO*`);
      lines.push(SEP);
      lines.push(`📌 *JID:* ${target}`);

      // ---- per-type details ----------------------------------------------
      if (type === 'group') {
        lines.push(`📂 *Type:* Group Chat`);
        try {
          const meta = await sock.groupMetadata(target);
          lines.push(`📛 *Name:* ${meta.subject || '—'}`);
          lines.push(`👥 *Members:* ${fmtNum(meta.size ?? meta.participants?.length ?? null)}`);
        } catch {
          lines.push(`⚠️ *Note:* Bot is not in this group — limited info`);
        }
        try {
          const code = await sock.groupInviteCode(target);
          if (code) lines.push(`🔗 *Link:* https://chat.whatsapp.com/${code}`);
        } catch {
          lines.push(`🔗 *Link:* (bot must be admin to fetch invite link)`);
        }

      } else if (type === 'channel') {
        lines.push(`📂 *Type:* Channel (Newsletter)`);
        let inviteCode = null;
        try {
          const meta = await sock.newsletterMetadata('jid', target);
          if (meta) {
            const name = meta.name || meta.subject || meta.title || '—';
            const followers = meta.subscribers
                          ?? meta.subscribers_count
                          ?? meta.subscriberCount
                          ?? meta.followersCount
                          ?? meta.followers
                          ?? null;
            lines.push(`📛 *Name:* ${name}`);
            lines.push(`🫂 *Followers:* ${fmtNum(followers)}`);
            inviteCode = meta.invite || meta.invite_code || meta.handle || null;
          }
        } catch {
          lines.push(`⚠️ *Note:* Could not fetch channel metadata`);
        }
        if (inviteCode) {
          lines.push(`🔗 *Link:* https://whatsapp.com/channel/${inviteCode}`);
        } else {
          lines.push(`🔗 *Link:* (channel link only available to admins)`);
        }

      } else if (type === 'user' || type === 'user_lid') {
        lines.push(`📂 *Type:* User (${type === 'user_lid' ? 'LID' : 'Phone'})`);
        const num = target.split('@')[0].split(':')[0].replace(/\D/g, '');
        if (type === 'user' && num.length >= 7) {
          lines.push(`📞 *Number:* +${num}`);
          lines.push(`🔗 *Link:* https://wa.me/${num}`);
        } else {
          lines.push(`🔗 *Link:* (LID — no public wa.me link)`);
        }

      } else if (type === 'status') {
        lines.push(`📂 *Type:* WhatsApp Status broadcast`);

      } else if (type === 'broadcast') {
        lines.push(`📂 *Type:* Broadcast list`);

      } else if (type === 'call') {
        lines.push(`📂 *Type:* Call session`);

      } else {
        lines.push(`📂 *Type:* Unknown / unsupported`);
      }

      lines.push(SEP);
      lines.push(`${getFooter(m.key.participant || m.key.remoteJid)}`);

      await sock.sendMessage(chatJid, { text: lines.join('\n') }, { quoted: m });

    } catch (err) {
      await sock.sendMessage(chatJid, {
        text: `❌ *JID Info Error*\n\n${err.message}\n\nPlease try again.`
      }, { quoted: m });
    }
  }
};
