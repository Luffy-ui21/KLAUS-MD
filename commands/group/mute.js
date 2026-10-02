// export default {
//   name: 'mute',
//   description: 'Mute the group (read-only)',
//   category: 'group',
//   async execute(sock, msg, args, metadata) {
//     const sender = msg.key.remoteJid;
//     const isGroup = sender.endsWith('@g.us');

//     if (!isGroup) {
//       await sock.sendMessage(sender, { text: '❌ This command can only be used within a pack (group).' }, { quoted: msg });
//       return;
//     }

//     const user = msg.key.participant || msg.participant || msg.key.remoteJid;
//     const groupAdmins = metadata.participants.filter(p => p.admin);
//     const isAdmin = groupAdmins.some(p => p.id === user);

//     if (!isAdmin) {
//       await sock.sendMessage(sender, { text: '⛔ Only the Alpha wolves (admins) can silence the pack.' }, { quoted: msg });
//       return;
//     }

//     try {
//       await sock.groupSettingUpdate(sender, 'announcement'); // read-only
//       await sock.sendMessage(sender, {
//         text: '🔇 *The pack has been silenced.*\nOnly the leaders may now speak.',
//       }, { quoted: msg });
//     } catch (error) {
//       console.error(error);
//       await sock.sendMessage(sender, {
//         text: '⚠️ Failed to mute the pack. Try again or check permissions.',
//       }, { quoted: msg });
//     }
//   }
// };











export default {
  name: 'mute',
  description: 'Mute the group (read-only)',
  category: 'group',
  alias: ['lock', 'silence', 'closegroup', 'close'],
  async execute(sock, msg, args, prefix, extra) {
    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');

    if (!isGroup) {
      await sock.sendMessage(sender, { 
        text: '❌ This command can only be used within a pack (group).' 
      }, { quoted: msg });
      return;
    }

    try {
      // Get group metadata
      const groupMetadata = extra?.groupMetadata || await sock.groupMetadata(sender);

      // Get the user who sent the message — normalize to numeric part to handle LID vs phone JID
      const userRaw = msg.key.participant || msg.key.remoteJid;
      const userClean = userRaw.split(':')[0].split('@')[0];

      // Check if user is an admin (compare numeric parts to handle LID ↔ phone JID mismatch)
      const participant = groupMetadata.participants.find(p => {
        const pClean = p.id.split(':')[0].split('@')[0];
        return pClean === userClean;
      });
      const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
      const isOwner = typeof extra?.isOwner === 'function' ? extra.isOwner() : extra?.isOwner;

      if (!isAdmin && !isOwner) {
        await sock.sendMessage(sender, { 
          text: '⛔ Only the Alpha wolves (admins) can silence the pack.' 
        }, { quoted: msg });
        return;
      }

      // Check if already muted
      const currentSetting = groupMetadata.announce;
      if (currentSetting) {
        await sock.sendMessage(sender, { 
          text: '🔕 *The pack is already silent.*\nOnly leaders can speak.'
        }, { quoted: msg });
        return;
      }

      // Mute the group (set to announcement/read-only)
      await sock.groupSettingUpdate(sender, 'announcement');
      
      await sock.sendMessage(sender, {
        text: '🔇 *The pack has been silenced!*\n\n' +
              'Only the Alpha wolves (admins) may now speak.\n' +
              `To unmute, use: *${prefix || '.'}unmute*`
      }, { quoted: msg });

    } catch (error) {
      console.error('Mute command error:', error);
      
      let errorMessage = '⚠️ Failed to mute the pack. ';
      if (error.message?.includes('not authorized')) {
        errorMessage += 'Bot needs admin permissions.';
      } else if (error.message?.includes('401')) {
        errorMessage += 'Invalid permissions.';
      } else {
        errorMessage += 'Try again later.';
      }
      
      await sock.sendMessage(sender, { text: errorMessage }, { quoted: msg });
    }
  }
};
