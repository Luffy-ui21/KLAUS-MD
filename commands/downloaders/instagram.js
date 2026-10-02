import axios from 'axios';
import { createWriteStream, existsSync } from 'fs';
import fs from 'fs';
import { createRequire } from 'module';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { setActionSession } from '../../lib/actionSession.js';

let _getUserCaption;
try {
  const captions = await import('../../lib/captionStore.js');
  _getUserCaption = captions.getUserCaption;
} catch { _getUserCaption = (uid) => `${getBotName()} is the Alpha`; }
function getCaption(uid) { return typeof _getUserCaption === 'function' ? _getUserCaption(uid) : `${getBotName()} is the Alpha`; }

const _req = createRequire(import.meta.url);
let giftedBtnsIg;
try { giftedBtnsIg = _req('wolfbtns'); } catch {}

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
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'video/mp4,video/*,image/*,*/*;q=0.8',
    }
  });

  const ct = (response.headers['content-type'] || '').toLowerCase();
  if (ct.includes('text/html')) {
    writer.destroy();
    throw new Error('Server returned HTML instead of media');
  }

  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ── bk9.dev Instagram API ─────────────────────────────────────────────────────
// Response: { status: true, BK9: [{ type: "video"|"image", url, thumbnail }] }
async function downloadInstagram(url) {
  const res = await axios.get('https://api.bk9.dev/download/instagram', {
    params: { url },
    timeout: 30000,
    headers: { 'User-Agent': 'WolfBot/1.0' }
  });

  const d = res.data;
  if (!d?.status || !Array.isArray(d.BK9) || d.BK9.length === 0) {
    return { success: false, error: 'No media found for that URL.' };
  }

  const ts = Date.now();
  const downloaded = [];

  for (const item of d.BK9.slice(0, 4)) {
    const mediaUrl = item?.url;
    if (!mediaUrl) continue;

    const isVideo = item.type === 'video' || mediaUrl.includes('.mp4');
    const ext = isVideo ? 'mp4' : 'jpg';
    const filePath = `/tmp/wolfbot_ig_bk9_${ts}_${downloaded.length}.${ext}`;

    try {
      await downloadFile(mediaUrl, filePath);
      downloaded.push({ filePath, isVideo });
      console.log(`[IG/bk9] ✅ saved ${filePath}`);
    } catch (e) {
      console.log(`[IG/bk9] dl failed: ${e.message?.slice(0, 80)}`);
    }
  }

  if (downloaded.length === 0) {
    return { success: false, error: 'Downloaded 0 items — media URLs may have expired.' };
  }

  return { success: true, items: downloaded };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
function cleanupFiles(items) {
  for (const { filePath } of items) {
    try { if (filePath && existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  }
}

// ── URL validator ─────────────────────────────────────────────────────────────
function isValidInstagramUrl(url) {
  return [
    /https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv|reels)\/[a-zA-Z0-9_-]+/i,
    /https?:\/\/(?:www\.)?instagr\.am\/(p|reel|tv|reels)\/[a-zA-Z0-9_-]+/i,
  ].some(p => p.test(url));
}

// ── Command export ────────────────────────────────────────────────────────────
export default {
  name: 'instagram',
  aliases: ['ig', 'igdl', 'insta'],
  description: 'Download Instagram reels / posts / carousels',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const userId = m.key.participant || m.key.remoteJid;

    if (!args[0]) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📷 *INSTAGRAM DOWNLOADER* ⌋\n│\n├─⊷ *${PREFIX}ig <url>*\n│  └⊷ Download reels / posts\n│\n├─⊷ *Examples:*\n│  └⊷ ${PREFIX}ig https://instagram.com/reel/xyz\n│  └⊷ ${PREFIX}ig https://instagram.com/p/xyz\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const url = (args[0] || m.quoted?.text?.trim() || '').trim();

    if (!isValidInstagramUrl(url)) {
      return sock.sendMessage(jid, {
        text: `❌ *Invalid Instagram URL*\n\nSupported:\n• instagram.com/p/...\n• instagram.com/reel/...`
      }, { quoted: m });
    }

    // Button mode card
    if (isButtonModeEnabled() && giftedBtnsIg?.sendInteractiveMessage) {
      const isReel = url.includes('/reel/');
      const mediaType = isReel ? 'Reel' : url.includes('/tv/') ? 'IGTV' : 'Post';
      const shortUrl = url.replace(/^https?:\/\/(www\.)?instagram\.com/, '').split('?')[0].slice(0, 40);
      const senderClean = (m.key.participant || m.key.remoteJid).split(':')[0].split('@')[0];
      setActionSession(`ig:${senderClean}:${jid.split('@')[0]}`, { url, mediaType }, 10 * 60 * 1000);
      try {
        await giftedBtnsIg.sendInteractiveMessage(sock, jid, {
          body: { text: `📷 *Instagram ${mediaType} Found*\n\n🔗 ${shortUrl}\n\n▸ Tap Download to get the media` },
          footer: { text: getBotName() },
          interactiveButtons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬇️ Download', id: `${PREFIX}igdlget` }) }]
        }, { quoted: m });
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return;
      } catch {}
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      const result = await downloadInstagram(url);

      if (!result.success) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *Instagram download failed*\n\n⚠️ ${result.error}`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      let sentCount = 0;
      for (const { filePath, isVideo } of result.items) {
        try {
          const buf = fs.readFileSync(filePath);
          const sizeMB = (buf.length / 1024 / 1024).toFixed(1);

          if (parseFloat(sizeMB) > 50) {
            await sock.sendMessage(jid, {
              text: `⚠️ Item ${sentCount + 1} too large (${sizeMB}MB), skipping.`
            }, { quoted: m });
            continue;
          }

          const caption = sentCount === 0
            ? `📷 *Instagram ${isVideo ? 'Video' : 'Photo'}*\n📦 ${sizeMB}MB |  ${getBotName()}\n\n${getCaption(userId)}`
            : `Part ${sentCount + 1} | ${sizeMB}MB`;

          if (isVideo) {
            await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m });
          } else {
            await sock.sendMessage(jid, { image: buf, caption }, { quoted: m });
          }
          sentCount++;
          if (sentCount < result.items.length) await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          console.log(`[IG] send failed for item ${sentCount + 1}: ${e.message}`);
        }
      }

      if (sentCount > 0) {
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        console.log(`✅ [IG] Sent ${sentCount} item(s) via bk9`);
      } else {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, {
          text: `❌ All items were too large or failed to send.`
        }, { quoted: m });
      }

      cleanupFiles(result.items);

    } catch (error) {
      console.error('❌ [IG] Error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Instagram download failed*\n\n${error.message}`
      }, { quoted: m });
    }
  }
};

export { downloadInstagram };
