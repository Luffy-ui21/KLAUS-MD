export default {
    name: "cringe",
    alias: ["cringing", "cringey", "awkward", "facepalm"],
    desc: "Anime cringe reaction",
    category: "Anime",
    usage: ".cringe @user or .cringe",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;
            const isSelf = target === sender || !mentionedJid.length;

            // APIs for cringe reactions
            const cringeAPIs = [
                // Facepalm is perfect for cringe
                "https://api.waifu.pics/sfw/facepalm",
                
                // Cringe specific API if available
                "https://api.catboys.com/facepalm",
                
                // Disgust/annoyed expressions work too
                "https://api.waifu.pics/sfw/disgust",
                
                // Annoyed/angry for secondhand embarrassment
                "https://api.waifu.pics/sfw/annoyed",
            ];

            let imageUrl = null;
            let apiName = null;
            
            // Try each API
            for (const apiUrl of cringeAPIs) {
                try {
                    console.log(`Trying cringe API: ${apiUrl}`);
                    const response = await fetch(apiUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 5000
                    });
                    
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    
                    if (apiUrl.includes("waifu.pics")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = apiUrl.includes("facepalm") ? "Facepalm" : 
                                     apiUrl.includes("disgust") ? "Disgust" : 
                                     apiUrl.includes("annoyed") ? "Annoyed" : "WaifuPics";
                            break;
                        }
                    } else if (apiUrl.includes("catboys.com")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "Catboys Facepalm";
                            break;
                        }
                    }
                } catch (apiError) {
                    console.log(`API ${apiUrl} failed:`, apiError.message);
                    continue;
                }
            }
            
            // Fallback to other awkward expressions
            if (!imageUrl) {
                const fallbackAPIs = [
                    "https://nekos.life/api/v2/img/facepalm",
                    "https://api.waifu.pics/sfw/cringe", // If exists
                    "https://nekos.best/api/v2/facepalm",
                    "https://api.otakugifs.xyz/gif?reaction=facepalm",
                ];
                
                for (const apiUrl of fallbackAPIs) {
                    try {
                        const response = await fetch(apiUrl);
                        const data = await response.json();
                        
                        if (apiUrl.includes("nekos.life") && data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife Facepalm";
                            break;
                        } else if (apiUrl.includes("waifu.pics") && data?.url) {
                            imageUrl = data.url;
                            apiName = "Cringe";
                            break;
                        } else if (apiUrl.includes("nekos.best") && data?.results?.[0]?.url) {
                            imageUrl = data.results[0].url;
                            apiName = "NekosBest Facepalm";
                            break;
                        } else if (apiUrl.includes("otakugifs.xyz") && data?.url) {
                            imageUrl = data.url;
                            apiName = "OtakuGifs Facepalm";
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // Hardcoded cringe/facepalm images
            if (!imageUrl) {
                const hardcodedCringe = [
                    "https://i.imgur.com/KL4Q8tX.gif", // Anime facepalm gif
                    "https://i.imgur.com/7V9dW2q.jpg", // Cringing anime face
                    "https://i.imgur.com/9zXwQpL.png", // Secondhand embarrassment
                    "https://i.imgur.com/mN3qB4P.gif", // Awkward look away
                    "https://i.imgur.com/2pQrT9Y.jpg"  // Disgusted face
                ];
                imageUrl = hardcodedCringe[Math.floor(Math.random() * hardcodedCringe.length)];
                apiName = "Cringe Collection";
            }

            // Different messages based on context
            let cringeMessages;
            
            if (isSelf) {
                cringeMessages = [
                    `🤦 *SELF-AWARENESS!* 🤦\n@${target.split("@")[0]} realizes how cringey they are...`,
                    `😬 *SELF-CRINGE!* 😬\n@${target.split("@")[0]} cringes at their own actions!`,
                    `🙈 *CAN'T LOOK!* 🙈\n@${target.split("@")[0]} hides from their own cringe!`,
                    `💀 *DYING INSIDE!* 💀\n@${target.split("@")[0]} experiences maximum self-cringe!`,
                    `🥴 *CRINGE OVERLOAD!* 🥴\n@${target.split("@")[0]}'s own cringe is too much!`
                ];
            } else {
                cringeMessages = [
                    `🤦 *FACE PALM!* 🤦\n@${sender.split("@")[0]} cringes at @${target.split("@")[0]}'s actions!`,
                    `😬 *SECONDHAND EMBARRASSMENT!* 😬\n@${sender.split("@")[0]} feels awkward for @${target.split("@")[0]}!`,
                    `🙈 *TOO CRINGEY TO WATCH!* 🙈\n@${sender.split("@")[0]} can't handle @${target.split("@")[0]}'s cringe!`,
                    `💀 *CRINGE ATTACK!* 💀\n@${target.split("@")[0]} just made @${sender.split("@")[0]} cringe to death!`,
                    `🥴 *CRINGE INDUCED NAUSEA!* 🥴\n@${target.split("@")[0]}'s cringe makes @${sender.split("@")[0]} sick!`,
                    `😖 *WHY WOULD YOU DO THAT?!* 😖\n@${sender.split("@")[0]} questions @${target.split("@")[0]}'s life choices!`
                ];
                
                // Check if it's a reply to someone's message
                const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg) {
                    cringeMessages.push(
                        `📱 *MESSAGE REVIEW!* 📱\n@${sender.split("@")[0]} cringes at @${target.split("@")[0]}'s last message!`,
                        `💬 *TEXT CRINGE!* 💬\n@${sender.split("@")[0]} reads @${target.split("@")[0]}'s message and cringes!`
                    );
                }
            }
            
            const finalCaption = cringeMessages[Math.floor(Math.random() * cringeMessages.length)];
            
            // Add debug info
            const debugInfo = process.env.DEBUG ? `\n\n😬 Reaction: ${apiName}` : "";

            // Check if URL is GIF
            const isGif = imageUrl.toLowerCase().endsWith('.gif');
            
            const mentions = isSelf ? [target] : [target, sender];
            
            await sock.sendMessage(
                jid,
                isGif ? {
                    video: { url: imageUrl },
                    gifPlayback: true,
                    caption: finalCaption + debugInfo,
                    mentions
                } : {
                    image: { url: imageUrl },
                    caption: finalCaption + debugInfo,
                    mentions
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Cringe command error:", err);
            
            // Text fallback with cringe ASCII
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                          m.key.participant || m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            const isSelf = target === sender;
            
            const cringeAscii = `
╔═════════════════╗
║   C R I N G E   ║
╚═════════════════╝
    (－‸ლ)
   /     \\
  /   ●   ● \\
 /      ▽     \\
|              |
 \\            /
  \\＿＿＿＿＿／`;
  
            const fallbackText = isSelf ? 
                `🤦 *SELF-CRINGE!* 🤦\n@${target.split("@")[0]} cringes at themselves...\n${cringeAscii}` :
                `😬 *CRINGE ALERT!* 😬\n@${sender.split("@")[0]} cringes at @${target.split("@")[0]}!\n${cringeAscii}`;
            
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