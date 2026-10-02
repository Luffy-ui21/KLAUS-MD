import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const GIFTED_DL   = 'https://api.giftedtech.co.ke/api/download/xnxxdl';
const GIFTED_SRCH = 'https://api.giftedtech.co.ke/api/search/xnxxsearch';
const XNXX_REGEX  = /xnxx\.(com|health|net|one)/i;

function isUrl(input) {
    return /^https?:\/\//i.test(input) || XNXX_REGEX.test(input);
}

function formatDuration(seconds) {
    const s = parseInt(seconds, 10);
    if (isNaN(s)) return seconds || 'N/A';
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function searchXnxx(query) {
    const res = await axios.get(GIFTED_SRCH, {
        params: { apikey: 'gifted', query },
        timeout: 20000
    });
    if (!res.data?.success || !res.data?.results?.length) return null;
    return res.data.results[0];
}

async function downloadVideoBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const buf = Buffer.from(res.data);
    if (buf.length < 5000) throw new Error('Received invalid video data');
    return buf;
}

export default {
    name: 'xnxx',
    aliases: ['xnxxdl', 'xnx'],
    desc: 'Download or search XNXX by URL or name',
    category: 'Downloaders',
    usage: '.xnxx <url or name>',

    async execute(sock, m, args, PREFIX) {
        const jid     = m.key.remoteJid;
        const BOT     = getBotName();
        const input   = args.join(' ').trim()
            || m.quoted?.text?.trim()
            || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
            || '';

        if (!input) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 🔞 *XNXX DOWNLOADER* ⌋\n` +
                    `│\n` +
                    `├⊷ *By URL:*\n` +
                    `│  └⊷ ${PREFIX}xnxx https://www.xnxx.com/video-abc123/title\n` +
                    `├⊷ *By Name:*\n` +
                    `│  └⊷ ${PREFIX}xnxx sexy massage\n` +
                    `├⊷ *Aliases:* xnxxdl, xnx\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            let videoUrl   = input;
            let searchThumb = null;

            if (!isUrl(input)) {
                console.log(`🔞 [XNXX] Searching: "${input}"`);
                await sock.sendMessage(jid, {
                    text: `🔍 *Searching XNXX for:* _${input}_`
                }, { quoted: m });

                const hit = await searchXnxx(input);
                if (!hit?.url) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(jid, {
                        text: `❌ *No results found for:* _${input}_\n\nTry a different name or use a direct URL.`
                    }, { quoted: m });
                }
                videoUrl    = hit.url;
                searchThumb = hit.thumb || hit.thumbnail || null;
                console.log(`🔞 [XNXX] Found: "${hit.title}" → ${videoUrl}`);
            }

            const res = await axios.get(GIFTED_DL, {
                params: { apikey: 'gifted', url: videoUrl },
                timeout: 30000
            });

            if (!res.data?.success || !res.data?.result) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(jid, {
                    text: `❌ *Failed to fetch video.*\n\nThe link may be broken or the video is unavailable.`
                }, { quoted: m });
            }

            const { title, duration, image, info, files } = res.data.result;
            const downloadUrl = files?.high || files?.low;

            if (!downloadUrl) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(jid, {
                    text: `❌ *No downloadable video found for this URL.*`
                }, { quoted: m });
            }

            const thumbUrl = image || files?.thumb || searchThumb;
            const caption =
                `╭─⌈ 🔞 *XNXX* ⌋\n` +
                `├⊷ 📌 *Title:* ${title || 'Unknown'}\n` +
                `├⊷ ⏱️ *Duration:* ${formatDuration(duration)}\n` +
                `├⊷ ℹ️ *Info:* ${(info || 'N/A').replace(/\n/g, ' | ')}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

            if (thumbUrl) {
                try {
                    const tRes = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 15000 });
                    await sock.sendMessage(jid, { image: Buffer.from(tRes.data), caption }, { quoted: m });
                } catch {
                    await sock.sendMessage(jid, { text: caption }, { quoted: m });
                }
            } else {
                await sock.sendMessage(jid, { text: caption }, { quoted: m });
            }

            await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

            const videoBuffer = await downloadVideoBuffer(downloadUrl);
            const safeTitle   = (title || 'xnxx').replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 50);

            await sock.sendMessage(jid, {
                video: videoBuffer,
                caption: `> ${BOT}`,
                mimetype: 'video/mp4',
                fileName: `${safeTitle}.mp4`
            }, { quoted: m });

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            console.log(`✅ [XNXX] Done: "${title}"`);

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text: `❌ *Download failed.*\n\n_${err.message || 'Unknown error'}_`
            }, { quoted: m });
        }
    }
};
