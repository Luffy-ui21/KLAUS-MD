import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const GIFTED_API = 'https://api.giftedtech.co.ke/api/download/apkdl';

async function downloadBuffer(url) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 90000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    validateStatus: (s) => s >= 200 && s < 400
  });
  return Buffer.from(response.data);
}

export default {
  name: 'apk',
  aliases: ['app', 'apkdownload', 'apkdl'],
  description: 'Download APK files from the Play Store',
  category: 'Downloader',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;

    if (!args || !args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📱 *APK DOWNLOADER* ⌋\n│\n├─⊷ *${prefix}apk <app name>*\n│  └⊷ Download APK file\n│\n├─⊷ *Examples:*\n│  └⊷ ${prefix}apk WhatsApp\n│  └⊷ ${prefix}apk Telegram\n│  └⊷ ${prefix}apk Spotify\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const appName = args.join(' ').trim();
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      const apiRes = await axios.get(GIFTED_API, {
        params: { apikey: 'gifted', appName },
        timeout: 20000
      });

      if (!apiRes.data?.success || !apiRes.data?.result) {
        throw new Error('App not found in Play Store');
      }

      const { appname, developer, mimetype, download_url, appicon } = apiRes.data.result;

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      const apkBuffer = await downloadBuffer(download_url);
      const fileSizeMB = (apkBuffer.length / (1024 * 1024)).toFixed(1);

      if (apkBuffer.length > 100 * 1024 * 1024) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *APK too large (${fileSizeMB}MB)*\n\n📥 Download directly:\n${download_url}`
        }, { quoted: m });
      }

      let iconBuffer = null;
      if (appicon) {
        try {
          const iconRes = await axios.get(appicon, { responseType: 'arraybuffer', timeout: 10000 });
          iconBuffer = Buffer.from(iconRes.data);
        } catch {}
      }

      await sock.sendMessage(jid, {
        document: apkBuffer,
        fileName: `${appname.replace(/[^a-zA-Z0-9]/g, '_')}.apk`,
        mimetype: mimetype || 'application/vnd.android.package-archive',
        caption: `📱 *${appname}*\n👤 *Developer:* ${developer || 'Unknown'}\n📦 *Size:* ${fileSizeMB}MB\n\n *Downloaded by ${getBotName()}*`,
        thumbnail: iconBuffer
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [APK] Error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *APK Download Failed*\n\n⚠️ ${error.message}\n\n💡 Try a different app name or check spelling.`
      }, { quoted: m });
    }
  }
};
