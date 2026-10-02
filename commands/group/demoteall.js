// export default {
//   name: 'demoteall',
//   description: 'Demote all admins in the group (except bot and superadmin)',
//   category: 'group',
//   async execute(sock, msg, args, metadata) {
//     const jid = msg.key.remoteJid;
    
//     // Check if it's a group
//     if (!jid.endsWith('@g.us')) {
//       await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
//       return;
//     }

//     // Add initial reaction
//     try {
//       await sock.sendMessage(jid, {
//         react: { text: '⏳', key: msg.key }
//       });
//     } catch (e) {}

//     // Get fresh group metadata
//     let groupMetadata;
//     try {
//       groupMetadata = await sock.groupMetadata(jid);
//     } catch (error) {
//       console.error('Error fetching group metadata:', error);
//       await sock.sendMessage(jid, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
//       return;
//     }

//     // Get sender ID
//     let sender = msg.key.participant || jid;
//     if (sender && !sender.includes('@')) {
//       sender = sender + '@s.whatsapp.net';
//     }

//     // Check if sender is superadmin
//     const senderParticipant = groupMetadata.participants.find(p => {
//       const cleanParticipantId = p.id.split(':')[0];
//       const cleanSenderId = sender.split(':')[0];
//       return cleanParticipantId === cleanSenderId;
//     });

//     const isSuperAdmin = senderParticipant?.admin === 'superadmin';
    
//     // Only superadmin can demote all
//     if (!isSuperAdmin) {
//       await sock.sendMessage(jid, { 
//         text: '🛑 Only group superadmin can use this command.\n\nNote: This command can demote ALL admins including yourself. Use with caution!'
//       }, { quoted: msg });
      
//       // Update reaction to warning
//       try {
//         await sock.sendMessage(jid, {
//           react: { text: '⚠️', key: msg.key }
//         });
//       } catch (e) {}
      
//       return;
//     }

//     // Check if bot is admin
//     const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
//     const botParticipant = groupMetadata.participants.find(p => p.id === botId);
//     const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
    
//     // if (!isBotAdmin) {
//     //   await sock.sendMessage(jid, { text: '❌ I need admin permissions to demote members.' }, { quoted: msg });
//     //   return;
//     // }

//     // Get all admin participants to demote
//     // Filter out: bot, superadmin (sender), and non-admins
//     const participantsToDemote = groupMetadata.participants
//       .filter(p => {
//         // Keep only admins (not superadmins except the sender if they're not superadmin)
//         const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
//         const isBot = p.id === botId;
//         const isSender = p.id === senderParticipant.id;
        
//         // Don't demote: bot, sender (superadmin), or non-admins
//         return isAdmin && !isBot && !isSender;
//       })
//       .map(p => p.id);

//     console.log('Admins to demote:', participantsToDemote.length);

//     if (participantsToDemote.length === 0) {
//       await sock.sendMessage(jid, { 
//         text: 'ℹ️ There are no other admins to demote in this group.\n\nOnly you (superadmin) and I (bot) have admin privileges.'
//       }, { quoted: msg });
      
//       // Update reaction to info
//       try {
//         await sock.sendMessage(jid, {
//           react: { text: 'ℹ️', key: msg.key }
//         });
//       } catch (e) {}
      
//       return;
//     }

//     // Add warning for large number of admins
//     if (participantsToDemote.length > 5) {
//       const warningMsg = await sock.sendMessage(jid, { 
//         text: `⚠️ *WARNING: You are about to demote ${participantsToDemote.length} admins!*\n\n` +
//               `This action cannot be undone. Type \`.confirm demoteall\` within 15 seconds to proceed.`
//       }, { quoted: msg });
      
//       // Store confirmation data
//       global.demoteAllConfirmations = global.demoteAllConfirmations || {};
//       global.demoteAllConfirmations[sender] = {
//         jid,
//         participants: participantsToDemote,
//         timestamp: Date.now()
//       };
      
//       // Auto-cleanup after 15 seconds
//       setTimeout(() => {
//         if (global.demoteAllConfirmations && global.demoteAllConfirmations[sender]) {
//           delete global.demoteAllConfirmations[sender];
//         }
//       }, 15000);
      
//       return;
//     }

//     // If 5 or less admins, proceed directly
//     await demoteMembers(sock, jid, participantsToDemote, msg, senderParticipant);
//   }
// };

// // Helper function to demote members
// async function demoteMembers(sock, jid, participants, originalMsg, senderParticipant) {
//   try {
//     let successful = 0;
//     let failed = 0;
//     const failedUsers = [];

//     // Demote in small batches
//     for (let i = 0; i < participants.length; i += 2) {
//       const batch = participants.slice(i, i + 2);
      
//       try {
//         await sock.groupParticipantsUpdate(jid, batch, 'demote');
//         successful += batch.length;
//       } catch (batchError) {
//         failed += batch.length;
        
//         // Try individually
//         for (const user of batch) {
//           try {
//             await sock.groupParticipantsUpdate(jid, [user], 'demote');
//             successful++;
//             failed--;
//           } catch (indvError) {
//             failedUsers.push(user.split('@')[0]);
//           }
//         }
//       }
      
//       // Delay between batches
//       if (i + 2 < participants.length) {
//         await new Promise(resolve => setTimeout(resolve, 1000));
//       }
//     }

//     // Prepare result message
//     let resultText = `✅ *Demotion Complete!*\n`;
//     resultText += `✓ Successfully demoted: ${successful} admins\n`;
    
//     if (failed > 0) {
//       resultText += `✗ Failed to demote: ${failed} admins\n`;
//       if (failedUsers.length > 0) {
//         resultText += `\nFailed: ${failedUsers.slice(0, 3).join(', ')}`;
//         if (failedUsers.length > 3) resultText += `...`;
//       }
//     } else {
//       resultText += `\n📉 *All ${successful} admins have been demoted to member rank.*\n`;
//       resultText += `Only you (superadmin) and I (bot) remain as admins.`;
      
//       // Warning about self-demotion
//       resultText += `\n\n⚠️ *Note:* If you want to demote yourself, use the regular .demote command.`;
//     }

//     // Send final message
//     await sock.sendMessage(jid, { 
//       text: resultText
//     }, { quoted: originalMsg });

//     // Update reaction to success
//     try {
//       await sock.sendMessage(jid, {
//         react: { text: '✅', key: originalMsg.key }
//       });
//     } catch (e) {}

//     // Optional: DM to sender about the action
//     try {
//       await sock.sendMessage(senderParticipant.id, {
//         text: `📋 *DemoteAll Action Report*\n\n` +
//               `• Group: ${jid}\n` +
//               `• Admins demoted: ${successful}\n` +
//               `• Failed: ${failed}\n` +
//               `• Time: ${new Date().toLocaleString()}\n\n` +
//               `You remain as the only superadmin in the group.`
//       });
//     } catch (dmError) {
//       console.log('Could not send DM report');
//     }

//   } catch (error) {
//     console.error('DemoteAll Error:', error);
    
//     // Update reaction to error
//     try {
//       await sock.sendMessage(jid, {
//         react: { text: '❌', key: originalMsg.key }
//       });
//     } catch (e) {}
    
//     let errorMsg = '❌ Failed to demote admins. ';
//     if (error.message.includes('not authorized')) {
//       errorMsg += 'I need admin permissions to demote members.';
//     } else {
//       errorMsg += 'Try again later.';
//     }
    
//     await sock.sendMessage(jid, { text: errorMsg }, { quoted: originalMsg });
//   }
// }

// // Confirmation handler for demoteall
// export const demoteAllConfirmation = {
//   name: 'confirm demoteall',
//   description: 'Confirm demoteall command',
//   async execute(sock, msg, args) {
//     const jid = msg.key.remoteJid;
//     const sender = msg.key.participant || jid;
    
//     if (!global.demoteAllConfirmations || !global.demoteAllConfirmations[sender]) {
//       await sock.sendMessage(jid, { 
//         text: '❌ No pending demotion confirmation found or it has expired.'
//       });
//       return;
//     }
    
//     const confirmation = global.demoteAllConfirmations[sender];
    
//     // Check if confirmation is recent (within 15 seconds)
//     if (Date.now() - confirmation.timestamp > 15000) {
//       delete global.demoteAllConfirmations[sender];
//       await sock.sendMessage(jid, { 
//         text: '❌ Confirmation expired. Please start over.'
//       });
//       return;
//     }
    
//     // Get fresh group metadata to verify sender is still superadmin
//     try {
//       const groupMetadata = await sock.groupMetadata(jid);
//       const senderParticipant = groupMetadata.participants.find(p => p.id === sender);
      
//       if (senderParticipant?.admin !== 'superadmin') {
//         await sock.sendMessage(jid, { 
//           text: '❌ You are no longer superadmin. Command cancelled.'
//         });
//         delete global.demoteAllConfirmations[sender];
//         return;
//       }
      
//       // Proceed with demotion
//       delete global.demoteAllConfirmations[sender];
//       await demoteMembers(sock, jid, confirmation.participants, msg, senderParticipant);
      
//     } catch (error) {
//       console.error('Confirmation error:', error);
//       await sock.sendMessage(jid, { 
//         text: '❌ Error verifying permissions. Command cancelled.'
//       });
//       delete global.demoteAllConfirmations[sender];
//     }
//   }
// };









export default {
  name: 'demoteall',
  description: 'Demote all admins in the group',
  category: 'group',
  async execute(sock, msg, args, metadata) {
    const jid = msg.key.remoteJid;
    
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ Group only.' }, { quoted: msg });
      return;
    }

    // Add reaction
    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
    } catch (e) {}

    // Get group data
    let groupMetadata;
    try {
      groupMetadata = await sock.groupMetadata(jid);
    } catch (error) {
      await sock.sendMessage(jid, { text: '❌ Failed to get group info.' }, { quoted: msg });
      return;
    }

    // Get sender
    let sender = msg.key.participant || jid;
    if (sender && !sender.includes('@')) {
      sender = sender + '@s.whatsapp.net';
    }

    // Find sender in participants
    const senderParticipant = groupMetadata.participants.find(p => {
      return p.id.split(':')[0] === sender.split(':')[0];
    });

    // Check if superadmin
    if (senderParticipant?.admin !== 'superadmin') {
      await sock.sendMessage(jid, { 
        text: '🛑 Only superadmin can demote all.' 
      }, { quoted: msg });
      
      try {
        await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } });
      } catch (e) {}
      
      return;
    }

    // Bot ID for filtering
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    // Get ALL admins to demote (excluding bot and sender)
    const allAdmins = groupMetadata.participants
      .filter(p => {
        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        const isBot = p.id === botId;
        const isSender = p.id === senderParticipant.id;
        return isAdmin && !isBot && !isSender;
      })
      .map(p => p.id);

    if (allAdmins.length === 0) {
      await sock.sendMessage(jid, { 
        text: '✅ No other admins to demote.' 
      }, { quoted: msg });
      
      try {
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      } catch (e) {}
      
      return;
    }

    // Try to demote ALL at once first (fastest method)
    try {
      // Attempt to demote everyone in one go
      await sock.groupParticipantsUpdate(jid, allAdmins, 'demote');
      
      // If successful, send success message
      await sock.sendMessage(jid, { 
        text: `✅ *Demoted all ${allAdmins.length} admins successfully!*\n📉 Only superadmin remains.` 
      }, { quoted: msg });
      
      try {
        await sock.sendMessage(jid, { react: { text: '🎉', key: msg.key } });
      } catch (e) {}
      
    } catch (bulkError) {
      console.log('Bulk demote failed, trying batch method:', bulkError.message);
      
      // If bulk fails, try smaller batches
      try {
        let success = 0;
        let failed = 0;
        const failedUsers = [];
        
        // Use larger batch size for speed
        const batchSize = 10; // Increased from 2
        
        for (let i = 0; i < allAdmins.length; i += batchSize) {
          const batch = allAdmins.slice(i, i + batchSize);
          
          try {
            await sock.groupParticipantsUpdate(jid, batch, 'demote');
            success += batch.length;
          } catch (batchError) {
            // If batch fails, try each individually
            for (const user of batch) {
              try {
                await sock.groupParticipantsUpdate(jid, [user], 'demote');
                success++;
              } catch (indvError) {
                failed++;
                failedUsers.push(user.split('@')[0]);
              }
            }
          }
          
          // Very short delay or no delay for speed
          if (i + batchSize < allAdmins.length) {
            await new Promise(r => setTimeout(r, 300)); // Reduced delay
          }
        }
        
        // Result message
        let result = `✅ *Demotion Complete!*\n✓ Successfully demoted: ${success} admins`;
        
        if (failed > 0) {
          result += `\n✗ Failed: ${failed} admins`;
          if (failedUsers.length > 0) {
            result += `\nFailed users: ${failedUsers.slice(0, 5).join(', ')}`;
            if (failedUsers.length > 5) result += ` and ${failedUsers.length - 5} more`;
          }
        } else {
          result += `\n📉 All ${success} admins have been demoted.`;
          result += `\nOnly superadmin remains.`;
        }
        
        await sock.sendMessage(jid, { text: result }, { quoted: msg });
        
        // Update reaction
        try {
          await sock.sendMessage(jid, {
            react: { text: failed === 0 ? '🎉' : '✅', key: msg.key }
          });
        } catch (e) {}
        
      } catch (error) {
        console.error('Final error:', error);
        
        try {
          await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        } catch (e) {}
        
        await sock.sendMessage(jid, { 
          text: `❌ Failed to demote: ${error.message}` 
        }, { quoted: msg });
      }
    }
  }
};










