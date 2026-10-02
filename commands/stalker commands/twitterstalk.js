import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const GIFTED_API = 'https://api.giftedtech.co.ke/api/stalk/twitterstalk';

export default {
  name: 'twitterstalk',
  aliases: ['twstalk', 'xstalk', 'twitterinfo'],
  description: 'Stalk a Twitter/X user profile',
  category: 'Stalker Commands',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;

    if (!args || !args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🔍 *TWITTER/X STALKER* ⌋\n│\n├─⊷ *${prefix}twitterstalk <username>*\n│  └⊷ Stalk a Twitter/X profile\n│\n├─⊷ *Example:*\n│  └⊷ ${prefix}twitterstalk giftedmauriceke\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const username = args[0].replace('@', '').trim();
    await sock.sendMessage(jid, { react: { text: '🔍', key: m.key } });

    try {
      const res = await axios.get(globalThis._apiOverrides?.['twitterstalk'] || GIFTED_API, {
        params: { apikey: 'gifted', username },
        timeout: 25000
      });

      if (!res.data?.success || !res.data?.result) {
        throw new Error('User not found or Twitter API unavailable');
      }

      const d = res.data.result;

      let avatarBuffer = null;
      const avatarUrl = d.avatar || d.profile_image_url || d.profile_image_url_https;
      if (avatarUrl) {
        try {
          const imgRes = await axios.get(avatarUrl.replace('_normal', '_400x400'), {
            responseType: 'arraybuffer',
            timeout: 10000
          });
          if (imgRes.data.length > 500) avatarBuffer = Buffer.from(imgRes.data);
        } catch {}
      }

      const caption = `╭─⌈ 🐦 *TWITTER/X PROFILE* ⌋\n│\n├─⊷ *👤 Name:* ${d.name || 'N/A'}\n├─⊷ *🏷️ Username:* @${d.username || d.screen_name || username}\n├─⊷ *📝 Bio:* ${d.bio || d.description || 'N/A'}\n├─⊷ *👥 Followers:* ${(d.followers || d.followers_count || 0).toLocaleString()}\n├─⊷ *👤 Following:* ${(d.following || d.friends_count || 0).toLocaleString()}\n├─⊷ *🐦 Tweets:* ${(d.tweets || d.statuses_count || 0).toLocaleString()}\n├─⊷ *✅ Verified:* ${d.verified ? 'Yes' : 'No'}${d.location ? `\n├─⊷ *📍 Location:* ${d.location}` : ''}${d.website || d.url ? `\n├─⊷ *🌐 Website:* ${d.website || d.url}` : ''}\n│\n╰───────────────\n>  *${getBotName()} STALKER*`;

      if (avatarBuffer) {
        await sock.sendMessage(jid, { image: avatarBuffer, caption }, { quoted: m });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [TWITTERSTALK] Error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Twitter Stalk Failed*\n\n⚠️ ${error.message}\n\n💡 Check the username and try again.`
      }, { quoted: m });
    }
  }
};
