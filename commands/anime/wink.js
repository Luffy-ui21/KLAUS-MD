export default {
    name: "wink",
    alias: ["winking", "flirt", "sly", "mischievous"],
    desc: "Anime wink reaction - playful or flirtatious",
    category: "Anime",
    usage: ".wink @user or .wink",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;
            const isSelf = target === sender || !mentionedJid.length;

            // APIs for wink reactions
            const winkAPIs = [
                // Wink endpoint on waifu.pics
                "https://api.waifu.pics/sfw/wink",
                
                // Nekos.life wink endpoint
                "https://nekos.life/api/v2/img/wink",
                
                // Catboys wink if available
                "https://api.catboys.com/wink",
                
                // Nekos.best wink
                "https://nekos.best/api/v2/wink",
            ];

            let imageUrl = null;
            let apiName = null;
            
            // Try each API
            for (const apiUrl of winkAPIs) {
                try {
                    console.log(`Trying wink API: ${apiUrl}`);
                    const response = await fetch(apiUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 5000
                    });
                    
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    
                    // Parse different API responses
                    if (apiUrl.includes("waifu.pics")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "WaifuPics Wink";
                            break;
                        }
                    } else if (apiUrl.includes("nekos.life")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife Wink";
                            break;
                        }
                    } else if (apiUrl.includes("catboys.com")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "Catboys Wink";
                            break;
                        }
                    } else if (apiUrl.includes("nekos.best")) {
                        if (data?.results?.[0]?.url) {
                            imageUrl = data.results[0].url;
                            apiName = "NekosBest Wink";
                            break;
                        }
                    }
                } catch (apiError) {
                    console.log(`API ${apiUrl} failed:`, apiError.message);
                    continue;
                }
            }
            
            // Fallback to smug or blush if wink not available
            if (!imageUrl) {
                const fallbackAPIs = [
                    "https://api.waifu.pics/sfw/smug",
                    "https://api.waifu.pics/sfw/blush",
                    "https://nekos.life/api/v2/img/neko",
                    "https://api.otakugifs.xyz/gif?reaction=wink",
                ];
                
                for (const apiUrl of fallbackAPIs) {
                    try {
                        const response = await fetch(apiUrl);
                        const data = await response.json();
                        
                        if (apiUrl.includes("waifu.pics") && data?.url) {
                            imageUrl = data.url;
                            apiName = apiUrl.includes("smug") ? "Smug" : "Blush";
                            break;
                        } else if (apiUrl.includes("nekos.life") && data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife";
                            break;
                        } else if (apiUrl.includes("otakugifs.xyz") && data?.url) {
                            imageUrl = data.url;
                            apiName = "OtakuGifs Wink";
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // Hardcoded wink images/GIFs
            if (!imageUrl) {
                const hardcodedWinks = [
                    "https://i.imgur.com/Xg5Lk8Z.gif", // Cute anime wink gif
                    "https://i.imgur.com/9zTmLQq.jpg", // Playful wink
                    "https://i.imgur.com/3pQrY2s.gif", // Flirty wink
                    "https://i.imgur.com/N7VqB4J.png", // Sly wink
                    "https://i.imgur.com/Km8Lp9Q.gif", // Mischievous wink
                    "https://i.imgur.com/2rQzTvX.jpg"  // Casual wink
                ];
                imageUrl = hardcodedWinks[Math.floor(Math.random() * hardcodedWinks.length)];
                apiName = "Wink Collection";
            }

            // Different messages based on context
            let winkMessages;
            
            if (isSelf) {
                winkMessages = [
                    `😉 *SELF-WINK!* 😉\n@${target.split("@")[0]} gives themselves a confident wink!`,
                    `✨ *MIRROR WINK!* ✨\n@${target.split("@")[0]} practices their wink in the mirror!`,
                    `💫 *SECRET SIGNAL!* 💫\n@${target.split("@")[0]} winks at their own reflection!`,
                    `🎭 *SOLO PERFORMANCE!* 🎭\n@${target.split("@")[0]} winks to an imaginary audience!`,
                    `👁️ *EYE EXERCISE!* 👁️\n@${target.split("@")[0]} works on their winking skills!`
                ];
            } else {
                winkMessages = [
                    `😉 *WINK!* 😉\n@${sender.split("@")[0]} playfully winks at @${target.split("@")[0]}!`,
                    `✨ *FLIRTY SIGNAL!* ✨\n@${sender.split("@")[0]} sends a flirty wink to @${target.split("@")[0]}!`,
                    `💖 *SPECIAL WINK!* 💖\n@${sender.split("@")[0]} gives @${target.split("@")[0]} a special wink just for them!`,
                    `🎯 *TARGET ACQUIRED!* 🎯\n@${sender.split("@")[0]} winks directly at @${target.split("@")[0]}!`,
                    `🤫 *SECRET MESSAGE!* 🤫\n@${sender.split("@")[0]} winks at @${target.split("@")[0]} - it's their little secret!`,
                    `😏 *MISCHIEVOUS WINK!* 😏\n@${sender.split("@")[0]} gives @${target.split("@")[0]} a sly, knowing wink!`,
                    `🌟 *SPARKLY WINK!* 🌟\n@${sender.split("@")[0]}'s wink makes @${target.split("@")[0]} feel special!`
                ];
                
                // Check for group settings or playful context
                const isGroup = jid.endsWith('@g.us');
                if (isGroup) {
                    winkMessages.push(
                        `👀 *GROUP WINK!* 👀\n@${sender.split("@")[0]} winks at @${target.split("@")[0]} across the chat!`,
                        `🎪 *PUBLIC WINK!* 🎪\nEveryone sees @${sender.split("@")[0]} wink at @${target.split("@")[0]}!`
                    );
                }
            }
            
            const finalCaption = winkMessages[Math.floor(Math.random() * winkMessages.length)];
            
            // Add romantic/heart emojis based on context
            const heartEmojis = isSelf ? "💫✨🌟" : "💖💕💘";
            const decoratedCaption = finalCaption + ` ${heartEmojis}`;
            
            // Add debug info
            const debugInfo = process.env.DEBUG ? `\n\n😉 Reaction: ${apiName}` : "";

            // Check if URL is GIF
            const isGif = imageUrl.toLowerCase().endsWith('.gif');
            
            const mentions = isSelf ? [target] : [target, sender];
            
            await sock.sendMessage(
                jid,
                isGif ? {
                    video: { url: imageUrl },
                    gifPlayback: true,
                    caption: decoratedCaption + debugInfo,
                    mentions
                } : {
                    image: { url: imageUrl },
                    caption: decoratedCaption + debugInfo,
                    mentions
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Wink command error:", err);
            
            // Text fallback with wink ASCII
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                          m.key.participant || m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            const isSelf = target === sender;
            
            const winkAscii = `
(^_~)
   \\
    \\   😉
     \\
   🎀💖🎀
       `;
  
            const fallbackText = isSelf ? 
                `😉 *SELF-WINK!* 😉\n@${target.split("@")[0]} gives a confident wink!\n${winkAscii}` :
                `✨ *WINK!* ✨\n@${sender.split("@")[0]} winks at @${target.split("@")[0]}!\n${winkAscii}`;
            
            await sock.sendMessage(
                m.key.remoteJid,
                { 
                    text: fallbackText,
                    mentions: isSelf ? [target] : [target, sender]
                },
                { quoted: m }
            );
        }
    }
};