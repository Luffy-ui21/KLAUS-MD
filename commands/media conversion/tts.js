import { createRequire } from 'module';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getBotName } from '../../lib/botname.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

const LANG_CODES = ['en', 'id', 'ja', 'es', 'fr', 'de', 'ru', 'pt', 'ar', 'hi', 'zh', 'ko'];

export default {
    name: 'tts',
    alias: ['say', 'speak'],
    desc: 'Convert text to speech',
    category: 'audio',
    usage: '.tts [language] [text] | Example: .tts en Hello world | .tts id Halo dunia',

    async execute(sock, m, args, prefix) {
        const chatId = m.key.remoteJid;
        const p = prefix || '.';

        try {
            if (args.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🎤 *TEXT-TO-SPEECH* ⌋\n│\n├─⊷ *${p}tts <lang> <text>*\n│  └⊷ Convert text to speech\n│\n├─⊷ *Examples:*\n│  └⊷ ${p}tts en Hello world\n│  └⊷ ${p}tts es Hola mundo\n│\n├─⊷ *Languages:* en, id, ja, es, fr, de, ru, pt, ar, hi, zh, ko\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            let language = 'en';
            let text = '';

            if (LANG_CODES.includes(args[0].toLowerCase())) {
                language = args[0].toLowerCase();
                text = args.slice(1).join(' ');
            } else {
                text = args.join(' ');
            }

            if (!text.trim()) {
                return await sock.sendMessage(chatId, {
                    text: `╭─⌈ ❌ *NO TEXT PROVIDED* ⌋\n│\n├─⊷ *${p}tts <text>*\n│  └⊷ Example: ${p}tts Hello how are you?\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            if (text.length > 500) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Text too long! Maximum 500 characters.'
                }, { quoted: m });
            }

            const tempDir = path.join(process.cwd(), 'tmp', 'tts');
            await fs.mkdir(tempDir, { recursive: true });
            const fileName = `tts_${Date.now()}.mp3`;
            const filePath = path.join(tempDir, fileName);

            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${language}&client=tw-ob`;

            try {
                const response = await axios({
                    method: 'GET',
                    url: ttsUrl,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                await fs.writeFile(filePath, response.data);
                const audioBuffer = await fs.readFile(filePath);

                await sock.sendMessage(chatId, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    fileName: `tts_${language}.mp3`
                }, { quoted: m });

                // ── Interactive buttons after audio ───────────────────────
                const speakAgainId = `${p}tts ${language} ${text}`.substring(0, 200);
                const translateId  = `${p}translate ${language} en ${text}`.substring(0, 200);

                if (isButtonModeEnabled() && giftedBtns?.sendInteractiveMessage) {
                    try {
                        await giftedBtns.sendInteractiveMessage(sock, chatId, {
                            text: `🎤 *${text.substring(0, 80)}${text.length > 80 ? '…' : ''}*\n🌐 Language: *${language.toUpperCase()}*`,
                            footer: ` ${getBotName()}`,
                            interactiveButtons: [
                                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔊 Speak Again', id: speakAgainId }) },
                                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🌐 Translate',   id: translateId  }) }
                            ]
                        });
                    } catch {}
                } else {
                    await sock.sendMessage(chatId, {
                        text: `🎤 *${text.substring(0, 80)}${text.length > 80 ? '…' : ''}*\n🌐 Language: *${language.toUpperCase()}*`
                    }, { quoted: m });
                }

                console.log(`✅ TTS generated for: "${text.substring(0, 30)}..."`);

            } catch (apiError) {
                console.error('Google TTS API error:', apiError);
                await sock.sendMessage(chatId, {
                    text: '⚠️ TTS failed. Please try again.'
                }, { quoted: m });
            }

            try { await fs.unlink(filePath); } catch {}

        } catch (error) {
            console.error('TTS command error:', error);
            if (m.key?.remoteJid) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: `❌ *TTS Error:* ${error.message}\n\nPlease try again with shorter text.`
                }, { quoted: m });
            }
        }
    }
};
