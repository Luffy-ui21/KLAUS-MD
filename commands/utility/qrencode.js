import { getBotName } from '../../lib/botname.js';

const QR_API = 'https://api.qrserver.com/v1/create-qr-code/';

export default {
    name: 'qrencode',
    alias: ['qrcode', 'qr', 'makeqr'],
    description: 'Generate a QR code from any text or URL',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const text = args.join(' ').trim();

        if (!text) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📱 QR GENERATOR 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ ${PREFIX}qrencode <text or URL>\n` +
                      `│\n` +
                      `├⊷ *Examples:*\n` +
                      `├⊷ ${PREFIX}qrencode https://example.com\n` +
                      `└⊷ ${PREFIX}qrencode Hello World\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const url = `${QR_API}?size=512x512&format=png&data=${encodeURIComponent(text)}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

            if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);

            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length < 100) throw new Error('Invalid QR image received');

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                image: buffer,
                caption: `╭⊷『 📱 QR CODE 』\n│\n` +
                         `├⊷ *Content:* ${text.length > 60 ? text.slice(0, 60) + '…' : text}\n` +
                         `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📱 QR GENERATOR 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Please try again\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
