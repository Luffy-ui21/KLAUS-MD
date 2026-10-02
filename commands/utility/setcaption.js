import { STATUS, UI } from '../../lib/emojis.js';
import { getUserCaption, setUserCaption } from '../../lib/captionStore.js';

export default {
  name: "setcaption",
  description: "Set custom caption for all media downloads",
  category: 'utility',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const userId = m.key.participant || m.key.remoteJid;

    try {
      if (!args[0]) {
        const currentCaption = getUserCaption(userId);
        await sock.sendMessage(jid, {
          text: `${UI.NOTE} *Global Caption Settings*\n\nUsage: setcaption <your text>\n\nCurrent caption: "${currentCaption}"\n\nThis caption is appended to supported media downloads and AI image generation.`
        }, { quoted: m });
        return;
      }

      const caption = args.join(' ');
      setUserCaption(userId, caption);

      await sock.sendMessage(jid, {
        text: `${STATUS.SUCCESS} Global caption set!\n\n"${caption}"\n\nThe caption will be used for supported media downloads and AI images.`
      }, { quoted: m });

    } catch (error) {
      await sock.sendMessage(jid, { text: `❌ Error setting caption` }, { quoted: m });
    }
  },
};
