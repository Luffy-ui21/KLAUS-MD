import { isArchived, setArchived } from '../../lib/chat-state.js';
import { safeModify } from '../../lib/safe-modify.js';

export default {
  name: 'archive',
  alias: ['archivechat', 'archivegroup', 'unarchive', 'unarchivechat', 'unarchivegroup'],
  description: 'Archive or unarchive the current chat',
  category: 'group',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

      const currently = isArchived(jid);
      const shouldArchive = !currently;

      const lastMessages = [{
        key: msg.key,
        messageTimestamp: msg.messageTimestamp
      }];

      setArchived(jid, shouldArchive);
      await safeModify(sock, { archive: shouldArchive, lastMessages }, jid);

      await sock.sendMessage(jid, { react: { text: shouldArchive ? '📦' : '📂', key: msg.key } });
      await sock.sendMessage(jid, {
        text: shouldArchive
          ? '📦 *Chat archived!*\nThis group has been moved to archived chats.'
          : '📂 *Chat unarchived!*\nThis group has been restored from archived chats.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[archive]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  }
};
