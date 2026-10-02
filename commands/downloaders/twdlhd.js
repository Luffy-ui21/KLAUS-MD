// commands/downloaders/twdlhd.js
// Handles quick_reply button responses for Twitter HD/SD download
// Triggered by .twdlhd (HD) or .twdlsd (SD) buttons from twitter.js card

import { createWriteStream, existsSync } from 'fs';
import fs from 'fs';
import axios from 'axios';
import { getActionSession, deleteActionSession } from '../../lib/actionSession.js';
import { getBotName } from '../../lib/botname.js';

let _getUserCaption;
try {
  const captions = await import('../../lib/captionStore.js');
  _getUserCaption = captions.getUserCaption;
} catch { _getUserCaption = (uid) => `${getBotName()} is the Alpha`; }
function getCaption(uid) { return typeof _getUserCaption === 'function' ? _getUserCaption(uid) : `${getBotName()} is the Alpha`; }

async function downloadFile(url, filePath) {
  const writer = createWriteStream(filePath);
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 90000,
    maxContentLength: 200 * 1024 * 1024,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://twitter.com/',
    }
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export default {
  name: 'twdlhd',
  aliases: ['twdlsd'],
  description: 'Send Twitter video from session (HD or SD)',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const userId = m.key.participant || m.key.remoteJid;
    const senderClean = userId.split(':')[0].split('@')[0];
    const sessionKey  = `twitter:${senderClean}:${jid.split('@')[0]}`;
    const session     = getActionSession(sessionKey);

    if (!session || (!session.video_hd && !session.video_sd)) {
      return sock.sendMessage(jid, {
        text: `❌ No Twitter download session found.\nPlease send the Twitter URL again with \`${PREFIX || '.'}twitter <url>\``
      }, { quoted: m });
    }

    deleteActionSession(sessionKey);

    // Determine which quality was requested
    const rawText   = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').toLowerCase();
    const wantHD    = rawText.includes('twdlhd') || rawText.includes('hd quality');
    const videoUrl  = wantHD && session.video_hd ? session.video_hd : (session.video_sd || session.video_hd);
    const quality   = (wantHD && session.video_hd) ? 'HD' : 'SD';

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    const ts       = Date.now();
    const filePath = `/tmp/wolfbot_tw_${ts}.mp4`;

    try {
      await downloadFile(videoUrl, filePath);

      const buf    = fs.readFileSync(filePath);
      const sizeMB = (buf.length / 1024 / 1024).toFixed(1);

      if (parseFloat(sizeMB) > 50) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ Video too large (${sizeMB}MB).\n\n🔗 Download manually:\n${videoUrl}`
        }, { quoted: m });
      }

      const shortDesc = session.desc?.slice(0, 100) || '';
      const caption   = `🐦 *Twitter ${quality} Video*\n${shortDesc ? `📝 ${shortDesc}\n` : ''}📦 ${sizeMB}MB |  ${getBotName()}\n\n${getCaption(userId)}`;

      await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (e) {
      console.log(`[Twitter/twdlhd] Download/send failed: ${e.message}`);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Download failed*\n\n⚠️ ${e.message}\n\n🔗 Try manually:\n${videoUrl}`
      }, { quoted: m });
    } finally {
      try { if (existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
  }
};
