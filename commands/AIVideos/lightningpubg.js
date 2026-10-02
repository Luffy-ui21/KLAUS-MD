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
        console.log(`[LIGHTNINGPUBG] mumaker failed: ${err.message}`);
    }

    return null;
}

export default {
    name: "lightningpubg",
    aliases: ["pubgvideo", "pubglightning", "pubglogo", "pubgintro", "lightningpubgvideo"],
    category: "Generator",
    description: "Create lightning PUBG video logo with your text",

    async execute(sock, m, args, prefix) {
        const jid = m.key.remoteJid;

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            if (args.length === 0) {
                return sock.sendMessage(jid, {
                    text: `╭─⌈ ⚡ *LIGHTNING PUBG VIDEO* ⌋\n│\n├─⊷ *${prefix}lightningpubg <text>*\n│  └⊷ Create lightning PUBG video logo (max 25 chars)\n│\n├─⊷ *Example:*\n│  └⊷ ${prefix}lightningpubg WOLF\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            let text = args.join(" ").trim();

            if (text.length > 25) {
                return sock.sendMessage(jid, {
                    text: "❌ Text is too long! Please use maximum 25 characters."
                }, { quoted: m });
            }

            console.log(`⚡ [LIGHTNINGPUBG] Generating for: "${text}"`);

            const statusMsg = await sock.sendMessage(jid, {
                text: `⚡ *Creating Lightning PUBG Video:*\n"${text}"\n⏳ *Generating epic effects...*`
            }, { quoted: m });

            const effectUrls = [
                "https://en.ephoto360.com/lightning-pubg-video-logo-maker-online-615.html",
                "https://en.ephoto360.com/create-pubg-style-glitch-video-avatar-581.html",
                "https://en.ephoto360.com/create-gaming-logo-pubg-style-online-free-575.html",
                "https://en.ephoto360.com/pubg-battlegrounds-logo-maker-online-free-576.html"
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
                    text: `❌ Failed to generate lightning PUBG effect for "${text}"\n\nPlease try:\n• Shorter text (max 25 chars)\n• Different text\n• Try again later`,
                    edit: statusMsg.key
                });
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return;
            }

            console.log(`✅ [LIGHTNINGPUBG] Got result from effect #${apiUsed}`);

            await sock.sendMessage(jid, {
                text: `⚡ *Creating Lightning PUBG:*\n"${text}" ✅\n⬇️ *Downloading...*`,
                edit: statusMsg.key
            });

            try {
                const response = await axios({
                    url: resultUrl,
                    method: 'GET',
                    responseType: 'arraybuffer',
                    timeout: 45000,
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
                        caption: `⚡ *LIGHTNING PUBG VIDEO LOGO*\n📝 *Text:* ${text}`,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: `⚡ *LIGHTNING PUBG EFFECT*\n📝 *Text:* ${text}`
                    }, { quoted: m });
                }

                await sock.sendMessage(jid, {
                    text: `✅ *Lightning PUBG Created!*`,
                    edit: statusMsg.key
                });
                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                console.log(`✅ [LIGHTNINGPUBG] Success: "${text}" (${fileSizeMB}MB)`);

            } catch (downloadError) {
                console.error("❌ [LIGHTNINGPUBG] Download error:", downloadError.message);
                await sock.sendMessage(jid, {
                    text: `❌ Download failed. Direct link:\n🔗 ${resultUrl}\n\n*Text:* ${text}`,
                    edit: statusMsg.key
                });
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            }

        } catch (error) {
            console.error("❌ [LIGHTNINGPUBG] ERROR:", error);
            await sock.sendMessage(jid, {
                text: `❌ Error: ${error.message}`
            }, { quoted: m });
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        }
    }
};
