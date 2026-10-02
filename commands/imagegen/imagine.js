import axios from 'axios';
import FormData from 'form-data';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CASPER_URL = 'https://ai-image-gen.xcasper.space/v1/image/prompt/generate';
const CASPER_BING_URL = 'https://ai-image-gen.xcasper.space/v1/image/bing/generate';

const SIZES = { portrait: '512x512', landscape: '1024x1024', square: '512x512', hd: '1024x1024' };

async function casperGenerate(prompt, size = '1024x1024', magic = false) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('total_images', '1');
  if (!magic) form.append('image_size', size);
  const url = magic ? CASPER_BING_URL : CASPER_URL;
  const res = await axios.post(url, form, { headers: form.getHeaders(), timeout: 55000 });
  const { url: urls, error } = res.data;
  if (error) throw new Error(error);
  if (!urls?.[0]) throw new Error('No image returned');
  return urls[0];
}

export default {
  name: 'imagine',
  aliases: ['img', 'imagineai', 'dream', 'paint'],
  category: 'imagegen',
  description: 'Generate AI images from a text prompt',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🎨 *IMAGINE AI* ⌋\n` +
              `├─⊷ *${PREFIX}imagine <prompt>*\n` +
              `│  └⊷ Generate image from text\n` +
              `├─⊷ *${PREFIX}imagine magic <prompt>*\n` +
              `│  └⊷ Use Magic Studio engine\n` +
              `├─⊷ *Sizes (add at end):*\n` +
              `│  └⊷ | portrait  | landscape  | hd\n` +
              `├─⊷ *Example:*\n` +
              `│  └⊷ ${PREFIX}imagine neon wolf city | hd\n` +
              `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const useMagic = args[0]?.toLowerCase() === 'magic';
    const rawInput = useMagic ? args.slice(1).join(' ') : args.join(' ');
    const parts = rawInput.split('|');
    const prompt = parts[0].trim();
    const sizeKey = (parts[1]?.trim().toLowerCase()) || 'hd';
    const size = SIZES[sizeKey] || '1024x1024';

    if (!prompt) {
      return sock.sendMessage(jid, { text: `❌ Please provide a prompt.` }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      const statusMsg = await sock.sendMessage(jid, {
        text: `🎨 *Generating your image...*\n📝 _${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}_`
      }, { quoted: m });

      let imageUrl;
      try {
        imageUrl = await casperGenerate(prompt, size, useMagic);
      } catch {
        const encoded = encodeURIComponent(prompt);
        imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&seed=${Date.now()}`;
      }

      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgRes.data);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `🎨 *IMAGINE AI*\n\n📝 _${prompt}_\n\n_Powered by ${getBotName()}_`
      }, { quoted: m });

      await sock.sendMessage(jid, { delete: statusMsg.key }).catch(() => {});
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Failed to generate image*\n\n${err.message}`
      }, { quoted: m });
    }
  }
};
