import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { getContentType, downloadContentFromMessage } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const execAsync = promisify(exec);

function parseTime(str) {
    str = str.trim();
    if (str.includes(':')) {
        const parts = str.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parseFloat(str) * 60;
}

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default {
    name: 'trim',
    alias: ['trimaudio', 'trimvideo', 'audiotrim', 'videotrim', 'cut'],
    description: 'Trim an audio or video between two timestamps',
    category: 'media conversion',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        if (!args[0]) {
            return reply(
                `╭─⌈ ✂️ *TRIM* ⌋\n│\n` +
                `├─⊷ *Reply to an audio or video, then:*\n│\n` +
                `├─⊷ *${PREFIX}trim 1,2*\n│  └⊷ Trim min 1 to min 2\n` +
                `├─⊷ *${PREFIX}trim 1:30,2:45*\n│  └⊷ Trim 1:30 to 2:45\n` +
                `├─⊷ *${PREFIX}trim 0,0:30*\n│  └⊷ First 30 seconds\n│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        const input = args[0];
        const parts = input.split(',');
        if (parts.length !== 2) {
            return reply(`❌ Use: \`${PREFIX}trim start,end\` — e.g. \`${PREFIX}trim 1,2\` or \`${PREFIX}trim 1:30,2:45\``);
        }

        const startSec = parseTime(parts[0]);
        const endSec   = parseTime(parts[1]);

        if (isNaN(startSec) || isNaN(endSec)) return reply('❌ Invalid time format.');
        if (endSec <= startSec) return reply('❌ End time must be greater than start time.');
        if (endSec - startSec > 600) return reply('❌ Max trim length is 10 minutes.');

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
                       || msg.message?.audioMessage?.contextInfo?.quotedMessage
                       || msg.message?.videoMessage?.contextInfo?.quotedMessage
                       || msg.message?.documentMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg) return reply(`❌ Reply to an audio or video with \`${PREFIX}trim ${input}\``);

        const msgType      = getContentType(quotedMsg);
        const mediaContent = quotedMsg[msgType];
        const mime         = mediaContent?.mimetype || '';

        const isAudio = msgType === 'audioMessage'
                     || (msgType === 'documentMessage' && mime.includes('audio'));
        const isVideo = msgType === 'videoMessage'
                     || (msgType === 'documentMessage' && mime.includes('video'));

        if (!isAudio && !isVideo) return reply('❌ Replied message must be an audio or video file.');

        await sock.sendMessage(chatId, { react: { text: '✂️', key: msg.key } });

        const tmpDir  = path.join(process.cwd(), 'tmp');
        await fs.mkdir(tmpDir, { recursive: true });

        const id      = msg.key.id || Date.now();
        const rawPath = path.join(tmpDir, `trim_raw_${id}`);
        const ext     = isVideo ? 'mp4' : 'mp3';
        const outPath = path.join(tmpDir, `trim_out_${id}.${ext}`);

        try {
            const mediaType = msgType.replace('Message', '');
            const stream    = await downloadContentFromMessage(mediaContent, mediaType);
            const chunks    = [];
            for await (const chunk of stream) chunks.push(chunk);
            await fs.writeFile(rawPath, Buffer.concat(chunks));

            const duration = endSec - startSec;

            let ffmpegCmd;
            if (isVideo) {
                ffmpegCmd = `ffmpeg -y -i "${rawPath}" -ss ${startSec} -t ${duration} -c:v libx264 -c:a aac -preset fast "${outPath}"`;
            } else {
                ffmpegCmd = `ffmpeg -y -i "${rawPath}" -ss ${startSec} -t ${duration} -vn -acodec libmp3lame -q:a 2 "${outPath}"`;
            }

            await execAsync(ffmpegCmd, { timeout: 120000 });

            const fileBuffer = fsSync.readFileSync(outPath);
            const fileName   = `trimmed_${formatTime(startSec)}-${formatTime(endSec)}.${ext}`;

            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video:    fileBuffer,
                    mimetype: 'video/mp4',
                    fileName
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, {
                    audio:    fileBuffer,
                    mimetype: 'audio/mp4',
                    fileName
                }, { quoted: msg });
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[TRIM]', err.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await reply(`❌ Trim failed: ${err.message}`);
        } finally {
            for (const f of [rawPath, outPath]) {
                try { await fs.unlink(f); } catch {}
            }
        }
    }
};
