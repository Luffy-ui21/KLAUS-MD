import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "funmenu",
  alias: ["funcmds", "funhelp"],
  desc: "Shows fun commands",
  category: "Fun",
  usage: ".funmenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *🎭 FUN & TOOLS*
│
│  • bf
│  • gf
│  • couple
│  • gay
│  • getjid
│  • movie
│  • trailer
│  • goodmorning
│  • goodnight
│  • channelstatus
│  • hack
│  • fakeblank
│  • insult
│  • advice
│  • gaymeter
│  • quote
│  • bible
│
╰─⊷`;

    await sendSubMenu(sock, jid, '🎭 FUN MENU', commandsText, m, PREFIX);
  }
};
