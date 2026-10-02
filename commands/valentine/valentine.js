import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const API_BASE = 'https://apiskeith.vercel.app';

export default {
    name: 'valentine',
    alias: ['vday', 'valentinesday'],
    category: 'valentine',
    description: 'Create a Valentine\'s Day effect with text and image',

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasImage = quoted?.imageMessage || msg.message?.imageMessage;

        if (!args.length && !hasImage) {
            return await sock.sendMessage(chatId, {
                text: `╭─⌈ 💝 *VALENTINE'S DAY* ⌋\n│\n│ Create a Valentine's Day effect\n│ with text and image\n│\n├─⊷ *Usage:*\n│ ${global.prefix || '.'}valentine <text>\n│ _(reply to an image)_\n│\n├─⊷ *Example:*\n│ ${global.prefix || '.'}valentine I Love You\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const text = args.join(' ') || 'Happy Valentine';

        let imageUrl = '';
        try {
            if (hasImage) {
                const imgMsg = quoted?.imageMessage || msg.message?.imageMessage;
                const buffer = await sock.downloadMediaMessage(quoted?.imageMessage ? { message: { imageMessage: imgMsg }, key: msg.key } : msg);
                const formData = new FormData();
                const blob = new Blob([buffer], { type: 'image/jpeg' });
                formData.append('file', blob, 'image.jpg');
                const upload = await axios.post('https://tmpfiles.org/api/v1/upload', formData, { timeout: 15000 });
                imageUrl = upload.data?.data?.url?.replace('tmpfiles.org/', 'tmpfiles.org/dl/') || '';
            }
        } catch {}

        await sock.sendMessage(chatId, { react: { text: '💝', key: msg.key } });

        try {
            let url = `${API_BASE}/api/photofunia/generate?effect=valentine&text=${encodeURIComponent(text)}`;
            if (imageUrl) url += `&imageUrl=${encodeURIComponent(imageUrl)}`;

            const res = await axios.get(url, { timeout: 30000 });
            const resultUrl = res.data?.url || res.data?.result || res.data?.image || res.data?.data?.url;

            if (!resultUrl) throw new Error('No image returned');

            const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 });

            await sock.sendMessage(chatId, {
                image: Buffer.from(imgRes.data),
                caption: `💝 *Valentine's Day*\nText: ${text}\n\n_Created by ${getBotName()}_`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(chatId, {
                text: `❌ Failed to generate Valentine's Day effect: ${err.message}`
            }, { quoted: msg });
        }
    }
};
