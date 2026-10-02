import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
// // commands/group/antileave.js

// const antiLeaveGroups = new Map(); // Store with group info
// let eventHandlerAdded = false;

// export default {
//   name: 'antileave',
//   description: 'Prevent users from leaving the group (admin only)',
//   category: 'group',
  
//   async execute(sock, msg, args) {
//     const jid = msg.key.remoteJid;
//     const sender = msg.key.participant || jid;
    
//     // Check if it's a group
//     if (!jid.endsWith('@g.us')) {
//       return sock.sendMessage(jid, { 
//         text: '❌ This command only works in groups.' 
//       }, { quoted: msg });
//     }
    
//     // Check if sender is admin
//     let isAdmin = false;
//     try {
//       const groupMetadata = await sock.groupMetadata(jid);
//       const senderParticipant = groupMetadata.participants.find(p => p.id === sender);
//       isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
      
//       if (!isAdmin) {
//         return sock.sendMessage(jid, { 
//           text: '🛑 Only admins can control anti-leave.' 
//         }, { quoted: msg });
//       }
//     } catch (error) {
//       console.error('Error checking admin:', error);
//       return sock.sendMessage(jid, { 
//         text: '❌ Failed to verify permissions.' 
//       }, { quoted: msg });
//     }
    
//     // Add event handler once
//     if (!eventHandlerAdded) {
//       setupAntiLeaveHandler(sock);
//       eventHandlerAdded = true;
//     }
    
//     // Initialize group data
//     if (!antiLeaveGroups.has(jid)) {
//       antiLeaveGroups.set(jid, {
//         enabled: false,
//         strikes: new Map(), // Track how many times users try to leave
//         lastAction: Date.now()
//       });
//     }
    
//     const groupData = antiLeaveGroups.get(jid);
//     const action = args[0]?.toLowerCase();
    
//     if (!action || action === 'status') {
//       const status = groupData.enabled ? '✅ ENABLED' : '❌ DISABLED';
//       const strikeCount = Array.from(groupData.strikes.values()).reduce((a, b) => a + b, 0);
      
//       return sock.sendMessage(jid, { 
//         text: `🛡️ *Anti-Leave Status*\n\nStatus: ${status}\nTotal leave attempts: ${strikeCount}\n\nCommands:\n• .antileave on - Enable protection\n• .antileave off - Disable protection\n• .antileave strikes - View strike list\n• .antileave reset - Reset all strikes\n• .antileave status - Check status` 
//       }, { quoted: msg });
//     }
    
//     if (action === 'on' || action === 'enable') {
//       if (groupData.enabled) {
//         return sock.sendMessage(jid, { 
//           text: 'ℹ️ Anti-leave is already enabled for this group.' 
//         }, { quoted: msg });
//       }
      
//       groupData.enabled = true;
//       groupData.strikes.clear();
      
//       return sock.sendMessage(jid, { 
//         text: '✅ *Anti-Leave ENABLED!*\n\n🚫 Users cannot leave this group now.\n📢 Any leave attempts will be logged and reported.\n⚠️ Repeated attempts may result in penalties.' 
//       }, { quoted: msg });
//     }
    
//     if (action === 'off' || action === 'disable') {
//       if (!groupData.enabled) {
//         return sock.sendMessage(jid, { 
//           text: 'ℹ️ Anti-leave is already disabled for this group.' 
//         }, { quoted: msg });
//       }
      
//       groupData.enabled = false;
//       return sock.sendMessage(jid, { 
//         text: '✅ *Anti-Leave DISABLED!*\n\nUsers can now leave the group freely.\nPrevious strike records have been preserved.' 
//       }, { quoted: msg });
//     }
    
//     if (action === 'strikes') {
//       const strikesList = [];
//       const mentionedUsers = [];
      
//       for (const [userId, count] of groupData.strikes) {
//         if (count > 0) {
//           const userNum = userId.split('@')[0];
//           strikesList.push(`@${userNum}: ${count} attempt${count > 1 ? 's' : ''}`);
//           mentionedUsers.push(userId);
//         }
//       }
      
//       const text = strikesList.length > 0
//         ? `📊 *Leave Attempts History*\n\n${strikesList.join('\n')}\n\n⚠️ Users with 3+ attempts may face action.`
//         : '📊 No leave attempts recorded yet.';
      
//       return sock.sendMessage(jid, {
//         text,
//         mentions: mentionedUsers
//       }, { quoted: msg });
//     }
    
//     if (action === 'reset') {
//       if (!isAdmin) {
//         return sock.sendMessage(jid, { 
//           text: '🛑 Only admins can reset strikes.' 
//         }, { quoted: msg });
//       }
      
//       const previousCount = groupData.strikes.size;
//       groupData.strikes.clear();
      
//       return sock.sendMessage(jid, { 
//         text: `✅ All strike records cleared!\nReset ${previousCount} user${previousCount !== 1 ? 's' : ''}.` 
//       }, { quoted: msg });
//     }
    
//     // Invalid command
//     return sock.sendMessage(jid, { 
//       text: '⚠️ Invalid command. Use: .antileave on/off/status/strikes/reset' 
//     }, { quoted: msg });
//   }
// };

// // Helper function to setup the event handler
// function setupAntiLeaveHandler(sock) {
//   console.log('🔧 Setting up anti-leave detection system...');
  
//   sock.ev.on('group-participants.update', async (update) => {
//     try {
//       const { id, participants, action } = update;
      
//       // Get group data
//       const groupData = antiLeaveGroups.get(id);
//       if (!groupData || !groupData.enabled) return;
      
//       // Update last action time
//       groupData.lastAction = Date.now();
      
//       // Check if it's a leave action
//       if (action === 'remove') {
//         for (const participant of participants) {
//           try {
//             // Track the attempt
//             const currentStrikes = groupData.strikes.get(participant) || 0;
//             groupData.strikes.set(participant, currentStrikes + 1);
            
//             const userNum = participant.split('@')[0];
//             const strikeCount = currentStrikes + 1;
            
//             console.log(`🚫 Anti-leave: ${participant} left ${id} (Attempt ${strikeCount})`);
            
//             // Try to add them back (only if we have reasonable confidence it will work)
//             let addBackSuccess = false;
            
//             // Check if it's a valid phone number (not a lid)
//             if (participant.includes('@s.whatsapp.net')) {
//               try {
//                 await sock.groupParticipantsUpdate(id, [participant], 'add');
//                 addBackSuccess = true;
//                 console.log(`✅ Added back ${participant}`);
//               } catch (addError) {
//                 console.log(`❌ Could not add back ${participant}: ${addError.message}`);
//               }
//             } else {
//               console.log(`⚠️ Cannot add back ${participant} (not a standard phone number)`);
//             }
            
//             // Send notification to group
//             let notificationText;
//             if (addBackSuccess) {
//               notificationText = `🚫 *ANTI-LEAVE VIOLATION*\n\n@${userNum} tried to leave but was added back!\n\n📊 Attempt ${strikeCount}/3\n\n_No one escapes the pack. _`;
//             } else {
//               notificationText = `🚫 *LEAVE ATTEMPT DETECTED*\n\n@${userNum} left the group!\n\n📊 Leave attempt ${strikeCount}/3\n\n⚠️ I could not add them back automatically.\nAn admin may need to take manual action.`;
//             }
            
//             await sock.sendMessage(id, {
//               text: notificationText,
//               mentions: [participant]
//             });
            
//             // Apply penalties for repeated attempts
//             if (strikeCount >= 3) {
//               // Try to ban if they keep trying to leave
//               try {
//                 // First try to add them (in case they're still trying to leave)
//                 if (addBackSuccess) {
//                   await sock.groupParticipantsUpdate(id, [participant], 'remove');
//                   await sock.sendMessage(id, {
//                     text: `❌ @${userNum} has been banned for 3+ leave attempts!`,
//                     mentions: [participant]
//                   });
//                   groupData.strikes.delete(participant);
//                 }
//               } catch (banError) {
//                 console.error('Ban error:', banError);
//               }
//             }
            
//           } catch (error) {
//             console.error('❌ Error processing leave:', error);
//           }
//         }
//       }
      
//     } catch (error) {
//       console.error('❌ Anti-leave handler error:', error);
//     }
//   });
  
//   console.log('✅ Anti-leave detection system ready');
// }

// // Optional: Auto-cleanup function
// setInterval(() => {
//   const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//   let cleaned = 0;
  
//   for (const [jid, data] of antiLeaveGroups) {
//     if (data.lastAction < oneWeekAgo) {
//       antiLeaveGroups.delete(jid);
//       cleaned++;
//     }
//   }
  
//   if (cleaned > 0) {
//     console.log(`🧹 Cleaned ${cleaned} inactive anti-leave groups`);
//   }
// }, 3600000); // Check every hour






































// commands/group/antileave.js

const antiLeaveGroups = new Map(); // Store group settings
let eventHandlerAdded = false;

export default {
  name: 'antileave',
  description: 'Anti-leave system with smart detection',
  category: 'group',
  
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ Groups only.' }, { quoted: msg });
    }
    
    // Check if sender is admin
    try {
      const groupMetadata = await sock.groupMetadata(jid);
      const senderParticipant = groupMetadata.participants.find(p => p.id === sender);
      const isAdmin = senderParticipant?.admin;
      
      if (!isAdmin) {
        return sock.sendMessage(jid, { text: '🛑 Admin only.' }, { quoted: msg });
      }
    } catch (error) {
      console.error('Admin check error:', error);
      return sock.sendMessage(jid, { text: '❌ Permission check failed.' }, { quoted: msg });
    }
    
    // Setup handler once
    if (!eventHandlerAdded) {
      setupLeaveHandler(sock);
      eventHandlerAdded = true;
    }
    
    // Initialize group
    if (!antiLeaveGroups.has(jid)) {
      antiLeaveGroups.set(jid, {
        enabled: false,
        leaveLogs: [], // Store leave events
        lastNotification: 0
      });
    }
    
    const groupData = antiLeaveGroups.get(jid);
    const action = args[0]?.toLowerCase();
    
    if (!action || action === 'status') {
      const status = groupData.enabled ? '✅ ACTIVE' : '❌ INACTIVE';
      const leaveCount = groupData.leaveLogs.length;
      
      return sock.sendMessage(jid, { 
        text: `╭─⌈ 🛡️ *ANTI-LEAVE* ⌋\n│\n├─⊷ *.antileave on*\n│  └⊷ Enable detection\n├─⊷ *.antileave off*\n│  └⊷ Disable detection\n├─⊷ *.antileave log*\n│  └⊷ View recent leaves\n├─⊷ *.antileave clear*\n│  └⊷ Clear leave logs\n├─⊷ *.antileave status*\n│  └⊷ Check current status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}` 
      }, { quoted: msg });
    }
    
    if (action === 'on') {
      groupData.enabled = true;
      groupData.leaveLogs = []; // Clear old logs
      return sock.sendMessage(jid, { 
        text: '✅ *Anti-Leave Activated*\n\nI will now detect and log all leave attempts.\nUsers attempting to leave will be reported immediately.' 
      }, { quoted: msg });
    }
    
    if (action === 'off') {
      groupData.enabled = false;
      return sock.sendMessage(jid, { 
        text: '✅ Anti-leave deactivated.' 
      }, { quoted: msg });
    }
    
    if (action === 'log' || action === 'logs') {
      const logs = groupData.leaveLogs.slice(-10).reverse(); // Last 10 leaves
      
      if (logs.length === 0) {
        return sock.sendMessage(jid, { 
          text: '📝 No leave attempts logged yet.' 
        }, { quoted: msg });
      }
      
      let logText = '📊 *LEAVE ATTEMPT LOG*\n\n';
      logs.forEach((log, index) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const userDisplay = log.userId.includes('@lid') ? 'Hidden User' : `@${log.userId.split('@')[0]}`;
        logText += `${index + 1}. ${userDisplay}\n   ⏰ ${time}\n   🆔 ${log.userId}\n\n`;
      });
      
      logText += `Total leaves: ${groupData.leaveLogs.length}`;
      
      return sock.sendMessage(jid, { text: logText }, { quoted: msg });
    }
    
    if (action === 'clear') {
      const count = groupData.leaveLogs.length;
      groupData.leaveLogs = [];
      return sock.sendMessage(jid, { 
        text: `✅ Cleared ${count} leave logs.` 
      }, { quoted: msg });
    }
    
    return sock.sendMessage(jid, { 
      text: '╭─⌈ ⚠️ *ANTI-LEAVE* ⌋\n│\n├─⊷ *.antileave on/off/log/clear/status*\n│  └⊷ Use a valid subcommand\n╰───' 
    }, { quoted: msg });
  }
};

// Helper function to setup the event handler
function setupLeaveHandler(sock) {
  console.log('🔧 Initializing leave detection system...');
  
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const { id, participants, action } = update;
      
      // Process leave events
      if (action === 'remove') {
        // Check all groups for anti-leave
        for (const [groupId, groupData] of antiLeaveGroups) {
          if (groupId === id && groupData.enabled) {
            for (const userId of participants) {
              // Log the leave
              const leaveLog = {
                userId,
                timestamp: Date.now(),
                groupId: id
              };
              
              groupData.leaveLogs.push(leaveLog);
              
              // Try to get user info
              let userInfo = 'Unknown User';
              let userNumber = 'Unknown';
              
              if (userId.includes('@s.whatsapp.net')) {
                userNumber = userId.split('@')[0];
                userInfo = `@${userNumber}`;
              } else if (userId.includes('@lid')) {
                // Handle Linked ID (privacy mode)
                const lidNumber = userId.split('@')[0];
                userInfo = `Hidden User (${lidNumber})`;
                userNumber = lidNumber;
              }
              
              console.log(`🚫 Leave detected: ${userId} from ${id}`);
              
              // Send notification (rate limited)
              const now = Date.now();
              if (now - groupData.lastNotification > 5000) { // 5 second cooldown
                const notificationText = `
🚨 *LEAVE DETECTED*

👤 User: ${userInfo}
📊 Total leaves: ${groupData.leaveLogs.length}
🕒 Time: ${new Date().toLocaleTimeString()}

⚠️ User attempted to leave the group.
${userId.includes('@lid') ? '\n🔒 *Note:* User is in privacy mode (Linked ID)' : ''}

_Admin attention required._
                `.trim();
                
                try {
                  await sock.sendMessage(id, { text: notificationText });
                  groupData.lastNotification = now;
                } catch (msgError) {
                  console.error('Failed to send notification:', msgError);
                }
              }
              
              // Optional: Try to get phone number from message history
              if (userId.includes('@lid')) {
                try {
                  // Try to find their real number in recent messages
                  const messages = await sock.fetchMessagesFromWA(id, 50);
                  for (const message of messages) {
                    if (message.key.participant === userId) {
                      // Found a message from this user
                      console.log(`Found message from ${userId} with ID: ${message.key.id}`);
                      break;
                    }
                  }
                } catch (err) {
                  // Ignore errors
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Leave handler error:', error);
    }
  });
  
  console.log('✅ Leave detection system ready');
}

// Alternative: Simpler version that just notifies
export const simpleAntiLeave = {
  name: 'leavealert',
  description: 'Get notified when users leave',
  category: 'group',
  
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ Groups only.' }, { quoted: msg });
    }
    
    // Simple always-on leave alert
    sock.ev.on('group-participants.update', async (update) => {
      if (update.id === jid && update.action === 'remove') {
        for (const user of update.participants) {
          const time = new Date().toLocaleTimeString();
          const userDisplay = user.includes('@lid') ? 'Hidden User' : `@${user.split('@')[0]}`;
          
          await sock.sendMessage(jid, {
            text: `🚨 ${userDisplay} left the group at ${time}`
          });
        }
      }
    });
    
    return sock.sendMessage(jid, { 
      text: '✅ Leave alerts activated for this session.\nI will notify when anyone leaves.' 
    }, { quoted: msg });
  }
};