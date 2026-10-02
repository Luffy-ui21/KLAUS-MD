// import fs from 'fs';

// const banFile = './lib/banned.json';

// // ===== Helper functions =====
// function loadBans() {
//     try {
//         if (!fs.existsSync(banFile)) {
//             fs.writeFileSync(banFile, '[]');
//             return [];
//         }
//         const data = JSON.parse(fs.readFileSync(banFile, 'utf8'));
//         return Array.isArray(data) ? data : [];
//     } catch (error) {
//         console.error('Error loading bans:', error);
//         return [];
//     }
// }

// function saveBans(bans) {
//     try {
//         fs.writeFileSync(banFile, JSON.stringify(bans, null, 2));
//     } catch (error) {
//         console.error('Error saving bans:', error);
//     }
// }

// // Global variable to track if listener is attached
// let banListenerAttached = false;

// export default {
//     name: 'ban',
//     description: 'Ban a user from the group',
//     category: 'group',
//     async execute(sock, msg, args) {
//         const chatId = msg.key.remoteJid;
//         const isGroup = chatId.endsWith('@g.us');

//         if (!isGroup) {
//             return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
//         }

//         // Get group metadata to check admin status
//         let metadata;
//         try {
//             metadata = await sock.groupMetadata(chatId);
//         } catch (error) {
//             console.error('Error fetching group metadata:', error);
//             return sock.sendMessage(chatId, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
//         }

//         // Get sender ID correctly
//         const senderId = msg.key.participant || msg.key.remoteJid;
//         const isAdmin = metadata.participants.some(
//             p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
//         );

//         if (!isAdmin) {
//             return sock.sendMessage(chatId, { text: '🛑 Only group admins can use this command.' }, { quoted: msg });
//         }

//         // Check for mentioned user or reply
//         let mentionedJid;
//         if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
//             mentionedJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
//         } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
//             // If replying to a user
//             mentionedJid = msg.message.extendedTextMessage.contextInfo.participant;
//         } else if (args[0] && args[0].includes('@')) {
//             // If user ID is provided as argument
//             mentionedJid = args[0].includes('@s.whatsapp.net') ? args[0] : args[0] + '@s.whatsapp.net';
//         } else {
//             return sock.sendMessage(chatId, { 
//                 text: '⚠️ Please mention or reply to the user you want to ban.\nUsage: .ban @user' 
//             }, { quoted: msg });
//         }

//         // Remove bot if accidentally mentioned
//         if (mentionedJid.includes(sock.user.id.split(':')[0])) {
//             return sock.sendMessage(chatId, { text: '😂 I cannot ban myself!' }, { quoted: msg });
//         }

//         let bans = loadBans();
//         const userId = mentionedJid.split('@')[0];
        
//         if (!bans.includes(mentionedJid)) {
//             bans.push(mentionedJid);
//             saveBans(bans);
//         }

//         try {
//             // Kick user from group
//             await sock.groupParticipantsUpdate(chatId, [mentionedJid], 'remove');
            
//             await sock.sendMessage(chatId, { 
//                 text: `🚫 @${userId} has been banned from this group!`, 
//                 mentions: [mentionedJid] 
//             }, { quoted: msg });
            
//             console.log(`✅ Banned ${mentionedJid} from ${chatId}`);
//         } catch (error) {
//             console.error('Ban error:', error);
            
//             let errorMessage = '❌ Failed to ban user.';
//             if (error.message?.includes('not authorized')) {
//                 errorMessage = '❌ I need to be an admin to remove users.';
//             } else if (error.message?.includes('not in group')) {
//                 errorMessage = '❌ User is not in this group.';
//             }
            
//             await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
//         }

//         // ===== AUTO-KICK HOOK =====
//         if (!banListenerAttached && sock.ev) {
//             console.log('🔗 Attaching ban auto-kick listener...');
            
//             sock.ev.on('group-participants.update', async (update) => {
//                 try {
//                     // Check if this is a group
//                     if (!update.id.endsWith('@g.us')) return;
                    
//                     const bansList = loadBans();
                    
//                     if (update.action === 'add') {
//                         for (const participant of update.participants) {
//                             if (bansList.includes(participant)) {
//                                 console.log(`🚫 Auto-kicking banned user ${participant} from ${update.id}`);
                                
//                                 // Small delay to ensure user is fully added
//                                 await new Promise(resolve => setTimeout(resolve, 1000));
                                
//                                 try {
//                                     await sock.groupParticipantsUpdate(update.id, [participant], 'remove');
//                                     console.log(`✅ Auto-kicked ${participant} from ${update.id}`);
                                    
//                                     // Optional: Send notification
//                                     // await sock.sendMessage(update.id, { 
//                                     //     text: `🚫 @${participant.split('@')[0]} is banned and has been removed.`,
//                                     //     mentions: [participant]
//                                     // });
//                                 } catch (kickError) {
//                                     console.error('Auto-kick error:', kickError);
//                                 }
//                             }
//                         }
//                     }
//                 } catch (error) {
//                     console.error('Error in ban listener:', error);
//                 }
//             });
            
//             banListenerAttached = true;
//             console.log('✅ Ban auto-kick listener attached');
//         }
//     }
// };






















import fs from 'fs';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const banFile = './lib/banned.json';

// ===== Helper functions =====
function loadBans() {
    try {
        if (!fs.existsSync(banFile)) {
            const dir = path.dirname(banFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(banFile, '[]');
            return [];
        }
        const data = JSON.parse(fs.readFileSync(banFile, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error loading bans:', error);
        return [];
    }
}

function saveBans(bans) {
    try {
        const dir = path.dirname(banFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(banFile, JSON.stringify(bans, null, 2));
    } catch (error) {
        console.error('Error saving bans:', error);
    }
}

// Track if listener is attached
let banListenerAttached = false;
let globalSock = null;

// ===== Auto-kick listener =====
function attachAutoKickListener(sock) {
    if (banListenerAttached) {
        console.log('✅ Ban listener already attached');
        return;
    }
    
    if (!sock || !sock.ev) {
        console.error('❌ Socket or event emitter not available');
        return;
    }
    
    globalSock = sock;
    
    console.log('🔗 Attaching ban auto-kick listener...');
    
    // Listen for group participant updates
    sock.ev.on('group-participants.update', async (update) => {
        try {
            // Check if this is a group
            if (!update.id.endsWith('@g.us')) return;
            
            const bansList = loadBans();
            
            // Only process 'add' actions (when users join)
            if (update.action === 'add') {
                for (const participant of update.participants) {
                    // Check if user is banned
                    if (bansList.includes(participant)) {
                        console.log(`🚫 Detected banned user ${participant} joining ${update.id}`);
                        
                        // Small delay to ensure user is fully added
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        try {
                            // Check if bot is admin before attempting to remove
                            let metadata;
                            try {
                                metadata = await sock.groupMetadata(update.id);
                            } catch (err) {
                                console.error('Failed to fetch group metadata:', err);
                                continue;
                            }
                            
                            // Find bot's participant info
                            const botParticipant = metadata.participants.find(
                                p => p.id === sock.user.id
                            );
                            
                            if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                                console.log(`⚠️ Bot is not admin in ${update.id}, cannot auto-kick`);
                                continue;
                            }
                            
                            // Check if user is still in group (might have left during delay)
                            const currentMetadata = await sock.groupMetadata(update.id);
                            const isStillInGroup = currentMetadata.participants.some(p => p.id === participant);
                            
                            if (!isStillInGroup) {
                                console.log(`ℹ️ User ${participant} already left ${update.id}`);
                                continue;
                            }
                            
                            // Kick the banned user
                            await sock.groupParticipantsUpdate(update.id, [participant], 'remove');
                            console.log(`✅ Auto-kicked ${participant} from ${update.id}`);
                            
                            // Send notification to group
                            try {
                                await sock.sendMessage(update.id, { 
                                    text: `🚫 @${participant.split('@')[0]} is banned and has been automatically removed.`,
                                    mentions: [participant]
                                });
                            } catch (notifyError) {
                                console.log('Could not send notification:', notifyError.message);
                            }
                            
                        } catch (kickError) {
                            console.error('Auto-kick error:', kickError.message || kickError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in ban listener:', error);
        }
    });
    
    banListenerAttached = true;
    console.log('✅ Ban auto-kick listener attached successfully');
    
    // Also check existing groups for banned users
    checkExistingGroupsForBans(sock);
}

// ===== Check existing groups =====
async function checkExistingGroupsForBans(sock) {
    try {
        console.log('🔍 Checking existing groups for banned users...');
        const bans = loadBans();
        
        if (bans.length === 0) {
            console.log('✅ No banned users to check');
            return;
        }
        
        // Get all groups the bot is in
        let groups;
        try {
            groups = await sock.groupFetchAllParticipating();
        } catch (error) {
            console.error('Failed to fetch groups:', error);
            return;
        }
        
        console.log(`📊 Checking ${Object.keys(groups).length} groups for banned users...`);
        
        for (const [groupId, groupData] of Object.entries(groups)) {
            try {
                // Check if bot is admin in this group
                const botParticipant = groupData.participants.find(p => p.id === sock.user.id);
                if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                    continue;
                }
                
                // Check each participant against ban list
                for (const participant of groupData.participants) {
                    if (bans.includes(participant.id) && participant.id !== sock.user.id) {
                        console.log(`🚫 Found banned user ${participant.id} in ${groupId}`);
                        try {
                            await sock.groupParticipantsUpdate(groupId, [participant.id], 'remove');
                            console.log(`✅ Removed banned user ${participant.id} from ${groupId}`);
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
                        } catch (error) {
                            console.error(`Failed to remove ${participant.id} from ${groupId}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing group ${groupId}:`, error);
            }
        }
        
        console.log('✅ Finished checking groups for banned users');
    } catch (error) {
        console.error('Error in checkExistingGroupsForBans:', error);
    }
}

// ===== Main command =====
export default {
    name: 'ban',
    description: 'Ban a user from the group',
    category: 'group',
    async execute(sock, msg, args) {
        // Auto-attach listener on first command use
        if (!banListenerAttached) {
            attachAutoKickListener(sock);
        }
        
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
        }

        // Get group metadata
        let metadata;
        try {
            metadata = await sock.groupMetadata(chatId);
        } catch (error) {
            console.error('Error fetching group metadata:', error);
            return sock.sendMessage(chatId, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
        }

        // Check if sender is admin
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isAdmin = metadata.participants.some(
            p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        if (!isAdmin) {
            return sock.sendMessage(chatId, { text: '🛑 Only group admins can use this command.' }, { quoted: msg });
        }

        // Handle list command
        if (args[0] === '--list' || args[0] === '-l') {
            const bans = loadBans();
            if (bans.length === 0) {
                return sock.sendMessage(chatId, { text: '📝 No users are currently banned.' }, { quoted: msg });
            }
            
            let listText = '📋 *Banned Users List:*\n';
            bans.forEach((ban, index) => {
                const userId = ban.split('@')[0];
                listText += `${index + 1}. @${userId}\n`;
            });
            
            return sock.sendMessage(chatId, { 
                text: listText,
                mentions: bans
            }, { quoted: msg });
        }
        
        // Handle unban command
        if (args[0] === '--unban' || args[0] === '-u') {
            let targetJid;
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (args[1] && args[1].includes('@')) {
                targetJid = args[1].includes('@s.whatsapp.net') ? args[1] : args[1] + '@s.whatsapp.net';
            } else {
                return sock.sendMessage(chatId, { 
                    text: `╭─⌈ ⚠️ *BAN* ⌋\n│\n├─⊷ *.ban --unban @user*\n│  └⊷ Unban a user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}` 
                }, { quoted: msg });
            }
            
            const bans = loadBans();
            const index = bans.indexOf(targetJid);
            if (index !== -1) {
                bans.splice(index, 1);
                saveBans(bans);
                const userId = targetJid.split('@')[0];
                return sock.sendMessage(chatId, { 
                    text: `✅ @${userId} has been unbanned.`, 
                    mentions: [targetJid]
                }, { quoted: msg });
            } else {
                const userId = targetJid.split('@')[0];
                return sock.sendMessage(chatId, { 
                    text: `⚠️ @${userId} is not in the ban list.`, 
                    mentions: [targetJid]
                }, { quoted: msg });
            }
        }

        // Handle regular ban
        let mentionedJid;
        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            mentionedJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            mentionedJid = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (args[0] && args[0].includes('@')) {
            mentionedJid = args[0].includes('@s.whatsapp.net') ? args[0] : args[0] + '@s.whatsapp.net';
        } else {
            return sock.sendMessage(chatId, { 
                text: `╭─⌈ ⚠️ *BAN* ⌋\n│\n├─⊷ *.ban @user*\n│  └⊷ Ban a user\n├─⊷ *.ban --list*\n│  └⊷ Show banned users\n├─⊷ *.ban --unban @user*\n│  └⊷ Unban a user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}` 
            }, { quoted: msg });
        }

        // Don't allow banning the bot
        if (mentionedJid.includes(sock.user.id.split(':')[0])) {
            return sock.sendMessage(chatId, { text: '😂 I cannot ban myself!' }, { quoted: msg });
        }

        let bans = loadBans();
        const userId = mentionedJid.split('@')[0];
        
        if (bans.includes(mentionedJid)) {
            return sock.sendMessage(chatId, { 
                text: `⚠️ @${userId} is already banned.`, 
                mentions: [mentionedJid]
            }, { quoted: msg });
        }
        
        // Add to ban list
        bans.push(mentionedJid);
        saveBans(bans);

        try {
            // Check if user is currently in the group and kick them
            const isInGroup = metadata.participants.some(p => p.id === mentionedJid);
            if (isInGroup) {
                await sock.groupParticipantsUpdate(chatId, [mentionedJid], 'remove');
            }
            
            await sock.sendMessage(chatId, { 
                text: `🚫 @${userId} has been banned ${isInGroup ? 'and removed from' : 'from'} this group!`, 
                mentions: [mentionedJid]
            }, { quoted: msg });
            
            console.log(`✅ Banned ${mentionedJid} from ${chatId}`);
            
            // Check other groups for this banned user
            setTimeout(async () => {
                try {
                    const allGroups = await sock.groupFetchAllParticipating();
                    for (const [groupId, groupData] of Object.entries(allGroups)) {
                        if (groupId !== chatId) {
                            const userInGroup = groupData.participants.some(p => p.id === mentionedJid);
                            if (userInGroup) {
                                const botParticipant = groupData.participants.find(p => p.id === sock.user.id);
                                if (botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin')) {
                                    await sock.groupParticipantsUpdate(groupId, [mentionedJid], 'remove');
                                    console.log(`✅ Also removed ${mentionedJid} from ${groupId}`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error checking other groups:', error);
                }
            }, 3000);
            
        } catch (error) {
            console.error('Ban error:', error);
            
            let errorMessage = '❌ Failed to ban user.';
            if (error.message?.includes('not authorized')) {
                errorMessage = '❌ I need to be an admin to remove users.';
            } else if (error.message?.includes('not in group')) {
                errorMessage = '❌ User is not in this group.';
            }
            
            await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        }
    }
};

// ===== Helper function to manually attach listener =====
export function initializeBanSystem(sock) {
    if (!sock) {
        console.error('❌ No socket provided to initialize ban system');
        return;
    }
    
    console.log('🔄 Initializing ban system...');
    attachAutoKickListener(sock);
}

// ===== Export the attach function for manual control =====
export { attachAutoKickListener };