import axios from 'axios';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
// xwolf disabled — APIs currently down
// import { xwolfDownloadVideo } from '../../lib/xwolfApi.js';

const KEITH_BASE  = 'https://apiskeith.top/download';
const XCASPER_API = 'https://apis.xcasper.space/api/downloader/yt-video';
const BK9_BASE    = 'https://api.bk9.dev/download';

// ── Search YouTube and return first result ────────────────────────────────
async function searchYouTube(query) {
  const { videos } = await yts(query);
  if (!videos?.length) throw new Error('No YouTube results found for that search.');
  const v = videos[0];
  return {
    url:       `https://www.youtube.com/watch?v=${v.videoId}`,
    title:     v.title     || query,
    thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
  };
}

// ── Download buffer from URL, validates it's real media ───────────────────
async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 10,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    validateStatus: s => s >= 200 && s < 400
  });
  const buf = Buffer.from(res.data);
  if (buf.length < 50000) throw new Error(`file too small (${buf.length} bytes) — server returned an error`);
  const hdr = buf.slice(0, 20).toString('utf8').toLowerCase();
  if (hdr.includes('<!doctype') || hdr.includes('<html')) throw new Error('server returned HTML instead of video');
  return buf;
}

// ── Keith video fallback chain (ytv → ytv4 → mp4) ────────────────────────
async function tryKeithVideo(ytUrl) {
  const endpoints = ['ytv', 'ytv4', 'mp4'];
  for (const ep of endpoints) {
    try {
      const res = await axios.get(`${KEITH_BASE}/${ep}`, {
        params: { url: ytUrl }, timeout: 35000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const d = res.data;
      if (!(d?.status === true || d?.success === true)) continue;
      if (typeof d?.result !== 'string' || !d.result.startsWith('http')) continue;
      if (d.result.includes('googlevideo.com') || d.result === 'Waiting...') continue;
      return await downloadBuffer(d.result);
    } catch (e) {
      console.log(`[YTV] keith/${ep} failed: ${e.message}`);
    }
  }
  throw new Error('all Keith video endpoints failed');
}

// ── BK9 YouTube video APIs ────────────────────────────────────────────────
async function tryBk9Video(ytUrl) {
  // 1️⃣ youtube endpoint — proxy CDN URL, not IP-locked
  try {
    const res = await axios.get(`${BK9_BASE}/youtube`, {
      params: { url: ytUrl, quality: '720p', type: 'video' },
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = res.data;
    if (d?.status === true && d?.BK9?.url) return await downloadBuffer(d.BK9.url);
  } catch (e) {
    console.log(`[YTV] BK9/youtube failed: ${e.message}`);
  }

  // 2️⃣ youtube3 endpoint — skip IP-locked Google CDN
  try {
    const res = await axios.get(`${BK9_BASE}/youtube3`, {
      params: { url: ytUrl },
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = res.data;
    const dlUrl = d?.BK9?.downloadUrl;
    if (d?.status === true && dlUrl && !dlUrl.includes('googlevideo.com')) {
      return await downloadBuffer(dlUrl);
    }
  } catch (e) {
    console.log(`[YTV] BK9/youtube3 failed: ${e.message}`);
  }

  throw new Error('all BK9 YouTube video endpoints failed');
}

// ── Source 3: XCasper (360p) ──────────────────────────────────────────────
async function tryXcasper(ytUrl) {
  const res = await axios.get(XCASPER_API, {
    params: { url: ytUrl }, timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const d = res.data;
  if (!d?.success || !Array.isArray(d?.videos) || !d.videos.length) {
    throw new Error(d?.message || 'no videos in response');
  }
  const chosen = d.videos.find(v => v.quality === '360p' && v.url)
               || d.videos.find(v => v.quality === '480p' && v.url)
               || d.videos.find(v => v.url);
  if (!chosen) throw new Error('no usable video format');
  return await downloadBuffer(chosen.url);
}

export default {
  name: 'ytv',
  aliases: ['ytvid', 'keithtv'],
  category: 'Downloader',
  description: 'Download a YouTube video via Keith ytv API',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p   = prefix || '/';
    const quotedText = m.quoted?.text?.trim()
      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
      || '';

    const input = args.join(' ').trim() || quotedText;

    if (!input) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🎬 *YTV DOWNLOADER* ⌋\n` +
          `│\n` +
          `├─⊷ *${p}ytv <video name>*\n` +
          `│  └⊷ Search and download\n` +
          `├─⊷ *${p}ytv <YouTube URL>*\n` +
          `│  └⊷ Download from link\n` +
          `│\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      // ── Step 1: Resolve to YouTube URL ───────────────────────────────────
      const isUrl = /^https?:\/\//i.test(input);
      let ytUrl = input;
      let title = 'YouTube Video';

      if (!isUrl) {
        const found = await searchYouTube(input);
        ytUrl = found.url;
        title = found.title;
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // ── Step 2: Download — BK9 primary, Keith + XCasper as fallbacks ─────
      let videoBuffer = null;

      // 1️⃣ BK9
      try {
        videoBuffer = await tryBk9Video(ytUrl);
      } catch (e) {
        console.log(`[YTV] BK9 failed: ${e.message}`);
      }

      // 2️⃣ Keith
      if (!videoBuffer) {
        try {
          videoBuffer = await tryKeithVideo(ytUrl);
        } catch (e) {
          console.log(`[YTV] Keith failed: ${e.message}`);
        }
      }

      // 3️⃣ XCasper
      if (!videoBuffer) videoBuffer = await tryXcasper(ytUrl);

      const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);

      if (parseFloat(sizeMB) > 64) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ Video too large (${sizeMB}MB). WhatsApp limit is 64MB.\nTry *${p}ytmp4 360 <title>* for a lower quality.`
        }, { quoted: m });
      }

      const cleanTitle = title.replace(/[^\w\s.-]/gi, '').substring(0, 50);

      // ── Step 3: Send ──────────────────────────────────────────────────────
      await sock.sendMessage(jid, {
        video:    videoBuffer,
        mimetype: 'video/mp4',
        fileName: `${cleanTitle}.mp4`,
        caption:  `🎬 *${title}*\n📹 ${sizeMB}MB\n ${getBotName()}`
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`[YTV] ✅ "${title}" ${sizeMB}MB`);

    } catch (err) {
      console.error(`[YTV] ❌ ${err.message}`);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *YTV download failed.*\n\n_${err.message}_`
      }, { quoted: m });
    }
  }
};
