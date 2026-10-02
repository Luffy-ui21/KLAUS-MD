import { getFavouritesList } from '../../lib/chat-state.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'starredchats',
  alias: ['favourites', 'listfavourites', 'myfav'],
  description: 'List all favourite/starred groups',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    try {
      const favourites = getFavouritesList();

      if (!favourites.length) {
        return sock.sendMessage(jid, {
          text: '⭐ *No favourite groups.*\nUse *.addtofavourite* inside a group to add it.'
        }, { quoted: msg });
      }

      let text = `╭─⌈ ⭐ *FAVOURITE GROUPS* ⌋\n│\n`;
      let count = 0;

      for (const groupJid of favourites) {
        count++;
        let name = groupJid;
        try {
          const meta = await sock.groupMetadata(groupJid);
          name = meta.subject || groupJid;
        } catch {}
        text += `├─⊷ ${count}. *${name}*\n`;
      }

      text += `│\n├─⊷ *Total:* ${favourites.length} favourite group(s)\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error('[starredchats]', err.message);
      await sock.sendMessage(jid, { text: `❌ Failed to fetch favourite groups: ${err.message}` }, { quoted: msg });
    }
  }
};
