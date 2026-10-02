import { getActionSession, deleteActionSession } from '../../lib/actionSession.js';

export default {
  name: 'kickconfirm',
  description: 'Confirm a pending kick action',
  category: 'group',

  execute: async (sock, msg, args, PREFIX) => {
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return;

    const senderJid = msg.key.participant || (msg.key.fromMe ? sock.user.id : chatId);
    const senderClean = senderJid.split(':')[0].split('@')[0];
    const sessionKey = `kick:${senderClean}:${chatId.split('@')[0]}`;

    const session = getActionSession(sessionKey);
    if (!session) {
      return sock.sendMessage(chatId, {
        text: '❌ No pending kick action. Use the kick command again.'
      }, { quoted: msg });
    }

    deleteActionSession(sessionKey);

    try {
      await sock.groupParticipantsUpdate(chatId, session.targets, 'remove');
      const kickedNames = session.targets.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ');
      await sock.sendMessage(chatId, {
        text: `👢 Kicked ${session.targets.length} user(s): ${kickedNames}`,
        mentions: session.targets
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(chatId, {
        text: '❌ Failed to kick user(s). Check my permissions.'
      }, { quoted: msg });
    }
  },
};
