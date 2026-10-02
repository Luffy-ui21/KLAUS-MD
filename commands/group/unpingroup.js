import { isPinned, setPinned } from '../../lib/chat-state.js';
import { safeModify } from '../../lib/safe-modify.js';

export default {
  name: 'unpingroup',
  alias: ['unpinchat'],
  description: 'Unpin this group from the top of your chat list',
  category: 'group',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    if (!isPinned(jid)) {
      return sock.sendMessage(jid, {
        text: '📌 This group is not pinned. Use *.pingroup* to pin it.'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

      setPinned(jid, false);
      await safeModify(sock, { pin: false }, jid);

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '📌 *Group unpinned!*\nThis group has been removed from pinned chats.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[unpingroup]', err.message);
      setPinned(jid, true);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  }
};
