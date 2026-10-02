import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { getFooter } from '../../lib/menuHelper.js';
import FFMPEG from '../../lib/ffmpegPath.js';

const execFileAsync = promisify(execFile);

async function webmToMp4(webmBuffer) {
    const ts   = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const inPath  = `/tmp/wolfbot_sswebv_in_${ts}_${rand}.webm`;
    const outPath = `/tmp/wolfbot_sswebv_out_${ts}_${rand}.mp4`;
    try {
        await fs.promises.writeFile(inPath, webmBuffer);
        await execFileAsync(FFMPEG, [
            '-y', '-i', inPath,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-preset', 'fast', '-crf', '26',
            '-movflags', '+faststart',
            '-c:a', 'aac', '-b:a', '128k',
            outPath
        ], { timeout: 60000 });
        return await fs.promises.readFile(outPath);
    } finally {
        try { fs.unlinkSync(inPath);  } catch {}
        try { fs.unlinkSync(outPath); } catch {}
    }
}

const BASE_URL = 'https://snapshot.xwolf.space/api/record';

const HELP_TEXT = (PREFIX, jid) =>
    `╭─⌈ 🎬 *WEBSITE SCREEN RECORD* ⌋\n├─⊷ *${PREFIX}sswebvideo <url>* — mobile recording\n├─⊷ *${PREFIX}sswebvideo <url> desktop* — desktop recording\n├─⊷ Recording takes 15–30s, please be patient\n╰⊷ ${getFooter(jid)}`;

export default {
    name: 'sswebvideo',
    aliases: ['webrecord', 'webvideo', 'recordweb', 'screenvideo', 'webscreen'],
    category: 'Tools',
    description: 'Record a short screen video of any website (mobile/desktop)',

    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(jid, { text: HELP_TEXT(PREFIX, jid) }, { quoted: m });
        }

        // Parse flags
        const flags = args.map(a => a.toLowerCase());
        const isDesktop = flags.includes('desktop');

        const FLAG_WORDS = new Set(['mobile', 'desktop']);
        let rawUrl = args.find(a => !FLAG_WORDS.has(a.toLowerCase())) || '';

        if (!rawUrl) {
            return sock.sendMessage(jid, { text: HELP_TEXT(PREFIX, jid) }, { quoted: m });
        }

        // Auto-prepend https:// if missing
        if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

        // Validate URL shape
        try { new URL(rawUrl); } catch {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid URL:* ${rawUrl}\n\nMake sure it's a valid website address.\n💡 Example: ${PREFIX}sswebvideo google.com`
            }, { quoted: m });
        }

        const viewport  = isDesktop ? 'desktop' : 'mobile';
        const modeLabel = isDesktop ? '🖥️ Desktop' : '📱 Mobile';

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            const resp = await axios.get(BASE_URL, {
                params:       { siteUrl: rawUrl, viewport },
                responseType: 'arraybuffer',
                timeout:      90000
            });

            const ct = resp.headers['content-type'] || '';
            if (!ct.startsWith('video/')) {
                throw new Error(`Unexpected response type: ${ct}`);
            }

            const buffer = Buffer.from(resp.data);
            if (buffer.length < 1000) throw new Error('Recording too small — site may not have loaded');

            // WhatsApp only accepts video/mp4 — convert webm if needed
            let videoBuffer = buffer;
            if (ct.includes('webm')) {
                videoBuffer = await webmToMp4(buffer);
            }

            const sizemb = (videoBuffer.length / (1024 * 1024)).toFixed(2);

            // WhatsApp has a ~64 MB video limit; warn if close
            if (videoBuffer.length > 60 * 1024 * 1024) {
                throw new Error(`Recording too large for WhatsApp (${sizemb} MB). Try a simpler page.`);
            }

            const caption =
                `🎬 *Website Screen Recording*\n` +
                `🌐 ${rawUrl}\n` +
                `📐 *View:* ${modeLabel}\n` +
                `📦 *Size:* ${sizemb} MB\n` +
                `${getFooter(m.key.participant || m.key.remoteJid)}`;

            await sock.sendMessage(jid, { react: { text: '🎬', key: m.key } });
            await sock.sendMessage(jid, {
                video:    videoBuffer,
                mimetype: 'video/mp4',
                caption
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });

            let reason = 'Unknown error';
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                reason = 'Request timed out — the site may be slow or unreachable';
            } else if (err.response?.status) {
                reason = `API returned HTTP ${err.response.status}`;
            } else if (err.message) {
                reason = err.message;
            }

            console.error(`[SSWEBVIDEO] Error: ${reason}`);
            return sock.sendMessage(jid, {
                text: `❌ *Screen recording failed*\n\n🌐 ${rawUrl}\n⚠️ ${reason}\n\n💡 Make sure the URL is reachable and try again.`
            }, { quoted: m });
        }
    }
};
