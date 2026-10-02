export default {
    name: "glomp",
    alias: ["tacklehug", "pounce", "jump hug", "flyinghug"],
    desc: "Anime glomp reaction - enthusiastic tackle hug",
    category: "Anime",
    usage: ".glomp @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Try various hug/tackle APIs for glomp effect
            const glompAPIs = [
                // Primary: Hug APIs work great for glomp
                "https://api.waifu.pics/sfw/hug",
                "https://nekos.life/api/v2/img/hug",
                "https://nekos.best/api/v2/hug",
                
                // Tackle/pounce style APIs
                "https://api.waifu.pics/sfw/tackle", // If available
                "https://api.catboys.com/cuddle",
            ];

            let imageUrl = null;
            let apiName = null;
            
            // Try each API
            for (const apiUrl of glompAPIs) {
                try {
                    console.log(`Trying glomp API: ${apiUrl}`);
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
                            apiName = "WaifuPics Hug";
                            break;
                        }
                    } else if (apiUrl.includes("nekos.life")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife Hug";
                            break;
                        }
                    } else if (apiUrl.includes("nekos.best")) {
                        if (data?.results?.[0]?.url) {
                            imageUrl = data.results[0].url;
                            apiName = "NekosBest Hug";
                            break;
                        }
                    } else if (apiUrl.includes("catboys.com")) {
                        if (data?.url) {
                            imageUrl = data.url;
                            apiName = "Catboys Cuddle";
                            break;
                        }
                    }
                } catch (apiError) {
                    console.log(`API ${apiUrl} failed:`, apiError.message);
                    continue;
                }
            }
            
            // Fallback to other affectionate reactions
            if (!imageUrl) {
                const fallbackAPIs = [
                    "https://api.waifu.pics/sfw/cuddle",
                    "https://nekos.life/api/v2/img/cuddle",
                    "https://api.otakugifs.xyz/gif?reaction=hug",
                ];
                
                for (const apiUrl of fallbackAPIs) {
                    try {
                        const response = await fetch(apiUrl);
                        const data = await response.json();
                        
                        if (apiUrl.includes("waifu.pics") && data?.url) {
                            imageUrl = data.url;
                            apiName = "Cuddle";
                            break;
                        } else if (apiUrl.includes("nekos.life") && data?.url) {
                            imageUrl = data.url;
                            apiName = "NekosLife Cuddle";
                            break;
                        } else if (apiUrl.includes("otakugifs.xyz") && data?.url) {
                            imageUrl = data.url;
                            apiName = "OtakuGifs Hug";
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            // Hardcoded glomp/tackle hug images
            if (!imageUrl) {
                const hardcodedGlomps = [
                    "https://i.imgur.com/6fK5Q0x.gif", // Anime glomp gif
                    "https://i.imgur.com/V8Q2G4N.gif", // Tackle hug
                    "https://i.imgur.com/9XqYzJL.jpg", // Flying hug
                    "https://i.imgur.com/3WvL7pF.png", // Jump hug
                    "https://i.imgur.com/mQ4nN8T.gif"  // Enthusiastic hug
                ];
                imageUrl = hardcodedGlomps[Math.floor(Math.random() * hardcodedGlomps.length)];
                apiName = "Glomp Collection";
            }

            const glompMessages = [
                `🏃‍♂️💨 *GLOMP ATTACK!* 🫂\n@${sender.split("@")[0]} enthusiastically tackles @${target.split("@")[0]} with a hug!`,
                `🚀 *FLYING HUG!* 🚀\n@${sender.split("@")[0]} jumps into @${target.split("@")[0]}'s arms! 💫`,
                `⚡ *P O U N C E !* ⚡\n@${sender.split("@")[0]} glomps @${target.split("@")[0]} with full force! 💥`,
                `🎯 *TACKLE HUG!* 🎯\n@${sender.split("@")[0]} perfectly tackles @${target.split("@")[0]} in a hug! 🫂`,
                `💖 *SUPER HUG!* 💖\n@${sender.split("@")[0]} runs and glomps @${target.split("@")[0]}! 🏃‍♀️💨`,
                `🌟 *MISSILE HUG!* 🌟\n@${sender.split("@")[0]} launches themselves at @${target.split("@")[0]}! 🚀🫂`
            ];
            
            const selfGlompMessages = [
                `🤗 *SELF-GLOMP!* 🤗\n@${target.split("@")[0]} gives themselves an enthusiastic hug! 💫`,
                `🌀 *SPIN HUG!* 🌀\n@${target.split("@")[0]} spins around and hugs themselves! ✨`,
                `💫 *ENERGY HUG!* 💫\n@${target.split("@")[0]} generates a hug-energy field! ⚡`
            ];
            
            // Check if it's a self-glomp or targeting someone else
            let finalCaption;
            if (target === sender || !mentionedJid.length) {
                // Self-glomp
                finalCaption = selfGlompMessages[Math.floor(Math.random() * selfGlompMessages.length)];
            } else {
                // Glomping someone else
                finalCaption = glompMessages[Math.floor(Math.random() * glompMessages.length)];
            }
            
            // Add reaction type in debug mode
            const debugInfo = process.env.DEBUG ? `\n\n✨ Reaction: ${apiName}` : "";

            // Check if URL is GIF for proper playback
            const isGif = imageUrl.toLowerCase().endsWith('.gif');
            
            await sock.sendMessage(
                jid,
                isGif ? {
                    video: { url: imageUrl },
                    gifPlayback: true,
                    caption: finalCaption + debugInfo,
                    mentions: [target, sender].filter((item, index, arr) => 
                        arr.indexOf(item) === index
                    )
                } : {
                    image: { url: imageUrl },
                    caption: finalCaption + debugInfo,
                    mentions: [target, sender].filter((item, index, arr) => 
                        arr.indexOf(item) === index
                    )
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Glomp command error:", err);
            
            // Text fallback with glomp ASCII art
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                          m.key.participant || m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            
            const glompAscii = `
╭━━━┳╮╱╱╱╱╱╭━━╮
┃╭━╮┃┃╱╱╱╱╱┃╭╮┃
┃┃╱╰┫╰━┳━━┳╯╰╯┣━━┳━━┳━━┳━━┳━╮
┃┃╭━┫╭╮┃┃━┫╭━╮┃╭╮┃╭━┫╭╮┃╭╮┃╭╯
┃╰┻━┃┃┃┃┃━┫╰━╯┃╭╮┃╰━┫╰╯┃╰╯┃┃
╰━━━┻╯╰┻━━┻━━━┻╯╰┻━━┻━━┻━━┻╯`;

            const fallbackText = target === sender ? 
                `🤗 *SELF-GLOMP!* 🤗\n@${target.split("@")[0]} gives themselves a big hug!\n${glompAscii}` :
                `🏃‍♂️💨 *GLOMP!* 🫂\n@${sender.split("@")[0]} tackles @${target.split("@")[0]} with a hug!\n${glompAscii}`;
            
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