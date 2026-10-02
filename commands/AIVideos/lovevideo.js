import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateEphoto(url, textArray) {
    const apiEndpoints = [
        `https://api-photooxy.vercel.app/api/ephoto360?url=${encodeURIComponent(url)}&text=${encodeURIComponent(textArray[0])}`,
        `https://widipe.com/ephoto360?url=${encodeURIComponent(url)}&text=${encodeURIComponent(textArray[0])}`
    ];

    for (const endpoint of apiEndpoints) {
        try {
            const res = await axios.get(endpoint, { timeout: 15000 });
            const u = res.data?.url || res.data?.image || res.data?.result?.url || res.data?.result?.image;
            if (u) return u;
        } catch {}
    }

    try {
        const { ephoto } = await import('mumaker');
        const result = await ephoto(url, textArray);
        if (result && (result.url || result.image || result.img)) {
            return result.url || result.image || result.img;
        }
    } catch (err) {
        console.log(`[LOVEVIDEO] mumaker failed: ${err.message}`);
    }

    return null;
}

export default {
    name: "lovevideo",
    aliases: ["lovecard", "sweetlove", "loveanimation", "lovegreeting", "romanticvideo"],
    category: "Generator",
    description: "Create sweet love video cards with your text",

    async execute(sock, m, args, prefix) {
        const jid = m.key.remoteJid;

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            if (args.length === 0) {
                return sock.sendMessage(jid, {
                    text: `╭─⌈ 💖 *LOVE VIDEO CARD* ⌋\n│\n├─⊷ *${prefix}lovevideo <text>*\n│  └⊷ Create sweet love video card (max 50 chars)\n│\n├─⊷ *Example:*\n│  └⊷ ${prefix}lovevideo I love Silent Wolf\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            let text = args.join(" ").trim();

            if (text.length > 50) {
                return sock.sendMessage(jid, {
                    text: "❌ Text is too long! Please use maximum 50 characters."
                }, { quoted: m });
            }

            console.log(`💖 [LOVEVIDEO] Generating for: "${text}"`);

            const statusMsg = await sock.sendMessage(jid, {
                text: `💖 *Creating Love Video:*\n"${text}"\n⏳ *Adding romantic effects...*`
            }, { quoted: m });

            const effectUrls = [
                "https://en.ephoto360.com/create-sweet-love-video-cards-online-734.html",
                "https://en.ephoto360.com/create-romantic-luxury-video-wedding-invitations-online-580.html",
                "https://en.ephoto360.com/write-text-on-love-hearts-261.html",
                "https://en.ephoto360.com/love-hearts-name-generator-353.html"
            ];

            let resultUrl = null;
            let apiUsed = "";

            for (const effectUrl of effectUrls) {
                resultUrl = await generateEphoto(effectUrl, [text]);
                if (resultUrl) {
                    apiUsed = effectUrl.match(/(\d+)\.html/)?.[1] || "ephoto360";
                    break;
                }
            }

            if (!resultUrl) {
                await sock.sendMessage(jid, {
                    text: `❌ Failed to generate love video for "${text}"\n\nPlease try:\n• Shorter text\n• Different text\n• Try again later`,
                    edit: statusMsg.key
                });
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return;
            }

            console.log(`✅ [LOVEVIDEO] Got result from effect #${apiUsed}`);

            await sock.sendMessage(jid, {
                text: `💖 *Creating Love Video:*\n"${text}" ✅\n⬇️ *Downloading...*`,
                edit: statusMsg.key
            });

            try {
                const response = await axios({
                    url: resultUrl,
                    method: 'GET',
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*'
                    }
                });

                const buffer = Buffer.from(response.data);
                if (buffer.length === 0) throw new Error("Empty response");

                const isVideo = /\.(mp4|webm|mov)/i.test(resultUrl);
                const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

                if (isVideo) {
                    await sock.sendMessage(jid, {
                        video: buffer,
                        caption: `💖 *SWEET LOVE VIDEO CARD*\n📝 *Message:* ${text}`,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: `💖 *SWEET LOVE CARD*\n📝 *Message:* ${text}`
                    }, { quoted: m });
                }

                await sock.sendMessage(jid, {
                    text: `✅ *Love Card Created!*`,
                    edit: statusMsg.key
                });
                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                console.log(`✅ [LOVEVIDEO] Success: "${text}" (${fileSizeMB}MB)`);

            } catch (downloadError) {
                console.error("❌ [LOVEVIDEO] Download error:", downloadError.message);
                await sock.sendMessage(jid, {
                    text: `❌ Download failed. Direct link:\n🔗 ${resultUrl}\n\n*Message:* ${text}`,
                    edit: statusMsg.key
                });
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            }

        } catch (error) {
            console.error("❌ [LOVEVIDEO] ERROR:", error);
            await sock.sendMessage(jid, {
                text: `❌ Error: ${error.message}`
            }, { quoted: m });
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        }
    }
};
