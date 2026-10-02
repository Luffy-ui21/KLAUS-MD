import { createRequire } from 'module';
import axios from 'axios';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { setMusicSession } from '../../lib/musicSession.js';
import { xwolfSearch } from '../../lib/xwolfApi.js';
import { giftedYtsSearch } from '../../lib/giftedApi.js';
import { downloadAudioWithFallback } from '../../lib/audioDownloader.js';
import { sigLog } from '../../lib/sigLog.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch (e) {}

// ── Search chain: gifted yts → xwolf → yt-search ─────────────────────────
async function searchVideos(query, limit = 5) {
  // 1. gifted yts (primary — fast, rich metadata)
  let items = await giftedYtsSearch(query, limit);
  if (items.length) {
    sigLog('✅', 'SONG/search', 'gifted yts hit', { Count: items.length });
    return items;
  }
  sigLog('⚠️', 'SONG/search', 'gifted yts empty — trying xwolf', null, 'yellow');

  // 2. xwolf
  items = await xwolfSearch(query, limit);
  if (items.length) {
    sigLog('✅', 'SONG/search', 'xwolf hit', { Count: items.length });
    return items;
  }
  sigLog('⚠️', 'SONG/search', 'xwolf empty — trying yt-search', null, 'yellow');

  // 3. yt-search (last resort)
  try {
    const { videos } = await yts(query);
    if (videos?.length) {
      return videos.slice(0, limit).map(v => ({
        id:           v.videoId,
        title:        v.title,
        channelTitle: v.author?.name || '',
        duration:     v.timestamp   || '',
        thumbnail:    v.thumbnail   || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
      }));
    }
  } catch {}
  return [];
}

export default {
  name: 'song',
  aliases: ['music', 'audio', 'mp3', 'ytmusic', 'ytplay', 'ytmp3', 'singit'],
  category: 'Downloader',
  description: 'Download YouTube audio',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p   = prefix || '/';
    const quotedText = m.quoted?.text?.trim()
      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
      || '';

    let searchQuery = args.join(' ').trim() || quotedText;

    if (!searchQuery) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🎵 *SONG DOWNLOADER* ⌋\n│\n├─⊷ *${p}song <song name>*\n│  └⊷ Download audio\n├─⊷ *${p}song <YouTube URL>*\n│  └⊷ Download from link\n├─⊷ Reply a message and send *${p}song*\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    sigLog('🎵', 'SONG', 'New audio request', { Query: searchQuery });
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      // ── Step 1: resolve search → YouTube URL + metadata ──────────────────
      const isUrl = /^https?:\/\//i.test(searchQuery);
      let videoInfo = { title: searchQuery, channelTitle: '', duration: '', thumbnail: '' };

      if (!isUrl) {
        sigLog('🔎', 'SONG', 'Searching via gifted yts → xwolf → yt-search…');
        const items = await searchVideos(searchQuery, 5);
        if (items.length) {
          const top = items[0];
          videoInfo = {
            title:        top.title       || searchQuery,
            channelTitle: top.channelTitle || '',
            duration:     top.duration    || '',
            thumbnail:    top.thumbnail   || `https://img.youtube.com/vi/${top.id}/hqdefault.jpg`
          };
          searchQuery = `https://youtube.com/watch?v=${top.id}`;
          sigLog('✅', 'SONG', 'Resolved', { Title: videoInfo.title, URL: searchQuery });

          if (isButtonModeEnabled() && giftedBtns?.sendInteractiveMessage) {
            const videos = items.map(v => ({
              url: `https://youtube.com/watch?v=${v.id}`, title: v.title,
              author: v.channelTitle || '', duration: v.duration || '',
              videoId: v.id, thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`
            }));
            setMusicSession(jid, { videos, index: 0, type: 'audio' });
            const buttons = [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬇️ Download', id: `${p}songdl` }) }];
            if (videos.length > 1) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '➡️ Next Result', id: `${p}snext` }) });
            try {
              const msgOpts = {
                title: videoInfo.title.substring(0, 60),
                text: `🎵 *${videoInfo.title}*\n👤 ${videoInfo.channelTitle || 'Unknown'}\n⏱️ ${videoInfo.duration || 'N/A'}\n\n_Result 1 of ${videos.length}_`,
                footer: ` ${getBotName()}`, interactiveButtons: buttons
              };
              if (videoInfo.thumbnail) msgOpts.image = { url: videoInfo.thumbnail };
              await giftedBtns.sendInteractiveMessage(sock, jid, msgOpts);
              await sock.sendMessage(jid, { react: { text: '🎵', key: m.key } });
              return;
            } catch {}
          }
        }
      } else {
        // Direct YouTube URL — enrich title/duration/channel via yts(videoId)
        // so the rich card shows real metadata instead of the raw URL.
        const videoId = searchQuery.match(/(?:v=|youtu\.be\/)([^&?\/\s]{11})/i)?.[1] || '';
        if (videoId) videoInfo.thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        if (videoId) {
          try {
            const meta = await yts({ videoId });
            if (meta?.title) {
              videoInfo.title        = meta.title;
              videoInfo.channelTitle = meta.author?.name  || videoInfo.channelTitle;
              videoInfo.duration     = meta.timestamp     || videoInfo.duration;
              videoInfo.thumbnail    = meta.thumbnail     || videoInfo.thumbnail;
              sigLog('✅', 'SONG', 'URL metadata loaded', { Title: meta.title });
            }
          } catch {}
        }
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // ── Step 2: download — Keith → yt-dlp → Cobalt ───────────────────────
      const audioBuffer = await downloadAudioWithFallback(searchQuery);

      if (!audioBuffer) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ Download failed. Please try again later.` }, { quoted: m });
      }

      const trackTitle = videoInfo.title || 'Audio';
      const sizeMB     = (audioBuffer.length / 1024 / 1024).toFixed(1);

      if (parseFloat(sizeMB) > 100) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ File too large (${sizeMB}MB). Max is 100MB.` }, { quoted: m });
      }

      let thumbnailBuffer = null;
      if (videoInfo.thumbnail) {
        try {
          const tr = await axios.get(videoInfo.thumbnail, { responseType: 'arraybuffer', timeout: 10000 });
          if (tr.data.length > 1000) thumbnailBuffer = Buffer.from(tr.data);
        } catch {}
      }

      const cleanTitle = trackTitle.replace(/[^\w\s.-]/gi, '').substring(0, 50);

      await sock.sendMessage(jid, {
        audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false,
        fileName: `${cleanTitle}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: trackTitle.substring(0, 60),
            body: `🎵 ${videoInfo.channelTitle ? videoInfo.channelTitle + ' | ' : ''}${videoInfo.duration ? '⏱️ ' + videoInfo.duration + ' | ' : ''}${sizeMB}MB | 128kbps | Downloaded by ${getBotName()}`,
            mediaType: 2, thumbnail: thumbnailBuffer,
            sourceUrl: searchQuery, mediaUrl: searchQuery,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      sigLog('✅', 'SONG', 'Sent track', { Title: trackTitle, Size: `${sizeMB}MB` });

    } catch (err) {
      sigLog('❌', 'SONG', 'Failed', { Error: err.message }, 'red');
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
