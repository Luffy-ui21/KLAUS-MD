import { createRequire } from 'module';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';

const _require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = _require('wolfbtns'); } catch (e) {}

async function searchVideos(query, limit = 15) {
  try {
    const { videos } = await yts(query);
    if (!videos?.length) return [];
    return videos.slice(0, limit).map(v => ({
      id:           v.videoId,
      title:        v.title,
      channelTitle: v.author?.name || '',
      duration:     v.timestamp   || '',
      thumbnail:    v.thumbnail   || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
    }));
  } catch (e) {
    console.log(`[yts] yt-search error: ${e.message}`);
    return [];
  }
}

export default {
  name: 'yts',
  description: 'Search YouTube videos',
  category: 'Downloader',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p = prefix || '.';

    const query = args.join(' ').trim();

    if (!query) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🔍 *YTS SEARCH* ⌋\n│\n├─⊷ *${p}yts <search query>*\n│  └⊷ Search YouTube videos\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      const items = await searchVideos(query, 15);

      if (!items.length) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ No results found for "${query}". Try different keywords.` }, { quoted: m });
      }

      if (isButtonModeEnabled() && giftedBtns?.sendInteractiveMessage) {
        try {
          const top = items.slice(0, 8);
          const rows = [];
          top.forEach((v, i) => {
            const ytUrl = `https://youtube.com/watch?v=${v.id}`;
            const dur = v.duration ? ` (${v.duration})` : '';
            const titleShort = v.title.substring(0, 55);
            rows.push({
              id: `${p}ytmp3 ${ytUrl}`,
              title: `🎵 ${titleShort}${dur}`,
              description: `Audio MP3 — ${v.channelTitle || 'Unknown Channel'}`
            });
            rows.push({
              id: `${p}ytmp4 ${ytUrl}`,
              title: `🎬 ${titleShort}${dur}`,
              description: `Video MP4 — ${v.channelTitle || 'Unknown Channel'}`
            });
          });

          const topVideo = items[0];
          const thumbUrl = `https://img.youtube.com/vi/${topVideo.id}/hqdefault.jpg`;

          await giftedBtns.sendInteractiveMessage(sock, jid, {
            title: `🔍 YouTube Search`,
            text: `*Query:* "${query}"\n*Results:* ${items.length} found\n\n▸ Tap the list to pick Audio or Video`,
            footer: ` ${getBotName()}`,
            image: { url: thumbUrl },
            interactiveButtons: [
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: '🎵🎬 Pick a Result',
                  sections: [{
                    title: `Top ${top.length} Results`,
                    rows
                  }]
                })
              },
              {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                  display_text: '🔍 Open YouTube',
                  url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
                })
              }
            ]
          });
          await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
          return;
        } catch (btnErr) {
          console.log('[YTS] Button mode failed:', btnErr.message);
        }
      }

      let text = `🔍 *${getBotName()} — YouTube Search*\n`;
      text += `📝 *Query:* "${query}"\n`;
      text += `📊 *Results:* ${items.length} found\n\n`;

      items.forEach((v, i) => {
        const ytUrl = `https://youtube.com/watch?v=${v.id}`;
        text += `*${i + 1}. ${v.title}*\n`;
        text += `   🅦 *URL:* ${ytUrl}\n`;
        text += `   ⏱️ *Duration:* ${v.duration || 'N/A'}\n`;
        text += `   👤 *Channel:* ${v.channelTitle || 'Unknown'}\n\n`;
      });

      text += `┌───────────────────\n`;
      text += `│  WOLFBOT DOWNLOAD TIPS\n`;
      text += `├───────────────────\n`;
      text += `│ • *${p}ytplay <url>* → Audio\n`;
      text += `│ • *${p}ytv <url>* → Video\n`;
      text += `│ • *${p}ytmp3 <url>* → MP3\n`;
      text += `│ • *${p}ytmp4 <url>* → MP4\n`;
      text += `└───────────────────`;

      await sock.sendMessage(jid, { text }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [YTS] Error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Search failed. Please try again later.` }, { quoted: m });
    }
  }
};
