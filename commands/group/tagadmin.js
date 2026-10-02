// commands/group/tagadmin.js

import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'tagadmin',
  alias: ['tagadmins'],
  description: 'Tags all admins in the group.',
  execute: async (sock, msg, args, prefix, opts) => {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    try {
      const groupMetadata = await sock.groupMetadata(jid);
      const participants = groupMetadata.participants;

      const admins = participants
        .filter(p => p.admin)
        .map(p => ({
          id: p.id,
          name: p.name || p.notify || p.id.split('@')[0],
          role: p.admin
        }));

      if (admins.length === 0) {
        return sock.sendMessage(jid, { text: '⚠️ No admins found in this group.' }, { quoted: msg });
      }

      const customMessage = args.length > 0 ? args.join(' ') : '';
      const groupName = groupMetadata.subject || 'Group';
      let text = `╭⊷ 👑 *TAG ADMINS*\n│\n`;
      if (customMessage) {
        text += `├⊷ 📢 ${customMessage}\n│\n`;
      }
      text += `├⊷ 🏷️ *Group:* ${groupName}\n`;
      text += `├⊷ 👑 *Admins:* ${admins.length}\n`;
      text += `│\n`;

      admins.forEach((admin, index) => {
        const num = (index + 1).toString().padStart(2, '0');
        const tag = admin.role === 'superadmin' ? '⭐' : '🔰';
        text += `├⊷ ${num}. ${tag} @${admin.id.split('@')[0]}\n`;
      });

      text += `│\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

      const mentionIds = admins.map(a => a.id);

      let profilePicture = null;
      try {
        profilePicture = await sock.profilePictureUrl(jid, 'image');
      } catch {
        profilePicture = null;
      }

      if (profilePicture) {
        const response = await fetch(profilePicture);
        const buffer = await response.arrayBuffer();
        await sock.sendMessage(jid, {
          image: Buffer.from(buffer),
          caption: text,
          mentions: mentionIds
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          text,
          mentions: mentionIds
        }, { quoted: msg });
      }

    } catch (err) {
      console.error('❌ tagadmin error:', err);
      await sock.sendMessage(jid, { text: '❌ Failed to tag admins.' }, { quoted: msg });
    }
  }
};
