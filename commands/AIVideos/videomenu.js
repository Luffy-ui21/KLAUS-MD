import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "videomenu",
  alias: ["vidmenu", "aividmenu", "videoeffects"],
  desc: "Shows AI video effect commands",
  category: "AIVideos",
  usage: ".videomenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *🎬 AI VIDEO EFFECTS*
│
│  • tigervideo
│  • introvideo
│  • lightningpubg
│  • lovevideo
│  • videogen
│
╰─⊷`;

    await sendSubMenu(sock, jid, '🎬 AI VIDEO EFFECTS MENU', commandsText, m, PREFIX);
  }
};
