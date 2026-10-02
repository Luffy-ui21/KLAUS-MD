import { getMutedList } from '../../lib/chat-state.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'mutedgroups',
  alias: ['mutedchats', 'listmuted'],
  description: 'List all muted groups',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    try {
      const muted = getMutedList();

      if (!muted.length) {
        return sock.sendMessage(jid, {
          text: '🔕 *No muted groups.*\nUse *.notifications* inside a group to mute it.'
        }, { quoted: msg });
      }

      let text = `╭─⌈ 🔕 *MUTED GROUPS* ⌋\n│\n`;
      let count = 0;

      for (const groupJid of muted) {
        count++;
        let name = groupJid;
        try {
          const meta = await sock.groupMetadata(groupJid);
          name = meta.subject || groupJid;
        } catch {}
        text += `├─⊷ ${count}. *${name}*\n`;
      }

      text += `│\n├─⊷ *Total:* ${muted.length} muted group(s)\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error('[mutedgroups]', err.message);
      await sock.sendMessage(jid, { text: `❌ Failed to fetch muted groups: ${err.message}` }, { quoted: msg });
    }
  }
};
