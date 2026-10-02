import { getPinnedList } from '../../lib/chat-state.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'pinnedgroups',
  alias: ['pinnedchats', 'listpinned'],
  description: 'List all pinned groups',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    try {
      const pinned = getPinnedList();

      if (!pinned.length) {
        return sock.sendMessage(jid, {
          text: '📌 *No pinned groups.*\nUse *.pingroup* inside a group to pin it.'
        }, { quoted: msg });
      }

      let text = `╭─⌈ 📌 *PINNED GROUPS* ⌋\n│\n`;
      let count = 0;

      for (const groupJid of pinned) {
        count++;
        let name = groupJid;
        try {
          const meta = await sock.groupMetadata(groupJid);
          name = meta.subject || groupJid;
        } catch {}
        text += `├─⊷ ${count}. *${name}*\n`;
      }

      text += `│\n├─⊷ *Total:* ${pinned.length} pinned group(s)\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error('[pinnedgroups]', err.message);
      await sock.sendMessage(jid, { text: `❌ Failed to fetch pinned groups: ${err.message}` }, { quoted: msg });
    }
  }
};
