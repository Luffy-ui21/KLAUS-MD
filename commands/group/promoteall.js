// export default {
//   name: 'promoteall',
//   description: 'Promote all members in the group to admin',
//   category: 'group',
//   async execute(sock, msg, args, metadata) {
//     const jid = msg.key.remoteJid;
    
//     // Debug: Log the sender info
//     console.log('Raw sender:', msg.key.participant);
//     console.log('Full message key:', JSON.stringify(msg.key, null, 2));
    
//     // Check if it's a group
//     if (!jid.endsWith('@g.us')) {
//       await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
//       return;
//     }

//     // Get fresh group metadata
//     let groupMetadata;
//     try {
//       groupMetadata = await sock.groupMetadata(jid);
//       console.log('Group participants:', groupMetadata.participants.length);
//     } catch (error) {
//       console.error('Error fetching group metadata:', error);
//       await sock.sendMessage(jid, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
//       return;
//     }

//     // FIX: Properly get sender ID
//     let sender = msg.key.participant;
    
//     // If no participant in key, it might be from a non-group message or the sender is the same as jid
//     if (!sender) {
//       // Try to get sender from message
//       sender = msg.key.fromMe ? sock.user.id : msg.key.remoteJid;
//     }
    
//     // Ensure sender JID is properly formatted
//     if (sender && !sender.includes('@')) {
//       sender = sender + '@s.whatsapp.net';
//     }
    
//     console.log('Formatted sender:', sender);
    
//     // Check if sender is in group participants
//     const senderParticipant = groupMetadata.participants.find(p => {
//       // Compare without any suffixes
//       const cleanParticipantId = p.id.split(':')[0];
//       const cleanSenderId = sender.split(':')[0];
//       return cleanParticipantId === cleanSenderId;
//     });
    
//     console.log('Found sender participant:', senderParticipant);
    
//     const isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';

//     if (!isAdmin) {
//       await sock.sendMessage(jid, { 
//         text: `🛑 Only group admins can use this command.\n\nDebug: You are ${senderParticipant ? 'not an admin' : 'not found in group'}.`
//       }, { quoted: msg });
//       return;
//     }

//     // Check if bot is admin
//     const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
//     const botParticipant = groupMetadata.participants.find(p => p.id === botId);
//     const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
    
//     // if (!isBotAdmin) {
//     //   await sock.sendMessage(jid, { text: '❌ I need admin permissions to promote members.' }, { quoted: msg });
//     //   return;
//     // }

//     // Get all non-admin participants (excluding bot)
//     const participantsToPromote = groupMetadata.participants
//       .filter(p => !p.admin && p.id !== botId)
//       .map(p => p.id);

//     console.log('Participants to promote:', participantsToPromote.length);

//     if (participantsToPromote.length === 0) {
//       await sock.sendMessage(jid, { 
//         text: 'ℹ️ Everyone in this group is already an admin!'
//       }, { quoted: msg });
//       return;
//     }

//     // Send initial message
//     await sock.sendMessage(jid, { 
//       text: `🚀 Starting to promote ${participantsToPromote.length} members...`
//     }, { quoted: msg });

//     try {
//       // Promote in very small batches to avoid rate limits
//       const batchSize = 2;
//       let successful = 0;
//       let failed = 0;
//       const failedUsers = [];

//       for (let i = 0; i < participantsToPromote.length; i += batchSize) {
//         const batch = participantsToPromote.slice(i, i + batchSize);
        
//         try {
//           console.log(`Promoting batch ${i/batchSize + 1}:`, batch);
//           await sock.groupParticipantsUpdate(jid, batch, 'promote');
//           successful += batch.length;
          
//           // Send progress update every 10 promotions or so
//           if (successful % 10 === 0 || i + batchSize >= participantsToPromote.length) {
//             await sock.sendMessage(jid, { 
//               text: `📊 Progress: ${successful}/${participantsToPromote.length} promoted`
//             });
//           }
//         } catch (batchError) {
//           console.error('Batch error:', batchError);
//           failed += batch.length;
          
//           // Try individually
//           for (const user of batch) {
//             try {
//               await sock.groupParticipantsUpdate(jid, [user], 'promote');
//               successful++;
//               failed--;
//               console.log(`Retry successful for: ${user}`);
//             } catch (indvError) {
//               console.error(`Failed to promote ${user}:`, indvError.message);
//               failedUsers.push(user.split('@')[0]);
//             }
//           }
//         }
        
//         // Longer delay between batches
//         if (i + batchSize < participantsToPromote.length) {
//           await new Promise(resolve => setTimeout(resolve, 2000));
//         }
//       }

//       // Send final result
//       let resultText = `✅ *Promotion Complete!*\n\n`;
//       resultText += `✓ Successfully promoted: ${successful} members\n`;
      
//       if (failed > 0) {
//         resultText += `✗ Failed to promote: ${failed} members\n`;
//         if (failedUsers.length > 0) {
//           resultText += `\nFailed users (first few): ${failedUsers.slice(0, 3).join(', ')}`;
//           if (failedUsers.length > 3) resultText += `...`;
//         }
//       } else {
//         resultText += `\n🎉 *All ${successful} members are now admins!*\n`;
//         resultText += `Everyone got Alpha rank! `;
//       }

//       await sock.sendMessage(jid, { 
//         text: resultText
//       }, { quoted: msg });

//     } catch (error) {
//       console.error('PromoteAll Error:', error);
      
//       let errorMsg = '❌ Failed to promote members: ';
//       if (error.message.includes('not authorized')) {
//         errorMsg += 'Bot needs admin permissions.';
//       } else if (error.message.includes('rate limit')) {
//         errorMsg += 'Rate limited. Try again in a few minutes.';
//       } else {
//         errorMsg += error.message;
//       }
      
//       await sock.sendMessage(jid, { text: errorMsg }, { quoted: msg });
//     }
//   }
// };















export default {
  name: 'promoteall',
  description: 'Promote all members in the group to admin',
  category: 'group',
  async execute(sock, msg, args, metadata) {
    const jid = msg.key.remoteJid;
    
    // Check if it's a group
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      return;
    }

    // Add reaction to show command received
    try {
      await sock.sendMessage(jid, {
        react: {
          text: '🔄', // Loading/processing emoji
          key: msg.key
        }
      });
    } catch (reactError) {
      console.log('Could not send reaction:', reactError);
    }

    // Get fresh group metadata
    let groupMetadata;
    try {
      groupMetadata = await sock.groupMetadata(jid);
    } catch (error) {
      console.error('Error fetching group metadata:', error);
      await sock.sendMessage(jid, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
      return;
    }

    // Get sender ID
    let sender = msg.key.participant || msg.key.remoteJid;
    if (sender && !sender.includes('@')) {
      sender = sender + '@s.whatsapp.net';
    }

    // Check if sender is admin
    const senderParticipant = groupMetadata.participants.find(p => {
      const cleanParticipantId = p.id.split(':')[0];
      const cleanSenderId = sender.split(':')[0];
      return cleanParticipantId === cleanSenderId;
    });

    const isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';

    if (!isAdmin) {
      await sock.sendMessage(jid, { 
        text: '🛑 Only group admins can use this command.' 
      }, { quoted: msg });
      return;
    }

    // Check if bot is admin
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botParticipant = groupMetadata.participants.find(p => p.id === botId);
    const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
    
    // if (!isBotAdmin) {
    //   await sock.sendMessage(jid, { text: '❌ I need admin permissions to promote members.' }, { quoted: msg });
    //   return;
    // }

    // Get all non-admin participants (excluding bot)
    const participantsToPromote = groupMetadata.participants
      .filter(p => !p.admin && p.id !== botId)
      .map(p => p.id);

    if (participantsToPromote.length === 0) {
      await sock.sendMessage(jid, { 
        text: 'ℹ️ Everyone in this group is already an admin!'
      }, { quoted: msg });
      return;
    }

    try {
      // Promote in batches
      const batchSize = 3;
      let successful = 0;
      let failed = 0;
      const failedUsers = [];

      for (let i = 0; i < participantsToPromote.length; i += batchSize) {
        const batch = participantsToPromote.slice(i, i + batchSize);
        
        try {
          await sock.groupParticipantsUpdate(jid, batch, 'promote');
          successful += batch.length;
        } catch (batchError) {
          failed += batch.length;
          
          // Try individually
          for (const user of batch) {
            try {
              await sock.groupParticipantsUpdate(jid, [user], 'promote');
              successful++;
              failed--;
            } catch (indvError) {
              failedUsers.push(user.split('@')[0]);
            }
          }
        }
        
        // Delay between batches
        if (i + batchSize < participantsToPromote.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Send final result only
      let resultText = `✅ *Promotion Complete!*\n`;
      resultText += `✓ Successfully promoted: ${successful} members\n`;
      
      if (failed > 0) {
        resultText += `✗ Failed to promote: ${failed} members\n`;
        if (failedUsers.length > 0) {
          resultText += `\nFailed users: ${failedUsers.slice(0, 5).join(', ')}`;
          if (failedUsers.length > 5) resultText += ` and ${failedUsers.length - 5} more`;
        }
      } else {
        resultText += `\n🎉 *All ${successful} members are now Alpha rank!* \n`;
        resultText += `The pack has grown stronger! 💪`;
      }

      // Send final message
      await sock.sendMessage(jid, { 
        text: resultText
      }, { quoted: msg });

      // Update reaction to success
      try {
        await sock.sendMessage(jid, {
          react: {
            text: '✅', // Success emoji
            key: msg.key
          }
        });
      } catch (reactError) {
        console.log('Could not update reaction:', reactError);
      }

    } catch (error) {
      console.error('PromoteAll Error:', error);
      
      // Update reaction to error
      try {
        await sock.sendMessage(jid, {
          react: {
            text: '❌', // Error emoji
            key: msg.key
          }
        });
      } catch (reactError) {
        console.log('Could not send error reaction:', reactError);
      }
      
      let errorMsg = '❌ Failed to promote members. ';
      if (error.message.includes('not authorized')) {
        errorMsg += 'I need admin permissions to promote members.';
      } else if (error.message.includes('rate limit')) {
        errorMsg += 'Rate limited. Try again in a few minutes.';
      } else {
        errorMsg += 'Try again later.';
      }
      
      await sock.sendMessage(jid, { text: errorMsg }, { quoted: msg });
    }
  }
};
