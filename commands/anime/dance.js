export default {
    name: "dance",
    alias: ["dancing", "boogie", "groove"],
    desc: "Animated dance reaction GIF",
    category: "Anime",
    usage: ".dance @user or .dance",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Dance-themed APIs that support GIFs
            const danceAPIs = [
                // OtakuGifs API (specialized for anime reactions)
                "https://api.otakugifs.xyz/gif?reaction=dance",
                
                // Catboy API for dance GIFs
                "https://api.catboys.com/dance",
                
                // NekoBot API for dance
                "https://nekobot.xyz/api/image?type=dance",
                
                // Waifu.pics SFW (though it's static images)
                "https://api.waifu.pics/sfw/dance",
            ];

            let gifUrl = null;
            let apiName = null;
            
            // Try each API in order
            for (const apiUrl of danceAPIs) {
                try {
                    console.log(`Trying API: ${apiUrl}`);
                    const response = await fetch(apiUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    
                    // Parse response based on API structure
                    if (apiUrl.includes("otakugifs.xyz")) {
                        if (data?.url) {
                            gifUrl = data.url;
                            apiName = "OtakuGifs";
                            break;
                        }
                    } else if (apiUrl.includes("catboys.com")) {
                        if (data?.url) {
                            gifUrl = data.url;
                            apiName = "Catboy";
                            break;
                        }
                    } else if (apiUrl.includes("nekobot.xyz")) {
                        if (data?.message) {
                            gifUrl = data.message;
                            apiName = "NekoBot";
                            break;
                        }
                    } else if (apiUrl.includes("waifu.pics")) {
                        if (data?.url) {
                            gifUrl = data.url;
                            apiName = "WaifuPics";
                            break;
                        }
                    }
                } catch (apiError) {
                    console.log(`API ${apiUrl} failed:`, apiError.message);
                    continue;
                }
            }
            
            // If all dance APIs fail, try some fallback reaction APIs
            if (!gifUrl) {
                const fallbackAPIs = [
                    "https://api.waifu.pics/sfw/happy",
                    "https://nekos.life/api/v2/img/neko",
                    "https://api.catboys.com/img"
                ];
                
                for (const apiUrl of fallbackAPIs) {
                    try {
                        const response = await fetch(apiUrl);
                        const data = await response.json();
                        
                        if (apiUrl.includes("waifu.pics") && data?.url) {
                            gifUrl = data.url;
                            apiName = "WaifuPics (Happy)";
                            break;
                        } else if (apiUrl.includes("nekos.life") && data?.url) {
                            gifUrl = data.url;
                            apiName = "NekosLife";
                            break;
                        } else if (apiUrl.includes("catboys.com") && data?.url) {
                            gifUrl = data.url;
                            apiName = "Catboy";
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            if (!gifUrl) {
                // Final hardcoded fallback dance GIFs
                const hardcodedGifs = [
                    "https://media.tenor.com/YN7Z6hY0lHwAAAAC/dance-anime.gif",
                    "https://media.tenor.com/2jNx2x9QcQEAAAAC/dance-dancing.gif",
                    "https://media.tenor.com/ib6qWchD8SwAAAAC/anime-dance.gif",
                    "https://media.tenor.com/SRyN1RYbbVQAAAAC/dance-anime.gif",
                    "https://media.tenor.com/8wHLqjz6R9AAAAAC/dance-anime.gif"
                ];
                gifUrl = hardcodedGifs[Math.floor(Math.random() * hardcodedGifs.length)];
                apiName = "Tenor Fallback";
            }

            const danceCaptions = [
                `💃 *DANCE TIME!* 🕺\n@${target.split("@")[0]} is hitting the dance floor! 🎶`,
                `🎵 *GROOVIN'!* 🎵\n@${target.split("@")[0]} busting out the moves! 🔥`,
                `✨ *DANCE PARTY!* ✨\n@${target.split("@")[0]} showing off their dance skills! 💫`,
                `🎶 *BOOGIE DOWN!* 🎶\n@${target.split("@")[0]} can't stop dancing! 🕺💥`,
                `🌟 *DANCE FLOOR QUEEN/KING!* 🌟\n@${target.split("@")[0]} owning the dance floor! 👑`,
                `💫 *EPIC DANCE MOVES!* 💫\n@${target.split("@")[0]} breaking it down! 🎉`
            ];
            
            const randomCaption = danceCaptions[Math.floor(Math.random() * danceCaptions.length)];
            
            // Add source info in debug mode
            const debugInfo = process.env.DEBUG ? `\n\n📡 Source: ${apiName}` : "";

            await sock.sendMessage(
                jid,
                {
                    video: { url: gifUrl },
                    gifPlayback: true,
                    caption: randomCaption + debugInfo,
                    mentions: [target]
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Dance command error:", err);
            
            // Try to send a simple text response if GIF fails
            try {
                await sock.sendMessage(
                    m.key.remoteJid,
                    { 
                        text: `🕺 *DANCE TIME!* 🕺\n@${m.key.participant?.split("@")[0] || "Someone"} is dancing!\n\n🎶 *Insert dance GIF here* 🎶`,
                        mentions: [m.key.participant || m.key.remoteJid]
                    },
                    { quoted: m }
                );
            } catch (finalErr) {
                console.error("Final fallback failed:", finalErr);
            }
        }
    }
};