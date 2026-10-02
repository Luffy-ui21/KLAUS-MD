import { callAI } from '../../lib/aiHelper.js';
import { downloadMediaMessage } from 'wolfsocket';
import { vision } from '../../lib/nvidia.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const VISION_MODEL  = 'meta/llama-3.2-11b-vision-instruct';

export default {
    name: 'ilama',
    description: 'LLaMA Fast AI — instant responses with optional image analysis',
    category: 'ai',
    aliases: ['llama', 'llamaai', 'llamafast', 'fastllama'],
    usage: 'ilama [question] — reply to an image or ask anything',

    async execute(sock, m, args, PREFIX) {
        const jid    = m.key.remoteJid;
        const owner  = getOwnerName().toUpperCase();
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedImg = quoted?.imageMessage;

        const urlInArgs = (args.join(' ').match(/\bhttps?:\/\/\S+/i) || [])[0];
        const query     = args.join(' ').replace(urlInArgs || '', '').trim();
        const hasImage  = !!(quotedImg || urlInArgs);

        if (!query && !hasImage) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 🦙 *LLAMA FAST AI* ⌋\n├─⊷ *${PREFIX}ilama <question>*\n│  └⊷ Fast LLaMA AI — reply to image or ask anything\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            let reply;

            if (hasImage) {
                // Image mode — use NVIDIA vision via lib/nvidia.js
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
                reply = await vision(
                    query || 'Analyze this image and describe what you see in detail',
                    imageInput,
                    { model: VISION_MODEL, maxTokens: 1024, timeoutMs: 60000 }
                );
            } else {
                // Text mode — use active AI providers via aiHelper
                reply = await callAI('llama', query);
            }

            if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(jid, {
                text: `🦙 *LLAMA FAST AI*\n━━━━━━━━━━━━━━━━━\n${reply}\n━━━━━━━━━━━━━━━━━\n${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });

        } catch (err) {
            console.error('[ILAMA] Error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text: `❌ *LLaMA Fast Error*\n\n${err.message}\n\nPlease try again later.`
            }, { quoted: m });
        }
    }
};
