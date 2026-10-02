import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

const GIFTED_API = 'https://api.giftedtech.co.ke/api/stalk/wachannel';

export default {
  name: 'wachannel',
  aliases: ['channelstalk', 'wachannelstalk', 'wacs'],
  description: 'Stalk a WhatsApp Channel',
  category: 'Stalker Commands',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;

    if (!args || !args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🔍 *WHATSAPP CHANNEL STALKER* ⌋\n│\n├─⊷ *${prefix}wachannel <channel URL>*\n│  └⊷ Stalk a WhatsApp channel\n│\n├─⊷ *Example:*\n│  └⊷ ${prefix}wachannel https://whatsapp.com/channel/...\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const url = args.join(' ').trim();
    await sock.sendMessage(jid, { react: { text: '🔍', key: m.key } });

    try {
      const res = await axios.get(GIFTED_API, {
        params: { apikey: 'gifted', url },
        timeout: 20000
      });

      if (!res.data?.success || !res.data?.result) {
        throw new Error('Channel not found or invalid URL');
      }

      const { followers, img, description } = res.data.result;

      let profileBuffer = null;
      if (img) {
        try {
          const imgRes = await axios.get(img, { responseType: 'arraybuffer', timeout: 10000 });
          if (imgRes.data.length > 500) profileBuffer = Buffer.from(imgRes.data);
        } catch {}
      }

      const caption = `╭─⌈ 📢 *WHATSAPP CHANNEL INFO* ⌋\n│\n├─⊷ *👥 Followers:* ${followers || 'N/A'}\n├─⊷ *📝 Description:*\n│  └⊷ ${description || 'N/A'}\n├─⊷ *🔗 URL:* ${url}\n│\n╰───────────────\n>  *${getBotName()} STALKER*`;

      if (profileBuffer) {
        await sock.sendMessage(jid, { image: profileBuffer, caption }, { quoted: m });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [WACHANNEL] Error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Channel Stalk Failed*\n\n⚠️ ${error.message}\n\n💡 Make sure you provide a valid WhatsApp channel URL.`
      }, { quoted: m });
    }
  }
};
