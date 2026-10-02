












// import fs from 'fs';
// import path from 'path';
// import { downloadContentFromMessage } from 'wolfsocket';

// // File to store sticker data
// const stickerPackFile = './stickers_packs.json';
// const stickerConfigFile = './sticker_config.json';
// const collectedStickersFile = './collected_stickers.json';

// // Ensure JSON files exist
// if (!fs.existsSync(stickerPackFile)) {
//     fs.writeFileSync(stickerPackFile, JSON.stringify({}, null, 2));
// }

// if (!fs.existsSync(stickerConfigFile)) {
//     fs.writeFileSync(stickerConfigFile, JSON.stringify({
//         defaultCollectionTime: 120, // seconds
//         maxStickersPerPack: 30,
//         autoCollect: true,
//         maxStickersPerCollection: 100
//     }, null, 2));
// }

// if (!fs.existsSync(collectedStickersFile)) {
//     fs.writeFileSync(collectedStickersFile, JSON.stringify({}, null, 2));
// }

// // Utility function to clean JID
// function cleanJid(jid) {
//     if (!jid) return jid;
//     const clean = jid.split(':')[0];
//     return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
// }

// // Create directories for sticker processing
// const tempDir = './temp_stickers';
// const collectedDir = './collected_stickers';
// if (!fs.existsSync(tempDir)) {
//     fs.mkdirSync(tempDir, { recursive: true });
// }
// if (!fs.existsSync(collectedDir)) {
//     fs.mkdirSync(collectedDir, { recursive: true });
// }

// // Load collected stickers
// function loadCollectedStickers() {
//     try {
//         const data = fs.readFileSync(collectedStickersFile, 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Error loading collected stickers:', error);
//         return {};
//     }
// }

// // Save collected stickers
// function saveCollectedStickers(data) {
//     try {
//         fs.writeFileSync(collectedStickersFile, JSON.stringify(data, null, 2));
//     } catch (error) {
//         console.error('Error saving collected stickers:', error);
//     }
// }

// // Load sticker packs data
// function loadStickerPacks() {
//     try {
//         const data = fs.readFileSync(stickerPackFile, 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Error loading sticker packs:', error);
//         return {};
//     }
// }

// // Save sticker packs data
// function saveStickerPacks(data) {
//     try {
//         fs.writeFileSync(stickerPackFile, JSON.stringify(data, null, 2));
//     } catch (error) {
//         console.error('Error saving sticker packs:', error);
//     }
// }

// // Load config
// function loadConfig() {
//     try {
//         const data = fs.readFileSync(stickerConfigFile, 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Error loading config:', error);
//         return {
//             defaultCollectionTime: 120,
//             maxStickersPerPack: 30,
//             autoCollect: true,
//             maxStickersPerCollection: 100
//         };
//     }
// }

// // Save config
// function saveConfig(config) {
//     try {
//         fs.writeFileSync(stickerConfigFile, JSON.stringify(config, null, 2));
//     } catch (error) {
//         console.error('Error saving config:', error);
//     }
// }

// // Store stickers when they're sent (for future use)
// const activeCollections = {}; // Track active collections per chat
// const collectionTimers = {}; // Track collection timers per chat

// // Function to collect stickers in real-time with detailed logging
// function setupStickerCollector(sock) {
//     sock.ev.on('messages.upsert', async ({ messages }) => {
//         const newMsg = messages[0];
        
//         if (!newMsg || !newMsg.key.remoteJid?.endsWith('@g.us')) return;
        
//         const chatId = newMsg.key.remoteJid;
        
//         // Skip if from bot itself
//         if (newMsg.key.fromMe) return;
        
//         if (newMsg.message?.stickerMessage) {
//             const config = loadConfig();
            
//             // Check if collection is active for this chat
//             if (!activeCollections[chatId] && !config.autoCollect) {
//                 return;
//             }
            
//             // Load collected stickers for this chat
//             const collectedStickers = loadCollectedStickers();
//             if (!collectedStickers[chatId]) {
//                 collectedStickers[chatId] = [];
//             }
            
//             const stickers = collectedStickers[chatId];
//             const configData = loadConfig();
            
//             // Check if we've reached max collection limit
//             if (stickers.length >= configData.maxStickersPerCollection) {
//                 console.log('\x1b[33m%s\x1b[0m', `⚠️ Max collection limit reached for ${chatId}: ${stickers.length}/${configData.maxStickersPerCollection}`);
//                 return;
//             }
            
//             const stickerId = newMsg.message.stickerMessage.fileSha256?.toString('base64') || 
//                             newMsg.key.id;
            
//             // Avoid duplicates
//             const isDuplicate = stickers.some(s => s.id === stickerId);
            
//             if (!isDuplicate) {
//                 // Get sender info for logging
//                 const sender = newMsg.key.participant || newMsg.key.remoteJid;
//                 const senderNumber = sender.split('@')[0];
                
//                 // Create sticker entry
//                 const stickerEntry = {
//                     id: stickerId,
//                     messageKey: newMsg.key,
//                     stickerMessage: newMsg.message.stickerMessage,
//                     timestamp: Date.now(),
//                     sender: sender,
//                     senderNumber: senderNumber,
//                     saved: false,
//                     filePath: ''
//                 };
                
//                 stickers.push(stickerEntry);
                
//                 // Save immediately to file
//                 saveCollectedStickers(collectedStickers);
                
//                 // Log to console with colorful output
//                 console.log('\x1b[32m%s\x1b[0m', '🎭 STICKER DETECTED AND SAVED!');
//                 console.log('\x1b[36m%s\x1b[0m', `📱 From: ${senderNumber}`);
//                 console.log('\x1b[36m%s\x1b[0m', `💬 Chat: ${chatId}`);
//                 console.log('\x1b[36m%s\x1b[0m', `🆔 Sticker ID: ${stickerId.substring(0, 10)}...`);
//                 console.log('\x1b[36m%s\x1b[0m', `📊 Total collected: ${stickers.length}/${configData.maxStickersPerCollection}`);
//                 console.log('\x1b[32m%s\x1b[0m', '✅ Sticker saved to file!\n');
                
//                 // If collection is active, download the sticker immediately
//                 if (activeCollections[chatId]) {
//                     try {
//                         await downloadAndSaveSticker(sock, newMsg, chatId, stickerEntry);
//                     } catch (error) {
//                         console.log('\x1b[31m%s\x1b[0m', `❌ Failed to download sticker: ${error.message}`);
//                     }
//                 }
//             }
//         }
//     });
// }

// // Download and save sticker to file
// async function downloadAndSaveSticker(sock, msg, chatId, stickerEntry) {
//     try {
//         console.log('\x1b[36m%s\x1b[0m', `⬇️ Downloading sticker from chat: ${chatId}`);
        
//         // Download sticker
//         let buffer;
//         try {
//             buffer = await sock.downloadMediaMessage(msg);
//         } catch (error) {
//             console.log('\x1b[33m%s\x1b[0m', `⚠️ Standard download failed, trying alternative...`);
            
//             // Alternative method using downloadContentFromMessage
//             try {
//                 const stream = await downloadContentFromMessage(msg.message.stickerMessage, 'sticker');
//                 const chunks = [];
//                 for await (const chunk of stream) {
//                     chunks.push(chunk);
//                 }
//                 buffer = Buffer.concat(chunks);
//             } catch (error2) {
//                 console.log('\x1b[31m%s\x1b[0m', `❌ Both download methods failed`);
//                 return null;
//             }
//         }
        
//         if (!buffer || buffer.length === 0) {
//             console.log('\x1b[31m%s\x1b[0m', `❌ Downloaded empty buffer`);
//             return null;
//         }
        
//         // Create chat directory if it doesn't exist
//         const chatDir = path.join(collectedDir, chatId.replace('@g.us', ''));
//         if (!fs.existsSync(chatDir)) {
//             fs.mkdirSync(chatDir, { recursive: true });
//         }
        
//         // Save sticker to file
//         const filename = `${stickerEntry.id.substring(0, 16)}_${Date.now()}.webp`;
//         const filePath = path.join(chatDir, filename);
        
//         fs.writeFileSync(filePath, buffer);
        
//         // Update sticker entry with file info
//         stickerEntry.saved = true;
//         stickerEntry.filePath = filePath;
//         stickerEntry.fileSize = buffer.length;
//         stickerEntry.downloadedAt = new Date().toISOString();
        
//         console.log('\x1b[32m%s\x1b[0m', `✅ Sticker saved to: ${filePath}`);
//         console.log('\x1b[36m%s\x1b[0m', `📁 File size: ${(buffer.length / 1024).toFixed(2)} KB\n`);
        
//         // Update collected stickers file
//         const collectedStickers = loadCollectedStickers();
//         const chatStickers = collectedStickers[chatId] || [];
//         const stickerIndex = chatStickers.findIndex(s => s.id === stickerEntry.id);
//         if (stickerIndex !== -1) {
//             chatStickers[stickerIndex] = stickerEntry;
//             collectedStickers[chatId] = chatStickers;
//             saveCollectedStickers(collectedStickers);
//         }
        
//         return filePath;
        
//     } catch (error) {
//         console.log('\x1b[31m%s\x1b[0m', `❌ Download error: ${error.message}\n`);
//         return null;
//     }
// }

// // Download all collected stickers for a chat
// async function downloadAllStickers(sock, chatId) {
//     try {
//         const collectedStickers = loadCollectedStickers();
//         const chatStickers = collectedStickers[chatId] || [];
        
//         if (chatStickers.length === 0) {
//             return 0;
//         }
        
//         console.log('\x1b[36m%s\x1b[0m', `⬇️ Downloading ${chatStickers.length} stickers for chat: ${chatId}`);
        
//         let downloadedCount = 0;
        
//         for (let i = 0; i < chatStickers.length; i++) {
//             const sticker = chatStickers[i];
            
//             if (!sticker.saved) {
//                 try {
//                     // Reconstruct message object for download
//                     const msgObj = {
//                         key: sticker.messageKey,
//                         message: { stickerMessage: sticker.stickerMessage }
//                     };
                    
//                     await downloadAndSaveSticker(sock, msgObj, chatId, sticker);
//                     downloadedCount++;
                    
//                     // Small delay to avoid rate limiting
//                     await new Promise(resolve => setTimeout(resolve, 500));
                    
//                 } catch (error) {
//                     console.log('\x1b[31m%s\x1b[0m', `❌ Failed to download sticker ${i + 1}: ${error.message}`);
//                 }
//             } else {
//                 downloadedCount++; // Already downloaded
//             }
            
//             // Show progress
//             if ((i + 1) % 5 === 0 || i + 1 === chatStickers.length) {
//                 console.log('\x1b[36m%s\x1b[0m', `📊 Progress: ${i + 1}/${chatStickers.length} (${downloadedCount} downloaded)`);
//             }
//         }
        
//         console.log('\x1b[32m%s\x1b[0m', `✅ Downloaded ${downloadedCount}/${chatStickers.length} stickers\n`);
//         return downloadedCount;
        
//     } catch (error) {
//         console.log('\x1b[31m%s\x1b[0m', `❌ Error downloading stickers: ${error.message}\n`);
//         return 0;
//     }
// }

// // Process and save sticker
// async function processStickerForPack(stickerBuffer, packId, stickerIndex) {
//     try {
//         if (!stickerBuffer) {
//             console.log('\x1b[31m%s\x1b[0m', `❌ No buffer for sticker ${stickerIndex}`);
//             return null;
//         }
        
//         // Create pack directory
//         const packDir = path.join(tempDir, packId);
//         if (!fs.existsSync(packDir)) {
//             fs.mkdirSync(packDir, { recursive: true });
//         }

//         // Create unique filename
//         const stickerFileName = `sticker_${stickerIndex}.webp`;
//         const stickerPath = path.join(packDir, stickerFileName);
        
//         // Save sticker
//         fs.writeFileSync(stickerPath, stickerBuffer);
        
//         console.log('\x1b[32m%s\x1b[0m', `💾 Saved sticker ${stickerIndex} to ${stickerPath}`);
        
//         return {
//             path: stickerPath,
//             index: stickerIndex,
//             size: stickerBuffer.length
//         };
//     } catch (error) {
//         console.log('\x1b[31m%s\x1b[0m', `❌ Error saving sticker ${stickerIndex}: ${error.message}\n`);
//         return null;
//     }
// }

// // Start collection timer for a chat
// function startCollectionTimer(chatId, duration, sock) {
//     if (collectionTimers[chatId]) {
//         clearTimeout(collectionTimers[chatId]);
//     }
    
//     console.log('\x1b[36m%s\x1b[0m', `⏰ Starting ${duration}-second collection timer for chat: ${chatId}`);
    
//     collectionTimers[chatId] = setTimeout(async () => {
//         const collectedStickers = loadCollectedStickers();
//         const count = collectedStickers[chatId]?.length || 0;
        
//         console.log('\x1b[33m%s\x1b[0m', `⏰ Collection timer ended for ${chatId}`);
//         console.log('\x1b[36m%s\x1b[0m', `📊 Total stickers collected: ${count}\n`);
        
//         // Stop active collection
//         activeCollections[chatId] = false;
//         delete collectionTimers[chatId];
        
//         // Download all collected stickers
//         await downloadAllStickers(sock, chatId);
        
//         // Notify group
//         if (count > 0) {
//             try {
//                 await sock.sendMessage(chatId, { 
//                     text: `✅ *Collection Period Ended!*\n\n🎭 Collected ${count} stickers!\n📁 Stickers have been saved to storage.\n\nNow you can use \`.stickerpack create [name]\` to make a pack!\n\nNote: You can continue collecting more stickers or create a pack now.` 
//                 });
//             } catch (error) {
//                 console.log('\x1b[31m%s\x1b[0m', `❌ Failed to send notification: ${error.message}`);
//             }
//         }
        
//     }, duration * 1000);
// }

// // Create sticker pack from collected stickers
// async function createStickerPack(sock, chatId, packName, sender) {
//     try {
//         // Load collected stickers
//         const collectedStickers = loadCollectedStickers();
//         const chatStickers = collectedStickers[chatId] || [];
        
//         if (chatStickers.length === 0) {
//             return {
//                 success: false,
//                 message: '❌ No stickers collected yet!\n\nUse `.stickerpack collect [time]` to start collecting stickers first.'
//             };
//         }
        
//         console.log('\x1b[32m%s\x1b[0m', `🎨 Creating sticker pack: ${packName}`);
//         console.log('\x1b[36m%s\x1b[0m', `📊 Found ${chatStickers.length} collected stickers\n`);
        
//         // Filter only saved stickers
//         const savedStickers = chatStickers.filter(s => s.saved && s.filePath && fs.existsSync(s.filePath));
        
//         if (savedStickers.length === 0) {
//             // Try to download stickers first
//             await sock.sendMessage(chatId, { 
//                 text: `🔄 Downloading ${chatStickers.length} stickers first... This may take a moment.` 
//             });
            
//             const downloaded = await downloadAllStickers(sock, chatId);
            
//             if (downloaded === 0) {
//                 return {
//                     success: false,
//                     message: '❌ Failed to download any stickers.\n\nTry sending new stickers and collect again.'
//                 };
//             }
            
//             // Reload stickers
//             const updatedStickers = loadCollectedStickers()[chatId] || [];
//             savedStickers = updatedStickers.filter(s => s.saved && s.filePath && fs.existsSync(s.filePath));
//         }
        
//         const config = loadConfig();
//         const maxStickers = Math.min(savedStickers.length, config.maxStickersPerPack);
        
//         console.log('\x1b[36m%s\x1b[0m', `📦 Processing ${maxStickers} saved stickers\n`);
        
//         // Generate unique pack ID
//         const packId = `wolfpack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
//         // Get group info for pack author
//         let packAuthor = '';
//         try {
//             const groupInfo = await sock.groupMetadata(chatId);
//             packAuthor = `From: ${groupInfo.subject}`;
//         } catch (error) {
//             packAuthor = `Group Stickers`;
//         }
        
//         // Process stickers
//         const processedStickers = [];
        
//         for (let i = 0; i < maxStickers; i++) {
//             try {
//                 const sticker = savedStickers[i];
//                 const stickerNumber = i + 1;
                
//                 console.log('\x1b[36m%s\x1b[0m', `--- Processing Sticker ${stickerNumber}/${maxStickers} ---`);
                
//                 // Read sticker file
//                 if (!fs.existsSync(sticker.filePath)) {
//                     console.log('\x1b[31m%s\x1b[0m', `❌ Sticker file not found: ${sticker.filePath}`);
//                     continue;
//                 }
                
//                 const buffer = fs.readFileSync(sticker.filePath);
                
//                 if (buffer.length > 0) {
//                     // Process for pack
//                     const stickerInfo = await processStickerForPack(buffer, packId, stickerNumber);
                    
//                     if (stickerInfo) {
//                         processedStickers.push(stickerInfo);
//                         console.log('\x1b[32m%s\x1b[0m', `✅ Sticker ${stickerNumber} added to pack\n`);
//                     }
//                 }
                
//             } catch (error) {
//                 console.log('\x1b[31m%s\x1b[0m', `❌ Error with sticker ${i + 1}: ${error.message}\n`);
//             }
//         }
        
//         if (processedStickers.length === 0) {
//             return {
//                 success: false,
//                 message: '❌ No stickers could be processed.\n\nTry collecting new stickers and try again.'
//             };
//         }
        
//         // Send stickers as pack
//         console.log('\x1b[32m%s\x1b[0m', `📤 Sending ${processedStickers.length} stickers as pack...\n`);
        
//         let sentCount = 0;
//         for (let i = 0; i < processedStickers.length; i++) {
//             try {
//                 const stickerPath = processedStickers[i].path;
//                 const stickerBuffer = fs.readFileSync(stickerPath);
                
//                 // Send sticker with pack metadata
//                 await sock.sendMessage(chatId, { 
//                     sticker: stickerBuffer 
//                 }, {
//                     packname: packName,
//                     author: packAuthor,
//                     categories: ['Group Stickers']
//                 });
                
//                 sentCount++;
//                 console.log('\x1b[32m%s\x1b[0m', `✅ Sent sticker ${i + 1}/${processedStickers.length}`);
                
//                 // Delay between stickers to avoid rate limiting
//                 await new Promise(resolve => setTimeout(resolve, 1500));
                
//             } catch (error) {
//                 console.log('\x1b[31m%s\x1b[0m', `❌ Error sending sticker ${i + 1}: ${error.message}`);
//             }
//         }
        
//         // Save pack info
//         const stickerPacks = loadStickerPacks();
//         const groupPacks = stickerPacks[chatId] || [];
        
//         const newPack = {
//             id: packId,
//             name: packName,
//             author: packAuthor,
//             chatId: chatId,
//             createdBy: sender,
//             createdDate: new Date().toISOString(),
//             stickerCount: processedStickers.length,
//             sentCount: sentCount,
//             stickers: processedStickers.map(s => ({
//                 index: s.index,
//                 size: s.size
//             }))
//         };
        
//         groupPacks.push(newPack);
//         stickerPacks[chatId] = groupPacks;
//         saveStickerPacks(stickerPacks);
        
//         // Clean up temporary pack directory after delay
//         setTimeout(() => {
//             try {
//                 const packDir = path.join(tempDir, packId);
//                 if (fs.existsSync(packDir)) {
//                     fs.rmSync(packDir, { recursive: true, force: true });
//                     console.log('\x1b[33m%s\x1b[0m', `🗑️ Cleaned up temp pack directory: ${packDir}\n`);
//                 }
//             } catch (cleanupError) {
//                 console.log('\x1b[31m%s\x1b[0m', `❌ Error cleaning up: ${cleanupError.message}\n`);
//             }
//         }, 60000);
        
//         return {
//             success: true,
//             message: `✅ *Sticker Pack Created Successfully!*\n\n📦 *Pack Name:* ${packName}\n🎭 *Stickers:* ${sentCount} sent\n👤 *Created by:* @${sender.split('@')[0]}\n📅 *Date:* ${new Date().toLocaleDateString()}\n\nAll stickers above are now part of the *${packName}* pack!\n\n*Note:* You can continue collecting more stickers for future packs.`,
//             stats: {
//                 processed: processedStickers.length,
//                 sent: sentCount,
//                 totalCollected: chatStickers.length
//             }
//         };
        
//     } catch (error) {
//         console.log('\x1b[31m%s\x1b[0m', `❌ Pack creation error: ${error.message}\n`);
//         return {
//             success: false,
//             message: `❌ Failed to create sticker pack.\n\nError: ${error.message}`
//         };
//     }
// }

// // Clear collected stickers for a chat
// function clearCollectedStickers(chatId) {
//     const collectedStickers = loadCollectedStickers();
//     const oldCount = collectedStickers[chatId]?.length || 0;
    
//     // Delete sticker files
//     if (collectedStickers[chatId]) {
//         collectedStickers[chatId].forEach(sticker => {
//             if (sticker.filePath && fs.existsSync(sticker.filePath)) {
//                 try {
//                     fs.unlinkSync(sticker.filePath);
//                 } catch (error) {
//                     console.log('\x1b[31m%s\x1b[0m', `❌ Error deleting file: ${sticker.filePath}`);
//                 }
//             }
//         });
//     }
    
//     // Clear from memory
//     collectedStickers[chatId] = [];
//     saveCollectedStickers(collectedStickers);
    
//     // Delete chat directory
//     const chatDir = path.join(collectedDir, chatId.replace('@g.us', ''));
//     if (fs.existsSync(chatDir)) {
//         try {
//             fs.rmSync(chatDir, { recursive: true, force: true });
//         } catch (error) {
//             console.log('\x1b[31m%s\x1b[0m', `❌ Error deleting chat directory: ${error.message}`);
//         }
//     }
    
//     return oldCount;
// }

// // Initialize sticker collector
// let stickerCollectorSetup = false;

// export default {
//     name: 'stickerpack',
//     description: 'Create a sticker pack from collected stickers',
//     category: 'group',
//     async execute(sock, msg, args, metadata) {
//         const chatId = msg.key.remoteJid;
//         const isGroup = chatId.endsWith('@g.us');
        
//         if (!isGroup) {
//             return sock.sendMessage(chatId, { 
//                 text: '❌ This command can only be used in groups.' 
//             }, { quoted: msg });
//         }

//         // Setup sticker collector if not already done
//         if (!stickerCollectorSetup) {
//             setupStickerCollector(sock);
//             stickerCollectorSetup = true;
//             console.log('\x1b[32m%s\x1b[0m', '🎭 Sticker collector initialized!\n');
//         }

//         // Get sender's JID
//         let sender = msg.key.participant || (msg.key.fromMe ? sock.user.id : msg.key.remoteJid);
//         sender = cleanJid(sender);

//         // Check if user is admin
//         let isAdmin = false;
        
//         try {
//             const groupMetadata = await sock.groupMetadata(chatId);
//             const cleanSender = cleanJid(sender);
            
//             const participant = groupMetadata.participants.find(p => {
//                 const cleanParticipantJid = cleanJid(p.id);
//                 return cleanParticipantJid === cleanSender;
//             });
            
//             isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
//         } catch (error) {
//             console.error('Error fetching group metadata:', error);
//             return sock.sendMessage(chatId, { 
//                 text: '❌ Failed to fetch group information.' 
//             }, { quoted: msg });
//         }

//         // Only admins can create packs
//         if (!isAdmin && !['stats', 'list', 'help'].includes(args[0]?.toLowerCase())) {
//             return sock.sendMessage(chatId, { 
//                 text: '❌ Only group admins can manage sticker packs!' 
//             }, { quoted: msg });
//         }

//         const subCommand = args[0]?.toLowerCase() || 'help';

//         if (subCommand === 'create') {
//             // Create sticker pack from collected stickers
//             const packName = args.slice(1).join(' ') || 'WolfPack';
            
//             // Check if collection is active
//             if (activeCollections[chatId]) {
//                 return sock.sendMessage(chatId, { 
//                     text: '⚠️ *Collection in Progress*\n\nPlease wait for the current collection to finish, or use `.stickerpack stop` to stop collection first.' 
//                 }, { quoted: msg });
//             }
            
//             // Start pack creation
//             await sock.sendMessage(chatId, { 
//                 text: `🔄 *Creating Sticker Pack: ${packName}*\n\nGathering all collected stickers...\n\n*Note:* This may take a moment. Check terminal for progress.` 
//             }, { quoted: msg });
            
//             const result = await createStickerPack(sock, chatId, packName, sender);
            
//             return sock.sendMessage(chatId, { 
//                 text: result.message,
//                 mentions: result.success ? [sender] : []
//             }, { quoted: msg });

//         } else if (subCommand === 'collect') {
//             // Start manual collection with configurable time
//             let duration = parseInt(args[1]) || loadConfig().defaultCollectionTime;
            
//             if (duration < 10) {
//                 duration = 10; // Minimum 10 seconds
//             }
//             if (duration > 600) {
//                 duration = 600; // Maximum 10 minutes
//             }
            
//             // Check if already collecting
//             if (activeCollections[chatId]) {
//                 return sock.sendMessage(chatId, { 
//                     text: '⚠️ *Already Collecting!*\n\nA collection is already in progress. Use `.stickerpack stop` to stop current collection.' 
//                 }, { quoted: msg });
//             }
            
//             // Start active collection
//             activeCollections[chatId] = true;
            
//             const collectedStickers = loadCollectedStickers();
//             const startCount = collectedStickers[chatId]?.length || 0;
//             const config = loadConfig();
            
//             console.log('\x1b[32m%s\x1b[0m', `🎭 Starting sticker collection for ${duration} seconds`);
//             console.log('\x1b[36m%s\x1b[0m', `💬 Chat: ${chatId}`);
//             console.log('\x1b[36m%s\x1b[0m', `📊 Starting with ${startCount} stickers already collected\n`);
            
//             await sock.sendMessage(chatId, { 
//                 text: `📥 *Sticker Collection Started!*\n\nI will collect stickers for *${duration} seconds*.\n\n*Send stickers now!* Every sticker sent will be saved.\n\n⏰ Duration: ${duration} seconds\n📊 Already collected: ${startCount} stickers\n📈 Max limit: ${config.maxStickersPerCollection} stickers\n\nAfter collection, use \`.stickerpack create [name]\` to make a pack!` 
//             }, { quoted: msg });

//             // Start collection timer
//             startCollectionTimer(chatId, duration, sock);
            
//             // Send time update
//             const minutes = Math.floor(duration / 60);
//             const seconds = duration % 60;
//             const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            
//             await sock.sendMessage(chatId, { 
//                 text: `⏰ Collection will run for ${timeText}. Start sending stickers!` 
//             });

//         } else if (subCommand === 'stop') {
//             // Stop active collection
//             if (!activeCollections[chatId]) {
//                 return sock.sendMessage(chatId, { 
//                     text: '⚠️ *No Active Collection*\n\nThere is no active sticker collection to stop.' 
//                 }, { quoted: msg });
//             }
            
//             activeCollections[chatId] = false;
            
//             if (collectionTimers[chatId]) {
//                 clearTimeout(collectionTimers[chatId]);
//                 delete collectionTimers[chatId];
//             }
            
//             const collectedStickers = loadCollectedStickers();
//             const count = collectedStickers[chatId]?.length || 0;
            
//             await sock.sendMessage(chatId, { 
//                 text: `🛑 *Collection Stopped!*\n\n🎭 Total stickers collected: ${count}\n\nUse \`.stickerpack create [name]\` to make a pack now!` 
//             }, { quoted: msg });
            
//             // Download collected stickers
//             await downloadAllStickers(sock, chatId);

//         } else if (subCommand === 'time') {
//             // Configure collection time
//             if (args[1]) {
//                 const newTime = parseInt(args[1]);
//                 if (isNaN(newTime) || newTime < 10 || newTime > 600) {
//                     await sock.sendMessage(chatId, { 
//                         text: '❌ Please specify a time between 10 and 600 seconds.' 
//                     }, { quoted: msg });
//                     return;
//                 }
                
//                 const config = loadConfig();
//                 config.defaultCollectionTime = newTime;
//                 saveConfig(config);
                
//                 await sock.sendMessage(chatId, { 
//                     text: `⚙️ *Collection Time Updated*\n\nDefault collection time set to *${newTime} seconds*\n\nUse \`.stickerpack collect\` without time to use this default.` 
//                 }, { quoted: msg });
//             } else {
//                 const config = loadConfig();
//                 await sock.sendMessage(chatId, { 
//                     text: `⚙️ *Current Collection Time*\n\nDefault: *${config.defaultCollectionTime} seconds*\n\nTo change: \`.stickerpack time [seconds]\`\n\nMin: 10s, Max: 600s (10 minutes)` 
//                 }, { quoted: msg });
//             }

//         } else if (subCommand === 'clear') {
//             // Clear collected stickers
//             const oldCount = clearCollectedStickers(chatId);
            
//             console.log('\x1b[33m%s\x1b[0m', `🧹 Cleared ${oldCount} stickers from chat: ${chatId}\n`);
            
//             await sock.sendMessage(chatId, { 
//                 text: `🧹 *Cleared All Stickers!*\n\nDeleted ${oldCount} collected stickers.\n\nSend new stickers and use \`.stickerpack collect\` to start fresh.` 
//             }, { quoted: msg });

//         } else if (subCommand === 'stats') {
//             // Show detailed stats
//             const collectedStickers = loadCollectedStickers();
//             const chatStickers = collectedStickers[chatId] || [];
//             const savedStickers = chatStickers.filter(s => s.saved).length;
//             const unsavedStickers = chatStickers.length - savedStickers;
            
//             const stickerPacks = loadStickerPacks();
//             const groupPacks = stickerPacks[chatId] || [];
//             const totalPacks = groupPacks.length;
//             const totalStickersInPacks = groupPacks.reduce((sum, pack) => sum + pack.stickerCount, 0);
            
//             const config = loadConfig();
//             const isCollecting = !!activeCollections[chatId];
            
//             const statsText = `📊 *Sticker Pack Statistics*\n\n` +
//                              `🎭 *Collected Stickers:* ${chatStickers.length}\n` +
//                              `💾 Saved to files: ${savedStickers}\n` +
//                              `⏳ Pending save: ${unsavedStickers}\n` +
//                              `📦 *Total packs created:* ${totalPacks}\n` +
//                              `✨ *Total stickers in packs:* ${totalStickersInPacks}\n` +
//                              `⏰ *Currently collecting:* ${isCollecting ? 'Yes' : 'No'}\n` +
//                              `⏱️ *Default collection time:* ${config.defaultCollectionTime}s\n` +
//                              `📈 *Max collection limit:* ${config.maxStickersPerCollection}\n` +
//                              `🎯 *Max per pack:* ${config.maxStickersPerPack}\n\n` +
//                              `*Commands:*\n` +
//                              `• \`.stickerpack create [name]\` - Make new pack\n` +
//                              `• \`.stickerpack collect [time]\` - Collect stickers\n` +
//                              `• \`.stickerpack stop\` - Stop collection\n` +
//                              `• \`.stickerpack clear\` - Clear all stickers\n` +
//                              `• \`.stickerpack time [seconds]\` - Set time`;
            
//             await sock.sendMessage(chatId, { text: statsText }, { quoted: msg });

//         } else if (subCommand === 'list') {
//             // List sticker packs
//             const stickerPacks = loadStickerPacks();
//             const groupPacks = stickerPacks[chatId] || [];
            
//             if (groupPacks.length === 0) {
//                 await sock.sendMessage(chatId, { 
//                     text: '📭 No sticker packs created for this group yet.\n\nCreate one with `.stickerpack create [name]`' 
//                 }, { quoted: msg });
//                 return;
//             }

//             let listText = `📦 *Sticker Packs for This Group*\n\n`;
            
//             groupPacks.forEach((pack, index) => {
//                 listText += `${index + 1}. *${pack.name}*\n`;
//                 listText += `   • Stickers: ${pack.stickerCount}\n`;
//                 listText += `   • Created: ${new Date(pack.createdDate).toLocaleDateString()}\n`;
//                 listText += `   • By: @${pack.createdBy.split('@')[0]}\n\n`;
//             });

//             listText += `\nTotal Packs: ${groupPacks.length}\n\nView details: \`.stickerpack info [number]\``;
            
//             await sock.sendMessage(chatId, { text: listText }, { quoted: msg });

//         } else if (subCommand === 'info') {
//             // Show pack info
//             const stickerPacks = loadStickerPacks();
//             const groupPacks = stickerPacks[chatId] || [];
//             const packIndex = parseInt(args[1]) - 1;
            
//             if (isNaN(packIndex) || packIndex < 0 || packIndex >= groupPacks.length) {
//                 await sock.sendMessage(chatId, { 
//                     text: `❌ Please specify a valid pack number (1-${groupPacks.length}).\n\nUse \`.stickerpack list\` to see available packs.` 
//                 }, { quoted: msg });
//                 return;
//             }

//             const pack = groupPacks[packIndex];
            
//             const infoText = `📋 *Sticker Pack Info*\n\n` +
//                             `📦 *Name:* ${pack.name}\n` +
//                             `👤 *Author:* ${pack.author}\n` +
//                             `🎭 *Sticker Count:* ${pack.stickerCount}\n` +
//                             `📅 *Created:* ${new Date(pack.createdDate).toLocaleString()}\n` +
//                             `👨‍💻 *Created by:* @${pack.createdBy.split('@')[0]}\n` +
//                             `💬 *Chat:* ${pack.chatId}\n\n` +
//                             `*Pack ID:* ${pack.id.substring(0, 15)}...`;
            
//             await sock.sendMessage(chatId, { 
//                 text: infoText,
//                 mentions: [pack.createdBy]
//             }, { quoted: msg });

//         } else {
//             // Show help
//             const config = loadConfig();
//             const helpText = `
// 📦 *Sticker Pack Creator - WolfPack*

// Create custom sticker packs from collected group stickers!

// *How it works:*
// 1. Start collection with \`.stickerpack collect [time]\`
// 2. Send stickers in the group (they get saved automatically)
// 3. Create pack with \`.stickerpack create [name]\`

// *Main Commands:*
// • \`.stickerpack create [name]\` - Create pack from collected stickers
// • \`.stickerpack collect [seconds]\` - Start collecting (default: ${config.defaultCollectionTime}s)
// • \`.stickerpack stop\` - Stop current collection
// • \`.stickerpack time [seconds]\` - Set default collection time

// *Management Commands:*
// • \`.stickerpack list\` - List all created packs
// • \`.stickerpack info [number]\` - Show pack details
// • \`.stickerpack stats\` - Show statistics
// • \`.stickerpack clear\` - Clear all collected stickers
// • \`.stickerpack help\` - Show this help

// *Examples:*
// • \`.stickerpack collect 60\` - Collect stickers for 60 seconds
// • \`.stickerpack create Memes\` - Create "Memes" pack
// • \`.stickerpack time 180\` - Set default to 3 minutes

// *Notes:*
// • Only admins can create packs
// • Maximum ${config.maxStickersPerPack} stickers per pack
// • Maximum ${config.maxStickersPerCollection} stickers per collection
// • Stickers are saved to files for future use
// • Check terminal for detailed processing logs
// `.trim();
            
//             await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
//         }
//     }
// };





























import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from 'wolfsocket';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createCanvas } from '../../lib/canvasWrapper.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const execAsync = promisify(exec);

// File to store sticker data
const stickerPackFile = './stickers_packs.json';
const stickerConfigFile = './sticker_config.json';
const collectedStickersFile = './collected_stickers.json';

// Ensure JSON files exist
if (!fs.existsSync(stickerPackFile)) {
    fs.writeFileSync(stickerPackFile, JSON.stringify({}, null, 2));
}

if (!fs.existsSync(stickerConfigFile)) {
    fs.writeFileSync(stickerConfigFile, JSON.stringify({
        defaultCollectionTime: 120, // seconds
        maxStickersPerPack: 30,
        autoCollect: true,
        maxStickersPerCollection: 100
    }, null, 2));
}

if (!fs.existsSync(collectedStickersFile)) {
    fs.writeFileSync(collectedStickersFile, JSON.stringify({}, null, 2));
}

// Utility function to clean JID
function cleanJid(jid) {
    if (!jid) return jid;
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

// Create directories for sticker processing
const tempDir = './temp_stickers';
const collectedDir = './collected_stickers';
const packDir = './sticker_packs';
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(collectedDir)) {
    fs.mkdirSync(collectedDir, { recursive: true });
}
if (!fs.existsSync(packDir)) {
    fs.mkdirSync(packDir, { recursive: true });
}

// Load collected stickers
function loadCollectedStickers() {
    try {
        const data = fs.readFileSync(collectedStickersFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading collected stickers:', error);
        return {};
    }
}

// Save collected stickers
function saveCollectedStickers(data) {
    try {
        fs.writeFileSync(collectedStickersFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving collected stickers:', error);
    }
}

// Load sticker packs data
function loadStickerPacks() {
    try {
        const data = fs.readFileSync(stickerPackFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading sticker packs:', error);
        return {};
    }
}

// Save sticker packs data
function saveStickerPacks(data) {
    try {
        fs.writeFileSync(stickerPackFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving sticker packs:', error);
    }
}

// Load config
function loadConfig() {
    try {
        const data = fs.readFileSync(stickerConfigFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading config:', error);
        return {
            defaultCollectionTime: 120,
            maxStickersPerPack: 30,
            autoCollect: true,
            maxStickersPerCollection: 100
        };
    }
}

// Save config
function saveConfig(config) {
    try {
        fs.writeFileSync(stickerConfigFile, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Store stickers when they're sent (for future use)
const activeCollections = {}; // Track active collections per chat
const collectionTimers = {}; // Track collection timers per chat

// Function to collect stickers in real-time with detailed logging
function setupStickerCollector(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const newMsg = messages[0];
        
        if (!newMsg || !newMsg.key.remoteJid?.endsWith('@g.us')) return;
        
        const chatId = newMsg.key.remoteJid;
        
        // Skip if from bot itself
        if (newMsg.key.fromMe) return;
        
        if (newMsg.message?.stickerMessage) {
            const config = loadConfig();
            
            // Check if collection is active for this chat
            if (!activeCollections[chatId] && !config.autoCollect) {
                return;
            }
            
            // Load collected stickers for this chat
            const collectedStickers = loadCollectedStickers();
            if (!collectedStickers[chatId]) {
                collectedStickers[chatId] = [];
            }
            
            const stickers = collectedStickers[chatId];
            const configData = loadConfig();
            
            // Check if we've reached max collection limit
            if (stickers.length >= configData.maxStickersPerCollection) {
                console.log('\x1b[33m%s\x1b[0m', `⚠️ Max collection limit reached for ${chatId}: ${stickers.length}/${configData.maxStickersPerCollection}`);
                return;
            }
            
            const stickerId = newMsg.message.stickerMessage.fileSha256?.toString('base64') || 
                            newMsg.key.id;
            
            // Avoid duplicates
            const isDuplicate = stickers.some(s => s.id === stickerId);
            
            if (!isDuplicate) {
                // Get sender info for logging
                const sender = newMsg.key.participant || newMsg.key.remoteJid;
                const senderNumber = sender.split('@')[0];
                
                // Create sticker entry
                const stickerEntry = {
                    id: stickerId,
                    messageKey: newMsg.key,
                    stickerMessage: newMsg.message.stickerMessage,
                    timestamp: Date.now(),
                    sender: sender,
                    senderNumber: senderNumber,
                    saved: false,
                    filePath: ''
                };
                
                stickers.push(stickerEntry);
                
                // Save immediately to file
                saveCollectedStickers(collectedStickers);
                
                // Log to console with colorful output
                console.log('\x1b[32m%s\x1b[0m', '🎭 STICKER DETECTED AND SAVED!');
                console.log('\x1b[36m%s\x1b[0m', `📱 From: ${senderNumber}`);
                console.log('\x1b[36m%s\x1b[0m', `💬 Chat: ${chatId}`);
                console.log('\x1b[36m%s\x1b[0m', `🆔 Sticker ID: ${stickerId.substring(0, 10)}...`);
                console.log('\x1b[36m%s\x1b[0m', `📊 Total collected: ${stickers.length}/${configData.maxStickersPerCollection}`);
                console.log('\x1b[32m%s\x1b[0m', '✅ Sticker saved to file!\n');
                
                // If collection is active, download the sticker immediately
                if (activeCollections[chatId]) {
                    try {
                        await downloadAndSaveSticker(sock, newMsg, chatId, stickerEntry);
                    } catch (error) {
                        console.log('\x1b[31m%s\x1b[0m', `❌ Failed to download sticker: ${error.message}`);
                    }
                }
            }
        }
    });
}

// Download and save sticker to file
async function downloadAndSaveSticker(sock, msg, chatId, stickerEntry) {
    try {
        console.log('\x1b[36m%s\x1b[0m', `⬇️ Downloading sticker from chat: ${chatId}`);
        
        // Download sticker
        let buffer;
        try {
            buffer = await sock.downloadMediaMessage(msg);
        } catch (error) {
            console.log('\x1b[33m%s\x1b[0m', `⚠️ Standard download failed, trying alternative...`);
            
            // Alternative method using downloadContentFromMessage
            try {
                const stream = await downloadContentFromMessage(msg.message.stickerMessage, 'sticker');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
            } catch (error2) {
                console.log('\x1b[31m%s\x1b[0m', `❌ Both download methods failed`);
                return null;
            }
        }
        
        if (!buffer || buffer.length === 0) {
            console.log('\x1b[31m%s\x1b[0m', `❌ Downloaded empty buffer`);
            return null;
        }
        
        // Create chat directory if it doesn't exist
        const chatDir = path.join(collectedDir, chatId.replace('@g.us', ''));
        if (!fs.existsSync(chatDir)) {
            fs.mkdirSync(chatDir, { recursive: true });
        }
        
        // Save sticker to file
        const filename = `${stickerEntry.id.substring(0, 16)}_${Date.now()}.webp`;
        const filePath = path.join(chatDir, filename);
        
        fs.writeFileSync(filePath, buffer);
        
        // Update sticker entry with file info
        stickerEntry.saved = true;
        stickerEntry.filePath = filePath;
        stickerEntry.fileSize = buffer.length;
        stickerEntry.downloadedAt = new Date().toISOString();
        
        console.log('\x1b[32m%s\x1b[0m', `✅ Sticker saved to: ${filePath}`);
        console.log('\x1b[36m%s\x1b[0m', `📁 File size: ${(buffer.length / 1024).toFixed(2)} KB\n`);
        
        // Update collected stickers file
        const collectedStickers = loadCollectedStickers();
        const chatStickers = collectedStickers[chatId] || [];
        const stickerIndex = chatStickers.findIndex(s => s.id === stickerEntry.id);
        if (stickerIndex !== -1) {
            chatStickers[stickerIndex] = stickerEntry;
            collectedStickers[chatId] = chatStickers;
            saveCollectedStickers(collectedStickers);
        }
        
        return filePath;
        
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', `❌ Download error: ${error.message}\n`);
        return null;
    }
}

// Download all collected stickers for a chat
async function downloadAllStickers(sock, chatId) {
    try {
        const collectedStickers = loadCollectedStickers();
        const chatStickers = collectedStickers[chatId] || [];
        
        if (chatStickers.length === 0) {
            return 0;
        }
        
        console.log('\x1b[36m%s\x1b[0m', `⬇️ Downloading ${chatStickers.length} stickers for chat: ${chatId}`);
        
        let downloadedCount = 0;
        
        for (let i = 0; i < chatStickers.length; i++) {
            const sticker = chatStickers[i];
            
            if (!sticker.saved) {
                try {
                    // Reconstruct message object for download
                    const msgObj = {
                        key: sticker.messageKey,
                        message: { stickerMessage: sticker.stickerMessage }
                    };
                    
                    await downloadAndSaveSticker(sock, msgObj, chatId, sticker);
                    downloadedCount++;
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log('\x1b[31m%s\x1b[0m', `❌ Failed to download sticker ${i + 1}: ${error.message}`);
                }
            } else {
                downloadedCount++; // Already downloaded
            }
            
            // Show progress
            if ((i + 1) % 5 === 0 || i + 1 === chatStickers.length) {
                console.log('\x1b[36m%s\x1b[0m', `📊 Progress: ${i + 1}/${chatStickers.length} (${downloadedCount} downloaded)`);
            }
        }
        
        console.log('\x1b[32m%s\x1b[0m', `✅ Downloaded ${downloadedCount}/${chatStickers.length} stickers\n`);
        return downloadedCount;
        
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', `❌ Error downloading stickers: ${error.message}\n`);
        return 0;
    }
}

// Create tray icon for sticker pack (512x512 PNG)
async function createTrayIcon(packName, packId) {
    try {
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#128C7E'; // WhatsApp green
        ctx.fillRect(0, 0, 512, 512);
        
        // Add text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Split pack name into lines if needed
        const words = packName.split(' ');
        let lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > 450 && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        
        // Draw text lines
        const lineHeight = 50;
        const startY = 256 - ((lines.length - 1) * lineHeight) / 2;
        
        lines.forEach((line, index) => {
            ctx.fillText(line, 256, startY + (index * lineHeight));
        });
        
        // Add sticker icon
        ctx.font = '120px Arial';
        ctx.fillText('🎭', 256, 150);
        
        // Save icon
        const iconPath = path.join(tempDir, packId, 'tray_icon.png');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(iconPath, buffer);
        
        console.log('\x1b[32m%s\x1b[0m', `🎨 Created tray icon: ${iconPath}`);
        return iconPath;
        
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', `❌ Error creating tray icon: ${error.message}`);
        return null;
    }
}

// Create WhatsApp Sticker Pack (Android format)
async function createWhatsAppStickerPack(packId, packName, author, stickers) {
    try {
        const packFolder = path.join(packDir, packId);
        if (!fs.existsSync(packFolder)) {
            fs.mkdirSync(packFolder, { recursive: true });
        }
        
        // Create contents.json file (WhatsApp sticker pack manifest)
        const contents = {
            android_play_store_link: "",
            ios_app_store_link: "",
            sticker_packs: [
                {
                    identifier: packId,
                    name: packName,
                    publisher: author,
                    tray_image_file: "tray_icon.png",
                    publisher_email: "",
                    publisher_website: "",
                    privacy_policy_website: "",
                    license_agreement_website: "",
                    image_data_version: "1",
                    avoid_cache: false,
                    stickers: stickers.map((sticker, index) => ({
                        image_file: `sticker_${index + 1}.webp`,
                        emojis: ["😂"]
                    }))
                }
            ]
        };
        
        const contentsPath = path.join(packFolder, 'contents.json');
        fs.writeFileSync(contentsPath, JSON.stringify(contents, null, 2));
        
        // Copy tray icon
        const trayIconPath = path.join(tempDir, packId, 'tray_icon.png');
        if (fs.existsSync(trayIconPath)) {
            fs.copyFileSync(trayIconPath, path.join(packFolder, 'tray_icon.png'));
        }
        
        // Copy stickers to pack folder
        stickers.forEach((sticker, index) => {
            if (fs.existsSync(sticker.path)) {
                const destPath = path.join(packFolder, `sticker_${index + 1}.webp`);
                fs.copyFileSync(sticker.path, destPath);
            }
        });
        
        console.log('\x1b[32m%s\x1b[0m', `📦 Created WhatsApp sticker pack at: ${packFolder}`);
        
        // Create zip file (optional - for distribution)
        const zipPath = path.join(packDir, `${packId}.zip`);
        
        try {
            await execAsync(`cd "${packFolder}" && zip -r "${zipPath}" .`);
            console.log('\x1b[32m%s\x1b[0m', `📎 Created zip file: ${zipPath}`);
        } catch (zipError) {
            console.log('\x1b[33m%s\x1b[0m', `⚠️ Could not create zip file: ${zipError.message}`);
        }
        
        return {
            folder: packFolder,
            contentsPath: contentsPath,
            zipPath: zipPath,
            stickerCount: stickers.length
        };
        
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', `❌ Error creating sticker pack: ${error.message}`);
        return null;
    }
}

// Send sticker pack to WhatsApp
async function sendStickerPack(sock, chatId, packInfo, packName, author) {
    try {
        // Since WhatsApp doesn't have a direct API to send sticker packs,
        // we'll send the first sticker with pack metadata, which will create the pack
        
        const firstStickerPath = path.join(packInfo.folder, 'sticker_1.webp');
        
        if (!fs.existsSync(firstStickerPath)) {
            throw new Error('First sticker not found in pack');
        }
        
        const stickerBuffer = fs.readFileSync(firstStickerPath);
        
        // Send the first sticker with pack metadata
        // This will create the sticker pack in WhatsApp
        await sock.sendMessage(chatId, { 
            sticker: stickerBuffer 
        }, {
            packname: packName,
            author: author,
            categories: ['Custom Pack']
        });
        
        console.log('\x1b[32m%s\x1b[0m', `📤 Sent sticker pack starter: ${packName}`);
        
        // Send remaining stickers as part of the same pack
        for (let i = 2; i <= packInfo.stickerCount; i++) {
            try {
                const stickerPath = path.join(packInfo.folder, `sticker_${i}.webp`);
                if (fs.existsSync(stickerPath)) {
                    const nextStickerBuffer = fs.readFileSync(stickerPath);
                    
                    await sock.sendMessage(chatId, { 
                        sticker: nextStickerBuffer 
                    }, {
                        packname: packName,
                        author: author
                    });
                    
                    console.log('\x1b[32m%s\x1b[0m', `✅ Added sticker ${i}/${packInfo.stickerCount} to pack`);
                    
                    // Delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.log('\x1b[31m%s\x1b[0m', `❌ Error adding sticker ${i}: ${error.message}`);
            }
        }
        
        return true;
        
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', `❌ Error sending sticker pack: ${error.message}`);
        return false;
    }
}

// Create sticker pack from collected stickers
async function createAndSendStickerPack(sock, chatId, packName, sender) {
    try {
        // Load collected stickers
        const collectedStickers = loadCollectedStickers();
        const chatStickers = collectedStickers[chatId] || [];
        
        if (chatStickers.length === 0) {
            return {
                success: false,
                message: '❌ No stickers collected yet!\n\nUse `.stickerpack collect [time]` to start collecting stickers first.'
            };
        }
        
        console.log('\x1b[32m%s\x1b[0m', `🎨 Creating sticker pack: ${packName}`);
        console.log('\x1b[36m%s\x1b[0m', `📊 Found ${chatStickers.length} collected stickers\n`);
        
        // Filter only saved stickers
        let savedStickers = chatStickers.filter(s => s.saved && s.filePath && fs.existsSync(s.filePath));
        
        if (savedStickers.length === 0) {
            // Try to download stickers first
            await sock.sendMessage(chatId, { 
                text: `🔄 Downloading ${chatStickers.length} stickers first... This may take a moment.` 
            });
            
            const downloaded = await downloadAllStickers(sock, chatId);
            
            if (downloaded === 0) {
                return {
                    success: false,
                    message: '❌ Failed to download any stickers.\n\nTry sending new stickers and collect again.'
                };
            }
            
            // Reload stickers
            const updatedStickers = loadCollectedStickers()[chatId] || [];
            savedStickers = updatedStickers.filter(s => s.saved && s.filePath && fs.existsSync(s.filePath));
        }
        
        const config = loadConfig();
        const maxStickers = Math.min(savedStickers.length, config.maxStickersPerPack);
        
        if (maxStickers === 0) {
            return {
                success: false,
                message: '❌ No valid stickers found to create a pack.'
            };
        }
        
        console.log('\x1b[36m%s\x1b[0m', `📦 Processing ${maxStickers} saved stickers\n`);
        
        // Generate unique pack ID
        const packId = `wolfpack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tempPackDir = path.join(tempDir, packId);
        fs.mkdirSync(tempPackDir, { recursive: true });
        
        // Get group info for pack author
        let packAuthor = '';
        try {
            const groupInfo = await sock.groupMetadata(chatId);
            packAuthor = `From: ${groupInfo.subject}`;
        } catch (error) {
            packAuthor = `Group Stickers`;
        }
        
        // Process stickers for pack
        const processedStickers = [];
        
        for (let i = 0; i < maxStickers; i++) {
            try {
                const sticker = savedStickers[i];
                const stickerNumber = i + 1;
                
                console.log('\x1b[36m%s\x1b[0m', `--- Processing Sticker ${stickerNumber}/${maxStickers} ---`);
                
                // Read sticker file
                if (!fs.existsSync(sticker.filePath)) {
                    console.log('\x1b[31m%s\x1b[0m', `❌ Sticker file not found: ${sticker.filePath}`);
                    continue;
                }
                
                const buffer = fs.readFileSync(sticker.filePath);
                
                if (buffer.length > 0) {
                    // Copy sticker to temp pack directory
                    const stickerFileName = `sticker_${stickerNumber}.webp`;
                    const stickerPath = path.join(tempPackDir, stickerFileName);
                    
                    fs.copyFileSync(sticker.filePath, stickerPath);
                    
                    processedStickers.push({
                        path: stickerPath,
                        index: stickerNumber,
                        size: buffer.length
                    });
                    
                    console.log('\x1b[32m%s\x1b[0m', `✅ Sticker ${stickerNumber} added to pack\n`);
                }
                
            } catch (error) {
                console.log('\x1b[31m%s\x1b[0m', `❌ Error with sticker ${i + 1}: ${error.message}\n`);
            }
        }
        
        if (processedStickers.length === 0) {
            return {
                success: false,
                message: '❌ No stickers could be processed.\n\nTry collecting new stickers and try again.'
            };
        }
        
        // Create tray icon
        await createTrayIcon(packName, packId);
        
        // Create WhatsApp sticker pack
        const packInfo = await createWhatsAppStickerPack(packId, packName, packAuthor, processedStickers);
        
        if (!packInfo) {
            return {
                success: false,
                message: '❌ Failed to create sticker pack structure.'
            };
        }
        
        // Send sticker pack to WhatsApp
        console.log('\x1b[32m%s\x1b[0m', `📤 Sending sticker pack to WhatsApp...\n`);
        
        const sentSuccess = await sendStickerPack(sock, chatId, packInfo, packName, packAuthor);
        
        if (!sentSuccess) {
            return {
                success: false,
                message: '❌ Failed to send sticker pack to WhatsApp.'
            };
        }
        
        // Save pack info to database
        const stickerPacks = loadStickerPacks();
        const groupPacks = stickerPacks[chatId] || [];
        
        const newPack = {
            id: packId,
            name: packName,
            author: packAuthor,
            chatId: chatId,
            createdBy: sender,
            createdDate: new Date().toISOString(),
            stickerCount: processedStickers.length,
            packFolder: packInfo.folder,
            zipPath: packInfo.zipPath
        };
        
        groupPacks.push(newPack);
        stickerPacks[chatId] = groupPacks;
        saveStickerPacks(stickerPacks);
        
        // Clean up temporary directory after delay
        setTimeout(() => {
            try {
                if (fs.existsSync(tempPackDir)) {
                    fs.rmSync(tempPackDir, { recursive: true, force: true });
                    console.log('\x1b[33m%s\x1b[0m', `🗑️ Cleaned up temp directory: ${tempPackDir}\n`);
                }
            } catch (cleanupError) {
                console.log('\x1b[31m%s\x1b[0m', `❌ Error cleaning up: ${cleanupError.message}\n`);
            }
        }, 30000); // 30 seconds delay
        
        return {
            success: true,
            message: `✅ *Sticker Pack Created and Sent!*\n\n📦 *Pack Name:* ${packName}\n🎭 *Stickers:* ${processedStickers.length} stickers\n👤 *Author:* ${packAuthor}\n📅 *Created by:* @${sender.split('@')[0]}\n\nThe sticker pack has been created and sent to this chat! All stickers are now part of the *${packName}* pack.\n\n*Note:* In WhatsApp, stickers will appear under the same pack name.`,
            stats: {
                processed: processedStickers.length,
                totalCollected: chatStickers.length,
                packId: packId
            }
        };
        
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', `❌ Pack creation error: ${error.message}\n`);
        return {
            success: false,
            message: `❌ Failed to create sticker pack.\n\nError: ${error.message}`
        };
    }
}

// Start collection timer for a chat
function startCollectionTimer(chatId, duration, sock) {
    if (collectionTimers[chatId]) {
        clearTimeout(collectionTimers[chatId]);
    }
    
    console.log('\x1b[36m%s\x1b[0m', `⏰ Starting ${duration}-second collection timer for chat: ${chatId}`);
    
    collectionTimers[chatId] = setTimeout(async () => {
        const collectedStickers = loadCollectedStickers();
        const count = collectedStickers[chatId]?.length || 0;
        
        console.log('\x1b[33m%s\x1b[0m', `⏰ Collection timer ended for ${chatId}`);
        console.log('\x1b[36m%s\x1b[0m', `📊 Total stickers collected: ${count}\n`);
        
        // Stop active collection
        activeCollections[chatId] = false;
        delete collectionTimers[chatId];
        
        // Download all collected stickers
        await downloadAllStickers(sock, chatId);
        
        // Notify group
        if (count > 0) {
            try {
                await sock.sendMessage(chatId, { 
                    text: `✅ *Collection Period Ended!*\n\n🎭 Collected ${count} stickers!\n📁 Stickers have been saved to storage.\n\nNow you can use \`.stickerpack create [name]\` to make a pack!\n\nNote: You can continue collecting more stickers or create a pack now.` 
                });
            } catch (error) {
                console.log('\x1b[31m%s\x1b[0m', `❌ Failed to send notification: ${error.message}`);
            }
        }
        
    }, duration * 1000);
}

// Clear collected stickers for a chat
function clearCollectedStickers(chatId) {
    const collectedStickers = loadCollectedStickers();
    const oldCount = collectedStickers[chatId]?.length || 0;
    
    // Delete sticker files
    if (collectedStickers[chatId]) {
        collectedStickers[chatId].forEach(sticker => {
            if (sticker.filePath && fs.existsSync(sticker.filePath)) {
                try {
                    fs.unlinkSync(sticker.filePath);
                } catch (error) {
                    console.log('\x1b[31m%s\x1b[0m', `❌ Error deleting file: ${sticker.filePath}`);
                }
            }
        });
    }
    
    // Clear from memory
    collectedStickers[chatId] = [];
    saveCollectedStickers(collectedStickers);
    
    // Delete chat directory
    const chatDir = path.join(collectedDir, chatId.replace('@g.us', ''));
    if (fs.existsSync(chatDir)) {
        try {
            fs.rmSync(chatDir, { recursive: true, force: true });
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', `❌ Error deleting chat directory: ${error.message}`);
        }
    }
    
    return oldCount;
}

// Initialize sticker collector
let stickerCollectorSetup = false;

export default {
    name: 'stickerpack',
    description: 'Create and send a WhatsApp sticker pack from collected stickers',
    category: 'group',
    async execute(sock, msg, args, metadata) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        if (!isGroup) {
            return sock.sendMessage(chatId, { 
                text: '❌ This command can only be used in groups.' 
            }, { quoted: msg });
        }

        // Setup sticker collector if not already done
        if (!stickerCollectorSetup) {
            setupStickerCollector(sock);
            stickerCollectorSetup = true;
            console.log('\x1b[32m%s\x1b[0m', '🎭 Sticker collector initialized!\n');
        }

        // Get sender's JID
        let sender = msg.key.participant || (msg.key.fromMe ? sock.user.id : msg.key.remoteJid);
        sender = cleanJid(sender);

        // Check if user is admin
        let isAdmin = false;
        
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const cleanSender = cleanJid(sender);
            
            const participant = groupMetadata.participants.find(p => {
                const cleanParticipantJid = cleanJid(p.id);
                return cleanParticipantJid === cleanSender;
            });
            
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
        } catch (error) {
            console.error('Error fetching group metadata:', error);
            return sock.sendMessage(chatId, { 
                text: '❌ Failed to fetch group information.' 
            }, { quoted: msg });
        }

        // Only admins can create packs
        if (!isAdmin && !['stats', 'list', 'help'].includes(args[0]?.toLowerCase())) {
            return sock.sendMessage(chatId, { 
                text: '❌ Only group admins can manage sticker packs!' 
            }, { quoted: msg });
        }

        const subCommand = args[0]?.toLowerCase() || 'help';

        if (subCommand === 'create') {
            // Create and send sticker pack from collected stickers
            const packName = args.slice(1).join(' ') || 'WolfPack';
            
            // Check if collection is active
            if (activeCollections[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '⚠️ *Collection in Progress*\n\nPlease wait for the current collection to finish, or use `.stickerpack stop` to stop collection first.' 
                }, { quoted: msg });
            }
            
            // Start pack creation
            await sock.sendMessage(chatId, { 
                text: `🔄 *Creating Sticker Pack: ${packName}*\n\nGathering all collected stickers...\n\n*Note:* This will create a proper WhatsApp sticker pack with tray icon and metadata.` 
            }, { quoted: msg });
            
            const result = await createAndSendStickerPack(sock, chatId, packName, sender);
            
            return sock.sendMessage(chatId, { 
                text: result.message,
                mentions: result.success ? [sender] : []
            }, { quoted: msg });

        } else if (subCommand === 'collect') {
            // Start manual collection with configurable time
            let duration = parseInt(args[1]) || loadConfig().defaultCollectionTime;
            
            if (duration < 10) {
                duration = 10; // Minimum 10 seconds
            }
            if (duration > 600) {
                duration = 600; // Maximum 10 minutes
            }
            
            // Check if already collecting
            if (activeCollections[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '⚠️ *Already Collecting!*\n\nA collection is already in progress. Use `.stickerpack stop` to stop current collection.' 
                }, { quoted: msg });
            }
            
            // Start active collection
            activeCollections[chatId] = true;
            
            const collectedStickers = loadCollectedStickers();
            const startCount = collectedStickers[chatId]?.length || 0;
            const config = loadConfig();
            
            console.log('\x1b[32m%s\x1b[0m', `🎭 Starting sticker collection for ${duration} seconds`);
            console.log('\x1b[36m%s\x1b[0m', `💬 Chat: ${chatId}`);
            console.log('\x1b[36m%s\x1b[0m', `📊 Starting with ${startCount} stickers already collected\n`);
            
            await sock.sendMessage(chatId, { 
                text: `📥 *Sticker Collection Started!*\n\nI will collect stickers for *${duration} seconds*.\n\n*Send stickers now!* Every sticker sent will be saved.\n\n⏰ Duration: ${duration} seconds\n📊 Already collected: ${startCount} stickers\n📈 Max limit: ${config.maxStickersPerCollection} stickers\n\nAfter collection, use \`.stickerpack create [name]\` to make a pack!` 
            }, { quoted: msg });

            // Start collection timer
            startCollectionTimer(chatId, duration, sock);
            
            // Send time update
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const timeText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            
            await sock.sendMessage(chatId, { 
                text: `⏰ Collection will run for ${timeText}. Start sending stickers!` 
            });

        } else if (subCommand === 'stop') {
            // Stop active collection
            if (!activeCollections[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '⚠️ *No Active Collection*\n\nThere is no active sticker collection to stop.' 
                }, { quoted: msg });
            }
            
            activeCollections[chatId] = false;
            
            if (collectionTimers[chatId]) {
                clearTimeout(collectionTimers[chatId]);
                delete collectionTimers[chatId];
            }
            
            const collectedStickers = loadCollectedStickers();
            const count = collectedStickers[chatId]?.length || 0;
            
            await sock.sendMessage(chatId, { 
                text: `🛑 *Collection Stopped!*\n\n🎭 Total stickers collected: ${count}\n\nUse \`.stickerpack create [name]\` to make a pack now!` 
            }, { quoted: msg });
            
            // Download collected stickers
            await downloadAllStickers(sock, chatId);

        } else if (subCommand === 'clear') {
            // Clear collected stickers
            const oldCount = clearCollectedStickers(chatId);
            
            console.log('\x1b[33m%s\x1b[0m', `🧹 Cleared ${oldCount} stickers from chat: ${chatId}\n`);
            
            await sock.sendMessage(chatId, { 
                text: `🧹 *Cleared All Stickers!*\n\nDeleted ${oldCount} collected stickers.\n\nSend new stickers and use \`.stickerpack collect\` to start fresh.` 
            }, { quoted: msg });

        } else if (subCommand === 'stats') {
            // Show detailed stats
            const collectedStickers = loadCollectedStickers();
            const chatStickers = collectedStickers[chatId] || [];
            const savedStickers = chatStickers.filter(s => s.saved).length;
            const unsavedStickers = chatStickers.length - savedStickers;
            
            const stickerPacks = loadStickerPacks();
            const groupPacks = stickerPacks[chatId] || [];
            const totalPacks = groupPacks.length;
            const totalStickersInPacks = groupPacks.reduce((sum, pack) => sum + pack.stickerCount, 0);
            
            const config = loadConfig();
            const isCollecting = !!activeCollections[chatId];
            
            const statsText = `📊 *Sticker Pack Statistics*\n\n` +
                             `🎭 *Collected Stickers:* ${chatStickers.length}\n` +
                             `💾 Saved to files: ${savedStickers}\n` +
                             `⏳ Pending save: ${unsavedStickers}\n` +
                             `📦 *Total packs created:* ${totalPacks}\n` +
                             `✨ *Total stickers in packs:* ${totalStickersInPacks}\n` +
                             `⏰ *Currently collecting:* ${isCollecting ? 'Yes' : 'No'}\n` +
                             `⏱️ *Default collection time:* ${config.defaultCollectionTime}s\n` +
                             `📈 *Max collection limit:* ${config.maxStickersPerCollection}\n` +
                             `🎯 *Max per pack:* ${config.maxStickersPerPack}\n\n` +
                             `\n╭─⌈ 📦 *STICKER PACK COMMANDS* ⌋\n│\n├─⊷ *.stickerpack create [name]*\n│  └⊷ Make new WhatsApp pack\n├─⊷ *.stickerpack collect [time]*\n│  └⊷ Collect stickers\n├─⊷ *.stickerpack stop*\n│  └⊷ Stop collection\n├─⊷ *.stickerpack clear*\n│  └⊷ Clear all stickers\n├─⊷ *.stickerpack time [seconds]*\n│  └⊷ Set collection time\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            
            await sock.sendMessage(chatId, { text: statsText }, { quoted: msg });

        } else if (subCommand === 'list') {
            // List sticker packs
            const stickerPacks = loadStickerPacks();
            const groupPacks = stickerPacks[chatId] || [];
            
            if (groupPacks.length === 0) {
                await sock.sendMessage(chatId, { 
                    text: '📭 No sticker packs created for this group yet.\n\nCreate one with `.stickerpack create [name]`' 
                }, { quoted: msg });
                return;
            }

            let listText = `📦 *Sticker Packs for This Group*\n\n`;
            
            groupPacks.forEach((pack, index) => {
                listText += `${index + 1}. *${pack.name}*\n`;
                listText += `   • Stickers: ${pack.stickerCount}\n`;
                listText += `   • Created: ${new Date(pack.createdDate).toLocaleDateString()}\n`;
                listText += `   • By: @${pack.createdBy.split('@')[0]}\n\n`;
            });

            listText += `\nTotal Packs: ${groupPacks.length}\n\nView details: \`.stickerpack info [number]\``;
            
            await sock.sendMessage(chatId, { text: listText }, { quoted: msg });

        } else if (subCommand === 'info') {
            // Show pack info
            const stickerPacks = loadStickerPacks();
            const groupPacks = stickerPacks[chatId] || [];
            const packIndex = parseInt(args[1]) - 1;
            
            if (isNaN(packIndex) || packIndex < 0 || packIndex >= groupPacks.length) {
                await sock.sendMessage(chatId, { 
                    text: `❌ Please specify a valid pack number (1-${groupPacks.length}).\n\nUse \`.stickerpack list\` to see available packs.` 
                }, { quoted: msg });
                return;
            }

            const pack = groupPacks[packIndex];
            
            const infoText = `📋 *Sticker Pack Info*\n\n` +
                            `📦 *Name:* ${pack.name}\n` +
                            `👤 *Author:* ${pack.author}\n` +
                            `🎭 *Sticker Count:* ${pack.stickerCount}\n` +
                            `📅 *Created:* ${new Date(pack.createdDate).toLocaleString()}\n` +
                            `👨‍💻 *Created by:* @${pack.createdBy.split('@')[0]}\n` +
                            `💬 *Chat:* ${pack.chatId}\n\n` +
                            `*Pack ID:* ${pack.id.substring(0, 15)}...`;
            
            await sock.sendMessage(chatId, { 
                text: infoText,
                mentions: [pack.createdBy]
            }, { quoted: msg });

        } else if (subCommand === 'time') {
            // Configure collection time
            if (args[1]) {
                const newTime = parseInt(args[1]);
                if (isNaN(newTime) || newTime < 10 || newTime > 600) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please specify a time between 10 and 600 seconds.' 
                    }, { quoted: msg });
                    return;
                }
                
                const config = loadConfig();
                config.defaultCollectionTime = newTime;
                saveConfig(config);
                
                await sock.sendMessage(chatId, { 
                    text: `⚙️ *Collection Time Updated*\n\nDefault collection time set to *${newTime} seconds*\n\nUse \`.stickerpack collect\` without time to use this default.` 
                }, { quoted: msg });
            } else {
                const config = loadConfig();
                await sock.sendMessage(chatId, { 
                    text: `⚙️ *Current Collection Time*\n\nDefault: *${config.defaultCollectionTime} seconds*\n\nTo change: \`.stickerpack time [seconds]\`\n\nMin: 10s, Max: 600s (10 minutes)` 
                }, { quoted: msg });
            }

        } else {
            // Show help
            const config = loadConfig();
            const helpText = `╭─⌈ 📦 *STICKER PACK CREATOR* ⌋\n│\n├─⊷ *.stickerpack create [name]*\n│  └⊷ Create WhatsApp pack\n├─⊷ *.stickerpack collect [seconds]*\n│  └⊷ Start collecting\n├─⊷ *.stickerpack stop*\n│  └⊷ Stop current collection\n├─⊷ *.stickerpack time [seconds]*\n│  └⊷ Set collection time\n├─⊷ *.stickerpack list*\n│  └⊷ List all packs\n├─⊷ *.stickerpack info [number]*\n│  └⊷ Show pack details\n├─⊷ *.stickerpack stats*\n│  └⊷ Show statistics\n├─⊷ *.stickerpack clear*\n│  └⊷ Clear stickers\n├─⊷ *.stickerpack help*\n│  └⊷ Show this help\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        }
    }
};