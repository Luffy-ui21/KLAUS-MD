import { getOwnerName, getFooter} from '../../lib/menuHelper.js';














// // export default {
// //   name: 'groupinfo',
// //   description: 'Shows detailed group information',
// //   category: 'group',
// //   async execute(sock, msg, args, metadata) {
// //     const sender = msg.key.remoteJid;
// //     const isGroup = sender.endsWith('@g.us');

// //     if (!isGroup) {
// //       await sock.sendMessage(sender, { 
// //         text: '❌ This command can only be used in groups.' 
// //       }, { quoted: msg });
// //       return;
// //     }

// //     try {
// //       // Ensure metadata has group data; if not, fetch it
// //       let groupInfo = metadata;
      
// //       // If metadata doesn't contain expected group info, fetch it directly
// //       if (!groupInfo || !groupInfo.id) {
// //         groupInfo = await sock.groupMetadata(sender);
// //       }

// //       const groupName = groupInfo.subject || 'N/A';
// //       const groupDesc = groupInfo.desc || 'No Description';
// //       const groupOwner = groupInfo.owner || groupInfo.participants?.find(p => p.admin === 'superadmin')?.id || 'Unknown';
// //       const memberCount = groupInfo.participants?.length || 0;
      
// //       // Get group creation date
// //       const creationTimestamp = groupInfo.creation || groupInfo.createdAt || null;
// //       let creationDate = 'Unknown';
      
// //       if (creationTimestamp) {
// //         const date = new Date(creationTimestamp * 1000); // Convert from seconds to milliseconds
// //         creationDate = date.toLocaleDateString('en-US', {
// //           weekday: 'long',
// //           year: 'numeric',
// //           month: 'long',
// //           day: 'numeric'
// //         });
// //       }

// //       // Format owner for mention
// //       const ownerFormatted = typeof groupOwner === 'string' ? 
// //         groupOwner.split('@')[0] : 
// //         (groupOwner.id || groupOwner).split('@')[0];

// //       // Prepare mentions (only owner)
// //       const mentions = [groupOwner];

// //       const infoText = ` *Group Info*\n\n` +
// //         `📛 *Name:* ${groupName}\n` +
// //         `👤 *Owner:* @${ownerFormatted}\n` +
// //         `👥 *Members:* ${memberCount}\n` +
// //         `📜 *Description:* ${groupDesc}\n` +
// //         `📅 *Created:* ${creationDate}\n\n` +
// //         `> Powered by WolfTech`;

// //       await sock.sendMessage(sender, {
// //         text: infoText,
// //         mentions: mentions
// //       }, { quoted: msg });

// //     } catch (err) {
// //       console.error('GroupInfo Error:', err);
// //       await sock.sendMessage(sender, { 
// //         text: '❌ Failed to fetch group info. Please try again.' 
// //       }, { quoted: msg });
// //     }
// //   }
// // };










// export default {
//   name: 'groupinfo',
//   description: 'Shows detailed group information',
//   category: 'group',
//   async execute(sock, msg, args, metadata) {
//     const sender = msg.key.remoteJid;
//     const isGroup = sender.endsWith('@g.us');

//     if (!isGroup) {
//       await sock.sendMessage(sender, { 
//         text: '❌ This command can only be used in groups.' 
//       }, { quoted: msg });
//       return;
//     }

//     try {
//       // Ensure metadata has group data; if not, fetch it
//       let groupInfo = metadata;
      
//       // If metadata doesn't contain expected group info, fetch it directly
//       if (!groupInfo || !groupInfo.id) {
//         groupInfo = await sock.groupMetadata(sender);
//       }

//       const groupName = groupInfo.subject || 'N/A';
//       const groupDesc = groupInfo.desc || 'No Description';
//       const groupOwner = groupInfo.owner || groupInfo.participants?.find(p => p.admin === 'superadmin')?.id || 'Unknown';
//       const memberCount = groupInfo.participants?.length || 0;
      
//       // Get group creation date
//       const creationTimestamp = groupInfo.creation || groupInfo.createdAt || null;
//       let creationDate = 'Unknown';
      
//       if (creationTimestamp) {
//         const date = new Date(creationTimestamp * 1000); // Convert from seconds to milliseconds
//         creationDate = date.toLocaleDateString('en-US', {
//           weekday: 'long',
//           year: 'numeric',
//           month: 'long',
//           day: 'numeric'
//         });
//       }

//       // Format owner for mention
//       const ownerFormatted = typeof groupOwner === 'string' ? 
//         groupOwner.split('@')[0] : 
//         (groupOwner.id || groupOwner).split('@')[0];

//       // Prepare mentions (only owner)
//       const mentions = [groupOwner];

//       // Prepare the info text
//       const infoText = ` *Group Info*\n\n` +
//         `📛 *Name:* ${groupName}\n` +
//         `👤 *Owner:* @${ownerFormatted}\n` +
//         `👥 *Members:* ${memberCount}\n` +
//         `📜 *Description:* ${groupDesc}\n` +
//         `📅 *Created:* ${creationDate}\n\n` +
//         `> Powered by WolfTech`;

//       // Try to get group profile picture (thumbnail)
//       let profilePicture;
//       try {
//         profilePicture = await sock.profilePictureUrl(sender, 'image');
//       } catch (err) {
//         console.log('No profile picture found for group, using text-only...');
//         profilePicture = null;
//       }

//       // Send message with or without profile picture
//       if (profilePicture) {
//         try {
//           // Download the image
//           const response = await fetch(profilePicture);
//           const buffer = await response.arrayBuffer();
          
//           await sock.sendMessage(sender, { 
//             image: Buffer.from(buffer),
//             caption: infoText,
//             mentions: mentions
//           }, { quoted: msg });
//         } catch (imgErr) {
//           console.log('Failed to fetch image, sending text only:', imgErr);
//           // Fallback to text only
//           await sock.sendMessage(sender, { 
//             text: infoText,
//             mentions: mentions
//           }, { quoted: msg });
//         }
//       } else {
//         // Send without image if no profile picture
//         await sock.sendMessage(sender, {
//           text: infoText,
//           mentions: mentions
//         }, { quoted: msg });
//       }

//     } catch (err) {
//       console.error('GroupInfo Error:', err);
//       await sock.sendMessage(sender, { 
//         text: '❌ Failed to fetch group info. Please try again.\n\n> Powered by WolfTech'
//       }, { quoted: msg });
//     }
//   }
// };
























export default {
  name: 'groupinfo',
  description: 'Shows detailed group information',
  category: 'group',
  async execute(sock, msg, args, metadata) {
    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');

    if (!isGroup) {
      await sock.sendMessage(sender, { 
        text: '❌ This command can only be used in groups.' 
      }, { quoted: msg });
      return;
    }

    try {
      // Ensure metadata has group data; if not, fetch it
      let groupInfo = metadata;
      
      // If metadata doesn't contain expected group info, fetch it directly
      if (!groupInfo || !groupInfo.id) {
        groupInfo = await sock.groupMetadata(sender);
      }

      const groupName = groupInfo.subject || 'N/A';
      const groupDesc = groupInfo.desc || 'No Description';
      const memberCount = groupInfo.participants?.length || 0;
      
      // Get group creation date
      const creationTimestamp = groupInfo.creation || groupInfo.createdAt || null;
      let creationDate = 'Unknown';
      
      if (creationTimestamp) {
        const date = new Date(creationTimestamp * 1000); // Convert from seconds to milliseconds
        creationDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      // Get full group ID (with @g.us suffix)
      const groupId = sender;
      
      // Get group mode (restricted or not)
      const isRestricted = groupInfo.restrict || false;
      const groupMode = isRestricted ? '🔒 Restricted (Admin Only)' : '🔓 Open for All Members';
      
      // Find super admin (creator) and all admins
      const participants = groupInfo.participants || [];
      const superAdmin = participants.find(p => p.admin === 'superadmin');
      const allAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
      
      const adminCount = allAdmins.length;
      
      // Format super admin for display
      let superAdminInfo = 'Unknown';
      if (superAdmin) {
        const superAdminName = superAdmin.name || superAdmin.notify || superAdmin.id.split('@')[0];
        superAdminInfo = `@${superAdminName}`;
      }

      // Format owner for mention (use super admin if available)
      const groupOwner = superAdmin?.id || groupInfo.owner || 'Unknown';
      const ownerFormatted = typeof groupOwner === 'string' ? 
        groupOwner.split('@')[0] : 
        (groupOwner.id || groupOwner).split('@')[0];

      // Prepare mentions (only super admin)
      const mentions = superAdmin ? [superAdmin.id] : [];

      // Prepare the info text with borders
      const infoText = 
        "┏━━━━━━━━━━━━━━━━━━━━\n" +
        `┃  *GROUP INFORMATION* \n` +
        "┣━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ 📛 *Name:* ${groupName}\n` +
        `┃ 🆔 *ID:* ${groupId}\n` +
        "┣━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ 👑 *Super Admin:* ${superAdminInfo}\n` +
        `┃ ⭐ *Total Admins:* ${adminCount}\n` +
        `┃ 👥 *Total Members:* ${memberCount}\n` +
        "┣━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ 📜 *Description:*\n` +
        `┃ ${groupDesc}\n` +
        "┣━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ 📅 *Created:* ${creationDate}\n` +
        `┃ 🔧 *Mode:* ${groupMode}\n` +
        "┣━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ > ${getFooter(msg.key.participant || msg.key.remoteJid)}
` +
        "┗━━━━━━━━━━━━━━━━━━━━";

      // Try to get group profile picture (thumbnail)
      let profilePicture;
      try {
        profilePicture = await sock.profilePictureUrl(sender, 'image');
      } catch (err) {
        console.log('No profile picture found for group, using text-only...');
        profilePicture = null;
      }

      // Send message with or without profile picture
      if (profilePicture) {
        try {
          // Download the image
          const response = await fetch(profilePicture);
          const buffer = await response.arrayBuffer();
          
          await sock.sendMessage(sender, { 
            image: Buffer.from(buffer),
            caption: infoText,
            mentions: mentions
          }, { quoted: msg });
        } catch (imgErr) {
          console.log('Failed to fetch image, sending text only:', imgErr);
          // Fallback to text only
          await sock.sendMessage(sender, { 
            text: infoText,
            mentions: mentions
          }, { quoted: msg });
        }
      } else {
        // Send without image if no profile picture
        await sock.sendMessage(sender, {
          text: infoText,
          mentions: mentions
        }, { quoted: msg });
      }

    } catch (err) {
      console.error('GroupInfo Error:', err);
      // Error message with border
      const errorText = 
        "┏━━━━━━━━━━━━━━━━━━━━━━┓\n" +
        `┃ ❌ *GROUP INFO ERROR* ┃\n` +
        "┣━━━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ Failed to fetch group info.\n` +
        `┃ Please try again.\n` +
        "┣━━━━━━━━━━━━━━━━━━━━━━\n" +
        `┃ > ${getFooter(msg.key.participant || msg.key.remoteJid)}
` +
        "┗━━━━━━━━━━━━━━━━━━━━━━┛";
      
      await sock.sendMessage(sender, { 
        text: errorText
      }, { quoted: msg });
    }
  }
};