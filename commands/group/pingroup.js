import { isPinned, setPinned } from '../../lib/chat-state.js';
import { safeModify } from '../../lib/safe-modify.js';

export default {
  name: 'pingroup',
  alias: ['pinnchat', 'pinchat'],
  description: 'Pin this group to the top of your chat list',
  category: 'group',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    if (isPinned(jid)) {
      return sock.sendMessage(jid, {
        text: '📌 This group is already pinned! Use *.unpingroup* to unpin it.'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

      setPinned(jid, true);
      await safeModify(sock, { pin: true }, jid);

      await sock.sendMessage(jid, { react: { text: '📌', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '📌 *Group pinned!*\nThis group has been pinned to the top of your chat list.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[pingroup]', err.message);
      setPinned(jid, false);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  }
};
