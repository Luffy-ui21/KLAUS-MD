import { getArchivedList } from '../../lib/chat-state.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'archivedgroups',
  alias: ['archivedchats', 'listarchived'],
  description: 'List all archived groups',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    try {
      const archived = getArchivedList();

      if (!archived.length) {
        return sock.sendMessage(jid, {
          text: '📦 *No archived groups.*\nUse *.archive* inside a group to archive it.'
        }, { quoted: msg });
      }

      let text = `╭─⌈ 📦 *ARCHIVED GROUPS* ⌋\n│\n`;
      let count = 0;

      for (const groupJid of archived) {
        count++;
        let name = groupJid;
        try {
          const meta = await sock.groupMetadata(groupJid);
          name = meta.subject || groupJid;
        } catch {}
        text += `├─⊷ ${count}. *${name}*\n`;
      }

      text += `│\n├─⊷ *Total:* ${archived.length} archived group(s)\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error('[archivedgroups]', err.message);
      await sock.sendMessage(jid, { text: `❌ Failed to fetch archived groups: ${err.message}` }, { quoted: msg });
    }
  }
};
