import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getFooter } from '../../lib/menuHelper.js';

const NANO_URL = 'https://api.cod3uchiha.com/ai/NanoBanana';

export default {
  name: 'nanobanana',
  aliases: ['nano', 'nanobana', 'nanoai'],
  category: 'imagegen',
  description: 'Generate AI images with NanoBanana',
  usage: 'nanobanana <prompt>',

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const prompt = args.join(' ').trim() || (m.quoted?.text || '').trim();

    if (!prompt) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🍌 *NANOBANANA AI* ⌋\n│\n` +
              `├─⊷ *nanobanana <prompt>*\n│  └⊷ Generate AI images with NanoBanana\n│\n` +
              `├─⊷ *Examples:*\n│  └⊷ nanobanana a futuristic city at night\n` +
              `│  └⊷ nanobanana cute cat in a forest\n│\n` +
              `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      const res = await axios.get(NANO_URL, {
        params: { prompt },
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const buffer = Buffer.from(res.data);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `🍌 *NANOBANANA AI*\n📝 _${prompt}_\n\n_Powered by ${getBotName()}_`
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error('[NANOBANANA] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *NanoBanana Error*\n\n${err.message}\n\nPlease try again later.`
      }, { quoted: m });
    }
  }
};
