import axios from 'axios';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { downloadAudioWithFallback } from '../../lib/audioDownloader.js';
import { xwolfSearch } from '../../lib/xwolfApi.js';
import { giftedYtsSearch } from '../../lib/giftedApi.js';
import { sigLog } from '../../lib/sigLog.js';

// ── Search chain: gifted yts → xwolf → yt-search ─────────────────────────
async function resolveTrack(query) {
  // 1. gifted yts (primary — fast, rich metadata)
  let items = await giftedYtsSearch(query, 1);
  if (items?.length) {
    sigLog('✅', 'PLAY/search', 'gifted yts hit', { Title: items[0].title });
    const v = items[0];
    return {
      title:        v.title,
      channelTitle: v.channelTitle || '',
      duration:     v.duration     || '',
      thumbnail:    v.thumbnail    || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
      videoUrl:     `https://youtube.com/watch?v=${v.id}`
    };
  }
  sigLog('⚠️', 'PLAY/search', 'gifted yts empty — trying xwolf', null, 'yellow');

  // 2. xwolf
  try {
    const xItems = await xwolfSearch(query, 1);
    if (xItems?.length) {
      sigLog('✅', 'PLAY/search', 'xwolf hit', { Title: xItems[0].title });
      const top = xItems[0];
      return {
        title:        top.title        || query,
        channelTitle: top.channelTitle || '',
        duration:     top.duration     || '',
        thumbnail:    top.thumbnail    || `https://img.youtube.com/vi/${top.id}/hqdefault.jpg`,
        videoUrl:     `https://youtube.com/watch?v=${top.id}`
      };
    }
  } catch {}
  sigLog('⚠️', 'PLAY/search', 'xwolf empty — trying yt-search', null, 'yellow');

  // 3. yt-search (last resort)
  try {
    const { videos } = await yts(query);
    if (videos?.length) {
      const v = videos[0];
      return {
        title:        v.title          || query,
        channelTitle: v.author?.name   || '',
        duration:     v.timestamp      || '',
        thumbnail:    v.thumbnail      || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
        videoUrl:     `https://youtube.com/watch?v=${v.videoId}`
      };
    }
  } catch {}
  return null;
}

export default {
  name: 'play',
  aliases: ['playaudio', 'dlsong'],
  category: 'Downloader',
  description: 'Download YouTube audio and send as both audio and saveable document',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p   = prefix || '/';
    const quotedText = m.quoted?.text?.trim()
      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
      || '';

    let searchQuery = args.join(' ').trim() || quotedText;

    if (!searchQuery) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🎵 *PLAY* ⌋\n` +
          `│\n` +
          `├─⊷ *${p}play <song name>*\n` +
          `│  └⊷ Downloads audio + saveable file\n` +
          `├─⊷ *${p}play <YouTube URL>*\n` +
          `│  └⊷ Download from link\n` +
          `│\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    sigLog('🎵', 'PLAY', 'New audio request', { Query: searchQuery });
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      // ── Step 1: Resolve search → YouTube URL + metadata ──────────────────
      const isUrl = /^https?:\/\//i.test(searchQuery);
      let videoInfo = { title: searchQuery, channelTitle: '', duration: '', thumbnail: '' };

      if (!isUrl) {
        sigLog('🔎', 'PLAY', 'Searching via gifted yts → xwolf → yt-search…');
        const found = await resolveTrack(searchQuery);
        if (!found) {
          throw new Error('Could not find that song. Try a more specific title or paste a YouTube link.');
        }
        videoInfo.title        = found.title;
        videoInfo.channelTitle = found.channelTitle;
        videoInfo.duration     = found.duration;
        videoInfo.thumbnail    = found.thumbnail;
        searchQuery            = found.videoUrl;
      } else {
        const vid = searchQuery.match(/(?:v=|youtu\.be\/)([^&?\/\s]{11})/i)?.[1] || '';
        if (vid) videoInfo.thumbnail = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // ── Step 2: Download via fallback chain ───────────────────────────────
      sigLog('📥', 'PLAY', 'Downloading audio', { URL: searchQuery });
      const audioBuffer = await downloadAudioWithFallback(searchQuery);

      if (!audioBuffer) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ Download failed. Please try again later.` }, { quoted: m });
      }

      const trackTitle = videoInfo.title || 'Audio';
      const sizeMB     = (audioBuffer.length / 1024 / 1024).toFixed(1);
      sigLog('🎵', 'PLAY', 'Downloaded — sending', { Size: `${sizeMB}MB` });

      if (parseFloat(sizeMB) > 100) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ File too large (${sizeMB}MB). Max is 100MB.` }, { quoted: m });
      }

      // ── Step 3: Fetch thumbnail ───────────────────────────────────────────
      let thumbnailBuffer = null;
      if (videoInfo.thumbnail) {
        try {
          const tr = await axios.get(videoInfo.thumbnail, { responseType: 'arraybuffer', timeout: 10000 });
          if (tr.data.length > 1000) thumbnailBuffer = Buffer.from(tr.data);
        } catch {}
      }

      const cleanTitle = trackTitle.replace(/[^\w\s.-]/gi, '').substring(0, 50);
      const bodyLine   = `🎵 ${videoInfo.channelTitle ? videoInfo.channelTitle + ' | ' : ''}${videoInfo.duration ? '⏱️ ' + videoInfo.duration + ' | ' : ''}${sizeMB}MB | ${getBotName()}`;

      // ── Step 4: Send audio with rich card ────────────────────────────────
      await sock.sendMessage(jid, {
        audio:    audioBuffer,
        mimetype: 'audio/mpeg',
        ptt:      false,
        fileName: `${cleanTitle}.mp3`,
        contextInfo: {
          externalAdReply: {
            title:               trackTitle.substring(0, 60),
            body:                bodyLine,
            mediaType:           2,
            thumbnail:           thumbnailBuffer,
            sourceUrl:           searchQuery,
            mediaUrl:            searchQuery,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m });

      // ── Step 5: Send document so user can save/download the file ─────────
      await sock.sendMessage(jid, {
        document: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        caption:  `📥 *${trackTitle}*\n💾 ${sizeMB}MB — tap to save`
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      sigLog('✅', 'PLAY', 'Sent track', { Title: trackTitle, Size: `${sizeMB}MB` });

    } catch (err) {
      sigLog('❌', 'PLAY', 'Failed', { Error: err.message }, 'red');
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *Play failed.*\n\n_${err.message}_` }, { quoted: m });
    }
  }
};
