import { downloadMediaMessage } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const BRAND = () => getOwnerName().toUpperCase();
const MAX_SIZE_MB = 50;

// Build a Baileys-compatible message object from the quoted contextInfo
function buildQuotedMsg(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo
             || msg.message?.imageMessage?.contextInfo
             || msg.message?.videoMessage?.contextInfo
             || msg.message?.documentMessage?.contextInfo;
    if (!ctx?.quotedMessage) return null;
    return {
        key: {
            remoteJid: msg.key.remoteJid,
            id: ctx.stanzaId,
            participant: ctx.participant,
            fromMe: ctx.participant
                ? ctx.participant === (msg.key?.remoteJid || '')
                : false
        },
        message: ctx.quotedMessage
    };
}

// Unwrap ephemeral / viewOnce envelopes around a media message
function unwrapMedia(message) {
    if (!message) return null;
    if (message.ephemeralMessage?.message) message = message.ephemeralMessage.message;
    if (message.viewOnceMessageV2?.message) message = message.viewOnceMessageV2.message;
    if (message.viewOnceMessageV2Extension?.message) message = message.viewOnceMessageV2Extension.message;
    if (message.viewOnceMessage?.message) message = message.viewOnceMessage.message;
    return message;
}

function detectMediaType(message) {
    const m = unwrapMedia(message);
    if (!m) return null;
    if (m.imageMessage) return { type: 'image', node: m.imageMessage };
    if (m.videoMessage) return { type: 'video', node: m.videoMessage };
    if (m.audioMessage) return { type: 'audio', node: m.audioMessage };
    return null;
}

export default {
    name: 'tovv',
    alias: ['toviewonce', 'tovv2', 'viewonce'],
    description: 'Convert a replied media into a view-once message and delete the original.',
    category: 'utility',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const quoted = buildQuotedMsg(msg);

        if (!quoted) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 👁️ *TO VIEW-ONCE* ⌋\n` +
                    `├─⊷ Reply to a *photo, video or audio* with\n` +
                    `│   *${PREFIX}tovv* to convert it into a\n` +
                    `│   view-once message.\n` +
                    `├─⊷ The original message will be deleted\n` +
                    `│   automatically (where possible).\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const media = detectMediaType(quoted.message);
        if (!media) {
            return sock.sendMessage(chatId, {
                text: `❌ Reply to a *photo, video or audio* — not a ${Object.keys(quoted.message || {})[0] || 'text'} message.`
            }, { quoted: msg });
        }

        // Download the media
        let buffer;
        try {
            buffer = await downloadMediaMessage(quoted, 'buffer', {}, {
                logger: { level: 'silent', child: () => ({ level: 'silent' }) },
                reuploadRequest: sock.updateMediaMessage
            });
        } catch (err) {
            return sock.sendMessage(chatId, {
                text: `❌ Could not download the media: ${err?.message || err}`
            }, { quoted: msg });
        }

        if (!buffer || buffer.length === 0) {
            return sock.sendMessage(chatId, { text: '❌ Download failed: empty buffer.' }, { quoted: msg });
        }

        const sizeMB = buffer.length / (1024 * 1024);
        if (sizeMB > MAX_SIZE_MB) {
            return sock.sendMessage(chatId, {
                text: `❌ Media is too large (${sizeMB.toFixed(2)} MB). Max allowed: ${MAX_SIZE_MB} MB.`
            }, { quoted: msg });
        }

        // Re-send as view-once
        try {
            const mimetype = media.node.mimetype || '';
            const caption  = media.node.caption  || '';
            const payload  = { viewOnce: true };

            if (media.type === 'image') {
                payload.image = buffer;
                if (caption) payload.caption = caption;
            } else if (media.type === 'video') {
                payload.video = buffer;
                if (mimetype) payload.mimetype = mimetype;
                if (caption)  payload.caption  = caption;
                if (media.node.seconds) payload.seconds = media.node.seconds;
                if (media.node.gifPlayback) payload.gifPlayback = true;
            } else if (media.type === 'audio') {
                payload.audio = buffer;
                payload.mimetype = mimetype || 'audio/mp4';
                if (media.node.ptt) payload.ptt = true;
            }

            await sock.sendMessage(chatId, payload);
        } catch (err) {
            return sock.sendMessage(chatId, {
                text: `❌ Failed to re-send as view-once: ${err?.message || err}`
            }, { quoted: msg });
        }

        // Try to delete the original (works for: bot's own messages everywhere,
        // and other people's messages when bot is group admin). Fail silently
        // otherwise — WhatsApp doesn't allow deleting other users' DMs.
        try {
            await sock.sendMessage(chatId, { delete: quoted.key });
        } catch {}

        // Also delete the .tovv command itself for a clean trail
        try {
            await sock.sendMessage(chatId, { delete: msg.key });
        } catch {}
    }
};
