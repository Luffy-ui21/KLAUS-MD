import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const EPHOTO_EFFECTS = {
  neon: { id: 68, name: 'Neon Text', url: 'https://en.ephoto360.com/tao-hieu-ung-chu-neon-dep-68.html', emoji: '💡' },
  colorfulglow: { id: 69, name: 'Colorful Glowing Text', url: 'https://en.ephoto360.com/colorful-glowing-text-effect-online-69.html', emoji: '🌈' },
  advancedglow: { id: 74, name: 'Advanced Glow', url: 'https://en.ephoto360.com/advanced-glow-effects-74.html', emoji: '✨' },
  neononline: { id: 78, name: 'Neon Online', url: 'https://en.ephoto360.com/neon-text-effect-online-78.html', emoji: '🔮' },
  blueneon: { id: 117, name: 'Blue Neon', url: 'https://en.ephoto360.com/blue-neon-text-effect-117.html', emoji: '🔵' },
  neontext: { id: 171, name: 'Neon Text Effect', url: 'https://en.ephoto360.com/neon-text-effect-171.html', emoji: '💫' },
  neonlight: { id: 200, name: 'Neon Light', url: 'https://en.ephoto360.com/neon-text-effect-light-200.html', emoji: '🌟' },
  greenneon: { id: 395, name: 'Green Neon', url: 'https://en.ephoto360.com/green-neon-text-effect-395.html', emoji: '🟢' },
  greenlightneon: { id: 429, name: 'Green Light Neon', url: 'https://en.ephoto360.com/create-light-effects-green-neon-online-429.html', emoji: '💚' },
  blueneonlogo: { id: 507, name: 'Blue Neon Logo', url: 'https://en.ephoto360.com/create-blue-neon-logo-online-507.html', emoji: '🔷' },
  galaxyneon: { id: 521, name: 'Galaxy Neon', url: 'https://en.ephoto360.com/making-neon-light-text-effect-with-galaxy-style-521.html', emoji: '🌌' },
  retroneon: { id: 538, name: 'Retro Neon', url: 'https://en.ephoto360.com/free-retro-neon-text-effect-online-538.html', emoji: '🕹️' },
  multicolorneon: { id: 591, name: 'Multicolor Neon Signature', url: 'https://en.ephoto360.com/create-multicolored-neon-light-signatures-591.html', emoji: '🎆' },
  hackerneon: { id: 677, name: 'Hacker Cyan Neon', url: 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html', emoji: '👤' },
  devilwings: { id: 683, name: 'Devil Wings Neon', url: 'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html', emoji: '😈' },
  glowtext: { id: 706, name: 'Glowing Text', url: 'https://en.ephoto360.com/create-glowing-text-effects-online-706.html', emoji: '🔆' },
  blackpinkneon: { id: 710, name: 'Blackpink Neon Logo', url: 'https://en.ephoto360.com/create-a-blackpink-neon-logo-text-effect-online-710.html', emoji: '🖤' },
  neonglitch: { id: 768, name: 'Neon Glitch', url: 'https://en.ephoto360.com/create-impressive-neon-glitch-text-effects-online-768.html', emoji: '⚡' },
  colorfulneonlight: { id: 797, name: 'Colorful Neon Light', url: 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html', emoji: '🌈' },
  wooden3d: { id: 59, name: 'Wooden 3D Text', url: 'https://en.ephoto360.com/wooden-3d-text-effect-59.html', emoji: '🪵', apiId: 59 },
  cubic3d: { id: 88, name: '3D Cubic Text', url: 'https://en.ephoto360.com/3d-cubic-text-effect-online-88.html', emoji: '🧊', apiId: 88 },
  wooden3donline: { id: 104, name: '3D Wooden Text Online', url: 'https://en.ephoto360.com/3d-wooden-text-effects-online-104.html', emoji: '🌲', apiId: 104 },
  water3d: { id: 126, name: 'Water 3D Text', url: 'https://en.ephoto360.com/water-3d-text-effect-online-126.html', emoji: '💧', apiId: 126 },
  cuongthi3d: { id: 143, name: '3D Cuong Thi Text', url: 'https://en.ephoto360.com/text-3d-cuong-thi-143.html', emoji: '🔤', apiId: 143 },
  text3d: { id: 172, name: '3D Text Effect', url: 'https://en.ephoto360.com/3d-text-effect-172.html', emoji: '✨', apiId: 172 },
  graffiti3d: { id: 208, name: '3D Graffiti Text', url: 'https://en.ephoto360.com/text-graffiti-3d-208.html', emoji: '🎨', apiId: 208 },
  silver3d: { id: 273, name: '3D Silver Text', url: 'https://en.ephoto360.com/3d-silver-text-effect-273.html', emoji: '🥈', apiId: 273 },
  style3d: { id: 274, name: '3D Text Style', url: 'https://en.ephoto360.com/3d-text-effects-style-274.html', emoji: '💎', apiId: 274 },
  metal3d: { id: 277, name: '3D Metal Text', url: 'https://en.ephoto360.com/text-metal-3d-277.html', emoji: '🔩', apiId: 277 },
  ruby3d: { id: 281, name: '3D Ruby Stone Text', url: 'https://en.ephoto360.com/3d-ruby-stone-text-281.html', emoji: '💎', apiId: 281 },
  birthday3d: { id: 373, name: '3D Birthday Card', url: 'https://en.ephoto360.com/create-birthday-cards-by-3d-names-373.html', emoji: '🎂', apiId: 373 },
  metallogo3d: { id: 374, name: '3D Metal Logo', url: 'https://en.ephoto360.com/create-logo-3d-metal-online-374.html', emoji: '🏷️', apiId: 374 },
  pig3d: { id: 397, name: '3D Cute Pig Text', url: 'https://en.ephoto360.com/lovely-cute-3d-text-effect-with-pig-397.html', emoji: '🐷', apiId: 397 },
  avengers3d: { id: 427, name: '3D Avengers Logo', url: 'https://en.ephoto360.com/create-logo-3d-style-avengers-online-427.html', emoji: '🦸', apiId: 427 },
  hologram3d: { id: 441, name: '3D Hologram Text', url: 'https://en.ephoto360.com/free-create-a-3d-hologram-text-effect-441.html', emoji: '🔮', apiId: 441 },
  gradient3d: { id: 476, name: '3D Gradient Logo', url: 'https://en.ephoto360.com/create-gradient-logo-3d-online-476.html', emoji: '🌈', apiId: 476 },
  stone3d: { id: 508, name: '3D Stone Text', url: 'https://en.ephoto360.com/create-3d-stone-text-effect-online-508.html', emoji: '🪨', apiId: 508 },
  space3d: { id: 559, name: '3D Space Text', url: 'https://en.ephoto360.com/latest-space-3d-text-effect-online-559.html', emoji: '🚀', apiId: 559 },
  sand3d: { id: 580, name: '3D Sand Text', url: 'https://en.ephoto360.com/realistic-3d-sand-text-effect-online-580.html', emoji: '🏖️', apiId: 580 },
  gradienttext3d: { id: 600, name: '3D Gradient Text', url: 'https://en.ephoto360.com/create-3d-gradient-text-effect-online-600.html', emoji: '🎆', apiId: 600 },
  lightbulb3d: { id: 608, name: '3D Vintage Light Bulb', url: 'https://en.ephoto360.com/create-realistic-vintage-3d-light-bulb-608.html', emoji: '💡', apiId: 608 },
  snow3d: { id: 621, name: '3D Snow Text', url: 'https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html', emoji: '❄️', apiId: 621 },
  papercut3d: { id: 658, name: '3D Paper Cut Text', url: 'https://en.ephoto360.com/multicolor-3d-paper-cut-style-text-effect-658.html', emoji: '📄', apiId: 658 },
  underwater3d: { id: 682, name: '3D Underwater Text', url: 'https://en.ephoto360.com/3d-underwater-text-effect-online-682.html', emoji: '🌊', apiId: 682 },
  shinymetallic3d: { id: 685, name: '3D Shiny Metallic Text', url: 'https://en.ephoto360.com/create-a-3d-shiny-metallic-text-effect-online-685.html', emoji: '✨', apiId: 685 },
  gradientstyle3d: { id: 686, name: '3D Gradient Style', url: 'https://en.ephoto360.com/create-3d-gradient-text-effect-online-686.html', emoji: '🎨', apiId: 686 },
  beach3d: { id: 688, name: '3D Beach Text', url: 'https://en.ephoto360.com/create-3d-text-effect-on-the-beach-online-688.html', emoji: '🏝️', apiId: 688 },
  crack3d: { id: 704, name: '3D Crack Text', url: 'https://en.ephoto360.com/create-3d-crack-text-effect-online-704.html', emoji: '💥', apiId: 704 },
  wood3d: { id: 705, name: '3D Wood Text', url: 'https://en.ephoto360.com/create-3d-wood-text-effects-online-free-705.html', emoji: '🪵', apiId: 705 },
  americanflag3d: { id: 725, name: '3D American Flag Text', url: 'https://en.ephoto360.com/free-online-american-flag-3d-text-effect-generator-725.html', emoji: '🇺🇸', apiId: 725 },
  christmas3d: { id: 727, name: '3D Christmas Sparkles', url: 'https://en.ephoto360.com/create-sparkles-3d-christmas-text-effect-online-727.html', emoji: '🎄', apiId: 727 },
  nigeriaflag3d: { id: 753, name: '3D Nigeria Flag Text', url: 'https://en.ephoto360.com/nigeria-3d-flag-text-effect-online-free-753.html', emoji: '🇳🇬', apiId: 753 },
  christmassnow3d: { id: 793, name: '3D Christmas Snow', url: 'https://en.ephoto360.com/create-a-beautiful-3d-christmas-snow-text-effect-793.html', emoji: '☃️', apiId: 793 },
  goldenchristmas3d: { id: 794, name: '3D Golden Christmas', url: 'https://en.ephoto360.com/christmas-and-new-year-glittering-3d-golden-text-effect-794.html', emoji: '🌟', apiId: 794 },
  decorativemetal3d: { id: 798, name: '3D Decorative Metal', url: 'https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html', emoji: '🛡️', apiId: 798 },
  colorfulpaint3d: { id: 801, name: '3D Colorful Paint', url: 'https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html', emoji: '🎨', apiId: 801 },
  glossysilver3d: { id: 802, name: '3D Glossy Silver', url: 'https://en.ephoto360.com/create-glossy-silver-3d-text-effect-online-802.html', emoji: '🪩', apiId: 802 },
  balloon3d: { id: 803, name: '3D Foil Balloon', url: 'https://en.ephoto360.com/beautiful-3d-foil-balloon-effects-for-holidays-and-birthday-803.html', emoji: '🎈', apiId: 803 },
  comic3d: { id: 817, name: '3D Comic Style', url: 'https://en.ephoto360.com/create-online-3d-comic-style-text-effects-817.html', emoji: '💬', apiId: 817 },
};

async function generateEphoto(effectKey, text) {
  const effect = EPHOTO_EFFECTS[effectKey];
  if (!effect) throw new Error('Unknown effect');

  const apiUrls = [
    `https://api.siputzx.my.id/api/ephoto-360/generate?effectId=${effect.apiId || effect.id}&text=${encodeURIComponent(text)}`,
    `https://api.neoxr.eu.org/api/ephoto360?url=${encodeURIComponent(effect.url)}&text=${encodeURIComponent(text)}`,
  ];

  for (const apiUrl of apiUrls) {
    try {
      const res = await axios.get(apiUrl, { timeout: 25000 });
      const imgUrl = res.data?.url || res.data?.image || res.data?.result?.url || res.data?.result?.image || res.data?.data?.url || res.data?.data?.image;
      if (imgUrl) return imgUrl;
    } catch (err) {
      console.log(`[EPHOTO] API failed for ${effectKey}: ${err.message}`);
    }
  }

  try {
    const { ephoto } = await import('mumaker');
    const result = await ephoto(effect.url, [text]);
    if (result && result.status && result.image) {
      return result.image;
    }
  } catch (err) {
    console.log(`[EPHOTO] mumaker failed for ${effectKey}: ${err.message}`);
  }

  return null;
}

function createEphotoCommand(effectKey) {
  const effect = EPHOTO_EFFECTS[effectKey];
  return {
    name: effectKey,
    alias: [`ephoto${effect.id}`, `ep${effect.id}`],
    description: `${effect.emoji} ${effect.name} Effect`,
    category: 'ephoto',
    ownerOnly: false,
    usage: `${effectKey} <text>`,

    async execute(sock, msg, args, PREFIX) {
      const chatId = msg.key.remoteJid;
      const text = args.join(' ');

      if (!text) {
        return await sock.sendMessage(chatId, {
          text: `╭─⌈ ${effect.emoji} *${effect.name.toUpperCase()}* ⌋\n│\n├─⊷ *Usage:* ${PREFIX}${effectKey} <text>\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}${effectKey} ${getBotName()}\n│\n├─⊷ *Aliases:* ephoto${effect.id}, ep${effect.id}\n│\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

      try {
        const imageUrl = await generateEphoto(effectKey, text);

        if (!imageUrl) {
          await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
          return await sock.sendMessage(chatId, {
            text: `❌ Failed to generate ${effect.name} effect. Try again later.`
          }, { quoted: msg });
        }

        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const imageBuffer = Buffer.from(imageResponse.data);

        await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: `${effect.emoji} *${effect.name}*\n📝 Text: ${text}\n\n *Created by ${getBotName()}*`
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (error) {
        console.log(`[EPHOTO] ${effectKey} error:`, error.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(chatId, {
          text: `❌ Error generating ${effect.name}: ${error.message}`
        }, { quoted: msg });
      }
    }
  };
}

export { EPHOTO_EFFECTS, generateEphoto, createEphotoCommand };
