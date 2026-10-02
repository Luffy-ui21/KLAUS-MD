import { downloadMediaMessage } from 'wolfsocket';
import { createRequire } from 'module';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const require = createRequire(import.meta.url);

const MAX_TEXT_CHARS = 3500;

// ── File-type detection ───────────────────────────────────────────────────────
const TEXT_EXTS = new Set([
    'txt','js','mjs','cjs','ts','jsx','tsx','html','htm','css','json','jsonc',
    'xml','csv','tsv','py','java','c','cpp','cc','h','hpp','php','rb','go',
    'rs','sh','bash','zsh','fish','md','markdown','yaml','yml','env','log',
    'sql','graphql','gql','toml','ini','cfg','conf','properties','vue','svelte',
    'dart','kt','swift','r','m','pl','lua','ex','exs','clj','hs','erl','elm'
]);

function getExt(name = '') {
    return name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function classify(mime = '', name = '') {
    const m = mime.toLowerCase();
    const ext = getExt(name);

    if (m === 'audio/mpeg' || m === 'audio/mp3' || ext === 'mp3') return 'mp3';
    if (m === 'video/mp4'  || ext === 'mp4')  return 'mp4';
    if (m.includes('pdf')  || ext === 'pdf')  return 'pdf';
    if (
        m.includes('wordprocessingml') || m.includes('msword') ||
        ext === 'docx' || ext === 'doc'
    ) return 'docx';
    if (TEXT_EXTS.has(ext)) return 'text';
    // Fallback: anything served as text/* or plain binary we can try as text
    if (m.startsWith('text/')) return 'text';
    return 'unknown';
}

// ── Build the fakeMsg required by Baileys downloadMediaMessage ────────────────
function buildFakeMsg(contextInfo, quotedMsg, chatId) {
    return {
        key: {
            id:          contextInfo.stanzaId,
            remoteJid:   chatId,
            participant: contextInfo.participant || undefined
        },
        message: quotedMsg
    };
}

// ── Text trimmer ─────────────────────────────────────────────────────────────
function trimText(raw) {
    const text = raw.trim();
    if (text.length <= MAX_TEXT_CHARS) return { text, trimmed: false };
    return {
        text: text.slice(0, MAX_TEXT_CHARS) + `\n\n… *(trimmed — ${text.length - MAX_TEXT_CHARS} more chars)*`,
        trimmed: true
    };
}

export default {
    name: 'getcontent',
    description: 'Get content from a file — text from docs/code files, audio from mp3, video from mp4',
    category: 'utility',
    aliases: ['filecontent', 'readfile', 'fileread', 'getfile'],
    usage: 'getcontent — reply to any file',

    async execute(sock, m, args, PREFIX) {
        const jid    = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const footer = getFooter(sender);

        // ── Resolve quoted message ────────────────────────────────────────────
        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;

        // Detect which sub-message holds the media
        const docMsg   = quotedMsg?.documentMessage;
        const audioMsg = quotedMsg?.audioMessage;
        const videoMsg = quotedMsg?.videoMessage;
        const mediaMsg = docMsg || audioMsg || videoMsg;

        if (!quotedMsg || !mediaMsg) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 📂 *GET CONTENT* ⌋\n` +
                    `├─⊷ *Usage:* Reply to any file with *${PREFIX}getcontent*\n` +
                    `│\n` +
                    `├─⊷ *Text files:* .txt .js .ts .html .css .json .py .java .go .rs .php .sql .md …\n` +
                    `├─⊷ *Documents:* .docx .doc .pdf\n` +
                    `├─⊷ *Audio:* .mp3 → sends back as audio\n` +
                    `├─⊷ *Video:* .mp4 → sends back as video\n` +
                    `│\n` +
                    `├─⊷ *Aliases:* ${PREFIX}filecontent · ${PREFIX}readfile · ${PREFIX}getfile\n` +
                    `╰⊷ ${footer}`
            }, { quoted: m });
        }

        const mime     = mediaMsg.mimetype || '';
        const fileName = mediaMsg.fileName || mediaMsg.title || '';
        const kind     = classify(mime, fileName);
        const label    = fileName || mime || 'unknown file';

        if (kind === 'unknown') {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ ❌ *UNSUPPORTED FILE* ⌋\n` +
                    `├─⊷ *File:* ${label}\n` +
                    `├─⊷ *Mime:* ${mime || '—'}\n` +
                    `│\n` +
                    `├─⊷ Supported: .txt .js .ts .html .css .json .py .java .go .rs .php .sql .md .docx .pdf .mp3 .mp4\n` +
                    `╰⊷ ${footer}`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            const fakeMsg = buildFakeMsg(contextInfo, quotedMsg, jid);
            const buffer  = await downloadMediaMessage(fakeMsg, 'buffer', {});

            if (!buffer || buffer.length === 0) throw new Error('Failed to download the file from WhatsApp');

            // ── MP3 ───────────────────────────────────────────────────────────
            if (kind === 'mp3') {
                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                await sock.sendMessage(jid, {
                    audio:    buffer,
                    mimetype: 'audio/mpeg',
                    ptt:      false,
                    fileName: fileName || 'audio.mp3'
                }, { quoted: m });
                return;
            }

            // ── MP4 ───────────────────────────────────────────────────────────
            if (kind === 'mp4') {
                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                await sock.sendMessage(jid, {
                    video:    buffer,
                    mimetype: 'video/mp4',
                    caption:  `📹 *${fileName || 'video.mp4'}*\n${footer}`
                }, { quoted: m });
                return;
            }

            // ── DOCX ──────────────────────────────────────────────────────────
            if (kind === 'docx') {
                const mammoth = require('mammoth');
                const result  = await mammoth.extractRawText({ buffer });
                const rawText = (result.value || '').trim();

                if (!rawText) {
                    await sock.sendMessage(jid, { react: { text: '⚠️', key: m.key } });
                    return sock.sendMessage(jid, {
                        text:
                            `╭─⌈ 📄 *GET CONTENT* ⌋\n` +
                            `├─⊷ *File:* ${label}\n` +
                            `├─⊷ No readable text found — document may be image-only\n` +
                            `╰⊷ ${footer}`
                    }, { quoted: m });
                }

                const { text, trimmed } = trimText(rawText);
                const words = rawText.split(/\s+/).filter(Boolean).length;

                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(jid, {
                    text:
                        `╭─⌈ 📄 *FILE CONTENT* ⌋\n` +
                        `├─⊷ *File:* ${label}\n` +
                        `├─⊷ *Words:* ${words}  *Chars:* ${rawText.length}${trimmed ? '  *(trimmed)*' : ''}\n` +
                        `│\n` +
                        `${text}\n\n` +
                        `╰⊷ ${footer}`
                }, { quoted: m });
            }

            // ── PDF ───────────────────────────────────────────────────────────
            if (kind === 'pdf') {
                const pdfParse = (await import('pdf-parse')).default;
                const data     = await pdfParse(buffer);
                const rawText  = (data.text || '').trim();
                const pages    = data.numpages ?? '?';

                if (!rawText) {
                    await sock.sendMessage(jid, { react: { text: '⚠️', key: m.key } });
                    return sock.sendMessage(jid, {
                        text:
                            `╭─⌈ 📑 *GET CONTENT* ⌋\n` +
                            `├─⊷ *File:* ${label}\n` +
                            `├─⊷ *Pages:* ${pages}\n` +
                            `├─⊷ No readable text — PDF may be image-only or encrypted\n` +
                            `╰⊷ ${footer}`
                    }, { quoted: m });
                }

                const { text, trimmed } = trimText(rawText);
                const words = rawText.split(/\s+/).filter(Boolean).length;

                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(jid, {
                    text:
                        `╭─⌈ 📑 *FILE CONTENT* ⌋\n` +
                        `├─⊷ *File:* ${label}\n` +
                        `├─⊷ *Pages:* ${pages}  *Words:* ${words}  *Chars:* ${rawText.length}${trimmed ? '  *(trimmed)*' : ''}\n` +
                        `│\n` +
                        `${text}\n\n` +
                        `╰⊷ ${footer}`
                }, { quoted: m });
            }

            // ── Plain text / code files ───────────────────────────────────────
            if (kind === 'text') {
                const rawText = buffer.toString('utf-8');
                const ext     = getExt(fileName);
                const { text, trimmed } = trimText(rawText);
                const lines = rawText.split('\n').length;
                const words = rawText.split(/\s+/).filter(Boolean).length;

                const icon = (() => {
                    if (['js','ts','jsx','tsx','mjs','cjs'].includes(ext)) return '🟨';
                    if (['html','htm'].includes(ext))  return '🌐';
                    if (ext === 'css')  return '🎨';
                    if (ext === 'json') return '📋';
                    if (ext === 'py')   return '🐍';
                    if (ext === 'md')   return '📝';
                    if (ext === 'sql')  return '🗄️';
                    if (['sh','bash','zsh'].includes(ext)) return '⚙️';
                    return '📃';
                })();

                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(jid, {
                    text:
                        `╭─⌈ ${icon} *FILE CONTENT* ⌋\n` +
                        `├─⊷ *File:* ${label}\n` +
                        `├─⊷ *Lines:* ${lines}  *Words:* ${words}  *Chars:* ${rawText.length}${trimmed ? '  *(trimmed)*' : ''}\n` +
                        `│\n` +
                        `${text}\n\n` +
                        `╰⊷ ${footer}`
                }, { quoted: m });
            }

        } catch (err) {
            console.error('[GETCONTENT] Error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text:
                    `╭─⌈ ❌ *GET CONTENT ERROR* ⌋\n` +
                    `├─⊷ *File:* ${label}\n` +
                    `├─⊷ *Error:* ${err.message}\n` +
                    `╰⊷ ${footer}`
            }, { quoted: m });
        }
    }
};
