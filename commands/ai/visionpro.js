import { downloadMediaMessage } from 'wolfsocket';
import { vision } from '../../lib/nvidia.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const MODEL = 'meta/llama-3.2-90b-vision-instruct';

export default {
    name: 'visionpro',
    description: 'Analyze images with NVIDIA Llama 3.2 Vision PRO (90B)',
    category: 'ai',
    aliases: ['vpro', 'imgpro', 'nvisionpro', 'visualpro', 'analyzepro'],
    usage: 'visionpro [question] — reply to an image or add a URL',

    async execute(sock, m, args, PREFIX) {
        const jid    = m.key.remoteJid;
        const owner  = getOwnerName().toUpperCase();
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedImg = quoted?.imageMessage;

        const urlInArgs = (args.join(' ').match(/\bhttps?:\/\/\S+/i) || [])[0];
        const query     = args.join(' ').replace(urlInArgs || '', '').trim()
                       || 'Analyze this image and describe what you see in great detail';

        if (!quotedImg && !urlInArgs) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 🔬 *VISION PRO AI* ⌋\n├─⊷ *${PREFIX}visionpro <question>*\n│  └⊷ Reply to an image or add a URL\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            let imageInput;
            if (quotedImg) {
                const buf = await downloadMediaMessage(
                    { key: m.key, message: quoted },
                    'buffer', {},
                    { reuploadRequest: sock.updateMediaMessage, logger: console }
                );
                if (!buf || buf.length === 0) throw new Error('Could not download image from WhatsApp');
                imageInput = buf;
            } else {
                imageInput = urlInArgs;
            }

            const reply = await vision(query, imageInput, {
                model: MODEL, maxTokens: 2048, timeoutMs: 90000
            });

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(jid, {
                text: `🔬 *VISION PRO AI*\n━━━━━━━━━━━━━━━━━\n${reply}\n━━━━━━━━━━━━━━━━━\n🤖 _${MODEL}_\n${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });

        } catch (err) {
            console.error('[VISIONPRO] Error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text: `❌ *Vision PRO Error*\n\n${err.message}\n\nPlease try again.`
            }, { quoted: m });
        }
    }
};
