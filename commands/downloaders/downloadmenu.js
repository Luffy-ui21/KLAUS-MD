import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: "downloadmenu",
  alias: ["dlmenu", "downloadhelp", "dlcmds"],
  desc: "Shows media download commands",
  category: "Downloaders",
  usage: ".downloadmenu",

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *📱 SOCIAL MEDIA*
│
│  • instagram
│  • facebook
│  • fbsearch
│  • snapchat
│
╰─⊷

╭─⊷ *🎬 YOUTUBE — VIDEO*
│
│  • yts          → search YouTube
│  • ytv          → download video
│  • ytmp4        → download video (MP4)
│  • ytvdoc       → download video as doc
│  • dlmp4        → download video by name
│  • playlist     → download playlist
│
╰─⊷

╭─⊷ *🎵 YOUTUBE — AUDIO*
│
│  • ytplay       → search & play audio
│  • ytmp3        → download audio (MP3)
│  • yta3         → download audio (fallback)
│  • ytplaydoc    → download audio as doc
│  • dlmp3        → download audio by name
│
╰─⊷

╭─⊷ *🔞 ADULT*
│
│  • xvideos
│  • xnxx
│  • porn
│
╰─⊷

╭─⊷ *📦 OTHER*
│
│  • mp3          → audio downloader
│  • mp4          → video downloader
│  • apk          → APK downloader
│  • mediafire    → MediaFire downloader
│  • downloadurl  → download any URL (auto-detect)
│
╰─⊷`;

    await sendSubMenu(sock, jid, '⬇️ DOWNLOAD MENU', commandsText, m, PREFIX);
  }
};
