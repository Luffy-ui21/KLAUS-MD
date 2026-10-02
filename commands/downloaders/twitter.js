// commands/downloaders/twitter.js
// .twitter / .twdl — Download Twitter/X videos via apiskeith.top
// API: GET https://apiskeith.top/download/twitter?url=<url>
// Response: { status: true, result: { desc, thumb, video_sd, video_hd, audio } }

import { createRequire } from 'module';
import axios from 'axios';
import { createWriteStream, existsSync } from 'fs';
import fs from 'fs';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { setActionSession } from '../../lib/actionSession.js';

let _getUserCaption;
try {
  const captions = await import('../../lib/captionStore.js');
  _getUserCaption = captions.getUserCaption;
} catch { _getUserCaption = (uid) => `${getBotName()} is the Alpha`; }
function getCaption(uid) { return typeof _getUserCaption === 'function' ? _getUserCaption(uid) : `${getBotName()} is the Alpha`; }

const _req = createRequire(import.meta.url);
let giftedBtnsTw;
try { giftedBtnsTw = _req('wolfbtns'); } catch {}

// ── Stream a URL to a temp file ───────────────────────────────────────────────
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

// ── Fetch tweet media metadata from apiskeith ─────────────────────────────────
async function fetchTwitterMeta(url) {
  const res = await axios.get('https://apiskeith.top/download/twitter', {
    params: { url },
    timeout: 25000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });

  const d = res.data;
  if (!d || d.status !== true || !d.result) return null;

  const r = d.result;
  return {
    desc:     r.desc     || '',
    thumb:    r.thumb    || '',
    video_hd: r.video_hd || '',
    video_sd: r.video_sd || '',
    audio:    r.audio    || '',
  };
}

// ── URL validator ─────────────────────────────────────────────────────────────
function isValidTwitterUrl(url) {
  return /https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i.test(url);
}

// ── Command export ────────────────────────────────────────────────────────────
export default {
  name: 'twitter',
  aliases: ['twdl', 'xdl', 'twdown'],
  description: 'Download Twitter/X videos',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const userId = m.key.participant || m.key.remoteJid;
    const url = (args[0] || '').trim();

    if (!url) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🐦 *TWITTER DOWNLOADER* ⌋\n│\n` +
          `├─⊷ *${PREFIX}twitter <url>*\n│  └⊷ Download Twitter/X videos\n│\n` +
          `├─⊷ *Examples:*\n` +
          `│  └⊷ ${PREFIX}twitter https://twitter.com/user/status/123\n` +
          `│  └⊷ ${PREFIX}twitter https://x.com/user/status/123\n│\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    if (!isValidTwitterUrl(url)) {
      return sock.sendMessage(jid, {
        text: `❌ *Invalid Twitter/X URL*\n\nExpected: twitter.com or x.com .../status/<id>`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    let meta;
    try {
      meta = await fetchTwitterMeta(url);
    } catch (e) {
      console.log(`[Twitter] API error: ${e.message}`);
    }

    if (!meta || (!meta.video_hd && !meta.video_sd)) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      return sock.sendMessage(jid, {
        text: `❌ *Twitter download failed*\n\nCould not fetch video from that tweet.\nMake sure the tweet contains a video and the URL is correct.`
      }, { quoted: m });
    }

    // ── Button mode: show card with HD / SD quality picker ────────────────────
    if (isButtonModeEnabled() && giftedBtnsTw?.sendInteractiveMessage) {
      const senderClean = (m.key.participant || m.key.remoteJid).split(':')[0].split('@')[0];
      const sessionKey = `twitter:${senderClean}:${jid.split('@')[0]}`;
      setActionSession(sessionKey, { url, video_hd: meta.video_hd, video_sd: meta.video_sd, desc: meta.desc }, 10 * 60 * 1000);

      const shortDesc = meta.desc?.slice(0, 80) || 'Twitter Video';
      const cardText = `🐦 *Twitter Video Found*\n\n📝 ${shortDesc}${meta.desc?.length > 80 ? '…' : ''}\n\n▸ Choose quality to download:`;

      const btns = [];
      if (meta.video_hd) btns.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 HD Quality', id: `${PREFIX}twdlhd` }) });
      if (meta.video_sd) btns.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📱 SD Quality', id: `${PREFIX}twdlsd` }) });

      try {
        await giftedBtnsTw.sendInteractiveMessage(sock, jid, {
          image: meta.thumb ? { url: meta.thumb } : undefined,
          body: { text: cardText },
          footer: { text: getBotName() },
          interactiveButtons: btns
        }, { quoted: m });
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return;
      } catch (e) {
        console.log(`[Twitter] Button card failed, falling through: ${e.message}`);
      }
    }

    // ── Direct download: prefer HD, fallback to SD ────────────────────────────
    const videoUrl = meta.video_hd || meta.video_sd;
    const quality  = meta.video_hd ? 'HD' : 'SD';
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

      const shortDesc = meta.desc?.slice(0, 100) || '';
      const caption   = `🐦 *Twitter ${quality} Video*\n${shortDesc ? `📝 ${shortDesc}\n` : ''}📦 ${sizeMB}MB |  ${getBotName()}\n\n${getCaption(userId)}`;

      await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (e) {
      console.log(`[Twitter] Download/send failed: ${e.message}`);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Download failed*\n\n⚠️ ${e.message}\n\n🔗 Try manually:\n${videoUrl}`
      }, { quoted: m });
    } finally {
      try { if (existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
  }
};
