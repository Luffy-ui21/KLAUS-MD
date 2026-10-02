import axios from 'axios';
import FormData from 'form-data';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getBotName } from '../../lib/botname.js';

const CASPER_URL = 'https://ai-image-gen.xcasper.space/v1/image/prompt/generate';

async function casperGenerate(prompt, size = '512x512') {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('total_images', '1');
  form.append('image_size', size);
  const res = await axios.post(CASPER_URL, form, { headers: form.getHeaders(), timeout: 50000 });
  const { url, error } = res.data;
  if (error) throw new Error(error);
  if (!url?.[0]) throw new Error('No image returned');
  return url[0];
}

export default {
  name: 'imagegen',
  aliases: ['iggen'],
  category: 'imagegen',
  description: 'Generate images — AI, waifu, neko',
  usage: '.imagegen <type> <prompt>',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🎨 *IMAGE GENERATOR* ⌋\n` +
              `├─⊷ *${PREFIX}imagegen ai <prompt>*\n` +
              `│  └⊷ AI image from text\n` +
              `├─⊷ *${PREFIX}imagegen waifu*\n` +
              `│  └⊷ Random anime waifu image\n` +
              `├─⊷ *${PREFIX}imagegen neko*\n` +
              `│  └⊷ Random neko image\n` +
              `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const type = args[0].toLowerCase();
    const prompt = args.slice(1).join(' ');

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      if (type === 'waifu' || type === 'neko') {
        const endpoint = type === 'waifu'
          ? 'https://api.waifu.pics/sfw/waifu'
          : 'https://api.waifu.pics/sfw/neko';
        const res = await axios.get(endpoint, { timeout: 10000 });
        const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer', timeout: 15000 });
        await sock.sendMessage(jid, {
          image: Buffer.from(imgRes.data),
          caption: `🎨 *${type.toUpperCase()}*\n_Powered by ${getBotName()}_`
        }, { quoted: m });

      } else if (type === 'ai') {
        if (!prompt) {
          return sock.sendMessage(jid, { text: `❌ Provide a prompt: *${PREFIX}imagegen ai <prompt>*` }, { quoted: m });
        }
        let imageUrl;
        try {
          imageUrl = await casperGenerate(prompt);
        } catch {
          const encoded = encodeURIComponent(prompt);
          imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&model=flux&seed=${Date.now()}`;
        }
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(jid, {
          image: Buffer.from(imgRes.data),
          caption: `🎨 *AI IMAGE*\n📝 _${prompt}_\n_Powered by ${getBotName()}_`
        }, { quoted: m });

      } else {
        return sock.sendMessage(jid, {
          text: `❌ Unknown type. Use: *ai*, *waifu*, *neko*`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Failed: ${err.message}` }, { quoted: m });
    }
  }
};
