










// import { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } from 'wolfsocket';
// import crypto from 'crypto';
// import { PassThrough } from 'stream';

// // 📌 Convert audio to voice note
// async function toVN(inputBuffer) {
//     return new Promise((resolve, reject) => {
//         try {
//             import('fluent-ffmpeg').then(ffmpeg => {
//                 const inStream = new PassThrough();
//                 inStream.end(inputBuffer);
//                 const outStream = new PassThrough();
//                 const chunks = [];

//                 ffmpeg.default(inStream)
//                     .noVideo()
//                     .audioCodec("libopus")
//                     .format("ogg")
//                     .audioBitrate("48k")
//                     .audioChannels(1)
//                     .audioFrequency(48000)
//                     .on("error", reject)
//                     .on("end", () => resolve(Buffer.concat(chunks)))
//                     .pipe(outStream, { end: true });

//                 outStream.on("data", chunk => chunks.push(chunk));
//             }).catch(() => resolve(inputBuffer));
//         } catch {
//             resolve(inputBuffer);
//         }
//     });
// }

// // 📌 Download message content to buffer
// async function downloadToBuffer(message, type) {
//     const stream = await downloadContentFromMessage(message, type);
//     let buffer = Buffer.from([]);
//     for await (const chunk of stream) {
//         buffer = Buffer.concat([buffer, chunk]);
//     }
//     return buffer;
// }

// // 📌 SIMPLIFIED: Send channel status - Direct approach
// async function sendChannelStatus(conn, channelJid, content) {
//     console.log(`[Channel] Sending to ${channelJid}`);
    
//     // Method 1: Try direct sendMessage (most reliable)
//     try {
//         if (content.text) {
//             return await conn.sendMessage(channelJid, { text: content.text });
//         } else if (content.image) {
//             return await conn.sendMessage(channelJid, {
//                 image: content.image,
//                 caption: content.caption || '',
//                 mimetype: content.mimetype || 'image/jpeg'
//             });
//         } else if (content.video) {
//             return await conn.sendMessage(channelJid, {
//                 video: content.video,
//                 caption: content.caption || '',
//                 gifPlayback: content.gifPlayback || false,
//                 mimetype: content.mimetype || 'video/mp4'
//             });
//         } else if (content.audio) {
//             return await conn.sendMessage(channelJid, {
//                 audio: content.audio,
//                 ptt: content.ptt || false,
//                 mimetype: content.mimetype || 'audio/mpeg'
//             });
//         } else if (content.sticker) {
//             return await conn.sendMessage(channelJid, {
//                 sticker: content.sticker,
//                 mimetype: content.mimetype || 'image/webp'
//             });
//         } else if (content.document) {
//             return await conn.sendMessage(channelJid, {
//                 document: content.document,
//                 fileName: content.fileName || 'file',
//                 mimetype: content.mimetype || 'application/octet-stream'
//             });
//         }
//     } catch (error) {
//         console.log(`[Channel] Direct send failed:`, error.message);
        
//         // Method 2: Fallback to generateWAMessageContent
//         try {
//             const inside = await generateWAMessageContent(content, { 
//                 upload: conn.waUploadToServer 
//             });
//             const messageSecret = crypto.randomBytes(32);

//             const m = generateWAMessageFromContent(channelJid, {
//                 messageContextInfo: { messageSecret },
//                 ...inside
//             }, {});

//             await conn.relayMessage(channelJid, m.message, { 
//                 messageId: m.key.id 
//             });
//             return m;
//         } catch (error2) {
//             console.log(`[Channel] Fallback also failed:`, error2.message);
//             throw new Error(`Failed to send: ${error.message}`);
//         }
//     }
// }

// // 📌 Check if JID is a channel
// function isChannelJid(jid) {
//     return jid && jid.includes('@newsletter');
// }

// // 📌 Get help text
// function getHelpText() {
//     return `📢 *CHANNEL STATUS COMMAND*\n\n` +
//            `*Usage:*\n` +
//            `Send in a channel:\n` +
//            `• \`.channel Your text here\` (text only)\n` +
//            `• \`.channel Caption here\` + 📷 Image\n` +
//            `• \`.channel\` + 🎥 Video\n` +
//            `• \`.channel\` + 🎤 Voice note\n\n` +
//            `*Requirements:*\n` +
//            `• Bot must be added to the channel\n` +
//            `• Works only in WhatsApp Channels\n` +
//            `• Media must be valid\n\n` +
//            `*Aliases:* .channel, .toc, .news, .cs`;
// }

// // 📌 Parse command
// function parseCommand(text) {
//     const commands = ['channel', 'tochannelstatus', 'toc', 'cs', 'news', 'newsletter'];
    
//     for (const cmd of commands) {
//         // Check with dot prefix
//         if (text.startsWith(`.${cmd}`)) {
//             return {
//                 command: cmd,
//                 caption: text.slice(`.${cmd}`.length).trim()
//             };
//         }
//         // Check without prefix
//         if (text.startsWith(cmd)) {
//             return {
//                 command: cmd,
//                 caption: text.slice(cmd.length).trim()
//             };
//         }
//     }
    
//     return { command: null, caption: text };
// }

// // 📌 Build payload
// async function buildPayload(m, captionText = '') {
//     const msg = m.message;
    
//     if (msg.imageMessage) {
//         console.log(`[Channel] Building image payload`);
//         const buffer = await downloadToBuffer(msg.imageMessage, 'image');
//         return {
//             image: buffer,
//             caption: captionText || msg.imageMessage.caption || '',
//             mimetype: msg.imageMessage.mimetype || 'image/jpeg'
//         };
//     }
    
//     if (msg.videoMessage) {
//         console.log(`[Channel] Building video payload`);
//         const buffer = await downloadToBuffer(msg.videoMessage, 'video');
//         return {
//             video: buffer,
//             caption: captionText || msg.videoMessage.caption || '',
//             gifPlayback: msg.videoMessage.gifPlayback || false,
//             mimetype: msg.videoMessage.mimetype || 'video/mp4'
//         };
//     }
    
//     if (msg.audioMessage) {
//         console.log(`[Channel] Building audio payload`);
//         const buffer = await downloadToBuffer(msg.audioMessage, 'audio');
        
//         if (msg.audioMessage.ptt) {
//             try {
//                 const vnBuffer = await toVN(buffer);
//                 return {
//                     audio: vnBuffer,
//                     ptt: true,
//                     mimetype: 'audio/ogg; codecs=opus'
//                 };
//             } catch {
//                 return {
//                     audio: buffer,
//                     ptt: true,
//                     mimetype: msg.audioMessage.mimetype || 'audio/mpeg'
//                 };
//             }
//         } else {
//             return {
//                 audio: buffer,
//                 ptt: false,
//                 mimetype: msg.audioMessage.mimetype || 'audio/mpeg'
//             };
//         }
//     }
    
//     if (msg.stickerMessage) {
//         console.log(`[Channel] Building sticker payload`);
//         const buffer = await downloadToBuffer(msg.stickerMessage, 'sticker');
//         return {
//             sticker: buffer,
//             mimetype: msg.stickerMessage.mimetype || 'image/webp'
//         };
//     }
    
//     if (msg.documentMessage) {
//         console.log(`[Channel] Building document payload`);
//         const buffer = await downloadToBuffer(msg.documentMessage, 'document');
//         return {
//             document: buffer,
//             fileName: msg.documentMessage.fileName || 'file',
//             mimetype: msg.documentMessage.mimetype || 'application/octet-stream'
//         };
//     }
    
//     if (msg.conversation || msg.extendedTextMessage?.text) {
//         console.log(`[Channel] Building text payload`);
//         const text = msg.conversation || msg.extendedTextMessage.text || '';
        
//         // If caption provided with command, use it
//         if (captionText && captionText !== text) {
//             return { text: captionText };
//         }
//         return { text };
//     }
    
//     return null;
// }

// // 📌 MAIN COMMAND - SIMPLIFIED NO-OWNER-CHECK VERSION
// export default {
//     name: 'channel',
//     aliases: ['tochannelstatus', 'toc', 'cs', 'news', 'newsletter', 'channelstatus'],
//     description: 'Send messages to WhatsApp Channel (no owner check)',
//     category: 'channel',
//     adminOnly: false, // Disabled for testing
//     ownerOnly: false, // Disabled

//     async execute(sock, m, args) {
//         try {
//             const jid = m.key.remoteJid;
//             const message = m;
            
//             console.log(`\n=== CHANNEL COMMAND ===`);
//             console.log(`Channel JID: ${jid}`);
//             console.log(`From: ${m.key.participant || 'Unknown'}`);
            
//             // Check if it's a channel
//             if (!isChannelJid(jid)) {
//                 console.log(`[Channel] Not a channel, rejecting`);
//                 await sock.sendMessage(jid, {
//                     text: '❌ This command works only in WhatsApp Channels!\n\n' +
//                           'Channels have @newsletter in their address.\n' +
//                           'Current: ' + jid
//                 });
//                 return;
//             }
            
//             console.log(`[Channel] Valid channel detected`);
            
//             // Get message text
//             const messageText = message.message?.conversation || 
//                                message.message?.extendedTextMessage?.text || 
//                                '';
            
//             console.log(`[Channel] Message text: "${messageText}"`);
            
//             // Show help if empty
//             if (!messageText.trim() && 
//                 !message.message?.imageMessage &&
//                 !message.message?.videoMessage &&
//                 !message.message?.audioMessage &&
//                 !message.message?.stickerMessage &&
//                 !message.message?.documentMessage) {
                
//                 console.log(`[Channel] No content, showing help`);
//                 await sock.sendMessage(jid, {
//                     text: getHelpText()
//                 });
//                 return;
//             }
            
//             // Parse command
//             const { caption } = parseCommand(messageText);
//             console.log(`[Channel] Caption extracted: "${caption}"`);
            
//             // Build payload
//             const payload = await buildPayload(message, caption);
            
//             if (!payload) {
//                 console.log(`[Channel] Failed to build payload`);
//                 await sock.sendMessage(jid, {
//                     text: '❌ Could not process your message.\n\n' +
//                           'Please send:\n' +
//                           '• Image with caption\n' +
//                           '• Video with caption\n' +
//                           '• Audio/voice note\n' +
//                           '• Or text message\n\n' +
//                           'Format: `.channel Your text` + media'
//                 });
//                 return;
//             }
            
//             console.log(`[Channel] Payload type:`, Object.keys(payload)[0]);
//             console.log(`[Channel] Payload size:`, 
//                 payload.image?.length || 
//                 payload.video?.length || 
//                 payload.text?.length || 
//                 payload.audio?.length || 
//                 0, 'bytes');
            
//             // Send processing message
//             const processingMsg = await sock.sendMessage(jid, {
//                 text: `🔄 Processing channel post...\n` +
//                       `Type: ${Object.keys(payload)[0].toUpperCase()}\n` +
//                       `Please wait...`
//             });
            
//             // Try to send to channel
//             try {
//                 console.log(`[Channel] Attempting to send...`);
//                 await sendChannelStatus(sock, jid, payload);
                
//                 // Success
//                 let successMsg = `✅ Posted to channel!\n\n`;
//                 successMsg += `Channel: ${jid.split('@')[0]}\n`;
//                 successMsg += `Type: ${Object.keys(payload)[0].toUpperCase()}\n`;
                
//                 if (payload.caption) {
//                     successMsg += `Caption: ${payload.caption}\n`;
//                 }
                
//                 if (payload.text) {
//                     const preview = payload.text.length > 50 ? 
//                         payload.text.substring(0, 50) + '...' : payload.text;
//                     successMsg += `Text: ${preview}\n`;
//                 }
                
//                 successMsg += `\n👥 Visible to all followers`;
                
//                 await sock.sendMessage(jid, {
//                     text: successMsg,
//                     edit: processingMsg.key
//                 });
                
//                 console.log(`[Channel] SUCCESS ✓`);
                
//             } catch (sendError) {
//                 console.error(`[Channel] Send failed:`, sendError);
                
//                 let errorMsg = `❌ Failed to post:\n`;
//                 errorMsg += `${sendError.message}\n\n`;
                
//                 if (sendError.message.includes('not authorized') || 
//                     sendError.message.includes('permission')) {
//                     errorMsg += `*Solution:*\n`;
//                     errorMsg += `1. Add bot to channel: ${sock.user?.id?.split('@')[0] || 'Bot number'}\n`;
//                     errorMsg += `2. Make bot admin if possible\n`;
//                     errorMsg += `3. Try again`;
//                 } else if (sendError.message.includes('newsletter')) {
//                     errorMsg += `*Issue:* Invalid channel format\n`;
//                     errorMsg += `Make sure you're in a WhatsApp Channel`;
//                 } else {
//                     errorMsg += `*Try:*\n`;
//                     errorMsg += `• Smaller media file\n`;
//                     errorMsg += `• Different format\n`;
//                     errorMsg += `• Text only first`;
//                 }
                
//                 await sock.sendMessage(jid, {
//                     text: errorMsg,
//                     edit: processingMsg.key
//                 });
//             }
            
//         } catch (error) {
//             console.error(`[Channel] Fatal error:`, error);
            
//             try {
//                 await sock.sendMessage(m.key.remoteJid, {
//                     text: `💥 Command crashed:\n${error.message}\n\n` +
//                           `Please check bot logs.`
//                 });
//             } catch {
//                 console.error(`[Channel] Could not send error`);
//             }
//         }
        
//         console.log(`=== CHANNEL COMMAND END ===\n`);
//     }
// };




















import { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } from 'wolfsocket';
import crypto from 'crypto';
import { PassThrough } from 'stream';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

// 📌 Convert audio to voice note
async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        try {
            import('fluent-ffmpeg').then(ffmpeg => {
                const inStream = new PassThrough();
                inStream.end(inputBuffer);
                const outStream = new PassThrough();
                const chunks = [];

                ffmpeg.default(inStream)
                    .noVideo()
                    .audioCodec("libopus")
                    .format("ogg")
                    .audioBitrate("48k")
                    .audioChannels(1)
                    .audioFrequency(48000)
                    .on("error", reject)
                    .on("end", () => resolve(Buffer.concat(chunks)))
                    .pipe(outStream, { end: true });

                outStream.on("data", chunk => chunks.push(chunk));
            }).catch(() => resolve(inputBuffer));
        } catch {
            resolve(inputBuffer);
        }
    });
}

// 📌 SAFE Download message content to buffer with error handling
async function downloadToBuffer(message, type) {
    try {
        // Check if media key exists
        if (!message.mediaKey || !message.fileSha256 || !message.fileEncSha256) {
            console.log(`[Download] Missing media key for ${type}`);
            throw new Error('Media key missing or incomplete');
        }
        
        const stream = await downloadContentFromMessage(message, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch (error) {
        console.error(`[Download] Failed to download ${type}:`, error.message);
        throw error;
    }
}

// 📌 SEND CHANNEL STATUS UPDATE
async function sendChannelStatusUpdate(conn, channelJid, content) {
    console.log(`[ChannelStatus] Creating channel status update for ${channelJid}`);
    
    try {
        // First generate the message content
        const inside = await generateWAMessageContent(content, { 
            upload: conn.waUploadToServer 
        });
        
        // Create message secret for encryption
        const messageSecret = crypto.randomBytes(32);
        
        console.log(`[ChannelStatus] Generated content, creating status message...`);
        
        // Use newsletterMessage for channel status/updates
        const m = generateWAMessageFromContent(channelJid, {
            messageContextInfo: { 
                messageSecret,
                newsletterJid: channelJid
            },
            newsletterMessage: {
                newsletterJid: channelJid,
                message: inside
            }
        }, {});
        
        console.log(`[ChannelStatus] Relaying channel status update...`);
        await conn.relayMessage(channelJid, m.message, { 
            messageId: m.key.id
        });
        
        console.log(`[ChannelStatus] Channel status update sent successfully`);
        return m;
        
    } catch (error) {
        console.error(`[ChannelStatus] Failed to send status update:`, error.message);
        
        // Fallback: Try regular sendMessage
        try {
            console.log(`[ChannelStatus] Trying fallback sendMessage...`);
            
            if (content.text) {
                return await conn.sendMessage(channelJid, { text: content.text });
            } else if (content.image) {
                return await conn.sendMessage(channelJid, {
                    image: content.image,
                    caption: content.caption || '',
                    mimetype: content.mimetype || 'image/jpeg'
                });
            } else if (content.video) {
                return await conn.sendMessage(channelJid, {
                    video: content.video,
                    caption: content.caption || '',
                    mimetype: content.mimetype || 'video/mp4'
                });
            } else if (content.audio) {
                return await conn.sendMessage(channelJid, {
                    audio: content.audio,
                    ptt: content.ptt || false,
                    mimetype: content.mimetype || 'audio/mpeg'
                });
            } else if (content.sticker) {
                return await conn.sendMessage(channelJid, {
                    sticker: content.sticker,
                    mimetype: content.mimetype || 'image/webp'
                });
            }
        } catch (fallbackError) {
            throw new Error(`Both methods failed: ${error.message} | Fallback: ${fallbackError.message}`);
        }
    }
}

// 📌 Check if JID is a channel
function isChannelJid(jid) {
    return jid && jid.includes('@newsletter');
}

// 📌 Get help text
function getHelpText() {
    return `╭─⌈ 📢 *CHANNEL STATUS UPDATE* ⌋\n│\n│ Posts to channel status (Updates tab)\n│\n├─⊷ *.channelstatus Your text here*\n│  └⊷ Send text only\n│\n├─⊷ *.channelstatus Caption here* + 📷 Image\n│  └⊷ Send image with caption\n│\n├─⊷ *.channelstatus* + 🎥 Video\n│  └⊷ Send video\n│\n├─⊷ *.channelstatus* + 🎤 Voice note\n│  └⊷ Send voice note\n│\n├─⊷ *.channelstatus* + 😀 Sticker\n│  └⊷ Send sticker\n│\n╰───\n_Bot must be in the channel • Media must be fully loaded_\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
}

// 📌 Parse command
function parseCommand(text) {
    const commands = ['channelstatus', 'chstatus', 'cupdate', 'cstatus', 'channelupdate'];
    
    for (const cmd of commands) {
        if (text.startsWith(`.${cmd}`)) {
            return {
                command: cmd,
                caption: text.slice(`.${cmd}`.length).trim()
            };
        }
    }
    
    return { command: null, caption: text };
}

// 📌 SAFE Build payload from message with error handling
async function buildChannelStatusPayload(m, captionText = '') {
    const msg = m.message;
    
    try {
        if (msg.imageMessage) {
            console.log(`[ChannelStatus] Building image status payload`);
            
            // Check if image has required keys
            if (!msg.imageMessage.mediaKey) {
                throw new Error('Image media key missing. Try resending the image.');
            }
            
            const buffer = await downloadToBuffer(msg.imageMessage, 'image');
            return {
                image: buffer,
                caption: captionText || msg.imageMessage.caption || '',
                mimetype: msg.imageMessage.mimetype || 'image/jpeg'
            };
        }
        
        if (msg.videoMessage) {
            console.log(`[ChannelStatus] Building video status payload`);
            
            if (!msg.videoMessage.mediaKey) {
                throw new Error('Video media key missing. Try resending the video.');
            }
            
            const buffer = await downloadToBuffer(msg.videoMessage, 'video');
            return {
                video: buffer,
                caption: captionText || msg.videoMessage.caption || '',
                gifPlayback: msg.videoMessage.gifPlayback || false,
                mimetype: msg.videoMessage.mimetype || 'video/mp4'
            };
        }
        
        if (msg.audioMessage) {
            console.log(`[ChannelStatus] Building audio status payload`);
            
            if (!msg.audioMessage.mediaKey) {
                throw new Error('Audio media key missing. Try resending the audio.');
            }
            
            const buffer = await downloadToBuffer(msg.audioMessage, 'audio');
            
            if (msg.audioMessage.ptt) {
                try {
                    const vnBuffer = await toVN(buffer);
                    return {
                        audio: vnBuffer,
                        ptt: true,
                        mimetype: 'audio/ogg; codecs=opus'
                    };
                } catch {
                    return {
                        audio: buffer,
                        ptt: true,
                        mimetype: msg.audioMessage.mimetype || 'audio/mpeg'
                    };
                }
            } else {
                return {
                    audio: buffer,
                    ptt: false,
                    mimetype: msg.audioMessage.mimetype || 'audio/mpeg'
                };
            }
        }
        
        if (msg.stickerMessage) {
            console.log(`[ChannelStatus] Building sticker status payload`);
            
            if (!msg.stickerMessage.mediaKey) {
                throw new Error('Sticker media key missing. Try resending the sticker.');
            }
            
            const buffer = await downloadToBuffer(msg.stickerMessage, 'sticker');
            return {
                sticker: buffer,
                mimetype: msg.stickerMessage.mimetype || 'image/webp'
            };
        }
        
        if (msg.conversation || msg.extendedTextMessage?.text) {
            console.log(`[ChannelStatus] Building text status payload`);
            const text = msg.conversation || msg.extendedTextMessage.text || '';
            
            // If caption provided with command, use it
            if (captionText && captionText !== text) {
                return { text: captionText };
            }
            return { text };
        }
        
        return null;
        
    } catch (error) {
        console.error(`[ChannelStatus] Error building payload:`, error.message);
        throw error; // Re-throw to handle in main function
    }
}

// 📌 MAIN COMMAND - WITH PROPER ERROR HANDLING
export default {
    name: 'channelstatus',
    aliases: ['chstatus', 'cupdate', 'cstatus', 'channelupdate', 'newsletterstatus'],
    description: 'Send status updates to WhatsApp Channel (like group status)',
    category: 'channel',
    adminOnly: false,
    ownerOnly: false,

    async execute(sock, m, args) {
        const startTime = Date.now();
        
        try {
            const jid = m.key.remoteJid;
            const message = m;
            
            console.log(`\n[${new Date().toISOString()}] CHANNEL STATUS COMMAND`);
            console.log(`Channel: ${jid}`);
            
            // Send immediate response
            let responseMsg;
            try {
                responseMsg = await sock.sendMessage(jid, {
                    text: '🔄 Processing channel status command...'
                });
            } catch (responseError) {
                console.error(`[ChannelStatus] Failed to send initial response:`, responseError.message);
            }
            
            // Check if it's a channel
            if (!isChannelJid(jid)) {
                console.log(`[ChannelStatus] Not a channel`);
                const errorMsg = '❌ This command works only in WhatsApp Channels!\n\n' +
                               'Channels have @newsletter suffix.\n' +
                               'Current chat: ' + jid;
                try {
                    await sock.sendMessage(jid, { text: errorMsg });
                } catch {}
                return;
            }
            
            console.log(`[ChannelStatus] Valid channel detected`);
            
            // Get message text
            const messageText = message.message?.conversation || 
                               message.message?.extendedTextMessage?.text || 
                               '';
            
            console.log(`[ChannelStatus] Message text: "${messageText}"`);
            
            // Show help if no content
            if (!messageText.trim() && 
                !message.message?.imageMessage &&
                !message.message?.videoMessage &&
                !message.message?.audioMessage &&
                !message.message?.stickerMessage) {
                
                console.log(`[ChannelStatus] No content, showing help`);
                try {
                    await sock.sendMessage(jid, {
                        text: getHelpText(),
                        ...(responseMsg && { edit: responseMsg.key })
                    });
                } catch {}
                return;
            }
            
            // Parse command
            const { caption } = parseCommand(messageText);
            console.log(`[ChannelStatus] Caption: "${caption}"`);
            
            // Update processing message
            try {
                await sock.sendMessage(jid, {
                    text: `📥 Processing your content...\n` +
                          `Type: ${message.message?.imageMessage ? 'Image' : 
                                  message.message?.videoMessage ? 'Video' : 
                                  message.message?.audioMessage ? 'Audio' : 
                                  message.message?.stickerMessage ? 'Sticker' : 
                                  'Text'}`,
                    ...(responseMsg && { edit: responseMsg.key })
                });
            } catch {}
            
            // Build payload
            let payload;
            try {
                payload = await buildChannelStatusPayload(message, caption);
            } catch (buildError) {
                console.error(`[ChannelStatus] Build payload error:`, buildError.message);
                
                let errorMsg = `❌ *Failed to process media*\n\n`;
                errorMsg += `Error: ${buildError.message}\n\n`;
                
                if (buildError.message.includes('media key') || 
                    buildError.message.includes('empty media')) {
                    errorMsg += `*Common Issue:* Media wasn't fully downloaded\n\n`;
                    errorMsg += `*Solutions:*\n`;
                    errorMsg += `1. Wait for media to fully load\n`;
                    errorMsg += `2. Resend the media\n`;
                    errorMsg += `3. Use smaller file size\n`;
                    errorMsg += `4. Try text-only first: \`.channelstatus Test message\``;
                } else {
                    errorMsg += `Please try again with different media.`;
                }
                
                try {
                    await sock.sendMessage(jid, {
                        text: errorMsg,
                        ...(responseMsg && { edit: responseMsg.key })
                    });
                } catch {}
                return;
            }
            
            if (!payload) {
                console.log(`[ChannelStatus] No payload created`);
                try {
                    await sock.sendMessage(jid, {
                        text: '❌ Could not process your message.\n\n' +
                              'Please send:\n' +
                              '• Image with caption\n' +
                              '• Video with caption\n' +
                              '• Audio/voice note\n' +
                              '• Sticker\n' +
                              '• Or text message',
                        ...(responseMsg && { edit: responseMsg.key })
                    });
                } catch {}
                return;
            }
            
            console.log(`[ChannelStatus] Payload type: ${Object.keys(payload)[0]}`);
            
            // Update processing message
            try {
                await sock.sendMessage(jid, {
                    text: `📤 Sending to channel status...\n` +
                          `Please wait...`,
                    ...(responseMsg && { edit: responseMsg.key })
                });
            } catch {}
            
            // Send channel status update
            try {
                console.log(`[ChannelStatus] Sending channel status update...`);
                await sendChannelStatusUpdate(sock, jid, payload);
                
                // Success message
                const elapsedTime = Date.now() - startTime;
                let successMsg = `✅ *Channel Status Update Posted!*\n\n`;
                successMsg += `⏱️ Time: ${elapsedTime}ms\n`;
                successMsg += `📢 Channel: ${jid.split('@')[0]}\n`;
                successMsg += `📍 Location: Updates/Status section\n`;
                successMsg += `📊 Type: ${Object.keys(payload)[0].toUpperCase()}\n`;
                
                if (payload.caption) {
                    successMsg += `📝 Caption: ${payload.caption}\n`;
                }
                
                if (payload.text) {
                    const preview = payload.text.length > 80 ? 
                        payload.text.substring(0, 80) + '...' : payload.text;
                    successMsg += `📄 Content: ${preview}\n`;
                }
                
                successMsg += `\n✨ Check the channel's Updates tab to see your post!`;
                
                try {
                    await sock.sendMessage(jid, {
                        text: successMsg,
                        ...(responseMsg && { edit: responseMsg.key })
                    });
                } catch {}
                
                console.log(`[ChannelStatus] SUCCESS ✓ (${elapsedTime}ms)`);
                
            } catch (sendError) {
                console.error(`[ChannelStatus] Send failed:`, sendError.message);
                
                const elapsedTime = Date.now() - startTime;
                let errorMsg = `❌ *Failed to post channel status*\n\n`;
                errorMsg += `⏱️ Failed after: ${elapsedTime}ms\n`;
                errorMsg += `Error: ${sendError.message}\n\n`;
                
                // User-friendly solutions
                errorMsg += `*Common Solutions:*\n`;
                errorMsg += `1. Make sure bot is added to the channel\n`;
                errorMsg += `2. Try with text-only first\n`;
                errorMsg += `3. Bot number: ${sock.user?.id?.split('@')[0] || 'Unknown'}\n`;
                errorMsg += `4. Media might be too large\n\n`;
                errorMsg += `*Quick test:* Try \`.channelstatus Test message\` with just text.`;
                
                try {
                    await sock.sendMessage(jid, {
                        text: errorMsg,
                        ...(responseMsg && { edit: responseMsg.key })
                    });
                } catch {}
            }
            
        } catch (error) {
            console.error(`[ChannelStatus] FATAL ERROR:`, error);
            
            try {
                await sock.sendMessage(m.key.remoteJid, {
                    text: `💥 *Command Error*\n\n` +
                          `Error: ${error.message}\n` +
                          `Please try again or contact support.`
                });
            } catch {
                console.error(`[ChannelStatus] Could not send error message`);
            }
        }
    }
};
