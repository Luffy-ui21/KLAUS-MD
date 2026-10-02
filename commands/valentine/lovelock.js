import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const API_BASE = 'https://apiskeith.vercel.app';

export default {
    name: 'lovelock',
    alias: ['lock', 'padlock'],
    category: 'valentine',
    description: 'Create a love lock effect with text',

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;

        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `╭─⌈ 🔒 *LOVE LOCK* ⌋\n│\n│ Create a love lock effect\n│ with your text\n│\n├─⊷ *Usage:*\n│ ${global.prefix || '.'}lovelock <text>\n│\n├─⊷ *Example:*\n│ ${global.prefix || '.'}lovelock John & Jane\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const text = args.join(' ');

        await sock.sendMessage(chatId, { react: { text: '🔒', key: msg.key } });

        try {
            const url = `${API_BASE}/api/photofunia/generate?effect=love-lock&text=${encodeURIComponent(text)}`;
            const res = await axios.get(url, { timeout: 30000 });
            const resultUrl = res.data?.url || res.data?.result || res.data?.image || res.data?.data?.url;

            if (!resultUrl) throw new Error('No image returned');

            const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 });

            await sock.sendMessage(chatId, {
                image: Buffer.from(imgRes.data),
                caption: `🔒 *Love Lock*\nText: ${text}\n\n_Created by ${getBotName()}_`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(chatId, {
                text: `❌ Failed to generate love lock effect: ${err.message}`
            }, { quoted: msg });
        }
    }
};
