/**
 * .song <name> — Search and download a song
 *
 * Primary: YouTube audio download (full song, up to 10MB)
 * Fallback: iTunes 30-second preview
 *
 * Usage:
 *   .song Harry Styles Watermelon Sugar
 *   .song Sauti Sol Suzanna
 *
 * Aliases: .music, .play, .audio, .ytaudio
 */

const axios = require('axios');

module.exports = {
  name: 'song',
  aliases: ['music', 'play', 'audio', 'ytaudio'],
  desc: 'Search and download a song (full audio)',
  category: 'media',
  async execute({ sock, msg, args, from, reply }) {
    const query = args.join(' ');
    if (!query) return reply('❌ Provide a song name.\nUsage: `.song Harry Styles Watermelon Sugar`');

    await reply(`🔍 *Searching for:* ${query}...`);

    // Try multiple public YouTube-to-audio APIs (no API key needed)
    const apis = [
      {
        name: 'Paxsenix',
        search: (q) => `https://paxsenix.dpdns.org/ytdl?query=${encodeURIComponent(q)}`,
        parse: (data) => {
          if (!data?.data?.formats) return null;
          const audio = data.data.formats.find(f => f.mimeType?.includes('audio')) ||
                        data.data.formats.find(f => f.audioOnly);
          return audio ? { url: audio.url, title: data.data.title, duration: data.data.lengthSeconds, source: 'Paxsenix' } : null;
        },
      },
      {
        name: 'Cobalt',
        search: (q) => `https://co.wuk.sh/api/json`,
        method: 'post',
        body: (q) => ({ query: q, audioFormat: 'mp3' }),
        parse: (data) => data?.url ? { url: data.url, title: query, duration: 0, source: 'Cobalt' } : null,
      },
      // Fallback — iTunes metadata
    ];

    // Try each API
    let fullAudio = null;
    for (const api of apis) {
      try {
        if (api.method === 'post') {
          const res = await axios.post(api.search, api.body(query), {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          });
          fullAudio = api.parse(res.data);
        } else {
          const res = await axios.get(api.search(query), {
            timeout: 15000,
            headers: { 'Accept': 'application/json' },
          });
          fullAudio = api.parse(res.data);
        }
        if (fullAudio) {
          console.log(`[SONG] Found via ${api.name}`);
          break;
        }
      } catch (e) {
        console.warn(`[SONG] ${api.name} failed:`, e.message);
      }
    }

    if (fullAudio) {
      try {
        await reply(`⏳ Downloading: *${fullAudio.title}*`);
        const audioRes = await axios.get(fullAudio.url, {
          responseType: 'arraybuffer',
          timeout: 120000,
          maxContentLength: 50 * 1024 * 1024,  // 50MB max
        });
        const audioBuffer = Buffer.from(audioRes.data);

        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: 'audio/mpeg',
          fileName: `${fullAudio.title}.mp3`,
        }, { quoted: msg });

        await reply(
          `✅ *Song downloaded!*\n\n` +
          `🎵 *Title:* ${fullAudio.title}\n` +
          `⏱️ *Duration:* ${fullAudio.duration ? `${Math.floor(fullAudio.duration / 60)}:${String(fullAudio.duration % 60).padStart(2, '0')}` : 'Unknown'}\n` +
          `💾 *Size:* ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB\n` +
          `🔧 *Source:* ${fullAudio.source}`
        );
        return;
      } catch (e) {
        console.warn('[SONG] Full download failed:', e.message);
        await reply(`⚠️ Full download failed — falling back to iTunes preview...`);
      }
    }

    // Fallback: iTunes 30-second preview
    try {
      const res = await axios.get('https://itunes.apple.com/search', {
        params: { term: query, media: 'music', limit: 1, country: 'KE' },
        timeout: 10000,
      });

      const results = res.data.results;
      if (!results || results.length === 0) {
        return reply(`❌ No song found for: *${query}*`);
      }

      const song = results[0];
      const previewUrl = song.previewUrl;

      if (!previewUrl) {
        return reply(
          `🎵 *${song.trackName}*\n` +
          `🎤 *Artist:* ${song.artistName}\n\n` +
          `❌ No preview available.`
        );
      }

      const audioRes = await axios.get(previewUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      const audioBuffer = Buffer.from(audioRes.data, 'binary');

      await sock.sendMessage(from, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${song.trackName} - ${song.artistName}.mp3`,
      }, { quoted: msg });

      await reply(
        `✅ *Preview sent (30s)*\n\n` +
        `🎵 *Title:* ${song.trackName}\n` +
        `🎤 *Artist:* ${song.artistName}\n` +
        `💿 *Album:* ${song.collectionName || 'Single'}\n\n` +
        `🔗 *Get full song:* ${song.trackViewUrl || 'N/A'}\n\n` +
        `_Full download APIs were unavailable. Try again later for full song._`
      );
    } catch (e) {
      await reply(`❌ Search failed: ${e.message}`);
    }
  },
};
