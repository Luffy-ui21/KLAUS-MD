import { createRequire } from 'module';
import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { setActionSession } from '../../lib/actionSession.js';
import { proxyFetch } from '../../lib/proxyFetch.js';

const _req = createRequire(import.meta.url);
let giftedBtnsFb;
try { giftedBtnsFb = _req('wolfbtns'); } catch (e) {}

const API_KEY  = process.env.XWOLF_API_KEY || process.env.XWOLF_BOT_KEY || 'wxa_u_xwk7sch6xj';
const XWOLF    = 'https://apis.xwolf.space/api/download';
const XCASPER  = 'https://apis.xcasper.space/api/downloader';

const FB_PATTERNS = [
  /https?:\/\/(?:www\.|m\.)?facebook\.com\/.+\/videos\/.+/i,
  /https?:\/\/(?:www\.|m\.)?facebook\.com\/watch/i,
  /https?:\/\/(?:www\.|m\.)?fb\.watch\/.+/i,
  /https?:\/\/(?:www\.)?facebook\.com\/reel\/.+/i,
  /https?:\/\/(?:www\.)?facebook\.com\/share\/.+/i,
  /https?:\/\/(?:www\.)?facebook\.com\/.+\/video/i,
  /https?:\/\/(?:www\.)?fb\.com\/.+/i
];

function isValidFbUrl(url) {
  return FB_PATTERNS.some(p => p.test(url));
}

function isReel(url) {
  return /\/reel\/|\/share\/v\//i.test(url);
}

const BK9_FB = 'https://api.bk9.dev/download/fb';

/**
 * BK9 Facebook API — returns { videoUrl, hdUrl, sdUrl, title, thumbnail } or null.
 */
async function fetchBK9(url) {
  try {
    console.log(`[FB] Trying BK9...`);
    const res = await axios.get(BK9_FB, { params: { url }, timeout: 30000 });
    const d = res.data?.BK9;
    if (!res.data?.status || !d) { console.log(`[FB/BK9] not success`); return null; }
    const hdUrl = d.hd || null;
    const sdUrl = d.sd || null;
    const videoUrl = hdUrl || sdUrl || null;
    if (!videoUrl) { console.log(`[FB/BK9] no video URL`); return null; }
    console.log(`[FB/BK9] ✅ resolved`);
    return {
      videoUrl,
      hdUrl,
      sdUrl,
      title:     d.title     || 'Facebook Video',
      thumbnail: d.thumbnail || d.thumb || null
    };
  } catch (e) {
    console.log(`[FB/BK9] error: ${e.message}`);
    return null;
  }
}

/**
 * Primary: xwolf API — tries /facebook/reel for reels, /facebook for all others.
 * Returns { videoUrl, title, thumbnail } or null.
 */
async function fetchXWolf(url) {
  const endpoint = isReel(url) ? `${XWOLF}/facebook/reel` : `${XWOLF}/facebook`;
  try {
    console.log(`[FB] Trying xwolf ${isReel(url) ? 'reel' : 'video'}...`);
    const res = await axios.get(endpoint, {
      params: { url, key: API_KEY },
      timeout: 30000
    });
    const d = res.data;
    if (!d?.success) { console.log(`[FB/xwolf] not success`); return null; }

    // Prefer HD proxy → HD direct → SD proxy → SD direct
    const videoUrl = d.hdProxyUrl || d.hdUrl || d.sdProxyUrl || d.sdUrl || null;
    if (!videoUrl) { console.log(`[FB/xwolf] no video URL`); return null; }

    console.log(`[FB/xwolf] ✅ resolved`);
    return {
      videoUrl,
      hdUrl:  d.hdUrl  || d.hdProxyUrl  || null,
      sdUrl:  d.sdUrl  || d.sdProxyUrl  || null,
      title:  d.title  || 'Facebook Video',
      thumbnail: null
    };
  } catch (e) {
    console.log(`[FB/xwolf] error: ${e.message}`);
    return null;
  }
}

/**
 * Fallback: xcasper fb → fb2.
 */
async function fetchXCasper(url) {
  for (const ep of ['fb', 'fb2']) {
    try {
      console.log(`[FB] Trying xcasper/${ep}...`);
      const res = await axios.get(`${XCASPER}/${ep}`, { params: { url }, timeout: 30000 });
      const d = res.data;
      if (!d?.success) continue;

      const hd  = d.hd  || d.data?.hd  || null;
      const sd  = d.sd  || d.data?.sd  || null;
      const url2= d.url || d.data?.url  || null;
      const medias = d.data?.medias || d.data?.media || d.medias || d.media || [];
      const mediaUrl = (Array.isArray(medias) && medias[0]?.url) || null;
      const videoUrl = hd || sd || url2 || mediaUrl;
      if (!videoUrl) continue;

      console.log(`[FB/xcasper/${ep}] ✅`);
      return { videoUrl, hdUrl: hd, sdUrl: sd, title: d.title || d.data?.title || 'Facebook Video', thumbnail: d.thumbnail || d.data?.thumbnail || null };
    } catch (e) {
      console.log(`[FB/xcasper/${ep}] error: ${e.message}`);
    }
  }
  return null;
}

async function fetchFbInfo(url) {
  return (await fetchBK9(url)) || (await fetchXCasper(url));
}

export default {
  name: 'facebook',
  aliases: ['fb', 'fbdl', 'fbvideo'],
  description: 'Download Facebook videos and reels',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const p = PREFIX || '.';
    const quotedText = m.quoted?.text?.trim() || '';
    const url = (args[0] || quotedText || '').trim();

    if (!url) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📘 *FACEBOOK DOWNLOADER* ⌋\n│\n├─⊷ *${p}fb <url>*\n│  └⊷ Download video or reel\n│\n├─⊷ *Supported:*\n│  └⊷ fb.watch links\n│  └⊷ facebook.com/reel/...\n│  └⊷ facebook.com/watch/...\n│  └⊷ facebook.com/.../videos/...\n│  └⊷ facebook.com/share/v/...\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    if (!isValidFbUrl(url)) {
      return sock.sendMessage(jid, {
        text: `❌ *Invalid Facebook URL*\n\nMust be a public Facebook video, reel, or watch link.`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    // Button mode card
    if (isButtonModeEnabled() && giftedBtnsFb?.sendInteractiveMessage) {
      const mediaType = isReel(url) ? 'Reel' : url.includes('fb.watch') ? 'Watch' : 'Video';
      const senderClean = (m.key.participant || m.key.remoteJid).split(':')[0].split('@')[0];
      let quickMeta = null;
      try {
        quickMeta = await Promise.race([
          fetchFbInfo(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
        ]);
      } catch {}
      setActionSession(`fb:${senderClean}:${jid.split('@')[0]}`, { url, mediaType }, 10 * 60 * 1000);
      try {
        const cardBody = quickMeta?.title
          ? `📘 *${quickMeta.title.substring(0, 80)}*\n\n📂 ${mediaType} | ▸ Tap to download`
          : `📘 *Facebook ${mediaType} Found*\n\n🔗 ${url.substring(0, 55)}...\n\n▸ Tap to download`;
        const msgOpts = {
          text: cardBody,
          footer: getBotName(),
          interactiveButtons: [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬇️ Download Video', id: `${p}fbdlget` }) }
          ]
        };
        if (quickMeta?.thumbnail) msgOpts.image = { url: quickMeta.thumbnail };
        await giftedBtnsFb.sendInteractiveMessage(sock, jid, msgOpts, { quoted: m });
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return;
      } catch {}
    }

    try {
      const info = await fetchFbInfo(url);

      if (!info) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *Could not fetch this Facebook video.*\n\n💡 Make sure the video is *public*.`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // Try HD first, fall back to SD
      let videoBuf = null;
      const urlsToTry = [info.hdUrl, info.sdUrl, info.videoUrl].filter(Boolean);
      for (const dlUrl of [...new Set(urlsToTry)]) {
        try {
          videoBuf = await proxyFetch(dlUrl, 120_000);
          if (videoBuf && videoBuf.byteLength > 10_000) break;
        } catch {}
        videoBuf = null;
      }

      if (!videoBuf) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *Download failed.*\n\n💡 *Direct link:*\n${info.sdUrl || info.videoUrl}`
        }, { quoted: m });
      }

      const sizeMB = (videoBuf.byteLength / 1024 / 1024).toFixed(1);
      console.log(`[FB] downloaded ${sizeMB}MB`);

      if (parseFloat(sizeMB) > 50) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ Video too large (${sizeMB}MB). WhatsApp limit is 50MB.\n\n💡 *Direct link:*\n${info.sdUrl || info.videoUrl}`
        }, { quoted: m });
      }

      const caption = `📘 *${info.title}*\n\n📦 ${sizeMB}MB |  ${getBotName()}`;

      await sock.sendMessage(jid, {
        video:    videoBuf,
        mimetype: 'video/mp4',
        caption
      }, { quoted: m });

      if (parseFloat(sizeMB) <= 20) {
        await sock.sendMessage(jid, {
          document: videoBuf,
          mimetype:  'video/mp4',
          fileName:  `${(info.title).replace(/[^\w\s]/gi, '').trim().substring(0, 40) || 'facebook_video'}.mp4`,
          caption:   `📄 ${info.title} | ${sizeMB}MB`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`✅ [FB] Sent: ${info.title} (${sizeMB}MB)`);

    } catch (error) {
      console.error('❌ [FB] Error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
  }
};