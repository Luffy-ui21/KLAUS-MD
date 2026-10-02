export default {
    name: "bj",
    alias: ["bj", "head", "oral"],
    desc: "NSFW bj reaction",
    category: "NSFW",
    usage: ".bj @user",
    nsfw: true,

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            // Check if it's a group
            const isGroup = jid.endsWith("@g.us");
            
            // If it's a group, check if NSFW is allowed
            if (isGroup) {
                // You might want to implement group NSFW settings check here
                // For example: if (!groupSettings.nsfwAllowed) return;
            }

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Option 1: Using waifu.pics NSFW endpoint (if available)
            let imageUrl;
            
            try {
                // Try waifu.pics NSFW first
                const res = await fetch("https://api.waifu.pics/nsfw/blowjob");
                const data = await res.json();
                
                if (data?.url) {
                    imageUrl = data.url;
                } else {
                    throw new Error("No URL from waifu.pics");
                }
            } catch (error) {
                console.log("waifu.pics failed, trying alternatives...");
                
                // Option 2: Using nekos.life API (NSFW)
                try {
                    const res = await fetch("https://nekos.life/api/v2/img/bj");
                    const data = await res.json();
                    
                    if (data?.url) {
                        imageUrl = data.url;
                    } else {
                        // Option 3: Using nekobot API
                        const fallbackRes = await fetch("https://nekobot.xyz/api/image?type=blowjob");
                        const fallbackData = await fallbackRes.json();
                        
                        if (fallbackData?.success && fallbackData?.message) {
                            imageUrl = fallbackData.message;
                        } else {
                            throw new Error("All APIs failed");
                        }
                    }
                } catch (fallbackError) {
                    // Option 4: Using hardcoded backup images
                    const backupImages = [
                        "https://cdn.nekos.life/blowjob/blowjob_001.jpg",
                        "https://cdn.nekos.life/blowjob/blowjob_002.jpg",
                        "https://i.imgur.com/example1.jpg", // Add actual backup URLs
                        "https://i.imgur.com/example2.jpg"
                    ];
                    imageUrl = backupImages[Math.floor(Math.random() * backupImages.length)];
                }
            }

            const caption = `💋 *NSFW Bj* 💋\n@${target.split("@")[0]} is getting some oral action! 🔥`;

            await sock.sendMessage(
                jid,
                {
                    image: { url: imageUrl },
                    caption,
                    mentions: [target]
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Bj command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while fetching NSFW content. The API might be down or blocked in your region." },
                { quoted: m }
            );
        }
    }
};