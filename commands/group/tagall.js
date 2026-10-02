// export default {
//   name: 'tagall',
//   description: 'Mentions all members in the group in a formatted list.',
//   execute: async (sock, msg, args, metadata) => {
//     const isGroup = msg.key.remoteJid.endsWith('@g.us');

//     if (!isGroup) {
//       return sock.sendMessage(msg.key.remoteJid, { text: '❌ This command only works in groups.' }, { quoted: msg });
//     }

//     try {
//       // Get group metadata
//       const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
//       const participants = groupMetadata.participants;
      
//       // Get all participants except the bot itself and status accounts
//       const allParticipants = participants
//         .filter(participant => !participant.id.includes('status') && participant.id !== sock.user.id.split(':')[0] + '@s.whatsapp.net')
//         .map(participant => ({
//           id: participant.id,
//           name: participant.name || participant.notify || participant.id.split('@')[0],
//           admin: participant.admin || 'member'
//         }));

//       if (allParticipants.length === 0) {
//         return sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ No members to tag.' }, { quoted: msg });
//       }

//       // Get optional custom message from args
//       const customMessage = args.length > 0 ? args.join(' ') : '📢 Attention everyone!';
      
//       // Separate admins and members
//       const admins = allParticipants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
//       const members = allParticipants.filter(p => p.admin !== 'admin' && p.admin !== 'superadmin');
      
//       // Create the header
//       let formattedText = `${customMessage}\n\n`;
      
//       // Top border
//       formattedText += "┌────────────────────┐\n";
      
//       // Group info section
//       const groupName = groupMetadata.subject || 'Group';
//       formattedText += `│ Group: ${groupName}\n`;
//       formattedText += `│ Total Members: ${allParticipants.length}\n`;
//       formattedText += "├───────────────────┤\n";
      
//       // Admins section
//       if (admins.length > 0) {
//         formattedText += `│ 👑 ADMINS (${admins.length})\n`;
//         formattedText += "├───────────────────┤\n";
//         admins.forEach((participant, index) => {
//           const paddedNumber = (index + 1).toString().padStart(2, '0');
//           const name = participant.name.length > 15 ? participant.name.substring(0, 12) + '...' : participant.name.padEnd(15, ' ');
//           formattedText += `│ ${paddedNumber}. @${name}\n`;
//         });
//         if (members.length > 0) {
//           formattedText += "├───────────────────┤\n";
//         }
//       }
      
//       // Members section
//       if (members.length > 0) {
//         formattedText += `│ 👥 MEMBERS (${members.length})\n`;
//         formattedText += "├───────────────────┤\n";
//         members.forEach((participant, index) => {
//           const paddedNumber = (admins.length + index + 1).toString().padStart(2, '0');
//           const name = participant.name.length > 15 ? participant.name.substring(0, 12) + '...' : participant.name.padEnd(15, ' ');
//           formattedText += `│ ${paddedNumber}. @${name}\n`;
//         });
//       }
      
//       // Bottom border
//       formattedText += "└────────────────────┘\n\n";
      
//       // Footer message
//       formattedText += `📍 All ${allParticipants.length} members have been notified.`;

//       // Collect all mention IDs
//       const mentionIds = allParticipants.map(p => p.id);

//       // Send message with mentions
//       await sock.sendMessage(msg.key.remoteJid, { 
//         text: formattedText,
//         mentions: mentionIds
//       }, { quoted: msg });

//     } catch (err) {
//       console.error('Tagall error:', err);
//       await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to tag members.' }, { quoted: msg });
//     }
//   },
// };






import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'tagall',
  description: 'Tags all members in the group.',
  execute: async (sock, msg, args, prefix, opts) => {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    try {
      const groupMetadata = await sock.groupMetadata(jid);
      const participants = groupMetadata.participants;

      const allParticipants = participants
        .filter(p => !p.id.includes('status') && p.id !== sock.user.id.split(':')[0] + '@s.whatsapp.net')
        .map(p => ({
          id: p.id,
          name: p.name || p.notify || p.id.split('@')[0],
          admin: p.admin || null
        }));

      if (allParticipants.length === 0) {
        return sock.sendMessage(jid, { text: 'ℹ️ No members to tag.' }, { quoted: msg });
      }

      const customMessage = args.length > 0 ? args.join(' ') : '';
      const groupName = groupMetadata.subject || 'Group';
      const admins = allParticipants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
      const members = allParticipants.filter(p => !p.admin);

      let text = `╭⊷ 📢 *TAG ALL*\n│\n`;
      if (customMessage) {
        text += `├⊷ 💬 ${customMessage}\n│\n`;
      }
      text += `├⊷ 🏷️ *Group:* ${groupName}\n`;
      text += `├⊷ 👥 *Members:* ${allParticipants.length}\n`;
      text += `│\n`;

      if (admins.length > 0) {
        text += `├⊷ 👑 *ADMINS* (${admins.length})\n`;
        admins.forEach((p, i) => {
          const num = (i + 1).toString().padStart(2, '0');
          const tag = p.admin === 'superadmin' ? '⭐' : '🔰';
          text += `├⊷ ${num}. ${tag} @${p.id.split('@')[0]}\n`;
        });
        text += `│\n`;
      }

      if (members.length > 0) {
        text += `├⊷ 👤 *MEMBERS* (${members.length})\n`;
        members.forEach((p, i) => {
          const num = (admins.length + i + 1).toString().padStart(2, '0');
          text += `├⊷ ${num}. @${p.id.split('@')[0]}\n`;
        });
        text += `│\n`;
      }

      text += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

      const mentionIds = allParticipants.map(p => p.id);

      let profilePicture = null;
      try {
        profilePicture = await sock.profilePictureUrl(jid, 'image');
      } catch {
        profilePicture = null;
      }

      if (profilePicture) {
        const response = await fetch(profilePicture);
        const buffer = await response.arrayBuffer();
        await sock.sendMessage(jid, {
          image: Buffer.from(buffer),
          caption: text,
          mentions: mentionIds
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          text,
          mentions: mentionIds
        }, { quoted: msg });
      }

    } catch (err) {
      console.error('Tagall error:', err);
      await sock.sendMessage(jid, { text: '❌ Failed to tag members.' }, { quoted: msg });
    }
  },
};