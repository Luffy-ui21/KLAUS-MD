import fetch from "node-fetch";
import { createRequire } from 'module';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';

const _require = createRequire(import.meta.url);
let sendInteractiveMessage;
try { ({ sendInteractiveMessage } = _require('wolfbtns')); } catch (e) {}

export default {
  name: "wiki",
  alias: ["wikipedia"],
  category: "tools",
  desc: "Search Wikipedia and get a brief summary",
  execute: async (sock, msg, args) => {
    try {
      const chatId = msg.key.remoteJid;

      let searchTerm = args.join(" ").trim();

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!searchTerm && quoted) {
        searchTerm =
          quoted.conversation ||
          quoted.extendedTextMessage?.text ||
          quoted.imageMessage?.caption ||
          quoted.videoMessage?.caption ||
          "";
      }

      if (!searchTerm) {
        return await sock.sendMessage(chatId, {
          text: `╭─⌈ 🌐 *WIKIPEDIA* ⌋\n│\n├─⊷ *wiki <search term>*\n│  └⊷ Search Wikipedia and get a summary\n│\n├─⊷ *Reply*\n│  └⊷ Reply to a message with .wiki\n│\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
          quoted: msg
        });
      }

      if (searchTerm.toLowerCase() === "klaus md" || searchTerm.toLowerCase() === "klaus-md" || searchTerm.toLowerCase() === "silent wolf") {
        return await sock.sendMessage(chatId, {
                text: " *${getBotName()}* — The Alpha of Bots!\n\n🌟 He outshined Meiser Hex, one of the greatest bots ever — bow down and fear the legend! 😎",
          quoted: msg
        });
      }

      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error("Article not found");

      const data = await response.json();
      const pageUrl = data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`;
      const summary = data.extract || '';
      const shortSummary = summary.length > 300 ? summary.substring(0, 297) + '...' : summary;

      const resultText = `🌐 *Wikipedia: ${data.title}*\n\n📝 ${data.description || ''}\n\n${shortSummary}`;

      if (isButtonModeEnabled() && typeof sendInteractiveMessage === 'function') {
        try {
          const msgOpts = {
            text: resultText,
            footer: '🌐 Wikipedia',
            interactiveButtons: [
              {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({ display_text: '📖 Read Full Article', url: pageUrl })
              },
              {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Summary', copy_code: `${data.title}\n\n${summary}` })
              }
            ]
          };
          if (data.thumbnail?.source) msgOpts.image = { url: data.thumbnail.source };
          await sendInteractiveMessage(sock, chatId, msgOpts);
          return;
        } catch (btnErr) {
          console.log('[Wiki] Button send failed:', btnErr.message);
        }
      }

      await sock.sendMessage(chatId, {
        text: `${resultText}\n\n🔗 ${pageUrl}`,
        quoted: msg,
        linkPreview: false
      });

    } catch {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "❌ Could not find a Wikipedia article for your search term. Please try another keyword.",
        quoted: msg
      });
    }
  }
};
