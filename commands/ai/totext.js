import axios from 'axios';
import { downloadMediaMessage } from 'wolfsocket';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import FormDataLib from 'form-data';

const execAsync = promisify(exec);

// ── Groq Whisper — direct file upload (primary, works from any server) ────────
async function groqTranscribe(buffer) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not set');
    const form = new FormDataLib();
    form.append('file', buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');
    const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${key}` },
        timeout: 60000
    });
    const text = res.data?.text?.trim();
    if (!text) throw new Error('Groq returned empty transcription');
    return {
        text,
        language: res.data?.language || '',
        duration:  res.data?.duration  || 0
    };
}

// ── Keith URL-based API (secondary — needs a reachable public URL) ─────────────
async function keithTranscribeUrl(audioUrl) {
    const res = await axios.get('https://apiskeith.top/ai/transcribe', {
        params: { url: audioUrl },
        timeout: 60000
    });
    if (!res.data?.status) throw new Error(res.data?.err || 'Keith API returned no result');
    const text = res.data?.result?.text?.trim();
    if (!text) throw new Error('Empty transcription');
    return { text, language: res.data?.result?.language || '', duration: res.data?.result?.duration || 0 };
}

const XCASPER_TRANSCRIPT = 'https://apis.xcasper.space/api/tools/transcript';

const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_\-]{11})/;

function extractYtId(text) {
    const m = text.match(YT_REGEX);
    return m ? m[1] : null;
}

async function fetchYtTranscript(urlOrId, lang = 'en') {
    const isId = /^[A-Za-z0-9_\-]{11}$/.test(urlOrId);
    const params = isId ? { id: urlOrId, lang } : { url: urlOrId, lang };

    const resp = await axios.get(XCASPER_TRANSCRIPT, { params, timeout: 30000 });
    if (!resp.data?.success) {
        throw new Error(resp.data?.error || resp.data?.message || 'Transcript fetch failed');
    }
    return resp.data;
}

async function convertToMp3(buffer) {
    const tmpDir = path.join(process.cwd(), 'tmp', 'transcribe');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const ts = Date.now();
    const inputPath  = path.join(tmpDir, `input_${ts}.ogg`);
    const outputPath = path.join(tmpDir, `output_${ts}.mp3`);

    fs.writeFileSync(inputPath, buffer);
    try {
        await execAsync(`ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -b:a 64k -y "${outputPath}"`, { timeout: 30000 });
        const result = fs.readFileSync(outputPath);
        try { fs.unlinkSync(inputPath); } catch {}
        try { fs.unlinkSync(outputPath); } catch {}
        return result;
    } catch {
        try { fs.unlinkSync(inputPath); } catch {}
        return buffer;
    }
}

export default {
    name:        'totext',
    alias:       ['transcribe', 'speech2text', 'audio2text', 'whisper', 'stt', 'transcript', 'yttranscript'],
    category:    'ai',
    description: 'Convert audio to text OR extract YouTube transcript',

    async execute(sock, m, args, PREFIX) {
        const jid   = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });

        const input         = args.join(' ').trim();
        const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // ── YouTube transcript mode ────────────────────────────────────────────
        const ytId = input ? extractYtId(input) : null;
        if (ytId || (input && /^[A-Za-z0-9_\-]{11}$/.test(input))) {
            const id   = ytId || input;
            const lang = args.find(a => /^[a-z]{2}(-[A-Z]{2})?$/.test(a) && a !== id) || 'en';

            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

            let data;
            try {
                data = await fetchYtTranscript(id, lang);
            } catch (err) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return reply(`❌ Failed to fetch transcript.\n\n_${err.message}_`);
            }

            const { fullText, wordCount, segmentCount, language, thumbnail, videoId } = data;
            const trimmed = fullText?.length > 3800 ? fullText.slice(0, 3800) + '\n…' : fullText;

            if (thumbnail) {
                try {
                    const imgResp = await axios.get(thumbnail, { responseType: 'arraybuffer', timeout: 10000 });
                    await sock.sendMessage(jid, {
                        image:   Buffer.from(imgResp.data),
                        caption:
                            `📜 *YouTube Transcript*\n` +
                            `━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🆔 *Video:* ${videoId}\n` +
                            `🌐 *Lang:* ${language}\n` +
                            `📊 *Words:* ${wordCount}  •  *Segments:* ${segmentCount}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                            `${trimmed}\n\n` +
                            ` _${getOwnerName().toUpperCase()} TECH_`
                    }, { quoted: m });
                } catch {
                    await reply(
                        `📜 *YouTube Transcript*\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `🆔 *Video:* ${videoId}\n` +
                        `🌐 *Lang:* ${language}\n` +
                        `📊 *Words:* ${wordCount}  •  *Segments:* ${segmentCount}\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `${trimmed}\n\n` +
                        ` _${getOwnerName().toUpperCase()} TECH_`
                    );
                }
            } else {
                await reply(
                    `📜 *YouTube Transcript*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 *Video:* ${videoId}\n` +
                    `🌐 *Lang:* ${language}\n` +
                    `📊 *Words:* ${wordCount}  •  *Segments:* ${segmentCount}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `${trimmed}\n\n` +
                    ` _${getOwnerName().toUpperCase()} TECH_`
                );
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            return;
        }

        // ── Audio transcription mode ───────────────────────────────────────────
        if (!quotedMessage) {
            return reply(
                `╭─⌈ *TRANSCRIBE* ⌋\n` +
                `│\n` +
                `├─⊷ *Audio → Text:*\n` +
                `│  Reply to a voice note / audio\n` +
                `│  ${PREFIX}totext\n` +
                `│\n` +
                `├─⊷ *YouTube Transcript:*\n` +
                `│  ${PREFIX}totext <YouTube URL>\n` +
                `│  ${PREFIX}totext <video ID>\n` +
                `│  ${PREFIX}totext <URL> fr  ← with language\n` +
                `│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );
        }

        if (!quotedMessage.audioMessage && !quotedMessage.videoMessage) {
            return reply(`❌ Please reply to an audio message or voice note.`);
        }

        try {
            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

            const quotedMsg = {
                key: {
                    id:         m.message.extendedTextMessage.contextInfo.stanzaId,
                    remoteJid:  jid,
                    participant: m.message.extendedTextMessage.contextInfo.participant
                },
                message: quotedMessage
            };

            const buffer    = await downloadMediaMessage(quotedMsg, 'buffer', {});
            if (!buffer || buffer.length === 0) throw new Error('Failed to download audio');

            const mp3Buffer = await convertToMp3(buffer);

            let transcription = '';
            let detectedLang  = '';
            let audioDuration = 0;

            // ── Primary: Groq Whisper (direct file upload — works from Replit) ─
            try {
                console.log('🎤 [TOTEXT] Trying Groq Whisper...');
                const gRes = await groqTranscribe(mp3Buffer);
                transcription = gRes.text;
                detectedLang  = gRes.language;
                audioDuration = gRes.duration;
                console.log(`✅ [TOTEXT] Groq success. Lang: ${detectedLang}`);
            } catch (err) {
                console.warn(`⚠️ [TOTEXT] Groq failed: ${err.message}`);
            }

            // ── Secondary: Keith URL-based (works outside Replit if file host available) ─
            if (!transcription) {
                try {
                    console.log('🎤 [TOTEXT] Trying Keith URL API...');
                    const tmpDir  = path.join(process.cwd(), 'tmp');
                    const tmpFile = path.join(tmpDir, `wolf_stt_${Date.now()}.mp3`);
                    fs.writeFileSync(tmpFile, mp3Buffer);
                    const publicUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/tmp/wolf_stt_${path.basename(tmpFile)}`;
                    const kRes = await keithTranscribeUrl(publicUrl);
                    transcription = kRes.text;
                    detectedLang  = kRes.language;
                    audioDuration = kRes.duration;
                    try { fs.unlinkSync(tmpFile); } catch {}
                    console.log(`✅ [TOTEXT] Keith success. Lang: ${detectedLang}`);
                } catch (err) {
                    console.warn(`⚠️ [TOTEXT] Keith failed: ${err.message}`);
                }
            }

            if (!transcription) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return reply(
                    `╭⌈ ❌ *TRANSCRIPTION FAILED* ⌋\n` +
                    `├⊷ No working transcription service available.\n` +
                    `│\n` +
                    `├⊷ 🔑 *Fix:* Add a free Groq API key:\n` +
                    `│   1. Go to console.groq.com\n` +
                    `│   2. Create a free account\n` +
                    `│   3. Generate an API key\n` +
                    `│   4. Add it as *GROQ_API_KEY* in Secrets\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                );
            }

            const wordCount = transcription.split(/\s+/).filter(w => w.length > 0).length;
            const durStr    = audioDuration ? `⏱️ ${Math.round(audioDuration)}s  •  ` : '';

            await reply(
                `╭⌈ 🎤 *TRANSCRIPTION* ⌋\n` +
                (detectedLang ? `├⊷ Language : *${detectedLang}*\n` : '') +
                `├⊷ ${durStr}📊 ${wordCount} words\n` +
                `│\n` +
                `${transcription}\n` +
                `│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );
            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await reply(`❌ Transcription failed: ${err.message}`);
        }
    }
};
