import { isFavourite, setFavourite } from '../../lib/chat-state.js';

export default {
  name: 'removefromfavourite',
  alias: ['removefav', 'unfav', 'unfavourite'],
  description: 'Remove this group from your favourites list',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    if (!isFavourite(jid)) {
      return sock.sendMessage(jid, {
        text: '⭐ This group is not in your favourites. Use *.addtofavourite* to add it.'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
      setFavourite(jid, false);
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '⭐ *Removed from favourites!*\nThis group has been removed from your favourites list.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[removefromfavourite]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  }
};
