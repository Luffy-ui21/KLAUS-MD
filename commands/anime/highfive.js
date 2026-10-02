export default {
    name: "highfive",
    alias: ["high5", "hi5", "hifive"],
    desc: "Anime highfive reaction",
    category: "Anime",
    usage: ".highfive @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Since highfive isn't a common endpoint, we'll use pat/hug as alternatives
            // Try multiple APIs for variety
            
            const apis = [
                "https://api.waifu.pics/sfw/pat",
                "https://api.waifu.pics/sfw/hug",
                "https://nekos.life/api/v2/img/pat",
                "https://nekos.life/api/v2/img/hug"
            ];
            
            let imageUrl = null;
            let apiUsed = null;
            
            // Try each API until we get a valid image
            for (const api of apis) {
                try {
                    const res = await fetch(api);
                    const data = await res.json();
                    
                    if (api.includes("waifu.pics") && data?.url) {
                        imageUrl = data.url;
                        apiUsed = "waifu.pics";
                        break;
                    } else if (api.includes("nekos.life") && data?.url) {
                        imageUrl = data.url;
                        apiUsed = "nekos.life";
                        break;
                    }
                } catch (apiErr) {
                    console.log(`API ${api} failed, trying next...`);
                    continue;
                }
            }
            
            if (!imageUrl) {
                // Final fallback to nekos.best
                try {
                    const fallbackRes = await fetch("https://nekos.best/api/v2/pat");
                    const fallbackData = await fallbackRes.json();
                    
                    if (fallbackData?.results?.[0]?.url) {
                        imageUrl = fallbackData.results[0].url;
                        apiUsed = "nekos.best";
                    }
                } catch (finalErr) {
                    // If all APIs fail
                }
            }
            
            if (!imageUrl) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch highfive reaction. Try again later! ✋" },
                    { quoted: m }
                );
            }

            const captions = [
                `✋ *HIGH FIVE!* ✋\n@${target.split("@")[0]} and @${sender.split("@")[0]} give a high five! 🎉`,
                `🖐️ *HIFIVE!* 🖐️\n@${target.split("@")[0]} slaps hands with @${sender.split("@")[0]}! 🙌`,
                `🤚 *HIGHFIVE SUCCESS!* 🤚\n@${target.split("@")[0]} and @${sender.split("@")[0]} connect! ✨`,
                `👏 *PERFECT TIMING!* 👏\n@${target.split("@")[0]} and @${sender.split("@")[0]} nail the highfive! ⭐`
            ];
            
            const randomCaption = captions[Math.floor(Math.random() * captions.length)];

            await sock.sendMessage(
                jid,
                {
                    image: { url: imageUrl },
                    caption: randomCaption,
                    mentions: [target, sender]
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Highfive command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while processing the highfive command." },
                { quoted: m }
            );
        }
    }
};