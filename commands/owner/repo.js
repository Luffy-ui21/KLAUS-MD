import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import moment from 'moment-timezone';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { OWNER, REPO, REPO_URL, REPO_ZIP } from '../../lib/repoConfig.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { createRequire } from 'module';

const _req = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = _req('wolfbtns'); } catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MENU_IMAGE_URL = "https://i.ibb.co/Gvkt4q9d/Chat-GPT-Image-Feb-21-2026-12-47-33-AM.png";

function getRepoImage() {
  const menuMediaDir1 = path.join(__dirname, "../menus/media");
  const menuMediaDir2 = path.join(__dirname, "../media");
  const imgPaths = [
    path.join(menuMediaDir1, "wolfbot.jpg"),
    path.join(menuMediaDir2, "wolfbot.jpg"),
    path.join(menuMediaDir1, "wolfbot.png"),
    path.join(menuMediaDir2, "wolfbot.png"),
  ];
  for (const p of imgPaths) {
    if (fs.existsSync(p)) {
      try { return { type: 'buffer', data: fs.readFileSync(p) }; } catch {}
    }
  }
  return { type: 'url', data: DEFAULT_MENU_IMAGE_URL };
}


async function sendRepoCard(sock, jid, caption, imagePayload, sender, fkontak) {
  if (isButtonModeEnabled() && giftedBtns?.sendInteractiveMessage) {
    try {
      const btnPayload = {
        text: caption,
        footer: ` ${getBotName()}`,
        interactiveButtons: [
          {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: '🌐 View Repo',
              url: REPO_URL
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '📦 Download Zip',
              id: `__repo_zip__`
            })
          }
        ]
      };
      if (imagePayload.image) btnPayload.image = imagePayload.image;
      await giftedBtns.sendInteractiveMessage(sock, jid, btnPayload, { quoted: fkontak });
      return;
    } catch {}
  }
  // Plain mode
  await sock.sendMessage(jid, {
    ...imagePayload,
    caption,
    mentions: [sender]
  }, { quoted: fkontak });
}

export default {
  name: "repo",
  aliases: ["r", "sc", "source", "github", "git", "wolfrepo", "botrepo"],
  description: "Shows bot GitHub repository information",

  async execute(sock, m, args, PREFIX) {
    try {
      const jid = m.key.remoteJid;
      const sender = m.key.participant || m.key.remoteJid;
      const mentionTag = `@${sender.split('@')[0]}`;

      function createFakeContact(message) {
        return {
          key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: getBotName()
          },
          message: {
            contactMessage: {
              vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${getBotName()}\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
          },
          participant: "0@s.whatsapp.net"
        };
      }

      const fkontak = createFakeContact(m);
      const img = getRepoImage();
      const imagePayload = img.type === 'buffer' ? { image: img.data } : { image: { url: img.data } };

      try {
        const { data } = await axios.get(
          `https://api.github.com/repos/${OWNER}/${REPO}`,
          {
            timeout: 10000,
            headers: { "User-Agent": "WolfBot", "Accept": "application/vnd.github.v3+json" }
          }
        );

        let sizeText;
        const sizeKB = data.size;
        sizeText = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;

        let txt = `╭─⌈ \`WOLF REPO\` ⌋\n`;
        txt += `│\n`;
        txt += `│ ✧ *Name* : ${data.name || "Silent Wolf "}\n`;
        txt += `│ ✧ *Owner* : ${OWNER}\n`;
        txt += `│ ✧ *Stars* : ${data.stargazers_count || 0} ⭐\n`;
        txt += `│ ✧ *Forks* : ${data.forks_count || 0} 🍴\n`;
        txt += `│ ✧ *Watchers* : ${data.watchers_count || 0} 👁️\n`;
        txt += `│ ✧ *Size* : ${sizeText}\n`;
        txt += `│ ✧ *Updated* : ${moment(data.updated_at).format('DD/MM/YYYY HH:mm:ss')}\n`;
        txt += `│ ✧ *Repo* : ${REPO_URL}\n`;
        txt += `│ *Description* : ${data.description || 'A powerful WhatsApp bot with 400+ commands'}\n`;
        txt += `│ Hey ${mentionTag}! 👋\n`;
        txt += `│ _*Don't forget*_ 🎉\n`;
        txt += `│ *to fork and star the repo!* ⭐\n`;
        txt += `╰───`;

        await sendRepoCard(sock, jid, txt, imagePayload, sender, fkontak);
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

      } catch (apiError) {
        console.error("GitHub API Error:", apiError);

        const fallbackText = `╭─⌈ *WOLF REPO* ⌋\n` +
          `│\n` +
          `│ ✧ *Name* : Silent Wolf Bot\n` +
          `│ ✧ *Owner* : ${OWNER}\n` +
          `│ ✧ *Repository* : ${REPO_URL}\n` +
          `│ ✧ *Status* : ✅ NEW CLEAN REPOSITORY\n` +
          `│ ✧ *Size* : ~1.5 MB (Optimized)\n` +
          `│ ✧ *Last Updated* : ${moment().format('DD/MM/YYYY HH:mm:ss')}\n` +
          `│\n` +
          `│ *Features* :\n` +
          `│ • 400+ Commands\n` +
          `│ • No node_modules in repo ✅\n` +
          `│ • Clean and optimized\n` +
          `│ • Fast and reliable\n` +
          `│\n` +
          `│ Hey ${mentionTag}! 👋\n` +
          `│ _This repository is clean and optimized!_\n` +
          `│ *Be the first to star it!* ⭐\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

        await sendRepoCard(sock, jid, fallbackText, imagePayload, sender, fkontak);
        await sock.sendMessage(jid, { react: { text: '⚠️', key: m.key } });
      }

    } catch (err) {
      console.error("General Error:", err);
      const img = getRepoImage();
      const imagePayload = img.type === 'buffer' ? { image: img.data } : { image: { url: img.data } };
      const simpleText = `*WOLF REPO*\n\n` +
        `• *New Repository* : ✅ YES\n` +
        `• *URL* : ${REPO_URL}\n` +
        `• *Status* : Clean and optimized\n` +
        `• *Size* : ~1.5 MB\n\n` +
        `Hey @${(m.key.participant || m.key.remoteJid).split('@')[0]}! _Thank you for choosing Silent Wolf!_`;
      await sendRepoCard(sock, m.key.remoteJid, simpleText, imagePayload,
        m.key.participant || m.key.remoteJid, m);
    }
  },
};