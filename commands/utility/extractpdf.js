import { getBotName } from '../../lib/botname.js';
import { downloadMediaMessage } from 'wolfsocket';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

export default {
    name: 'extractpdf',
    alias: ['pdfreader', 'pdfextract', 'readpdf', 'pdftext'],
    description: 'Extract and read text from a PDF document',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;
        const docMsg      = quotedMsg?.documentMessage;

        if (!quotedMsg || !docMsg) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📖 PDF READER 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ Reply to a PDF file with ${PREFIX}extractpdf\n` +
                      `│\n` +
                      `├⊷ *Aliases:*\n` +
                      `├⊷ ${PREFIX}pdfreader\n` +
                      `├⊷ ${PREFIX}pdfextract\n` +
                      `└⊷ ${PREFIX}readpdf\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        const mimeType = docMsg.mimetype || '';
        if (!mimeType.includes('pdf') && !docMsg.fileName?.toLowerCase().endsWith('.pdf')) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📖 PDF READER 』\n│\n` +
                      `├⊷ *Error:* The replied file is not a PDF\n` +
                      `└⊷ Please reply to a valid PDF document\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        const tmpPath = join(tmpdir(), `wolfbot_pdf_${Date.now()}.pdf`);

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
            if (!buffer || buffer.length === 0) throw new Error('Failed to download PDF');

            writeFileSync(tmpPath, buffer);

            const { PDFParse } = await import('pdf-parse');
            const fileUrl = `file://${tmpPath}`;
            const parser  = new PDFParse({ url: fileUrl });
            const data    = await parser.getText();

            const rawText  = (data.text || '').trim();
            const pages    = data.total ?? data.totalPages ?? data.numpages ?? '?';
            const fileName = docMsg.fileName || 'document.pdf';

            if (!rawText) {
                await sock.sendMessage(chatId, { react: { text: '⚠️', key: m.key } });
                return sock.sendMessage(chatId, {
                    text: `╭⊷『 📖 PDF READER 』\n│\n` +
                          `├⊷ *File:* ${fileName}\n` +
                          `├⊷ *Pages:* ${pages}\n` +
                          `│\n` +
                          `├⊷ *Result:* No readable text found\n` +
                          `└⊷ This PDF may be image-only or password protected\n\n` +
                          `╰⊷ *${getBotName()} Utility*`
                }, { quoted: m });
            }

            const MAX_CHARS = 3500;
            const trimmed   = rawText.length > MAX_CHARS
                ? rawText.slice(0, MAX_CHARS) + `\n\n… *(truncated — ${rawText.length - MAX_CHARS} more chars)*`
                : rawText;

            const wordCount = rawText.split(/\s+/).filter(Boolean).length;
            const charCount = rawText.length;

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📖 PDF EXTRACTED 』\n│\n` +
                      `├⊷ *File:* ${fileName}\n` +
                      `├⊷ *Pages:* ${pages}\n` +
                      `├⊷ *Words:* ${wordCount}\n` +
                      `├⊷ *Chars:* ${charCount}\n` +
                      `│\n` +
                      `├⊷ *Content:*\n` +
                      `│\n` +
                      `${trimmed}\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📖 PDF READER 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Make sure the PDF is not corrupted or encrypted\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        } finally {
            if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
    }
};
