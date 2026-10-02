export default {
    name: "trap",
    alias: ["astolfo", "otokonoko", "femboy"],
    desc: "Send random anime trap character images",
    category: "Anime",
    usage: ".trap",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;

            // Multiple API sources for trap/astolfo images
            const apiSources = [
                async () => {
                    const res = await fetch("https://api.waifu.pics/sfw/waifu");
                    const data = await res.json();
                    return data?.url;
                },
                async () => {
                    const res = await fetch("https://nekos.best/api/v2/neko");
                    const data = await res.json();
                    return data?.results?.[0]?.url;
                },
                async () => {
                    const res = await fetch("https://api.waifu.im/search?included_tags=trap");
                    const data = await res.json();
                    return data?.images?.[0]?.url;
                }
            ];

            let imageUrl = null;

            // Try each API source until one works
            for (const apiCall of apiSources) {
                try {
                    imageUrl = await apiCall();
                    if (imageUrl) break;
                } catch (error) {
                    console.log(`API failed: ${error.message}`);
                    continue;
                }
            }

            if (!imageUrl) {
                // Final fallback to a static image or GIF
                return sock.sendMessage(
                    jid,
                    {
                        image: {
                            url: "https://i.pinimg.com/originals/7d/b4/ee/7db4ee3c1c6fe6d34f5b8c8f4a7c9a0f.gif"
                        },
                        caption: "✨ *Astolfo Trap* ✨\nHere's a cute trap character for you!",
                    },
                    { quoted: m }
                );
            }

            const captions = [
                "✨ *Trap-Kun Detected!* ✨",
                "💫 *Astolfo Has Arrived!* 💫",
                "🌸 *Who's The Cutest Trap?* 🌸",
                "🎀 *Femboy Power!* 🎀",
                "⚡ *Otokonoko Magic!* ⚡",
                "💖 *Trap Charm Activated!* 💖",
                "🌟 *100% Pure Cuteness!* 🌟"
            ];

            const randomCaption = captions[Math.floor(Math.random() * captions.length)];

            await sock.sendMessage(
                jid,
                {
                    image: { url: imageUrl },
                    caption: randomCaption,
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Trap command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { 
                    text: "⚠️ Failed to fetch trap image. Please try again later!",
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true
                    }
                },
                { quoted: m }
            );
        }
    }
};