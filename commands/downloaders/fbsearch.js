import axios from 'axios';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const GIFTED_BASE = 'https://api.giftedtech.co.ke/api/download';

function isFacebookUrl(s) {
  return /facebook\.com|fb\.watch|fb\.com/i.test(s);
}

function formatViews(n) {
  if (!n && n !== 0) return null;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

async function fetchFbInfo(url) {
  try {
    const res = await axios.get(`${GIFTED_BASE}/facebookv2`, {
      params: { apikey: 'gifted', url },
      timeout: 30000
    });
    const r = res.data?.result;
    if (res.data?.success && r && (r.links?.length || r.title)) {
      return {
        success: true,
        title:    r.title     || 'Facebook Video',
        uploader: r.uploader  || null,
        duration: r.duration  || null,
        views:    r.view_count ?? null,
        links: (r.links || []).map(l => ({
          quality: l.quality || 'Unknown',
          url:     l.url || l.link || ''
        })).filter(l => l.url)
      };
    }
  } catch {}

  try {
    const res = await axios.get(`${GIFTED_BASE}/facebook`, {
      params: { apikey: 'gifted', url },
      timeout: 30000
    });
    const r = res.data?.result;
    if (res.data?.success && (r?.hd_video || r?.sd_video)) {
      const links = [];
      if (r.hd_video) links.push({ quality: 'HD', url: r.hd_video });
      if (r.sd_video) links.push({ quality: 'SD', url: r.sd_video });
      return {
        success: true,
        title:    r.title    || 'Facebook Video',
        duration: r.duration || null,
        links
      };
    }
  } catch {}

  return { success: false };
}

export default {
  name: 'fbsearch',
  aliases: ['fbs', 'fbinfo', 'fbvid'],
  description: 'Search Facebook videos or get download links',
  category: 'Downloader',

  async execute(sock, m, args, prefix) {
    const jid   = m.key.remoteJid;
    const p     = prefix || '.';
    const input = args.join(' ').trim() || m.quoted?.text?.trim() || '';

    if (!input) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📘 *FBSEARCH* ⌋\n│\n├─⊷ *${p}fbsearch <Facebook URL>*\n│  └⊷ Get video info + download links\n├─⊷ *${p}fbsearch <keywords>*\n│  └⊷ Search for Facebook videos\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '🔍', key: m.key } });

    if (isFacebookUrl(input)) {
      const info = await fetchFbInfo(input);

      if (!info.success) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ Could not fetch video info. Make sure the video is public.\n\nTip: Copy the full URL from the Facebook app.`
        }, { quoted: m });
      }

      let text = `📘 *Facebook Video*\n\n`;
      text += `*${info.title}*\n`;
      if (info.uploader) text += `👤 ${info.uploader}\n`;
      if (info.duration)  text += `⏱️ ${info.duration}\n`;
      const v = formatViews(info.views);
      if (v) text += `👁️ ${v} views\n`;

      if (info.links.length) {
        text += `\n*Download Links (${info.links.length}):*\n`;
        info.links.forEach((l, i) => {
          text += `${i + 1}. ${l.quality} — ${l.url.substring(0, 70)}...\n`;
        });
      } else {
        text += `\n❌ No download links found.\n`;
      }

      text += `\n💡 Use *${p}video ${input}* to download directly`;

      await sock.sendMessage(jid, { text }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`\x1b[32m✅ [FBSEARCH] ${info.title} — ${info.links.length} links\x1b[0m`);
      return;
    }

    try {
      const results = await yts(input);
      const videos = results?.videos?.slice(0, 8) || [];

      if (!videos.length) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ No results found for "${input}"` }, { quoted: m });
      }

      const fbSearchUrl = `https://www.facebook.com/search/videos/?q=${encodeURIComponent(input)}`;

      let text = `📘 *Facebook Search: "${input}"*\n`;
      text += `🔗 Search on FB: ${fbSearchUrl}\n\n`;
      text += `_Showing YouTube results for reference:_\n\n`;

      videos.forEach((v, i) => {
        text += `*${i + 1}. ${v.title}*\n`;
        text += `🅦 ${v.url}\n`;
        text += `⏱️ ${v.timestamp || 'N/A'} • 👤 ${v.author?.name || 'Unknown'}\n\n`;
      });

      text += `💡 Find a video on FB → use *${p}fbsearch <fb_url>* for download links`;

      await sock.sendMessage(jid, { text }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`\x1b[32m✅ [FBSEARCH] keyword: "${input}" — ${videos.length} YT results\x1b[0m`);
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Search failed: ${err.message}` }, { quoted: m });
    }
  }
};
