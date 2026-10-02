export default {
    name: "kill",
    alias: ["murder", "destroy", "eliminate", "assassinate"],
    desc: "Playful anime kill reaction (SFW)",
    category: "Anime",
    usage: ".kill @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // APIs for playful "kill" reactions (SFW)
            const killAPIs = [
                // Bonk is a playful "hit" reaction
                "https://api.waifu.pics/sfw/bonk",
                
                // Smug works for villainous expressions
                "https://api.waifu.pics/sfw/smug",
                
                // NekosLife has kill endpoint
                "https://nekos.life/api/v2/img/kill",
                
                // Slap as alternative
                "https://api.waifu.pics/sfw/slap",
            ];

            let imageUrl = null;
            let apiName = null;
            
            // Try each API
            for (const apiUrl of killAPIs) {
                try {
                    console.log(`Trying kill API: ${apiUrl}`);
                    const response = await fetch(apiUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 5000
                    });
                    
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    
                    if (apiUrl.includes("waifu.pics")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = apiUrl.includes("bonk") ? "Bonk" : 
                                     apiUrl.includes("smug") ? "Smug" : 
                                     apiUrl.includes("slap") ? "Slap" : "WaifuPics";
                            break;
                        }
                    } else if (apiUrl.includes("nekos.life")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife Kill";
                            break;
                        }
                    }
                } catch (apiError) {
                    console.log(`API ${apiUrl} failed:`, apiError.message);
                    continue;
                }
            }
            
            // Fallback to other reactions if kill-specific APIs fail
            if (!imageUrl) {
                const fallbackAPIs = [
                    "https://api.waifu.pics/sfw/angry",
                    "https://nekos.life/api/v2/img/angry",
                    "https://api.catboys.com/baka"
                ];
                
                for (const apiUrl of fallbackAPIs) {
                    try {
                        const response = await fetch(apiUrl);
                        const data = await response.json();
                        
                        if (apiUrl.includes("waifu.pics") && data?.url) {
                            imageUrl = data.url;
                            apiName = "Angry";
                            break;
                        } else if (apiUrl.includes("nekos.life") && data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife Angry";
                            break;
                        } else if (apiUrl.includes("catboys.com") && data?.url) {
                            imageUrl = data.url;
                            apiName = "Baka";
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // Hardcoded fallback images
            if (!imageUrl) {
                const hardcodedImages = [
                    "https://i.imgur.com/5WqFQ4R.png", // Anime bonk
                    "https://i.imgur.com/3JZyRkK.jpg", // Anime slap
                    "https://i.imgur.com/XrZ8Q2v.png"  // Anime angry
                ];
                imageUrl = hardcodedImages[Math.floor(Math.random() * hardcodedImages.length)];
                apiName = "Fallback Image";
            }

            const killMessages = [
                `☠️ *ELIMINATED!* ☠️\n@${target.split("@")[0]} has been taken out by @${sender.split("@")[0]}! 💀`,
                `⚰️ *MISSION ACCOMPLISHED* ⚰️\n@${sender.split("@")[0]} successfully eliminated @${target.split("@")[0]}! 🎯`,
                `🔫 *TARGET NEUTRALIZED* 🔫\n@${target.split("@")[0]} was no match for @${sender.split("@")[0]}! 💥`,
                `💀 *FATALITY!* 💀\n@${sender.split("@")[0]} finishes @${target.split("@")[0]}! 🩸`,
                `⚔️ *VICTORY!* ⚔️\n@${sender.split("@")[0]} defeats @${target.split("@")[0]} in battle! 🏆`,
                `🔥 *ANNIHILATED!* 🔥\n@${target.split("@")[0]} has been destroyed by @${sender.split("@")[0]}! 💣`
            ];
            
            const selfKillMessages = [
                `🤦 *SELF-DESTRUCT!* 🤦\n@${target.split("@")[0]} accidentally eliminated themselves! 💥`,
                `💥 *SUICIDE MISSION!* 💥\n@${target.split("@")[0]} took themselves out! 💀`,
                `😵 *MISSION FAILED!* 😵\n@${target.split("@")[0]} became their own worst enemy! ☠️`
            ];
            
            let finalCaption;
            if (target === sender || !mentionedJid.length) {
                // Self-kill or no target mentioned
                finalCaption = selfKillMessages[Math.floor(Math.random() * selfKillMessages.length)];
            } else {
                // Killing someone else
                finalCaption = killMessages[Math.floor(Math.random() * killMessages.length)];
            }
            
            // Add debug info
            const debugInfo = process.env.DEBUG ? `\n\n⚙️ Reaction: ${apiName}` : "";

            await sock.sendMessage(
                jid,
                {
                    image: { url: imageUrl },
                    caption: finalCaption + debugInfo,
                    mentions: [target, sender].filter((item, index, arr) => 
                        arr.indexOf(item) === index
                    ) // Remove duplicates if self-target
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Kill command error:", err);
            
            // Simple text fallback
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                          m.key.participant || m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            
            const fallbackText = target === sender ? 
                `💀 *SELF-DESTRUCT!* 💀\n@${target.split("@")[0]} eliminated themselves!` :
                `🔫 *ELIMINATION!* 🔫\n@${sender.split("@")[0]} took out @${target.split("@")[0]}!`;
            
            await sock.sendMessage(
                m.key.remoteJid,
                { 
                    text: fallbackText,
                    mentions: [target, sender]
                },
                { quoted: m }
            );
        }
    }
};