import fetch from "node-fetch";
import { createRequire } from 'module';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';

const _require = createRequire(import.meta.url);
let sendInteractiveMessage;
try { ({ sendInteractiveMessage } = _require('wolfbtns')); } catch (e) {}

export default {
  name: "define",
  alias: ["meaning", "dict"],
  description: "Get the definition of a word (reply or type a word)",

  async execute(sock, m, args) {
    try {
      let word;

      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        word =
          m.message.extendedTextMessage.contextInfo.quotedMessage?.conversation ||
          m.message.extendedTextMessage.contextInfo.quotedMessage?.extendedTextMessage?.text;
      } else {
        word = args.join(" ");
      }

      if (!word) {
        await sock.sendMessage(m.key.remoteJid, {
          text: `╭─⌈ 💚 *DICTIONARY* ⌋\n│\n├─⊷ *define <word>*\n│  └⊷ Get the definition of a word\n│\n├─⊷ *Reply*\n│  └⊷ Reply to a word with .define\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
        return;
      }

      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (!res.ok) throw new Error("Word not found");

      const data = await res.json();
      const partOfSpeech = data[0]?.meanings[0]?.partOfSpeech || '';
      const definition = data[0]?.meanings[0]?.definitions[0]?.definition || "No definition found.";
      const example = data[0]?.meanings[0]?.definitions[0]?.example || '';

      const outText = `🌿 *Silent Wolf Dictionary* 🌿\n\n🔎 *Word:* ${word}${partOfSpeech ? ` _(${partOfSpeech})_` : ''}\n📖 *Definition:* ${definition}${example ? `\n📝 *Example:* ${example}` : ''}`;
      const copyText = `${word}${partOfSpeech ? ` (${partOfSpeech})` : ''}\n\nDefinition: ${definition}${example ? `\nExample: ${example}` : ''}`;

      if (isButtonModeEnabled() && typeof sendInteractiveMessage === 'function') {
        try {
          await sendInteractiveMessage(sock, m.key.remoteJid, {
            text: outText,
            footer: '📖 Silent Wolf Dictionary',
            interactiveButtons: [
              {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Definition', copy_code: copyText })
              }
            ]
          });
          return;
        } catch (btnErr) {
          console.log('[Define] Button send failed:', btnErr.message);
        }
      }

      await sock.sendMessage(m.key.remoteJid, { text: outText }, { quoted: m });

    } catch (e) {
      console.error("❌ Error in define command:", e);
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Could not fetch definition. Try another word."
      }, { quoted: m });
    }
  },
};
