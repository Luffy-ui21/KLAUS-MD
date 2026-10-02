import fetch from 'node-fetch';
import { createRequire } from 'module';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';

const require = createRequire(import.meta.url);
let sendInteractiveMessage;
try { ({ sendInteractiveMessage } = require('wolfbtns')); } catch (e) {}

export default {
  name: 'shorturl',
  alias: ['tinyurl', 'shorten'],
  description: '🔗 Shorten a long URL',
  category: 'utility',
  usage: '.shorturl <long URL>',

  async execute(sock, m, args, from, isGroup, sender) {
    const jid = typeof from === 'string' ? from : m.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(
        jid,
        { text: `╭─⌈ 🔗 *URL SHORTENER* ⌋\n│\n├─⊷ *shorturl <URL>*\n│  └⊷ Shorten a long URL\n│\n├─⊷ *Example:*\n│  └⊷ \`.shorturl https://example.com\`\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}` },
        { quoted: m }
      );
    }

    const longUrl = args[0];

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
      const shortUrl = await response.text();

      if (!shortUrl || shortUrl.includes('Error')) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: '❌ Failed to shorten URL. Please check the URL and try again.' }, { quoted: m });
      }

      if (isButtonModeEnabled() && typeof sendInteractiveMessage === 'function') {
        try {
          await sendInteractiveMessage(sock, jid, {
            text: `✅ *URL Shortened!*\n\n🔗 *Short:* ${shortUrl}\n🌐 *Original:* ${longUrl.substring(0, 60)}${longUrl.length > 60 ? '...' : ''}`,
            footer: ' Silent Wolf',
            interactiveButtons: [
              {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Short URL', copy_code: shortUrl })
              },
              {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({ display_text: '🌐 Open Link', url: shortUrl })
              }
            ]
          });
          await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
          return;
        } catch (btnErr) {
          console.log('[ShortURL] Button send failed:', btnErr.message);
        }
      }

      await sock.sendMessage(jid, { text: `🔗 *Short URL:*\n${shortUrl}` }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error('[ShortURL Error]', err);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      if (typeof jid === 'string') {
        sock.sendMessage(jid, { text: '❌ Failed to shorten URL. Please try again later.' }, { quoted: m });
      }
    }
  }
};
