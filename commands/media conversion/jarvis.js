import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const execAsync = promisify(exec);

const AI_APIS = [
    {
        name: 'GPT-5',
        url: 'https://iamtkm.vercel.app/ai/gpt5',
        params: (q) => ({ apikey: 'tkm', text: q }),
        parse: (data) => data?.result || data?.response || data?.answer || null
    },
    {
        name: 'Grok',
        url: 'https://apiskeith.vercel.app/ai/grok',
        params: (q) => ({ q }),
        parse: (data) => data?.result || data?.response || data?.answer || data?.text || data?.content || data?.message || null
    },
    {
        name: 'Copilot',
        url: 'https://darkness.ashlynn.workers.dev/chat/',
        method: 'POST',
        body: (q) => ({ messages: [{ role: 'user', content: q }], model: 'gpt-4o' }),
        parse: (data) => data?.response || data?.choices?.[0]?.message?.content || null
    },
    {
        name: 'Blackbox',
        url: 'https://api.ryzendesu.vip/api/ai/blackbox',
        params: (q) => ({ chat: q }),
        parse: (data) => data?.response || data?.result || null
    }
];

async function getAIResponse(query) {
    const jarvisPrompt = `You are JARVIS (Just A Rather Very Intelligent System), Tony Stark's AI assistant from Iron Man. Respond in character as JARVIS - formal, intelligent, british, helpful, and slightly witty. Address the user as "sir" occasionally. Keep responses concise (under 200 words). Question: ${query}`;

    for (const api of AI_APIS) {
        try {
            let response;
            if (api.method === 'POST') {
                response = await axios.post(api.url, api.body(jarvisPrompt), {
                    timeout: 25000,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                response = await axios.get(api.url, {
                    params: api.params(jarvisPrompt),
                    timeout: 25000
                });
            }
            const result = api.parse(response.data);
            if (result && result.trim().length > 10) {
                console.log(`[JARVIS] AI response from ${api.name}`);
                return result.trim();
            }
        } catch (err) {
            console.log(`[JARVIS] ${api.name} failed: ${err.message}`);
            continue;
        }
    }
    return null;
}

const TTS_ENDPOINTS = [
    {
        name: 'Google TTS',
        generate: async (text) => {
            const chunks = splitText(text, 200);
            const buffers = [];
            for (const chunk of chunks) {
                const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=en-GB&client=tw-ob`;
                const res = await axios({ method: 'GET', url, responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/' } });
                buffers.push(Buffer.from(res.data));
            }
            return Buffer.concat(buffers);
        }
    },
    {
        name: 'StreamElements TTS',
        generate: async (text) => {
            const truncated = text.substring(0, 300);
            const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(truncated)}`;
            const res = await axios({ method: 'GET', url, responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(res.data);
        }
    },
    {
        name: 'VoiceRSS TTS',
        generate: async (text) => {
            const truncated = text.substring(0, 300);
            const url = `https://api.voicerss.org/?key=free&hl=en-gb&src=${encodeURIComponent(truncated)}&c=MP3`;
            const res = await axios({ method: 'GET', url, responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(res.data);
        }
    }
];

function splitText(text, maxLen) {
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }
        let splitIdx = remaining.lastIndexOf('. ', maxLen);
        if (splitIdx === -1 || splitIdx < maxLen / 2) splitIdx = remaining.lastIndexOf(' ', maxLen);
        if (splitIdx === -1 || splitIdx < maxLen / 2) splitIdx = maxLen;
        chunks.push(remaining.substring(0, splitIdx + 1).trim());
        remaining = remaining.substring(splitIdx + 1).trim();
    }
    return chunks;
}

async function textToAudio(text) {
    for (const endpoint of TTS_ENDPOINTS) {
        try {
            const buffer = await endpoint.generate(text);
            if (buffer && buffer.length > 1000) {
                console.log(`[JARVIS] TTS success via ${endpoint.name}`);
                return buffer;
            }
        } catch (err) {
            console.log(`[JARVIS] ${endpoint.name} TTS failed: ${err.message}`);
        }
    }
    return null;
}

async function applyJarvisEffect(inputBuffer) {
    const tempDir = path.join(process.cwd(), 'tmp', 'jarvis');
    await fs.mkdir(tempDir, { recursive: true });

    const ts = Date.now();
    const inputPath = path.join(tempDir, `jarvis_in_${ts}.mp3`);
    const outputPath = path.join(tempDir, `jarvis_out_${ts}.ogg`);

    await fs.writeFile(inputPath, inputBuffer);

    try {
        const cmd = `ffmpeg -i "${inputPath}" -af "asetrate=44100*0.97,aresample=48000,equalizer=f=1000:t=q:w=0.8:g=4,equalizer=f=3000:t=q:w=1:g=2,aecho=0.8:0.88:60:0.4" -c:a libopus -b:a 128k -ar 48000 -ac 1 -y "${outputPath}"`;
        await execAsync(cmd, { timeout: 30000 });

        const result = await fs.readFile(outputPath);
        try { await fs.unlink(inputPath); } catch {}
        try { await fs.unlink(outputPath); } catch {}
        return result;
    } catch {
        try { await fs.unlink(inputPath); } catch {}
        return inputBuffer;
    }
}

export default {
    name: "jarvis",
    alias: [],
    desc: "JARVIS AI assistant - responds with voice using AI",
    category: "media conversion",
    usage: `.jarvis [question/message]`,

    async execute(sock, m, args) {
        try {
            const chatId = m.key.remoteJid;

            if (args.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🤖 *J.A.R.V.I.S.* ⌋\n│  _Just A Rather Very Intelligent System_\n│\n├─⊷ *.jarvis <message>*\n│  └⊷ Ask anything to the AI assistant\n│\n├─⊷ *Examples:*\n│  └⊷ .jarvis What is quantum computing?\n│  └⊷ .jarvis How does AI work?\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            const query = args.join(' ');

            await sock.sendMessage(chatId, { react: { text: '🤖', key: m.key } });

            const aiResponse = await getAIResponse(query);

            if (!aiResponse) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
                return await sock.sendMessage(chatId, {
                    text: '❌ *J.A.R.V.I.S.:* All AI systems are currently offline. Please try again later, sir.'
                }, { quoted: m });
            }

            let ttsText = aiResponse;
            if (ttsText.length > 500) {
                ttsText = ttsText.substring(0, 500);
            }

            const rawAudio = await textToAudio(ttsText);

            if (!rawAudio) {
                await sock.sendMessage(chatId, {
                    text: `🤖 *J.A.R.V.I.S.:*\n\n${aiResponse}`
                }, { quoted: m });
                await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
                return;
            }

            const finalAudio = await applyJarvisEffect(rawAudio);

            await sock.sendMessage(chatId, {
                audio: finalAudio,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: m });

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (error) {
            console.error("JARVIS error:", error);
            if (m.key?.remoteJid) {
                await sock.sendMessage(m.key.remoteJid, { react: { text: '❌', key: m.key } });
                await sock.sendMessage(m.key.remoteJid, {
                    text: `❌ *J.A.R.V.I.S. Error:* ${error.message}`
                }, { quoted: m });
            }
        }
    }
};
