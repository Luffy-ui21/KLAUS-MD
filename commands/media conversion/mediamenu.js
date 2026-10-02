import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "mediamenu",
  alias: ["convertmenu", "conversionmenu", "mediacmds"],
  desc: "Shows media conversion commands",
  category: "Media",
  usage: ".mediamenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *🔄 MEDIA CONVERSION*
│
│  • toimage
│  • tosticker
│  • toaudio
│  • tovoice
│  • togif
│  • tts
│  • bass
│  • trebleboost
│  • jarvis
│
╰─⊷`;

    await sendSubMenu(sock, jid, '🔄 MEDIA CONVERSION MENU', commandsText, m, PREFIX);
  }
};
