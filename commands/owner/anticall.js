// import fs from 'fs';

// const antiCallFile = './anticall.json';

// // Ensure JSON file exists
// if (!fs.existsSync(antiCallFile)) {
//     const initialData = {
//         settings: {},
//         callLogs: [],
//         blockedNumbers: []
//     };
//     fs.writeFileSync(antiCallFile, JSON.stringify(initialData, null, 2));
// }

// // Load anti-call settings
// function loadAntiCall() {
//     try {
//         const data = fs.readFileSync(antiCallFile, 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Error loading anti-call settings:', error);
//         return { settings: {}, callLogs: [], blockedNumbers: [] };
//     }
// }

// // Save anti-call settings
// function saveAntiCall(data) {
//     try {
//         fs.writeFileSync(antiCallFile, JSON.stringify(data, null, 2));
//     } catch (error) {
//         console.error('Error saving anti-call settings:', error);
//     }
// }

// // Utility function to clean JID
// function cleanJid(jid) {
//     if (!jid) return jid;
    
//     // Remove device suffix if present
//     const clean = jid.split(':')[0];
    
//     // If it already has a domain, return as is
//     if (clean.includes('@')) {
//         return clean;
//     }
    
//     // Otherwise, assume it's a regular WhatsApp number
//     return clean + '@s.whatsapp.net';
// }

// // Setup anti-call listener
// let antiCallListenerAttached = false;

// // Track handled calls to avoid duplicates
// const handledCalls = new Map();
// const sentMessages = new Map();

// // Clean up old entries periodically
// setInterval(() => {
//     const now = Date.now();
//     const fiveMinutes = 5 * 60 * 1000;
    
//     for (const [callId, timestamp] of handledCalls.entries()) {
//         if (now - timestamp > fiveMinutes) {
//             handledCalls.delete(callId);
//         }
//     }
    
//     for (const [callId, timestamp] of sentMessages.entries()) {
//         if (now - timestamp > fiveMinutes) {
//             sentMessages.delete(callId);
//         }
//     }
// }, 60000); // Clean every minute

// export default {
//     name: 'anticall',
//     description: 'Manage automatic call handling and blocking',
//     category: 'utility',
//     async execute(sock, msg, args, metadata) {
//         const chatId = msg.key.remoteJid;
        
//         // Get sender's JID
//         let sender = msg.key.participant || (msg.key.fromMe ? sock.user.id : msg.key.remoteJid);
//         sender = cleanJid(sender);
        
//         // Load settings
//         const antiCallData = loadAntiCall();
//         const settings = antiCallData.settings || {};
//         const blockedNumbers = antiCallData.blockedNumbers || [];
//         const callLogs = antiCallData.callLogs || [];
        
//         const subCommand = args[0]?.toLowerCase();
//         const action = args[1]?.toLowerCase();
        
//         // Get bot's JID for settings
//         const botJid = cleanJid(sock.user?.id);
        
//         // Attach listener if not already attached
//         if (!antiCallListenerAttached) {
//             setupAntiCallListener(sock);
//             antiCallListenerAttached = true;
//         }
        
//         // Handle different subcommands
//         if (subCommand === 'status') {
//             const userSettings = settings[botJid] || {
//                 enabled: false,
//                 mode: 'decline',
//                 autoMessage: false,
//                 message: "Sorry, I don't accept calls. Please message me instead."
//             };
            
//             let statusText = `📞 *Anti-call Status*\n\n`;
//             statusText += `• Enabled: ${userSettings.enabled ? '✅ Yes' : '❌ No'}\n`;
//             statusText += `• Bot JID: ${botJid}\n`;
            
//             if (userSettings.enabled) {
//                 statusText += `• Mode: ${userSettings.mode.toUpperCase()}\n`;
//                 statusText += `• Auto Message: ${userSettings.autoMessage ? '✅ Yes' : '❌ No'}\n`;
//                 if (userSettings.autoMessage) {
//                     statusText += `• Message: ${userSettings.message}\n`;
//                 }
//             }
            
//             statusText += `\n📊 *Statistics*\n`;
//             statusText += `• Blocked numbers: ${blockedNumbers.length}\n`;
//             statusText += `• Total calls handled: ${callLogs.length}\n`;
//             statusText += `• Currently tracking: ${handledCalls.size} calls\n`;
            
//             // Show last 5 calls
//             if (callLogs.length > 0) {
//                 statusText += `\n📝 *Recent Calls:*\n`;
//                 const recentCalls = callLogs.slice(-5).reverse();
//                 recentCalls.forEach((log, index) => {
//                     const time = new Date(log.timestamp).toLocaleTimeString();
//                     const date = new Date(log.timestamp).toLocaleDateString();
//                     statusText += `${index + 1}. ${log.from} (${date} ${time}) - ${log.action}\n`;
//                 });
//             }
            
//             // Show listener status
//             statusText += `\n🔧 *Listener Status:* ${antiCallListenerAttached ? '✅ Active' : '❌ Inactive'}`;
            
//             await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
//         }
//         else if (subCommand === 'enable') {
//             if (!action || !['decline', 'block'].includes(action)) {
//                 return sock.sendMessage(chatId, { 
//                     text: '⚙️ *Anti-call Setup*\n\nUsage: `.anticall enable [mode]`\n\nAvailable modes:\n• `decline` - Automatically decline calls\n• `block` - Automatically block callers\n\nExample: `.anticall enable decline`' 
//                 }, { quoted: msg });
//             }
            
//             settings[botJid] = {
//                 enabled: true,
//                 mode: action,
//                 autoMessage: settings[botJid]?.autoMessage || false,
//                 message: settings[botJid]?.message || "Sorry, I don't accept calls. Please message me instead.",
//                 lastUpdated: new Date().toISOString()
//             };
            
//             antiCallData.settings = settings;
//             saveAntiCall(antiCallData);
            
//             await sock.sendMessage(chatId, { 
//                 text: `✅ *Anti-call enabled!*\n\nBot JID: ${botJid}\nMode: *${action.toUpperCase()}*\n\nCalls will now be automatically ${action === 'block' ? 'blocked' : 'declined'}.\n\nTo set an auto-reply message:\n\`.anticall message [your message]\`\n\nTo disable: \`.anticall disable\`` 
//             }, { quoted: msg });
//         }
//         else if (subCommand === 'disable') {
//             if (settings[botJid]) {
//                 settings[botJid].enabled = false;
//                 antiCallData.settings = settings;
//                 saveAntiCall(antiCallData);
//                 await sock.sendMessage(chatId, { 
//                     text: '❌ *Anti-call disabled!*\n\nCalls will now come through normally.' 
//                 }, { quoted: msg });
//             } else {
//                 await sock.sendMessage(chatId, { 
//                     text: 'ℹ️ Anti-call is already disabled for your account.' 
//                 }, { quoted: msg });
//             }
//         }
//         else if (subCommand === 'message') {
//             const messageText = args.slice(1).join(' ').trim();
            
//             if (!messageText) {
//                 return sock.sendMessage(chatId, { 
//                     text: 'Usage: `.anticall message [your message]`\n\nExample: `.anticall message Sorry, I don\'t accept calls. Please send a text message instead.`' 
//                 }, { quoted: msg });
//             }
            
//             if (!settings[botJid]) {
//                 settings[botJid] = {
//                     enabled: false,
//                     mode: 'decline',
//                     autoMessage: true,
//                     message: messageText,
//                     lastUpdated: new Date().toISOString()
//                 };
//             } else {
//                 settings[botJid].autoMessage = true;
//                 settings[botJid].message = messageText;
//                 settings[botJid].lastUpdated = new Date().toISOString();
//             }
            
//             antiCallData.settings = settings;
//             saveAntiCall(antiCallData);
            
//             await sock.sendMessage(chatId, { 
//                 text: `✅ *Auto-reply message set!*\n\nMessage: "${messageText}"\n\nThis message will be sent after ${settings[botJid]?.mode === 'block' ? 'blocking' : 'declining'} a call.\n\nTo enable anti-call: \`.anticall enable [decline/block]\`` 
//             }, { quoted: msg });
//         }
//         else if (subCommand === 'nomessage') {
//             if (!settings[botJid]) {
//                 settings[botJid] = {
//                     enabled: settings[botJid]?.enabled || false,
//                     mode: settings[botJid]?.mode || 'decline',
//                     autoMessage: false,
//                     message: "Sorry, I don't accept calls. Please message me instead.",
//                     lastUpdated: new Date().toISOString()
//                 };
//             } else {
//                 settings[botJid].autoMessage = false;
//                 settings[botJid].lastUpdated = new Date().toISOString();
//             }
            
//             antiCallData.settings = settings;
//             saveAntiCall(antiCallData);
            
//             await sock.sendMessage(chatId, { 
//                 text: '✅ *Auto-reply message disabled!*\n\nNo messages will be sent after calls.\n\nTo enable again: `.anticall message [your message]`' 
//             }, { quoted: msg });
//         }
//         else if (subCommand === 'clearhandled') {
//             handledCalls.clear();
//             sentMessages.clear();
//             await sock.sendMessage(chatId, { 
//                 text: '✅ *Cleared call tracking cache!*\n\nThe bot will now track new calls from scratch.' 
//             }, { quoted: msg });
//         }
//         else if (subCommand === 'debug') {
//             // Debug command to see what's happening
//             let debugText = `🔍 *Anti-call Debug Info*\n\n`;
//             debugText += `• Bot JID: ${botJid}\n`;
//             debugText += `• Listener attached: ${antiCallListenerAttached}\n`;
//             debugText += `• Currently tracking: ${handledCalls.size} calls\n`;
//             debugText += `• Messages sent tracking: ${sentMessages.size}\n`;
//             debugText += `• Current settings for bot:\n`;
            
//             const botSettings = settings[botJid];
//             if (botSettings) {
//                 for (const [key, value] of Object.entries(botSettings)) {
//                     debugText += `  ${key}: ${value}\n`;
//                 }
//             } else {
//                 debugText += `  No settings found\n`;
//             }
            
//             debugText += `\n• Total blocked numbers: ${blockedNumbers.length}\n`;
//             debugText += `• Total call logs: ${callLogs.length}\n`;
            
//             // Show currently tracked calls
//             if (handledCalls.size > 0) {
//                 debugText += `\n📞 *Currently tracked calls:*\n`;
//                 let i = 1;
//                 for (const [callId, timestamp] of handledCalls.entries()) {
//                     const timeAgo = Date.now() - timestamp;
//                     debugText += `${i}. ${callId} - ${Math.floor(timeAgo / 1000)}s ago\n`;
//                     i++;
//                 }
//             }
            
//             await sock.sendMessage(chatId, { text: debugText }, { quoted: msg });
//         }
//         else if (subCommand === 'test') {
//             // Test the anti-call feature
//             const testNumber = args[1] || '1234567890@s.whatsapp.net';
//             const botSettings = settings[botJid] || {
//                 enabled: false,
//                 mode: 'decline',
//                 autoMessage: false,
//                 message: "Test message"
//             };
            
//             let testText = `🔍 *Anti-call Test*\n\n`;
//             testText += `Test from: ${testNumber}\n`;
//             testText += `Bot JID: ${botJid}\n`;
//             testText += `Enabled: ${botSettings.enabled ? 'Yes' : 'No'}\n`;
            
//             if (botSettings.enabled) {
//                 testText += `Mode: ${botSettings.mode}\n`;
//                 testText += `Auto Message: ${botSettings.autoMessage ? 'Yes' : 'No'}\n`;
//                 if (botSettings.autoMessage) {
//                     testText += `Message: ${botSettings.message}\n`;
//                 }
//                 testText += `\n✅ Would ${botSettings.mode === 'block' ? 'block and decline' : 'decline'} call from ${testNumber}`;
//             } else {
//                 testText += `\n❌ Anti-call is disabled. Calls would come through normally.`;
//             }
            
//             await sock.sendMessage(chatId, { text: testText }, { quoted: msg });
//         }
//         else if (subCommand === 'blocklist') {
//             if (blockedNumbers.length === 0) {
//                 await sock.sendMessage(chatId, { 
//                     text: '📋 *Blocked Numbers*\n\nNo numbers are currently blocked.\n\nBlock a number: `.anticall block [number]`' 
//                 }, { quoted: msg });
//             } else {
//                 let listText = '📋 *Blocked Numbers*\n\n';
//                 blockedNumbers.forEach((number, index) => {
//                     const time = new Date(number.blockedAt).toLocaleString();
//                     listText += `${index + 1}. ${number.number}\n   Blocked: ${time}\n`;
//                     if (number.reason) {
//                         listText += `   Reason: ${number.reason}\n`;
//                     }
//                     listText += '\n';
//                 });
//                 listText += `Total: ${blockedNumbers.length} numbers\n\nUnblock: \`.anticall unblock [number]\``;
                
//                 await sock.sendMessage(chatId, { text: listText }, { quoted: msg });
//             }
//         }
//         else if (subCommand === 'logs') {
//             const limit = parseInt(args[1]) || 10;
//             const filteredLogs = callLogs.slice(-limit).reverse();
            
//             if (filteredLogs.length === 0) {
//                 await sock.sendMessage(chatId, { 
//                     text: '📝 *Call Logs*\n\nNo calls have been handled yet.' 
//                 }, { quoted: msg });
//             } else {
//                 let logsText = `📝 *Call Logs* (Last ${filteredLogs.length})\n\n`;
                
//                 filteredLogs.forEach((log, index) => {
//                     const time = new Date(log.timestamp).toLocaleTimeString();
//                     const date = new Date(log.timestamp).toLocaleDateString();
//                     logsText += `${index + 1}. *From:* ${log.from}\n`;
//                     logsText += `   *Time:* ${date} ${time}\n`;
//                     logsText += `   *Action:* ${log.action.toUpperCase()}\n`;
//                     if (log.messageSent) {
//                         logsText += `   *Message:* Sent\n`;
//                     }
//                     logsText += '\n';
//                 });
                
//                 logsText += `Total calls: ${callLogs.length}`;
                
//                 await sock.sendMessage(chatId, { text: logsText }, { quoted: msg });
//             }
//         }
//         else {
//             // Show help
//             const helpText = `📞 *Anti-call Command*

// • \`.anticall enable [decline/block]\` 
// • \`.anticall disable\` 
// • \`.anticall status\` 
// • \`.anticall message [text]\` 
// • \`.anticall nomessage\` 
// • \`.anticall clearhandled\`
// • \`.anticall blocklist\` 
// `;

//             await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
//         }
//     }
// };

// function setupAntiCallListener(sock) {
//     console.log('🔧 Setting up anti-call listener...');
    
//     // Listen for incoming calls
//     sock.ev.on('call', async (callArray) => {
//         try {
//             // Handle both single call and array of calls
//             const calls = Array.isArray(callArray) ? callArray : [callArray];
            
//             for (const call of calls) {
//                 console.log('📞 Incoming call detected:', call);
                
//                 const antiCallData = loadAntiCall();
//                 const settings = antiCallData.settings || {};
//                 const blockedNumbers = antiCallData.blockedNumbers || [];
//                 const callLogs = antiCallData.callLogs || [];
                
//                 // Get the bot's JID
//                 const botJid = cleanJid(sock.user?.id);
//                 const userSettings = settings[botJid];
                
//                 console.log(`Checking settings for bot ${botJid}:`, userSettings);
                
//                 // Check if anti-call is enabled for the bot
//                 if (!userSettings || !userSettings.enabled) {
//                     console.log('Anti-call not enabled for bot, allowing call');
//                     return;
//                 }
                
//                 const fromJid = call.from;
//                 const callId = call.id;
//                 console.log(`Call from: ${fromJid}, Call ID: ${callId}, Status: ${call.status}`);
                
//                 // Only handle "offer" status calls (initial call)
//                 // This prevents handling the same call multiple times
//                 if (call.status !== 'offer') {
//                     console.log(`Skipping call with status: ${call.status}`);
//                     return;
//                 }
                
//                 // Check if we've already handled this call
//                 if (handledCalls.has(callId)) {
//                     console.log(`Already handled call ${callId}, skipping`);
//                     return;
//                 }
                
//                 // Mark this call as handled
//                 handledCalls.set(callId, Date.now());
//                 console.log(`Tracking call ${callId} from ${fromJid}`);
                
//                 // Check if number is in blocked list
//                 const isManuallyBlocked = blockedNumbers.some(n => n.number === fromJid);
//                 if (isManuallyBlocked) {
//                     console.log(`Number ${fromJid} is in block list, rejecting call`);
//                     try {
//                         // Try to reject the call
//                         await sock.rejectCall(callId, call.from);
                        
//                         // Log the call
//                         callLogs.push({
//                             callId: callId,
//                             from: fromJid,
//                             action: 'decline',
//                             reason: 'manually_blocked',
//                             timestamp: new Date().toISOString(),
//                             messageSent: false,
//                             status: call.status
//                         });
                        
//                         antiCallData.callLogs = callLogs;
//                         saveAntiCall(antiCallData);
//                     } catch (error) {
//                         console.error('Failed to reject call:', error);
//                         // Remove from tracking if failed
//                         handledCalls.delete(callId);
//                     }
//                     continue;
//                 }
                
//                 // Handle based on mode
//                 let actionTaken = 'none';
//                 let messageSent = false;
                
//                 switch (userSettings.mode) {
//                     case 'decline':
//                         try {
//                             console.log(`Attempting to decline call ${callId} from ${fromJid}`);
//                             await sock.rejectCall(callId, call.from);
//                             actionTaken = 'decline';
//                             console.log(`Successfully declined call ${callId} from ${fromJid}`);
//                         } catch (error) {
//                             console.error('Failed to decline call:', error);
//                             // Remove from tracking if failed
//                             handledCalls.delete(callId);
//                             continue;
//                         }
//                         break;
                        
//                     case 'block':
//                         try {
//                             console.log(`Attempting to block and decline call ${callId} from ${fromJid}`);
//                             // First decline the call
//                             await sock.rejectCall(callId, call.from);
                            
//                             // Then try to block the number
//                             try {
//                                 await sock.updateBlockStatus(fromJid, 'block');
//                                 actionTaken = 'block';
                                
//                                 // Add to blocked list
//                                 blockedNumbers.push({
//                                     number: fromJid,
//                                     blockedBy: botJid,
//                                     blockedAt: new Date().toISOString(),
//                                     reason: 'Auto-blocked by anti-call'
//                                 });
                                
//                                 antiCallData.blockedNumbers = blockedNumbers;
//                                 console.log(`Successfully blocked and declined call ${callId} from ${fromJid}`);
//                             } catch (blockError) {
//                                 console.error('Failed to block via WhatsApp API:', blockError);
//                                 actionTaken = 'decline'; // Still declined the call
//                             }
//                         } catch (error) {
//                             console.error('Failed to handle block mode:', error);
//                             // Remove from tracking if failed
//                             handledCalls.delete(callId);
//                             continue;
//                         }
//                         break;
//                 }
                
//                 // Send auto-reply message if enabled
//                 if (userSettings.autoMessage && userSettings.message && actionTaken !== 'none') {
//                     try {
//                         // Check if we've already sent a message for this call
//                         if (sentMessages.has(callId)) {
//                             console.log(`Already sent message for call ${callId}, skipping`);
//                             messageSent = true;
//                         } else {
//                             // Wait a bit before sending message
//                             setTimeout(async () => {
//                                 try {
//                                     await sock.sendMessage(fromJid, { 
//                                         text: userSettings.message 
//                                     });
//                                     console.log(`Sent auto-reply to ${fromJid} for call ${callId}`);
                                    
//                                     // Mark message as sent
//                                     sentMessages.set(callId, Date.now());
                                    
//                                     // Update the log
//                                     const lastLog = callLogs[callLogs.length - 1];
//                                     if (lastLog && lastLog.callId === callId) {
//                                         lastLog.messageSent = true;
//                                         saveAntiCall(antiCallData);
//                                     }
//                                 } catch (messageError) {
//                                     console.error('Failed to send auto-reply:', messageError);
//                                 }
//                             }, 1000);
                            
//                             messageSent = true;
//                         }
//                     } catch (messageError) {
//                         console.error('Failed to send auto-reply:', messageError);
//                     }
//                 }
                
//                 // Log the call
//                 callLogs.push({
//                     callId: callId,
//                     from: fromJid,
//                     action: actionTaken,
//                     reason: 'anti_call_enabled',
//                     timestamp: new Date().toISOString(),
//                     messageSent: messageSent,
//                     status: call.status,
//                     mode: userSettings.mode
//                 });
                
//                 // Keep only last 1000 logs
//                 if (callLogs.length > 1000) {
//                     callLogs.splice(0, callLogs.length - 1000);
//                 }
                
//                 antiCallData.callLogs = callLogs;
//                 saveAntiCall(antiCallData);
                
//                 console.log(`Call ${callId} from ${fromJid} handled: ${actionTaken}, message sent: ${messageSent}`);
//             }
//         } catch (error) {
//             console.error('Error in anti-call handler:', error);
//         }
//     });
    
//     console.log('✅ Anti-call listener attached');
// }

























import fs from 'fs';
import { getFooter } from '../../lib/menuHelper.js';

const antiCallFile = './anticall.json';

// Ensure JSON file exists
if (!fs.existsSync(antiCallFile)) {
    const initialData = {
        settings: {},
        callLogs: [],
        blockedNumbers: [],
        lastCacheClear: new Date().toISOString()
    };
    fs.writeFileSync(antiCallFile, JSON.stringify(initialData, null, 2));
}

// Load anti-call settings
function loadAntiCall() {
    try {
        const data = fs.readFileSync(antiCallFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading anti-call settings:', error);
        return { settings: {}, callLogs: [], blockedNumbers: [], lastCacheClear: new Date().toISOString() };
    }
}

// Save anti-call settings
function saveAntiCall(data) {
    try {
        fs.writeFileSync(antiCallFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving anti-call settings:', error);
    }
}

// Utility function to clean JID
function cleanJid(jid) {
    if (!jid) return jid;
    
    // Remove device suffix if present
    const clean = jid.split(':')[0];
    
    // If it already has a domain, return as is
    if (clean.includes('@')) {
        return clean;
    }
    
    // Otherwise, assume it's a regular WhatsApp number
    return clean + '@s.whatsapp.net';
}

// Setup anti-call listener
let antiCallListenerAttached = false;

// Track handled calls to avoid duplicates
const handledCalls = new Map();
const sentMessages = new Map();

// Last cache clear time
let lastAutoClearTime = Date.now();

// Clean up old entries periodically (every minute for short-term cache)
setInterval(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Clean up old handled calls (older than 5 minutes)
    for (const [callId, timestamp] of handledCalls.entries()) {
        if (now - timestamp > fiveMinutes) {
            handledCalls.delete(callId);
        }
    }
    
    // Clean up old sent messages (older than 5 minutes)
    for (const [callId, timestamp] of sentMessages.entries()) {
        if (now - timestamp > fiveMinutes) {
            sentMessages.delete(callId);
        }
    }
    
    // Auto-clear all cache every 24 hours (86,400,000 milliseconds)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now - lastAutoClearTime > twentyFourHours) {
        console.log('🔄 Auto-clearing call cache after 24 hours...');
        handledCalls.clear();
        sentMessages.clear();
        lastAutoClearTime = now;
        
        // Update last clear time in JSON file
        const antiCallData = loadAntiCall();
        antiCallData.lastCacheClear = new Date().toISOString();
        saveAntiCall(antiCallData);
        
        console.log('✅ Call cache auto-cleared successfully');
    }
}, 60000); // Check every minute

export default {
    name: 'anticall',
    alias: ['callblock', 'blockcall'],
    description: 'Manage automatic call handling and blocking',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        const botJid = cleanJid(sock.user?.id);

        const antiCallData = loadAntiCall();
        const settings = antiCallData.settings || {};
        const blockedNumbers = antiCallData.blockedNumbers || [];
        const callLogs = antiCallData.callLogs || [];
        const lastCacheClear = antiCallData.lastCacheClear || new Date().toISOString();

        const subCommand = args[0]?.toLowerCase();
        const action = args[1]?.toLowerCase();

        const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        if (!antiCallListenerAttached) {
            setupAntiCallListener(sock);
            antiCallListenerAttached = true;
        }

        if (subCommand === 'status') {
            const us = settings[botJid] || { enabled: false, mode: 'decline', autoMessage: false };
            const nextClear = new Date(new Date(lastCacheClear).getTime() + 24 * 60 * 60 * 1000);
            const msLeft = nextClear - Date.now();
            const hLeft = Math.floor(msLeft / 3600000);
            const mLeft = Math.floor((msLeft % 3600000) / 60000);

            let txt = `╭─⌈ 📞 *ANTICALL STATUS* ⌋\n│\n`;
            txt += `├─⊷ *Status:* ${us.enabled ? '🟢 ON' : '🔴 OFF'}\n`;
            txt += `├─⊷ *Mode:* ${(us.mode || 'decline').toUpperCase()}\n`;
            txt += `├─⊷ *Auto-reply:* ${us.autoMessage ? '✅ ON' : '❌ OFF'}\n`;
            if (us.autoMessage && us.message) {
                txt += `├─⊷ *Message:* ${us.message.substring(0, 40)}${us.message.length > 40 ? '…' : ''}\n`;
            }
            txt += `│\n`;
            txt += `├─⊷ *Calls handled:* ${callLogs.length}\n`;
            txt += `├─⊷ *Next cache clear:* ${hLeft}h ${mLeft}m\n`;
            if (callLogs.length > 0) {
                txt += `│\n├─⊷ *Recent calls:*\n`;
                callLogs.slice(-3).reverse().forEach((log, i) => {
                    const t = new Date(log.timestamp).toLocaleTimeString();
                    txt += `│  ${i + 1}. ${log.from?.split('@')[0]} — ${log.action} (${t})\n`;
                });
            }
            txt += `╰⊷ *Listener:* ${antiCallListenerAttached ? '✅ Active' : '❌ Inactive'}`;
            return reply(txt);
        }

        if (subCommand === 'enable') {
            if (action === 'block') {
                return reply(
                    `╭─⌈ 📞 *ANTICALL* ⌋\n│\n` +
                    `├─⊷ ⚠️ *Block mode unavailable*\n│\n` +
                    `│  Due to WhatsApp API limitations, bots\n` +
                    `│  cannot block callers at the WhatsApp level.\n│\n` +
                    `│  👉 To block manually:\n` +
                    `│  Open chat → Tap name → *Block*\n│\n` +
                    `╰⊷ Use *${PREFIX}anticall enable decline* instead`
                );
            }
            if (!action || action !== 'decline') {
                return reply(
                    `╭─⌈ 📞 *ANTICALL* ⌋\n│\n` +
                    `├─⊷ *${PREFIX}anticall enable decline*\n│  └⊷ Silently decline all calls\n` +
                    `╰⊷ Provide mode: decline`
                );
            }
            settings[botJid] = {
                enabled: true,
                mode: 'decline',
                autoMessage: settings[botJid]?.autoMessage || false,
                message: settings[botJid]?.message || "Sorry, I don't accept calls. Please message me instead.",
                lastUpdated: new Date().toISOString()
            };
            antiCallData.settings = settings;
            saveAntiCall(antiCallData);
            return reply(
                `╭─⌈ 📞 *ANTICALL* ⌋\n│\n` +
                `├─⊷ *Status:* 🟢 ON\n` +
                `├─⊷ *Mode:* DECLINE\n` +
                `╰⊷ All incoming calls will be silently declined`
            );
        }

        if (subCommand === 'disable') {
            if (settings[botJid]?.enabled) {
                settings[botJid].enabled = false;
                antiCallData.settings = settings;
                saveAntiCall(antiCallData);
                return reply(`╭─⌈ 📞 *ANTICALL* ⌋\n│\n├─⊷ *Status:* 🔴 OFF\n╰⊷ Calls will come through normally`);
            }
            return reply(`╭─⌈ 📞 *ANTICALL* ⌋\n│\n╰⊷ Already disabled`);
        }

        if (subCommand === 'message') {
            const messageText = args.slice(1).join(' ').trim();
            if (!messageText) {
                return reply(
                    `╭─⌈ 📞 *ANTICALL* ⌋\n│\n` +
                    `├─⊷ *${PREFIX}anticall message [text]*\n│  └⊷ Set auto-reply for calls\n` +
                    `╰⊷ Example: ${PREFIX}anticall message I can't take calls`
                );
            }
            if (!settings[botJid]) {
                settings[botJid] = { enabled: false, mode: 'decline', autoMessage: true, message: messageText, lastUpdated: new Date().toISOString() };
            } else {
                settings[botJid].autoMessage = true;
                settings[botJid].message = messageText;
                settings[botJid].lastUpdated = new Date().toISOString();
            }
            antiCallData.settings = settings;
            saveAntiCall(antiCallData);
            return reply(`╭─⌈ 📞 *ANTICALL* ⌋\n│\n├─⊷ *Auto-reply:* ✅ ON\n├─⊷ *Message:* ${messageText.substring(0, 50)}\n╰⊷ Sent after every handled call`);
        }

        if (subCommand === 'nomessage') {
            if (!settings[botJid]) {
                settings[botJid] = { enabled: false, mode: 'decline', autoMessage: false, message: '', lastUpdated: new Date().toISOString() };
            } else {
                settings[botJid].autoMessage = false;
                settings[botJid].lastUpdated = new Date().toISOString();
            }
            antiCallData.settings = settings;
            saveAntiCall(antiCallData);
            return reply(`╭─⌈ 📞 *ANTICALL* ⌋\n│\n├─⊷ *Auto-reply:* ❌ OFF\n╰⊷ No message sent after calls`);
        }

        if (subCommand === 'clearhandled') {
            handledCalls.clear();
            sentMessages.clear();
            lastAutoClearTime = Date.now();
            antiCallData.lastCacheClear = new Date().toISOString();
            saveAntiCall(antiCallData);
            return reply(`╭─⌈ 📞 *ANTICALL* ⌋\n│\n├─⊷ *Cache cleared* ✅\n╰⊷ Next auto-clear in 24h`);
        }

        if (subCommand === 'logs') {
            const limit = parseInt(args[1]) || 10;
            const recent = callLogs.slice(-limit).reverse();
            if (recent.length === 0) {
                return reply(`╭─⌈ 📞 *CALL LOGS* ⌋\n│\n╰⊷ No calls handled yet`);
            }
            let txt = `╭─⌈ 📞 *CALL LOGS* ⌋\n│\n`;
            recent.forEach((log, i) => {
                const t = new Date(log.timestamp).toLocaleString();
                txt += `├─⊷ ${i + 1}. ${log.from?.split('@')[0]}\n│  └⊷ ${log.action.toUpperCase()} • ${t}\n`;
            });
            txt += `╰⊷ Total: ${callLogs.length} call(s)`;
            return reply(txt);
        }

        return reply(
            `╭─⌈ 📞 *ANTICALL* ⌋\n│\n` +
            `├─⊷ *${PREFIX}anticall enable decline*\n│  └⊷ Auto-decline all incoming calls\n` +
            `├─⊷ *${PREFIX}anticall disable*\n│  └⊷ Turn off anticall\n` +
            `├─⊷ *${PREFIX}anticall message [text]*\n│  └⊷ Set auto-reply after call\n` +
            `├─⊷ *${PREFIX}anticall nomessage*\n│  └⊷ Remove auto-reply\n` +
            `├─⊷ *${PREFIX}anticall status*\n│  └⊷ View current settings\n` +
            `├─⊷ *${PREFIX}anticall logs*\n│  └⊷ View recent call history\n` +
            `├─⊷ *${PREFIX}anticall clearhandled*\n│  └⊷ Clear call tracking cache\n` +
            `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        );
    }
};

function setupAntiCallListener(sock) {
    console.log('🔧 Setting up anti-call listener...');
    
    // Listen for incoming calls
    sock.ev.on('call', async (callArray) => {
        try {
            // Handle both single call and array of calls
            const calls = Array.isArray(callArray) ? callArray : [callArray];
            
            for (const call of calls) {
                console.log('📞 Incoming call detected:', call);
                
                const antiCallData = loadAntiCall();
                const settings = antiCallData.settings || {};
                const blockedNumbers = antiCallData.blockedNumbers || [];
                const callLogs = antiCallData.callLogs || [];
                
                // Get the bot's JID
                const botJid = cleanJid(sock.user?.id);
                const userSettings = settings[botJid];
                
                console.log(`Checking settings for bot ${botJid}:`, userSettings);
                
                // Check if anti-call is enabled for the bot
                if (!userSettings || !userSettings.enabled) {
                    console.log('Anti-call not enabled for bot, allowing call');
                    return;
                }
                
                const fromJid = call.from;
                const callId = call.id;
                console.log(`Call from: ${fromJid}, Call ID: ${callId}, Status: ${call.status}`);
                
                // Only handle "offer" status calls (initial call)
                // This prevents handling the same call multiple times
                if (call.status !== 'offer') {
                    console.log(`Skipping call with status: ${call.status}`);
                    return;
                }
                
                // Check if we've already handled this call
                if (handledCalls.has(callId)) {
                    console.log(`Already handled call ${callId}, skipping`);
                    return;
                }
                
                // Mark this call as handled
                handledCalls.set(callId, Date.now());
                console.log(`Tracking call ${callId} from ${fromJid}`);
                
                // Check if number is in blocked list
                const isManuallyBlocked = blockedNumbers.some(n => n.number === fromJid);
                if (isManuallyBlocked) {
                    console.log(`Number ${fromJid} is in block list, rejecting call`);
                    try {
                        // Try to reject the call
                        await sock.rejectCall(callId, call.from);
                        
                        // Log the call
                        callLogs.push({
                            callId: callId,
                            from: fromJid,
                            action: 'decline',
                            reason: 'manually_blocked',
                            timestamp: new Date().toISOString(),
                            messageSent: false,
                            status: call.status
                        });
                        
                        antiCallData.callLogs = callLogs;
                        saveAntiCall(antiCallData);
                    } catch (error) {
                        console.error('Failed to reject call:', error);
                        // Remove from tracking if failed
                        handledCalls.delete(callId);
                    }
                    continue;
                }
                
                // Handle based on mode
                let actionTaken = 'none';
                let messageSent = false;
                
                switch (userSettings.mode) {
                    case 'block':
                    case 'decline':
                        try {
                            console.log(`Declining call ${callId} from ${fromJid}`);
                            await sock.rejectCall(callId, call.from);
                            actionTaken = 'decline';
                        } catch (error) {
                            console.error('Failed to decline call:', error);
                            handledCalls.delete(callId);
                            continue;
                        }
                        break;
                }
                
                // Send auto-reply message if enabled
                if (userSettings.autoMessage && userSettings.message && actionTaken !== 'none') {
                    try {
                        // Check if we've already sent a message for this call
                        if (sentMessages.has(callId)) {
                            console.log(`Already sent message for call ${callId}, skipping`);
                            messageSent = true;
                        } else {
                            // Wait a bit before sending message
                            setTimeout(async () => {
                                try {
                                    await sock.sendMessage(fromJid, { 
                                        text: userSettings.message 
                                    });
                                    console.log(`Sent auto-reply to ${fromJid} for call ${callId}`);
                                    
                                    // Mark message as sent
                                    sentMessages.set(callId, Date.now());
                                    
                                    // Update the log
                                    const lastLog = callLogs[callLogs.length - 1];
                                    if (lastLog && lastLog.callId === callId) {
                                        lastLog.messageSent = true;
                                        saveAntiCall(antiCallData);
                                    }
                                } catch (messageError) {
                                    console.error('Failed to send auto-reply:', messageError);
                                }
                            }, 1000);
                            
                            messageSent = true;
                        }
                    } catch (messageError) {
                        console.error('Failed to send auto-reply:', messageError);
                    }
                }
                
                // Log the call
                callLogs.push({
                    callId: callId,
                    from: fromJid,
                    action: actionTaken,
                    reason: 'anti_call_enabled',
                    timestamp: new Date().toISOString(),
                    messageSent: messageSent,
                    status: call.status,
                    mode: userSettings.mode
                });
                
                // Keep only last 1000 logs
                if (callLogs.length > 1000) {
                    callLogs.splice(0, callLogs.length - 1000);
                }
                
                antiCallData.callLogs = callLogs;
                saveAntiCall(antiCallData);
                
                console.log(`Call ${callId} from ${fromJid} handled: ${actionTaken}, message sent: ${messageSent}`);
            }
        } catch (error) {
            console.error('Error in anti-call handler:', error);
        }
    });
    
    console.log('✅ Anti-call listener attached');
}

globalThis._anticallInit = (sock) => {
    try {
        const data = loadAntiCall();
        const settings = data.settings || {};
        const botJid = cleanJid(sock.user?.id);
        const userSettings = settings[botJid];
        if (userSettings?.enabled && !antiCallListenerAttached) {
            setupAntiCallListener(sock);
            antiCallListenerAttached = true;
            console.log('✅ Anti-call listener restored on reconnect');
        }
    } catch {}
};