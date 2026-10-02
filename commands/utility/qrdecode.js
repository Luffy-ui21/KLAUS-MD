import { getBotName } from '../../lib/botname.js';
import { downloadMediaMessage } from 'wolfsocket';

const DECODE_API = 'https://api.qrserver.com/v1/read-qr-code/';

export default {
    name: 'qrdecode',
    alias: ['decodeqr', 'readqr', 'scanqr'],
    description: 'Decode / read a QR code from an image',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;
        const imageMsg    = quotedMsg?.imageMessage || quotedMsg?.stickerMessage;

        if (!quotedMsg || !imageMsg) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 🔍 QR DECODER 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ Reply to an image containing a QR code\n` +
                      `└⊷ Then send ${PREFIX}qrdecode\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const fakeMsg = {
                key: {
                    id:         contextInfo.stanzaId,
                    remoteJid:  chatId,
                    participant: contextInfo.participant || undefined
                },
                message: quotedMsg
            };

            const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
            if (!buffer || buffer.length === 0) throw new Error('Failed to download image');

            const { default: FormData } = await import('form-data');
            const form = new FormData();
            form.append('file', buffer, { filename: 'qr.png', contentType: 'image/png' });

            const res = await fetch(DECODE_API, {
                method: 'POST',
                headers: form.getHeaders(),
                body: form.getBuffer()
            });

            if (!res.ok) throw new Error(`Decode API error: HTTP ${res.status}`);

            const json = await res.json();
            const decoded = json?.[0]?.symbol?.[0]?.data;
            const decodeError = json?.[0]?.symbol?.[0]?.error;

            if (decodeError || !decoded) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(chatId, {
                    text: `╭⊷『 🔍 QR DECODER 』\n│\n` +
                          `├⊷ *Result:* ❌ No QR code found in image\n` +
                          `└⊷ Make sure the QR code is clear and fully visible\n\n` +
                          `╰⊷ *${getBotName()} Utility*`
                }, { quoted: m });
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 🔍 QR DECODED 』\n│\n` +
                      `├⊷ *Content:*\n` +
                      `│  ${decoded}\n` +
                      `│\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 🔍 QR DECODER 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Please try again with a clearer image\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
