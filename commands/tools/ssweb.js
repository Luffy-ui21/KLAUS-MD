import axios from 'axios';
import { getFooter } from '../../lib/menuHelper.js';

const BASE_URL = 'https://snapshot.xwolf.space/api/capture';

const HELP_TEXT = (PREFIX, jid) =>
    `╭─⌈ 📸 *WEBSITE SCREENSHOT* ⌋\n├─⊷ *${PREFIX}ssweb <url>* — mobile screenshot\n├─⊷ *${PREFIX}ssweb <url> desktop* — desktop view\n├─⊷ *${PREFIX}ssweb <url> full* — full-page scroll\n├─⊷ *${PREFIX}ssweb <url> desktop full* — desktop full-page\n╰⊷ ${getFooter(jid)}`;

export default {
    name: 'ssweb',
    aliases: ['screenshot', 'webss', 'webshot', 'ss'],
    category: 'Tools',
    description: 'Take a screenshot of any website (mobile/desktop/full-page)',

    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(jid, { text: HELP_TEXT(PREFIX, jid) }, { quoted: m });
        }

        // Parse flags — viewport and fullPage can appear anywhere after the URL
        const flags = args.map(a => a.toLowerCase());
        const isDesktop  = flags.includes('desktop');
        const isFullPage = flags.includes('full') || flags.includes('fullpage');

        // First arg that isn't a flag is the URL
        const FLAG_WORDS = new Set(['mobile', 'desktop', 'full', 'fullpage']);
        let rawUrl = args.find(a => !FLAG_WORDS.has(a.toLowerCase())) || '';

        if (!rawUrl) {
            return sock.sendMessage(jid, { text: HELP_TEXT(PREFIX, jid) }, { quoted: m });
        }

        // Auto-prepend https:// if missing
        if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

        // Validate URL shape
        try { new URL(rawUrl); } catch {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid URL:* ${rawUrl}\n\nMake sure it's a valid website address.\n💡 Example: ${PREFIX}ssweb google.com`
            }, { quoted: m });
        }

        const viewport  = isDesktop ? 'desktop' : 'mobile';
        const modeLabel = `${isDesktop ? '🖥️ Desktop' : '📱 Mobile'}${isFullPage ? ' · Full Page' : ''}`;

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            const params = { siteUrl: rawUrl, viewport };
            if (isFullPage) params.fullPage = 'true';

            const resp = await axios.get(BASE_URL, {
                params,
                responseType: 'arraybuffer',
                timeout: 45000
            });

            const ct = resp.headers['content-type'] || '';
            if (!ct.startsWith('image/')) {
                throw new Error(`Unexpected response type: ${ct}`);
            }

            const buffer = Buffer.from(resp.data);
            if (buffer.length < 500) throw new Error('Screenshot too small — site may not have loaded');

            const sizekb = (buffer.length / 1024).toFixed(1);
            const caption =
                `📸 *Website Screenshot*\n` +
                `🌐 ${rawUrl}\n` +
                `📐 *View:* ${modeLabel}\n` +
                `📦 *Size:* ${sizekb} KB\n` +
                `${getFooter(m.key.participant || m.key.remoteJid)}`;

            await sock.sendMessage(jid, { react: { text: '📸', key: m.key } });
            await sock.sendMessage(jid, {
                image:    buffer,
                mimetype: 'image/png',
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

            console.error(`[SSWEB] Error: ${reason}`);
            return sock.sendMessage(jid, {
                text: `❌ *Screenshot failed*\n\n🌐 ${rawUrl}\n⚠️ ${reason}\n\n💡 Make sure the URL is reachable and try again.`
            }, { quoted: m });
        }
    }
};
