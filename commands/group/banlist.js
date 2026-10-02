// import fs from 'fs';
// const banFile = '../../lib/banned.json';

// function loadBans() {
//     try {
//         if (!fs.existsSync(banFile)) return [];
//         const data = JSON.parse(fs.readFileSync(banFile, 'utf8'));
//         return Array.isArray(data) ? data : [];
//     } catch {
//         return [];
//     }
// }

// export default {
//     name: 'banlist',
//     description: 'Show all banned users in this group',
//     category: 'group',
//     async execute(sock, msg) {
//         const chatId = msg.key.remoteJid;
//         const isGroup = chatId.endsWith('@g.us');

//         if (!isGroup) {
//             return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
//         }

//         // ✅ Admin check
//         const metadata = await sock.groupMetadata(chatId);
//         const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
//         const isAdmin = metadata.participants.some(
//             p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
//         );

//         if (!isAdmin) {
//             return sock.sendMessage(chatId, { text: '🛑 Only group admins can use this command.' }, { quoted: msg });
//         }

//         const bans = loadBans();
//         if (bans.length === 0) {
//             return sock.sendMessage(chatId, { text: '📭 No banned users.' }, { quoted: msg });
//         }

//         let text = `🚫 *Banned Users List (${bans.length})*\n\n`;
//         text += bans.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n');

//         await sock.sendMessage(chatId, { 
//             text, 
//             mentions: bans 
//         }, { quoted: msg });
//     }
// };
















import fs from 'fs';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const exFile = './lib/exlist.json';

// ===== Helper functions =====
function loadExList() {
    try {
        if (!fs.existsSync(exFile)) {
            fs.writeFileSync(exFile, '[]');
            return [];
        }
        const data = JSON.parse(fs.readFileSync(exFile, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error loading ex list:', error);
        return [];
    }
}

function saveExList(exList) {
    try {
        fs.writeFileSync(exFile, JSON.stringify(exList, null, 2));
    } catch (error) {
        console.error('Error saving ex list:', error);
    }
}

// Global variables
let exListenerAttached = false;

export default {
    name: 'ex',
    description: 'Execute/Expel user from group with auto-kick feature',
    category: 'group',
    usage: 'ex [@user | reply] (reason)',
    
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(chatId, { 
                text: '❌ This command can only be used in groups.' 
            }, { quoted: msg });
        }

        // Get group metadata
        let metadata;
        try {
            metadata = await sock.groupMetadata(chatId);
        } catch (error) {
            return sock.sendMessage(chatId, { 
                text: '❌ Failed to fetch group information.' 
            }, { quoted: msg });
        }

        // ====== FIXED ADMIN CHECK ======
        const senderId = msg.key.participant || msg.key.remoteJid;
        
        // Method 1: Check if sender is in participants list
        const senderParticipant = metadata.participants.find(p => p.id === senderId);
        
        // Debug logging
        console.log('ADMIN CHECK DEBUG:');
        console.log('- Sender ID:', senderId);
        console.log('- Sender Participant:', senderParticipant);
        console.log('- All Participants:', metadata.participants.map(p => ({
            id: p.id,
            admin: p.admin
        })));
        
        // Check admin status using multiple methods
        let isAdmin = false;
        
        if (senderParticipant) {
            // Method A: Check admin field
            if (senderParticipant.admin) {
                isAdmin = senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin';
                console.log('- Admin check via admin field:', senderParticipant.admin, '=>', isAdmin);
            }
            
            // Method B: Check if fromMe (bot owner)
            if (msg.key.fromMe) {
                isAdmin = true;
                console.log('- Admin check via fromMe:', isAdmin);
            }
            
            // Method C: Check if sender is bot itself
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            if (senderId === botJid) {
                isAdmin = true;
                console.log('- Admin check via bot JID:', isAdmin);
            }
        }
        
        // If still not admin, try alternative check
        if (!isAdmin) {
            // Try the same method as kickall command
            isAdmin = metadata.participants.some(
                p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
            );
            console.log('- Alternative admin check:', isAdmin);
        }

        if (!isAdmin) {
            return sock.sendMessage(chatId, { 
                text: '🛑 Only group admins can use this command.\n\n' +
                      '🔍 *Debug Info:*\n' +
                      `• Your ID: ${senderId}\n` +
                      `• Found in participants: ${senderParticipant ? 'Yes' : 'No'}\n` +
                      `• Admin field: ${senderParticipant?.admin || 'None'}\n` +
                      `• From Me: ${msg.key.fromMe ? 'Yes' : 'No'}`
            }, { quoted: msg });
        }
        // ====== END FIXED ADMIN CHECK ======

        // Check bot admin status
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botParticipant = metadata.participants.find(p => p.id === botJid);
        const isBotAdmin = botParticipant && ['admin', 'superadmin'].includes(botParticipant.admin);

        if (!isBotAdmin) {
            return sock.sendMessage(chatId, { 
                text: '🤖 I need to be an admin to execute users.' 
            }, { quoted: msg });
        }

        // Get target user
        let targetJid;
        const mentionedUsers = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Method 1: Mentioned user
        if (mentionedUsers.length > 0) {
            targetJid = mentionedUsers[0];
        } 
        // Method 2: Replying to user
        else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant;
        }
        // Method 3: Phone number argument
        else if (args[0] && !isNaN(args[0]) && args[0].length >= 10) {
            const phone = args[0].replace(/\D/g, '');
            targetJid = phone + '@s.whatsapp.net';
        }
        // Method 4: Show help
        else {
            return sock.sendMessage(chatId, { 
                text: `╭─⌈ ⚡ *EX COMMAND* ⌋\n│\n├─⊷ *.ex @user*\n│  └⊷ Ban & kick user\n├─⊷ *.ex 947xxxxxxxx*\n│  └⊷ Use number\n├─⊷ *.ex* (reply)\n│  └⊷ Reply to user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        // Safety checks
        if (targetJid.includes(botJid.split('@')[0])) {
            return sock.sendMessage(chatId, { 
                text: '😂 I cannot execute myself!' 
            }, { quoted: msg });
        }

        // Check if target is admin (can't ban admins)
        const targetParticipant = metadata.participants.find(p => p.id === targetJid);
        const isTargetAdmin = targetParticipant && ['admin', 'superadmin'].includes(targetParticipant.admin);
        
        if (isTargetAdmin) {
            return sock.sendMessage(chatId, { 
                text: '⚠️ Cannot execute group admins.' 
            }, { quoted: msg });
        }

        // Check if target is in group
        if (!targetParticipant) {
            return sock.sendMessage(chatId, { 
                text: '❌ User is not in this group.' 
            }, { quoted: msg });
        }

        // Get reason
        let reason = '';
        if (mentionedUsers.length > 0) {
            // Remove mentions from args to get reason
            const cleanArgs = args.filter(arg => !arg.includes('@'));
            reason = cleanArgs.join(' ');
        } else {
            // Remove phone number if used
            const cleanArgs = args.filter(arg => isNaN(arg) || arg.length < 10);
            reason = cleanArgs.join(' ');
        }

        // Load and update ex list
        let exList = loadExList();
        const userEntry = {
            jid: targetJid,
            group: chatId,
            executedBy: senderId,
            timestamp: Date.now(),
            reason: reason || 'No reason provided'
        };

        // Check if already in list
        const existingIndex = exList.findIndex(entry => 
            entry.jid === targetJid && entry.group === chatId
        );

        if (existingIndex !== -1) {
            exList[existingIndex] = userEntry;
        } else {
            exList.push(userEntry);
        }

        saveExList(exList);

        // Execute the user
        try {
            await sock.groupParticipantsUpdate(chatId, [targetJid], 'remove');
            
            // Success message
            const targetNumber = targetJid.split('@')[0];
            const senderNumber = senderId.split('@')[0];
            
            let successMsg = `⚡ *EXECUTED*\n\n`;
            successMsg += `• User: @${targetNumber}\n`;
            successMsg += `• By: @${senderNumber}\n`;
            successMsg += `• Group: ${metadata.subject}\n`;
            if (reason) successMsg += `• Reason: ${reason}\n`;
            successMsg += `• Status: Removed ✅\n`;
            successMsg += `• Auto-kick: Active 🔄\n\n`;
            successMsg += `⚠️ User will be auto-kicked if they try to rejoin.`;
            
            await sock.sendMessage(chatId, { 
                text: successMsg,
                mentions: [targetJid, senderId]
            }, { quoted: msg });
            
            console.log(`✅ EX: ${targetJid} executed from ${chatId} by ${senderId}`);
            
        } catch (error) {
            console.error('EX error:', error);
            
            let errorMsg = '❌ Failed to execute user. ';
            if (error.message?.includes('not authorized')) {
                errorMsg += 'I need admin permissions.';
            } else if (error.message?.includes('401')) {
                errorMsg += 'User not in group.';
            } else if (error.message?.includes('403')) {
                errorMsg += 'Bot is not an admin.';
            } else {
                errorMsg += error.message;
            }
            
            await sock.sendMessage(chatId, { 
                text: errorMsg 
            }, { quoted: msg });
        }

        // ===== AUTO-KICK LISTENER =====
        if (!exListenerAttached && sock.ev) {
            console.log('🔗 Attaching EX auto-kick listener...');
            
            sock.ev.on('group-participants.update', async (update) => {
                try {
                    // Only process group events
                    if (!update.id.endsWith('@g.us')) return;
                    
                    // Only process "add" events
                    if (update.action !== 'add') return;
                    
                    const exList = loadExList();
                    
                    for (const participant of update.participants) {
                        // Check if user is in ex list for this group
                        const isExed = exList.some(entry => 
                            entry.jid === participant && entry.group === update.id
                        );
                        
                        if (isExed) {
                            console.log(`⚡ Auto-kicking EXed user ${participant} from ${update.id}`);
                            
                            // Small delay to ensure smooth process
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            
                            try {
                                await sock.groupParticipantsUpdate(update.id, [participant], 'remove');
                                console.log(`✅ Auto-kicked ${participant} from ${update.id}`);
                                
                            } catch (kickError) {
                                console.error('Auto-kick error:', kickError);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error in EX listener:', error);
                }
            });
            
            exListenerAttached = true;
            console.log('✅ EX auto-kick listener attached');
        }
    }
};
