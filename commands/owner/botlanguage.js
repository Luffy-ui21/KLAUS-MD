// commands/owner/botlanguage.js
// .botlanguage <language> — Set the language for ALL bot responses
// .botlanguage english / .botlanguage reset — turn off translation

import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import {
  LANGUAGE_CODES,
  getBotLanguage,
  setBotLanguage,
  clearBotLanguage,
  clearTranslationCache,
} from '../../lib/translator.js';

export default {
  name: 'botlanguage',
  aliases: ['setlang', 'blang', 'botlang'],
  description: 'Set the language for all bot responses and menus',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const p   = (args[0] || '').toLowerCase().trim();

    const footer = `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

    // ── No args: show current + list ────────────────────────────────────────
    if (!p) {
      const current = getBotLanguage();
      const langList = Object.entries(LANGUAGE_CODES)
        .filter(([name, code]) => name.length > 2 && name !== 'default' && name !== 'reset' && name !== 'off')
        .map(([name]) => `│  └⊷ ${name}`)
        .join('\n');

      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🌐 *BOT LANGUAGE* ⌋\n` +
          `├⊷ *Current:* ${current.language} (${current.code})\n` +
          `│\n` +
          `├─⌈ *Usage*\n` +
          `│  └⊷ botlanguage swahili\n` +
          `│  └⊷ botlanguage french\n` +
          `│  └⊷ botlanguage english ← reset\n` +
          `│\n` +
          `├─⌈ *Supported Languages*\n` +
          `${langList}\n` +
          `│\n` +
          footer
      }, { quoted: m });
    }

    // ── Reset / English ──────────────────────────────────────────────────────
    if (['english', 'en', 'reset', 'default', 'off'].includes(p)) {
      clearBotLanguage();
      clearTranslationCache();
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🌐 *BOT LANGUAGE* ⌋\n` +
          `├⊷ ✅ *Language reset to English*\n` +
          `├⊷ All responses will now be in English\n` +
          `│\n` +
          footer
      }, { quoted: m });
    }

    // ── Set language ─────────────────────────────────────────────────────────
    const code = LANGUAGE_CODES[p];
    if (!code) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🌐 *BOT LANGUAGE* ⌋\n` +
          `├⊷ ❌ *Unknown language:* "${p}"\n` +
          `├⊷ Type *botlanguage* to see all supported languages\n` +
          `│\n` +
          footer
      }, { quoted: m });
    }

    if (code === 'en') {
      clearBotLanguage();
      clearTranslationCache();
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🌐 *BOT LANGUAGE* ⌋\n` +
          `├⊷ ✅ *Language reset to English*\n` +
          `│\n` +
          footer
      }, { quoted: m });
    }

    setBotLanguage(p, code);
    clearTranslationCache();

    return sock.sendMessage(jid, {
      text:
        `╭─⌈ 🌐 *BOT LANGUAGE* ⌋\n` +
        `├⊷ ✅ *Language set to ${p} (${code})*\n` +
        `├⊷ All bot responses will now be translated\n` +
        `├⊷ Use *botlanguage english* to reset\n` +
        `│\n` +
        footer
    }, { quoted: m });
  },
};
