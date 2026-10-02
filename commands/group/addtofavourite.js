import { isFavourite, setFavourite } from '../../lib/chat-state.js';

export default {
  name: 'addtofavourite',
  alias: ['favourite', 'addfav', 'fav'],
  description: 'Add this group to your favourites list',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    if (isFavourite(jid)) {
      return sock.sendMessage(jid, {
        text: '⭐ This group is already in your favourites! Use *.removefromfavourite* to remove it.'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
      setFavourite(jid, true);
      await sock.sendMessage(jid, { react: { text: '⭐', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '⭐ *Added to favourites!*\nThis group has been added to your favourites list.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[addtofavourite]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  }
};
