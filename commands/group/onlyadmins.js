import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const BRAND = () => getOwnerName().toUpperCase();

export default {
  name: 'onlyadmins',
  alias: ['addmode', 'memberaddmode'],
  description: 'Control who can add new members to the group.',

  execute: async (sock, msg, args, PREFIX, extra) => {
    const chatId = msg.key.remoteJid;

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    let groupMeta;
    try {
      groupMeta = await sock.groupMetadata(chatId);
    } catch {
      return sock.sendMessage(chatId, { text: '❌ Failed to fetch group info.' }, { quoted: msg });
    }

    const senderJid = msg.key.participant || chatId;
    const senderClean = senderJid.split(':')[0].split('@')[0];
    const senderP = groupMeta.participants.find(p => p.id.split(':')[0].split('@')[0] === senderClean);
    const isAdmin = senderP?.admin === 'admin' || senderP?.admin === 'superadmin';

    if (!isAdmin) {
      return sock.sendMessage(chatId, { text: '❌ Only group admins can change this setting.' }, { quoted: msg });
    }

    const sub = (args[0] || '').toLowerCase();

    // Show current status if no subcommand
    if (!sub || sub === 'status') {
      // memberAddMode: true = all members can add, false = admins only
      const current = groupMeta.memberAddMode ? '👥 All members' : '👑 Admins only';
      return sock.sendMessage(chatId, {
        text:
          `╭─⌈ 👥 *MEMBER ADD MODE* ⌋\n` +
          `├─⊷ Current : *${current}*\n` +
          `├─⊷ *${PREFIX}onlyadmins on*  — only admins can add members\n` +
          `├─⊷ *${PREFIX}onlyadmins off* — anyone can add members\n` +
          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
    }

    if (sub !== 'on' && sub !== 'off') {
      return sock.sendMessage(chatId, {
        text: `❌ Usage: *${PREFIX}onlyadmins on* or *${PREFIX}onlyadmins off*`
      }, { quoted: msg });
    }

    const adminsOnly = sub === 'on';
    const baileysMode = adminsOnly ? 'admin_add' : 'all_member_add';

    try {
      await sock.groupMemberAddMode(chatId, baileysMode);
      const icon = adminsOnly ? '👑' : '👥';
      const desc = adminsOnly
        ? 'Only admins can now add new members.'
        : 'All members can now add others to the group.';
      return sock.sendMessage(chatId, {
        text:
          `╭─⌈ ${icon} *MEMBER ADD MODE* ⌋\n` +
          `├─⊷ Status : *${adminsOnly ? 'Admins only' : 'All members'}*\n` +
          `├─⊷ ${desc}\n` +
          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
    } catch (err) {
      return sock.sendMessage(chatId, {
        text: `❌ Failed to update member add mode: ${err.message}`
      }, { quoted: msg });
    }
  },
};
