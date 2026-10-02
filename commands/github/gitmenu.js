import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "gitmenu",
  alias: ["githubmenu", "gitcmds", "githelp"],
  desc: "Shows GitHub commands",
  category: "GitHub",
  usage: ".gitmenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *🐙 GITHUB COMMANDS*
│
│  • gitclone
│  • zip
│  • update
│  • repo
│
╰─⊷`;

    await sendSubMenu(sock, jid, '🐙 GITHUB MENU', commandsText, m, PREFIX);
  }
};
