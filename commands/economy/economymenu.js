import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "economymenu",
  alias: ["ecomenu", "ecohelp", "economyhelp", "moneymenu"],
  desc: "Shows economy commands",
  category: "Economy",
  usage: ".economymenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *💰 ECONOMY*
│
│  • balance
│  • daily
│  • work
│  • deposit
│  • withdraw
│  • pay
│  • rob
│  • gamble
│  • leaderboard
│  • profile
│  • economymenu
│
╰─⊷`;

    await sendSubMenu(sock, jid, '💰 ECONOMY MENU', commandsText, m, PREFIX);
  }
};
