import { getBotName } from '../../lib/botname.js';
import { downloadMediaMessage } from 'wolfsocket';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const PPTX_MIMES = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/mspowerpoint',
    'application/powerpoint'
];

function extractTextFromXml(xml) {
    const texts = [];
    const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const t = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        if (t) texts.push(t);
    }
    return texts;
}

export default {
    name: 'extractppt',
    alias: ['pptreader', 'readppt', 'readpptx', 'pptxtxt', 'fromslides'],
    description: 'Extract text content from a PowerPoint (.pptx) presentation',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;
        const docMsg      = quotedMsg?.documentMessage;

        if (!quotedMsg || !docMsg) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📊 PPTX READER 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ Reply to a PowerPoint file with ${PREFIX}extractppt\n` +
                      `│\n` +
                      `├⊷ *Aliases:*\n` +
                      `├⊷ ${PREFIX}pptreader\n` +
                      `├⊷ ${PREFIX}readpptx\n` +
                      `└⊷ ${PREFIX}readppt\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        const mimeType = docMsg.mimetype || '';
        const fileName = docMsg.fileName || '';
        const isPptx   = PPTX_MIMES.some(t => mimeType.includes(t.split('/').pop()))
                      || fileName.toLowerCase().endsWith('.pptx')
                      || fileName.toLowerCase().endsWith('.ppt');

        if (!isPptx) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📊 PPTX READER 』\n│\n` +
                      `├⊷ *Error:* The replied file is not a PowerPoint presentation\n` +
                      `└⊷ Please reply to a valid .pptx or .ppt file\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const fakeMsg = {
                key: {
                    id:          contextInfo.stanzaId,
                    remoteJid:   chatId,
                    participant: contextInfo.participant || undefined
                },
                message: quotedMsg
            };

            const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
            if (!buffer || buffer.length === 0) throw new Error('Failed to download presentation');

            const JSZip = require('jszip');
            const zip   = await JSZip.loadAsync(buffer);

            const slideFiles = Object.keys(zip.files)
                .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
                .sort((a, b) => {
                    const na = parseInt(a.match(/slide(\d+)/)[1]);
                    const nb = parseInt(b.match(/slide(\d+)/)[1]);
                    return na - nb;
                });

            if (slideFiles.length === 0) {
                throw new Error('No slides found — the file may be corrupt or in an unsupported format');
            }

            const slideOutputs = [];

            for (let i = 0; i < slideFiles.length; i++) {
                const xml    = await zip.files[slideFiles[i]].async('string');
                const texts  = extractTextFromXml(xml);

                if (texts.length === 0) continue;

                const title   = texts[0];
                const bullets = texts.slice(1);
                let block = `*Slide ${i + 1}:* ${title}`;
                if (bullets.length > 0) {
                    block += '\n' + bullets.map(b => `  • ${b}`).join('\n');
                }
                slideOutputs.push(block);
            }

            if (slideOutputs.length === 0) {
                await sock.sendMessage(chatId, { react: { text: '⚠️', key: m.key } });
                return sock.sendMessage(chatId, {
                    text: `╭⊷『 📊 PPTX READER 』\n│\n` +
                          `├⊷ *File:* ${fileName}\n` +
                          `├⊷ *Slides:* ${slideFiles.length}\n` +
                          `├⊷ *Result:* No readable text found\n` +
                          `└⊷ The presentation may be image-only\n\n` +
                          `╰⊷ *${getBotName()} Utility*`
                }, { quoted: m });
            }

            const MAX_CHARS = 3500;
            let body = slideOutputs.join('\n\n');
            if (body.length > MAX_CHARS) {
                body = body.slice(0, MAX_CHARS) + `\n\n… *(truncated — more slides not shown)*`;
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📊 PPTX EXTRACTED 』\n│\n` +
                      `├⊷ *File:* ${fileName || 'presentation.pptx'}\n` +
                      `├⊷ *Slides:* ${slideFiles.length}\n` +
                      `│\n` +
                      `${body}\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📊 PPTX READER 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Make sure the file is a valid .pptx presentation\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
