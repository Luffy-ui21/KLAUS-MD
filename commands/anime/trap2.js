export default {
    name: "trap2",
    alias: ["astolfo", "otokonoko", "femboy"],
    desc: "Send random anime trap character images (NSFW available)",
    category: "Anime",
    usage: ".trap2 [sfw/nsfw]",
    async execute(sock, m, args) {
        try {
            const jid = m.key.remoteJid;
            const type = args[0]?.toLowerCase() || "sfw";
            
            // Check if in NSFW group or private chat for NSFW content
            const isNSFWAllowed = true; // Add your own logic here

            if (type === "nsfw" && !isNSFWAllowed) {
                return sock.sendMessage(
                    jid,
                    { 
                        text: "❌ NSFW content is only allowed in NSFW-enabled groups or private chats!",
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true
                        }
                    },
                    { quoted: m }
                );
            }

            let apiUrl;
            
            if (type === "nsfw") {
                // NSFW trap APIs
                apiUrl = "https://api.waifu.pics/nsfw/trap";
                // Note: waifu.pics might not have NSFW trap endpoint
                // You might need a different NSFW API
            } else {
                // SFW trap APIs
                apiUrl = "https://api.waifu.pics/sfw/waifu";
            }

            const res = await fetch(apiUrl);
            const data = await res.json();

            if (!data?.url) {
                // Fallback
                const fallbackRes = await fetch("https://nekos.best/api/v2/neko");
                const fallbackData = await fallbackRes.json();
                
                const imageUrl = fallbackData?.results?.[0]?.url || 
                    "https://i.imgur.com/example.jpg"; // Add default image
                
                const caption = type === "nsfw" 
                    ? "🔞 *NSFW Trap* 🔞\nViewer discretion advised!"
                    : "✨ *SFW Trap* ✨\nCute trap character incoming!";
                
                await sock.sendMessage(
                    jid,
                    {
                        image: { url: imageUrl },
                        caption: caption,
                    },
                    { quoted: m }
                );
                return;
            }

            const caption = type === "nsfw" 
                ? "🔞 *NSFW Trap Content* 🔞\nEnjoy responsibly!"
                : "✨ *Trap Image* ✨\nHere's your cute character!";

            await sock.sendMessage(
                jid,
                {
                    image: { url: data.url },
                    caption: caption,
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Trap command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { 
                    text: "⚠️ Error: " + err.message,
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