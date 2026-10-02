import axios from 'axios';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
// xwolf disabled — APIs currently down
// import { xwolfDownloadVideo } from '../../lib/xwolfApi.js';

const XCASPER_VIDEO_API = 'https://apis.xcasper.space/api/downloader/yt-video';
const KEITH_VIDEO_API   = 'https://apiskeith.top/download/video';
const BK9_BASE          = 'https://api.bk9.dev/download';

// ── Search YouTube and return first result URL ────────────────────────────
async function searchYouTube(query) {
  const { videos } = await yts(query);
  if (!videos?.length) throw new Error('No YouTube results found for that search.');
  const v = videos[0];
  return {
    url:       `https://www.youtube.com/watch?v=${v.videoId}`,
    title:     v.title     || '',
    thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
  };
}

// ── Fetch video info + download URLs from XCasper ────────────────────────
async function xcasperVideo(ytUrl) {
  const res = await axios.get(XCASPER_VIDEO_API, {
    params: { url: ytUrl },
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const d = res.data;
  if (!d?.success || !Array.isArray(d?.videos) || !d.videos.length) {
    throw new Error(d?.message || 'XCasper returned no video links');
  }
  return d;
}

// ── BK9 YouTube video APIs ────────────────────────────────────────────────
async function bk9Video(ytUrl, preferred = '360p') {
  // 1️⃣ youtube endpoint — proxy CDN URL, not IP-locked
  try {
    const res = await axios.get(`${BK9_BASE}/youtube`, {
      params: { url: ytUrl, quality: preferred, type: 'video' },
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = res.data;
    if (d?.status === true && d?.BK9?.url) {
      const dl = await axios.get(d.BK9.url, {
        responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const buf = Buffer.from(dl.data);
      if (buf.length < 10000) throw new Error('buffer too small');
      buf._meta = { quality: d.BK9.quality || preferred, title: d.BK9.filename || '' };
      return buf;
    }
  } catch (e) {
    console.log(`[YTMP4] BK9/youtube failed: ${e.message}`);
  }

  // 2️⃣ youtube3 endpoint — downloadUrl field
  try {
    const res = await axios.get(`${BK9_BASE}/youtube3`, {
      params: { url: ytUrl },
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = res.data;
    const dlUrl = d?.BK9?.downloadUrl;
    if (d?.status === true && dlUrl && !dlUrl.includes('googlevideo.com')) {
      const dl = await axios.get(dlUrl, {
        responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const buf = Buffer.from(dl.data);
      if (buf.length < 10000) throw new Error('buffer too small');
      buf._meta = { quality: d.BK9.quality || '360p', title: d.BK9.title || '' };
      return buf;
    }
  } catch (e) {
    console.log(`[YTMP4] BK9/youtube3 failed: ${e.message}`);
  }

  throw new Error('All BK9 YouTube video endpoints failed');
}

// ── Download video buffer via Keith API ───────────────────────────────────
async function keithVideo(ytUrl) {
  const res = await axios.get(KEITH_VIDEO_API, {
    params: { url: ytUrl },
    timeout: 35000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const d = res.data;
  if (d?.status !== true || typeof d?.result !== 'string' || !d.result.startsWith('http')) {
    throw new Error(d?.message || 'Keith video: no result URL');
  }
  console.log(`[keith/video] got URL, downloading...`);
  const dl = await axios.get(d.result, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const buf = Buffer.from(dl.data);
  if (buf.length < 10000) throw new Error('Keith video: downloaded file too small');
  console.log(`[keith/video] ✅ ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
  return buf;
}

// ── Pick best quality at or below the requested quality ──────────────────
// Preference: 360p default. Tries exact match first, then next available.
function pickQuality(videos, preferred = '360p') {
  const order = ['360p', '480p', '720p', '1080p'];
  const preferredIndex = order.indexOf(preferred);
  // Try preferred first, then go up in quality, then down
  const sorted = [...order.slice(preferredIndex), ...order.slice(0, preferredIndex).reverse()];
  for (const q of sorted) {
    const match = videos.find(v => v.quality === q && v.url);
    if (match) return match;
  }
  return videos.find(v => v.url) || null;
}

export default {
  name: 'ytmp4',
  aliases: ['video', 'mp4', 'ytvideo', 'vid'],
  category: 'Downloader',
  description: 'Download a YouTube video',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p   = prefix || '/';
    const quotedText = m.quoted?.text?.trim()
      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
      || '';

    let input = args.join(' ').trim() || quotedText;

    if (!input) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🎬 *VIDEO DOWNLOADER* ⌋\n` +
          `│\n` +
          `├─⊷ *${p}ytmp4 <video name>*\n` +
          `│  └⊷ Search and download\n` +
          `├─⊷ *${p}ytmp4 <YouTube URL>*\n` +
          `│  └⊷ Download from link\n` +
          `├─⊷ *${p}ytmp4 720 <name or URL>*\n` +
          `│  └⊷ Choose quality (360/480/720/1080)\n` +
          `│\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    // ── Optional quality prefix e.g. "720 Starboy" or "1080 https://..." ──
    const qualityMap = { '360': '360p', '480': '480p', '720': '720p', '1080': '1080p' };
    let preferredQuality = '360p';
    const firstWord = args[0];
    if (qualityMap[firstWord]) {
      preferredQuality = qualityMap[firstWord];
      input = args.slice(1).join(' ').trim() || quotedText;
    }

    if (!input) {
      return sock.sendMessage(jid, { text: `❌ Please provide a video name or YouTube URL.` }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      // ── Step 1: Resolve to a YouTube URL ─────────────────────────────────
      const isUrl = /^https?:\/\//i.test(input);
      let ytUrl = input;
      let title = 'YouTube Video';

      if (!isUrl) {
        const found = await searchYouTube(input);
        ytUrl  = found.url;
        title  = found.title || title;
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // ── Step 2: Download — BK9 primary, XCasper + Keith as fallbacks ─────
      let videoBuffer = null;
      let quality     = preferredQuality;

      // 1️⃣ BK9
      try {
        const bk9Buf = await bk9Video(ytUrl, preferredQuality);
        videoBuffer = bk9Buf;
        if (bk9Buf._meta?.title)   title   = bk9Buf._meta.title   || title;
        if (bk9Buf._meta?.quality) quality = bk9Buf._meta.quality || quality;
      } catch (bk9Err) {
        console.log(`[YTMP4] BK9 failed: ${bk9Err.message}`);
      }

      // 2️⃣ XCasper
      if (!videoBuffer) {
        try {
          const data   = await xcasperVideo(ytUrl);
          const chosen = pickQuality(data.videos, preferredQuality);
          if (!chosen) throw new Error('no usable format');
          title   = data.title   || title;
          quality = chosen.quality;
          const dlRes = await axios.get(chosen.url, {
            responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          videoBuffer = Buffer.from(dlRes.data);
          if (videoBuffer.length < 10000) throw new Error('buffer too small');
        } catch (xcErr) {
          console.log(`[YTMP4] XCasper failed: ${xcErr.message}`);
        }
      }

      // 3️⃣ Keith
      if (!videoBuffer) {
        videoBuffer = await keithVideo(ytUrl);
        quality = 'HD';
      }

      if (!videoBuffer) throw new Error('All video sources failed. Try again later.');

      const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
      if (videoBuffer.length < 10000) throw new Error('Downloaded file is too small.');

      if (parseFloat(sizeMB) > 64) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ Video too large (${sizeMB}MB). WhatsApp limit is 64MB.\nTry a lower quality: *${p}ytmp4 360 <title>*`
        }, { quoted: m });
      }

      const cleanTitle = title.replace(/[^\w\s.-]/gi, '').substring(0, 50);

      // ── Step 3: Send ──────────────────────────────────────────────────────
      await sock.sendMessage(jid, {
        video:    videoBuffer,
        mimetype: 'video/mp4',
        fileName: `${cleanTitle}.mp4`,
        caption:  `🎬 *${title}*\n📹 ${quality} • ${sizeMB}MB\n ${getBotName()}`
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`[YTMP4] ✅ "${title}" ${quality} ${sizeMB}MB`);

    } catch (err) {
      console.error(`[YTMP4] ❌ ${err.message}`);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Video download failed.*\n\n_${err.message}_`
      }, { quoted: m });
    }
  }
};
