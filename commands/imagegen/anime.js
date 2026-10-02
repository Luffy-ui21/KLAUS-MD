import axios from 'axios';
import FormData from 'form-data';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CASPER_URL = 'https://ai-image-gen.xcasper.space/v1/image/prompt/generate';

async function casperGenerate(prompt) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('total_images', '1');
  form.append('image_size', '512x512');
  const res = await axios.post(CASPER_URL, form, { headers: form.getHeaders(), timeout: 50000 });
  const { url, error } = res.data;
  if (error) throw new Error(error);
  if (!url?.[0]) throw new Error('No image returned');
  return url[0];
}

export default {
  name: 'anime',
  aliases: ['animediff', 'animegen', 'waifu'],
  category: 'imagegen',
  description: 'Generate anime-style AI images',

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    if (!args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🎨 *ANIME IMAGE GEN* ⌋\n│\n` +
              `├─⊷ *anime <prompt>*\n│  └⊷ Generate anime-style AI images\n│\n` +
              `├─⊷ *Examples:*\n│  └⊷ anime cute cat girl with blue hair\n` +
              `│  └⊷ anime cyberpunk samurai in tokyo\n│\n` +
              `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const prompt = `anime style, ${args.join(' ')}, highly detailed, vibrant colors`;

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      const statusMsg = await sock.sendMessage(jid, {
        text: `🎨 *Generating anime image...*\n📝 _${args.join(' ').substring(0, 60)}_`
      }, { quoted: m });

      let imageUrl;
      try {
        imageUrl = await casperGenerate(prompt);
      } catch {
        const encoded = encodeURIComponent(prompt);
        imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=768&model=flux&seed=${Date.now()}`;
      }

      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgRes.data);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `🎨 *ANIME AI*\n📝 _${args.join(' ')}_\n\n_Powered by ${getBotName()}_`
      }, { quoted: m });

      await sock.sendMessage(jid, { delete: statusMsg.key }).catch(() => {});
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *Failed:* ${err.message}` }, { quoted: m });
    }
  }
};
