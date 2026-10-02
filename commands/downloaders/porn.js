import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const GIFTED_BASE = 'https://api.giftedtech.co.ke/api';
const XVIDEOS_REGEX = /xvideos\.com/i;
const XNXX_REGEX    = /xnxx\.(com|health|net|one)/i;
const XHAM_REGEX    = /xhamster\.(com|desi)/i;

function isUrl(input) {
    return /^https?:\/\//i.test(input);
}

function detectSite(url) {
    if (XVIDEOS_REGEX.test(url)) return 'xvideos';
    if (XNXX_REGEX.test(url))    return 'xnxx';
    if (XHAM_REGEX.test(url))    return 'xhamster';
    return null;
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

async function fetchXvideos(url) {
    const res = await axios.get(`${GIFTED_BASE}/download/xvideosdl`, {
        params: { apikey: 'gifted', url },
        timeout: 30000
    });
    if (!res.data?.success || !res.data?.result?.download_url) return null;
    const r = res.data.result;
    return { title: r.title, thumb: r.thumbnail, dlUrl: r.download_url, info: `👁️ ${r.views || 'N/A'} | 👍 ${r.likes || 'N/A'}` };
}

async function fetchXnxx(url) {
    const res = await axios.get(`${GIFTED_BASE}/download/xnxxdl`, {
        params: { apikey: 'gifted', url },
        timeout: 30000
    });
    if (!res.data?.success || !res.data?.result) return null;
    const r = res.data.result;
    const dlUrl = r.files?.high || r.files?.low;
    if (!dlUrl) return null;
    const dur = parseInt(r.duration, 10);
    const durStr = !isNaN(dur) ? `${Math.floor(dur/60)}m ${dur%60}s` : (r.duration || 'N/A');
    return { title: r.title, thumb: r.image || r.files?.thumb, dlUrl, info: `⏱️ ${durStr}` };
}

async function fetchXhamster(url) {
    const res = await axios.get(`${GIFTED_BASE}/download/xhamsterdl`, {
        params: { apikey: 'gifted', url },
        timeout: 30000
    });
    if (!res.data?.success) return null;
    const r = res.data?.result || res.data?.data || {};
    const dlUrl = r.download_url || r.url || r.hd || r.sd;
    if (!dlUrl) return null;
    return { title: r.title, thumb: r.thumbnail || r.thumb, dlUrl, info: '' };
}

async function searchAndFetch(query) {
    // Search xvideos by name → use first result URL → download
    const sRes = await axios.get(`${GIFTED_BASE}/search/xvideossearch`, {
        params: { apikey: 'gifted', query },
        timeout: 20000
    });
    if (!sRes.data?.success || !sRes.data?.results?.length) return null;
    const hit = sRes.data.results[0];
    if (!hit?.url) return null;
    const dl = await fetchXvideos(hit.url);
    if (dl) return { ...dl, thumb: dl.thumb || hit.thumb };
    return null;
}

export default {
    name: 'porn',
    aliases: ['pornhub', 'porno', 'adultvid', '18plus'],
    desc: 'Download adult videos by name or URL (XVideos / XNXX / XHamster)',
    category: 'Downloaders',
    usage: '.porn <name or url>',

    async execute(sock, m, args, PREFIX) {
        const jid  = m.key.remoteJid;
        const BOT  = getBotName();
        const input = args.join(' ').trim()
            || m.quoted?.text?.trim()
            || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
            || '';

        if (!input) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 🔞 *ADULT VIDEO DOWNLOADER* ⌋\n` +
                    `│\n` +
                    `├⊷ *By Name:*\n` +
                    `│  └⊷ ${PREFIX}porn sexy massage\n` +
                    `├⊷ *By URL:*\n` +
                    `│  └⊷ ${PREFIX}porn https://www.xvideos.com/...\n` +
                    `│  └⊷ ${PREFIX}porn https://www.xnxx.com/...\n` +
                    `│  └⊷ ${PREFIX}porn https://xhamster.com/...\n` +
                    `├⊷ *Aliases:* pornhub, porno, adultvid, 18plus\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            let result = null;

            if (isUrl(input)) {
                const site = detectSite(input);
                if (!site) {
                    return sock.sendMessage(jid, {
                        text: `❌ Unsupported URL. Supported: XVideos, XNXX, XHamster`
                    }, { quoted: m });
                }
                console.log(`🔞 [PORN] URL download: ${site}`);
                if (site === 'xvideos')  result = await fetchXvideos(input);
                if (site === 'xnxx')     result = await fetchXnxx(input);
                if (site === 'xhamster') result = await fetchXhamster(input);
            } else {
                console.log(`🔞 [PORN] Searching: "${input}"`);
                await sock.sendMessage(jid, {
                    text: `🔍 *Searching for:* _${input}_`
                }, { quoted: m });
                result = await searchAndFetch(input);
            }

            if (!result) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(jid, {
                    text: `❌ *No results found.*\n\nTry a different name or use a direct URL.`
                }, { quoted: m });
            }

            const { title, thumb, dlUrl, info } = result;

            const caption =
                `╭─⌈ 🔞 *ADULT VIDEO* ⌋\n` +
                `├⊷ 📌 *Title:* ${title || 'Unknown'}\n` +
                (info ? `├⊷ ${info}\n` : '') +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

            if (thumb) {
                try {
                    const tRes = await axios.get(thumb, { responseType: 'arraybuffer', timeout: 15000 });
                    await sock.sendMessage(jid, { image: Buffer.from(tRes.data), caption }, { quoted: m });
                } catch {
                    await sock.sendMessage(jid, { text: caption }, { quoted: m });
                }
            } else {
                await sock.sendMessage(jid, { text: caption }, { quoted: m });
            }

            await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

            const videoBuffer = await downloadVideoBuffer(dlUrl);
            const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 50);

            await sock.sendMessage(jid, {
                video: videoBuffer,
                caption: `> ${BOT}`,
                mimetype: 'video/mp4',
                fileName: `${safeTitle}.mp4`
            }, { quoted: m });

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            console.log(`✅ [PORN] Done: ${title}`);

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text: `❌ *Download failed.*\n\n_${err.message || 'Unknown error'}_`
            }, { quoted: m });
        }
    }
};
