import axios from 'axios';
import FormData from 'form-data';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CASPER_URL = 'https://ai-image-gen.xcasper.space/v1/image/prompt/generate';
const CASPER_BING_URL = 'https://ai-image-gen.xcasper.space/v1/image/bing/generate';

async function casperGenerate(prompt, size = '1024x1024', magic = false) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('total_images', '1');
  const url = magic ? CASPER_BING_URL : CASPER_URL;
  if (!magic) form.append('image_size', size);
  const res = await axios.post(url, form, { headers: form.getHeaders(), timeout: 55000 });
  const { url: urls, error } = res.data;
  if (error) throw new Error(error);
  if (!urls?.[0]) throw new Error('No image returned');
  return urls[0];
}

export default {
  name: 'real',
  aliases: ['realistic', 'photo', 'photoreal', 'realgen'],
  category: 'imagegen',
  description: 'Generate photorealistic AI images',

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    if (!args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📸 *PHOTOREALISTIC IMAGE GEN* ⌋\n│\n` +
              `├─⊷ *real <prompt>*\n│  └⊷ Generate photorealistic AI images\n│\n` +
              `├─⊷ *Examples:*\n│  └⊷ real cyberpunk city at night, 8k\n` +
              `│  └⊷ real portrait of a woman, studio lighting\n│\n` +
              `├─⊷ *Add | magic at end for Magic Studio:*\n` +
              `│  └⊷ real wolf on mountain | magic\n│\n` +
              `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const input = args.join(' ');
    const useMagic = input.toLowerCase().endsWith('| magic') || input.toLowerCase().endsWith('|magic');
    const rawPrompt = useMagic ? input.replace(/\|\s*magic\s*$/i, '').trim() : input;

    if (rawPrompt.length < 5) {
      return sock.sendMessage(jid, {
        text: `❌ Prompt is too short. Describe what you want in detail.`
      }, { quoted: m });
    }

    const prompt = `photorealistic, ${rawPrompt}, 8k, high detail, sharp focus, cinematic lighting`;

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      const statusMsg = await sock.sendMessage(jid, {
        text: `📸 *Generating photorealistic image...*\n📝 _${rawPrompt.substring(0, 60)}_`
      }, { quoted: m });

      let imageUrl;
      try {
        imageUrl = await casperGenerate(prompt, '1024x1024', useMagic);
      } catch {
        try {
          imageUrl = await casperGenerate(prompt, '1024x1024', !useMagic);
        } catch {
          const encoded = encodeURIComponent(prompt);
          imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&seed=${Date.now()}&enhance=true`;
        }
      }

      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgRes.data);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `📸 *PHOTOREALISTIC AI*\n📝 _${rawPrompt}_\n\n_Powered by ${getBotName()}_`
      }, { quoted: m });

      await sock.sendMessage(jid, { delete: statusMsg.key }).catch(() => {});
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *Failed:* ${err.message}` }, { quoted: m });
    }
  }
};
