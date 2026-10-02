import axios from 'axios';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { downloadMediaMessage } from 'wolfsocket';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function extractAudioClip(buffer, durationSec = 15) {
    const tmpDir = path.join(process.cwd(), 'tmp', 'shazam');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const ts = Date.now();
    const inputPath = path.join(tmpDir, `shazam_in_${ts}.ogg`);
    const outputPath = path.join(tmpDir, `shazam_out_${ts}.mp3`);

    fs.writeFileSync(inputPath, buffer);

    try {
        await execAsync(`ffmpeg -i "${inputPath}" -t ${durationSec} -ar 44100 -ac 1 -b:a 128k -y "${outputPath}"`, { timeout: 30000 });
        const result = fs.readFileSync(outputPath);
        try { fs.unlinkSync(inputPath); } catch {}
        try { fs.unlinkSync(outputPath); } catch {}
        return result;
    } catch {
        try { fs.unlinkSync(inputPath); } catch {}
        return buffer;
    }
}

async function identifySong(audioBuffer) {
    const FormData = (await import('form-data')).default;

    const identifyApis = [
        {
            name: 'AudD',
            identify: async (buf) => {
                const base64 = buf.toString('base64');
                const res = await axios.post('https://api.audd.io/', {
                    audio: base64,
                    return: 'apple_music,spotify',
                    api_token: 'test'
                }, { timeout: 30000 });

                if (res.data?.status === 'success' && res.data?.result) {
                    const r = res.data.result;
                    return {
                        title: r.title || 'Unknown',
                        artist: r.artist || 'Unknown',
                        album: r.album || '',
                        releaseDate: r.release_date || '',
                        label: r.label || '',
                        timecode: r.timecode || '',
                        songLink: r.song_link || '',
                        spotify: r.spotify?.external_urls?.spotify || '',
                        appleMusic: r.apple_music?.url || ''
                    };
                }
                return null;
            }
        },
        {
            name: 'Keith Shazam',
            identify: async (buf) => {
                const form = new FormData();
                form.append('file', buf, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

                const res = await axios.post('https://apiskeith.vercel.app/ai/shazam', form, {
                    headers: form.getHeaders(),
                    timeout: 30000
                });

                const r = res.data?.result || res.data;
                if (r && (r.title || r.track)) {
                    return {
                        title: r.title || r.track?.title || 'Unknown',
                        artist: r.artist || r.track?.subtitle || 'Unknown',
                        album: r.album || r.track?.sections?.[0]?.metadata?.[0]?.text || '',
                        releaseDate: r.release_date || '',
                        label: r.label || '',
                        songLink: r.url || r.track?.url || '',
                        spotify: '',
                        appleMusic: ''
                    };
                }
                return null;
            }
        },
        {
            name: 'Ryzen Shazam',
            identify: async (buf) => {
                const form = new FormData();
                form.append('file', buf, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

                const res = await axios.post('https://api.ryzendesu.vip/api/ai/shazam', form, {
                    headers: form.getHeaders(),
                    timeout: 30000
                });

                const r = res.data?.result || res.data;
                if (r && (r.title || r.track)) {
                    return {
                        title: r.title || r.track?.title || 'Unknown',
                        artist: r.artist || r.track?.subtitle || 'Unknown',
                        album: r.album || '',
                        releaseDate: '',
                        label: '',
                        songLink: r.url || '',
                        spotify: '',
                        appleMusic: ''
                    };
                }
                return null;
            }
        }
    ];

    for (const api of identifyApis) {
        try {
            const result = await api.identify(audioBuffer);
            if (result) {
                console.log(`[SHAZAM] Identified via ${api.name}`);
                return result;
            }
        } catch (err) {
            console.log(`[SHAZAM] ${api.name} failed: ${err.message}`);
        }
    }

    return null;
}

export default {
    name: 'shazam',
    aliases: ['whatsong', 'findsong', 'identify', 'musicid'],
    description: 'Identify a song from audio. Reply to audio/voice note or search by name.',
    category: 'Search',

    async execute(sock, m, args) {
        const jid = m.key.remoteJid;

        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const hasAudio = m.message?.audioMessage;
            const hasVideo = m.message?.videoMessage;

            if (!quoted && !hasAudio && !hasVideo && args.length === 0) {
                return sock.sendMessage(jid, {
                    text: `╭─⌈ 🎵 *SHAZAM* ⌋\n│\n├─⊷ *shazam*\n│  └⊷ Reply to audio to identify\n├─⊷ *shazam <song name>*\n│  └⊷ Search by text\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            if (args.length > 0 && !quoted && !hasAudio && !hasVideo) {
                const searchQuery = args.join(' ');
                await sock.sendMessage(jid, { react: { text: '🔍', key: m.key } });

                try {
                    const yts = (await import('yt-search')).default;
                    const results = await yts(searchQuery);

                    if (!results?.videos?.length) {
                        return sock.sendMessage(jid, {
                            text: `❌ No results found for "${searchQuery}"`
                        }, { quoted: m });
                    }

                    const top = results.videos.slice(0, 5);
                    let text = `🎵 *Search Results for:* "${searchQuery}"\n\n`;
                    top.forEach((v, i) => {
                        text += `${i + 1}. *${v.title}*\n`;
                        text += `   👤 ${v.author.name}\n`;
                        text += `   ⏱️ ${v.timestamp} | 👁️ ${v.views?.toLocaleString() || 'N/A'}\n`;
                        text += `   🔗 ${v.url}\n\n`;
                    });

                    await sock.sendMessage(jid, { text }, { quoted: m });
                    await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                } catch (searchErr) {
                    await sock.sendMessage(jid, {
                        text: `❌ Search failed: ${searchErr.message}`
                    }, { quoted: m });
                }
                return;
            }

            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

            let audioBuffer;

            if (hasAudio || hasVideo) {
                audioBuffer = await downloadMediaMessage(m, 'buffer', {});
            } else if (quoted) {
                const quotedMsg = {
                    key: {
                        id: m.message.extendedTextMessage.contextInfo.stanzaId,
                        remoteJid: jid,
                        participant: m.message.extendedTextMessage.contextInfo.participant
                    },
                    message: quoted
                };
                audioBuffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            }

            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Failed to download audio');
            }

            const clip = await extractAudioClip(audioBuffer, 15);

            await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

            const songInfo = await identifySong(clip);

            if (!songInfo) {
                await sock.sendMessage(jid, {
                    text: `❌ *Song not identified*\n\nCould not recognize this audio.\n\n*Tips:*\n• Use clear audio (not distorted)\n• 10-15 seconds of the main melody\n• Avoid background noise`
                }, { quoted: m });
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return;
            }

            let resultText = `🎵 *SONG IDENTIFIED*\n\n`;
            resultText += `🎶 *Title:* ${songInfo.title}\n`;
            resultText += `👤 *Artist:* ${songInfo.artist}\n`;
            if (songInfo.album) resultText += `💿 *Album:* ${songInfo.album}\n`;
            if (songInfo.releaseDate) resultText += `📅 *Released:* ${songInfo.releaseDate}\n`;
            if (songInfo.label) resultText += `🏷️ *Label:* ${songInfo.label}\n`;
            if (songInfo.timecode) resultText += `⏱️ *Timecode:* ${songInfo.timecode}\n`;

            resultText += `\n`;
            if (songInfo.songLink) resultText += `🔗 *Link:* ${songInfo.songLink}\n`;
            if (songInfo.spotify) resultText += `🟢 *Spotify:* ${songInfo.spotify}\n`;
            if (songInfo.appleMusic) resultText += `🍎 *Apple Music:* ${songInfo.appleMusic}\n`;

            await sock.sendMessage(jid, {
                text: resultText
            }, { quoted: m });

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            console.log(`[SHAZAM] Identified: ${songInfo.artist} - ${songInfo.title}`);

        } catch (error) {
            console.error('[SHAZAM ERROR]:', error);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text: `❌ Shazam error: ${error.message}`
            }, { quoted: m });
        }
    }
};
