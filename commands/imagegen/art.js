import axios from 'axios';
import FormData from 'form-data';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CASPER_URL = 'https://ai-image-gen.xcasper.space/v1/image/prompt/generate';
const CASPER_BING_URL = 'https://ai-image-gen.xcasper.space/v1/image/bing/generate';

const ART_STYLES = {
  oil: 'oil painting style',
  watercolor: 'watercolor painting style',
  sketch: 'pencil sketch style, black and white',
  digital: 'digital art style, vibrant',
  impressionist: 'impressionist painting style',
  surreal: 'surrealism art style',
  abstract: 'abstract art style',
  fantasy: 'fantasy art style, epic lighting',
  concept: 'concept art style, cinematic',
  pixel: 'pixel art style',
};

async function casperGenerate(prompt, magic = false) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('total_images', '1');
  const url = magic ? CASPER_BING_URL : CASPER_URL;
  if (!magic) form.append('image_size', '512x512');
  const res = await axios.post(url, form, { headers: form.getHeaders(), timeout: 55000 });
  const { url: urls, error } = res.data;
  if (error) throw new Error(error);
  if (!urls?.[0]) throw new Error('No image returned');
  return urls[0];
}

export default {
  name: 'art',
  aliases: ['artist', 'artwork', 'artgen', 'creative'],
  category: 'imagegen',
  description: 'Generate artistic and creative AI images',

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    if (!args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🎨 *ART IMAGE GEN* ⌋\n│\n` +
              `├─⊷ *art <prompt>*\n│  └⊷ Generate artistic AI images\n│\n` +
              `├─⊷ *art <style> | <prompt>*\n│  └⊷ Apply a specific art style\n│\n` +
              `├─⊷ *Styles:*\n` +
              `│  └⊷ oil, watercolor, sketch, digital\n` +
              `│  └⊷ impressionist, surreal, abstract\n` +
              `│  └⊷ fantasy, concept, pixel\n│\n` +
              `├─⊷ *Example:*\n│  └⊷ art watercolor | wolf in the forest\n│\n` +
              `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const input = args.join(' ');
    let prompt, styleLabel;

    if (input.includes('|')) {
      const [stylePart, promptPart] = input.split('|').map(s => s.trim());
      const styleKey = stylePart.toLowerCase();
      styleLabel = ART_STYLES[styleKey] || stylePart;
      prompt = `${styleLabel}, ${promptPart}, highly detailed, masterpiece`;
    } else {
      prompt = `artistic style, ${input}, highly detailed, masterpiece`;
      styleLabel = 'Auto';
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      const statusMsg = await sock.sendMessage(jid, {
        text: `🎨 *Generating art...*\n📝 _${input.substring(0, 60)}_`
      }, { quoted: m });

      let imageUrl;
      try {
        imageUrl = await casperGenerate(prompt);
      } catch {
        try {
          imageUrl = await casperGenerate(prompt, true);
        } catch {
          const encoded = encodeURIComponent(prompt);
          imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&model=flux&seed=${Date.now()}`;
        }
      }

      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgRes.data);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `🎨 *ART AI*\n📝 _${input}_\n\n_Powered by ${getBotName()}_`
      }, { quoted: m });

      await sock.sendMessage(jid, { delete: statusMsg.key }).catch(() => {});
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *Failed:* ${err.message}` }, { quoted: m });
    }
  }
};
