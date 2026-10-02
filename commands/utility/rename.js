import { downloadMediaMessage, normalizeMessageContent } from 'wolfsocket';
import { getBotName } from '../../lib/botname.js';

const silentLogger = {
    level: 'silent', trace: ()=>{}, debug: ()=>{}, info: ()=>{},
    warn: ()=>{}, error: ()=>{}, fatal: ()=>{},
    child: ()=>({ level:'silent', trace:()=>{}, debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{}, fatal:()=>{}, child:()=>({}) })
};

const MIME_EXT = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/html': 'html',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
    'video/mp4': 'mp4',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
};

function getContextInfo(msg) {
    if (!msg?.message) return null;
    const m = msg.message;
    return m.extendedTextMessage?.contextInfo
        || m.imageMessage?.contextInfo
        || m.videoMessage?.contextInfo
        || m.audioMessage?.contextInfo
        || m.documentMessage?.contextInfo
        || m.documentWithCaptionMessage?.message?.documentMessage?.contextInfo
        || null;
}

function unwrapDocument(quotedMsg) {
    if (!quotedMsg) return null;
    const normalized = normalizeMessageContent(quotedMsg) || quotedMsg;
    if (normalized.documentMessage) return normalized.documentMessage;
    if (normalized.documentWithCaptionMessage?.message?.documentMessage) {
        return normalized.documentWithCaptionMessage.message.documentMessage;
    }
    if (normalized.audioMessage)    return { ...normalized.audioMessage,    _wrapped: 'audio' };
    if (normalized.videoMessage)    return { ...normalized.videoMessage,    _wrapped: 'video' };
    if (normalized.imageMessage)    return { ...normalized.imageMessage,    _wrapped: 'image' };
    return null;
}

function sanitizeFilename(name) {
    return String(name)
        .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_')
        .replace(/^\.+/, '')
        .trim()
        .slice(0, 200);
}

function ensureExtension(newName, mimetype, originalName) {
    const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(newName);
    if (hasExt) return newName;

    const mimeExt = MIME_EXT[(mimetype || '').toLowerCase().split(';')[0].trim()];
    if (mimeExt) return `${newName}.${mimeExt}`;

    const origExt = originalName ? originalName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] : null;
    if (origExt) return `${newName}${origExt}`;

    return newName;
}

export default {
    name: 'rename',
    alias: ['renamefile', 'filerename'],
    description: 'Rename a document by replying to it with a new filename. Works with PDF, Word, Excel, PowerPoint, MP3, MP4, ZIP, etc.',
    category: 'utility',
    usage: '.rename <new filename> (reply to a document)',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;
        const botName = getBotName();

        const contextInfo = getContextInfo(m);
        const quotedMsg = contextInfo?.quotedMessage;

        if (!quotedMsg) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 📝 *RENAME FILE* ⌋\n│\n` +
                      `├⊷ Reply to any document with:\n│   *${PREFIX}rename <new name>*\n│\n` +
                      `├⊷ *Examples:*\n` +
                      `│  • ${PREFIX}rename Report 2026\n` +
                      `│  • ${PREFIX}rename song.mp3\n` +
                      `│  • ${PREFIX}rename presentation.pptx\n│\n` +
                      `├⊷ Supported: PDF, DOC/DOCX, XLS/XLSX,\n` +
                      `│   PPT/PPTX, MP3, MP4, ZIP, and more.\n│\n` +
                      `╰⊷ *${botName.toUpperCase()}*`
            }, { quoted: m });
        }

        const newNameRaw = args.join(' ').trim();
        if (!newNameRaw) {
            return sock.sendMessage(chatId, {
                text: `❌ Please provide a new filename.\n\nUsage: *${PREFIX}rename <new filename>* (reply to the document)`
            }, { quoted: m });
        }

        const docInfo = unwrapDocument(quotedMsg);
        if (!docInfo) {
            return sock.sendMessage(chatId, {
                text: `❌ That isn't a renameable file. Reply to a *document* (PDF, Word, Excel, PowerPoint, MP3, MP4, ZIP, etc.).`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const originalName = docInfo.fileName || docInfo.title || '';
            const mimetype = docInfo.mimetype || 'application/octet-stream';

            const safeName = sanitizeFilename(newNameRaw);
            if (!safeName) throw new Error('Filename is empty after sanitization.');
            const finalName = ensureExtension(safeName, mimetype, originalName);

            const fakeMsg = {
                key: m.key,
                message: quotedMsg
            };

            const buffer = await Promise.race([
                downloadMediaMessage(fakeMsg, 'buffer', {}, {
                    logger: silentLogger,
                    reuploadRequest: sock.updateMediaMessage
                }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))
            ]);

            if (!buffer || buffer.length === 0) {
                throw new Error('Download returned empty buffer.');
            }

            const sizeKB = (buffer.length / 1024).toFixed(1);
            const sizeStr = buffer.length > 1024 * 1024
                ? `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`
                : `${sizeKB} KB`;

            const caption =
                `╭─⌈ ✅ *FILE RENAMED* ⌋\n` +
                `│ 📄 *Old:* ${originalName || 'unnamed'}\n` +
                `│ 📝 *New:* ${finalName}\n` +
                `│ 📦 *Size:* ${sizeStr}\n` +
                `╰⊷ *${botName.toUpperCase()}*`;

            await sock.sendMessage(chatId, {
                document: buffer,
                fileName: finalName,
                mimetype,
                caption
            }, { quoted: m });

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            const message = err.message === 'timeout'
                ? '⏱️ Download timed out — file may be too large or expired.'
                : `❌ Could not rename: ${err.message}`;
            await sock.sendMessage(chatId, { text: message }, { quoted: m });
        }
    }
};
