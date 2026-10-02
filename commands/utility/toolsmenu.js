import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "toolsmenu",
  alias: ["utilitymenu", "utilmenu", "toolshelp"],
  desc: "Shows utility and tools commands",
  category: "Utility",
  usage: ".toolsmenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *📰 NEWS*
│
│  • citizennews
│  • bbcnews
│  • ntvnews
│  • kbcnews
│  • technews
│
╰─⊷

╭─⊷ *🔍 INFO & SEARCH*
│
│  • alive
│  • ping
│  • ping2
│  • time
│  • uptime
│  • define
│  • remind
│  • sessioninfo
│  • genmusic
│  • genlyrics
│  • news
│  • covid
│  • weather
│  • wiki
│  • translate
│  • calc
│  • iplookup
│  • getip
│  • getpp
│  • getgpp
│  • prefixinfo
│  • onwhatsapp
│  • country
│
╰─⊷

╭─⊷ *🔗 CONVERSION & MEDIA*
│
│  • shorturl
│  • url
│  • fetch
│  • qrencode
│  • qrdecode
│  • topdf
│  • extractpdf
│  • toword
│  • extractword
│  • toexcel
│  • extractexcel
│  • toppt
│  • extractppt
│  • take
│  • imgbb
│  • save
│  • rename
│  • screenshot
│  • inspect
│
╰─⊷

╭─⊷ *🔐 CODE TOOLS*
│
│  • encrypt
│
╰─⊷

╭─⊷ *📇 CONTACT TOOLS*
│
│  • vcf
│  • viewvcf
│  • vv
│  • vv2
│
╰─⊷

╭─⊷ *👑 OWNER TOOLS*
│
│  • broadcast
│  • shutdown
│  • restart
│  • mode
│  • setprefix
│  • setowner
│  • addsudo
│  • clearsudo
│
╰─⊷`;

    await sendSubMenu(sock, jid, '✨ Tools & Utility Menu', commandsText, m, PREFIX);
  }
};
