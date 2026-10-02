import { deleteActionSession } from '../../lib/actionSession.js';

export default {
  name: 'kickcancel',
  description: 'Cancel a pending kick action',
  category: 'group',

  execute: async (sock, msg, args, PREFIX) => {
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return;

    const senderJid = msg.key.participant || (msg.key.fromMe ? sock.user.id : chatId);
    const senderClean = senderJid.split(':')[0].split('@')[0];
    const sessionKey = `kick:${senderClean}:${chatId.split('@')[0]}`;

    deleteActionSession(sessionKey);
    return sock.sendMessage(chatId, { text: '❌ Kick action cancelled.' }, { quoted: msg });
  },
};
