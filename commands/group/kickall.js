export default {
  name: 'kickall',
  description: 'Removes all members from the group except admins.',
  execute: async (sock, msg, args, metadata) => {
    const isGroup = msg.key.remoteJid.endsWith('@g.us');

    if (!isGroup) {
      return sock.sendMessage(msg.key.remoteJid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    try {
      // Get group metadata including all participants
      const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
      const participants = groupMetadata.participants;
      
      // Filter out admins (only remove regular participants)
      const nonAdminParticipants = participants
        .filter(participant => participant.admin !== 'admin' && participant.admin !== 'superadmin')
        .map(participant => participant.id);

      // Check if there are non-admin participants to remove
      if (nonAdminParticipants.length === 0) {
        return sock.sendMessage(msg.key.remoteJid, { text: 'ℹ️ No non-admin members to kick.' }, { quoted: msg });
      }

      // Send a warning message first
      await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Starting to kick ${nonAdminParticipants.length} member(s)... This may take a moment.` }, { quoted: msg });

      // Kick all non-admin participants
      await sock.groupParticipantsUpdate(msg.key.remoteJid, nonAdminParticipants, 'remove');
      
      await sock.sendMessage(msg.key.remoteJid, { text: `✅ Successfully kicked ${nonAdminParticipants.length} member(s) from the group.` }, { quoted: msg });
      
    } catch (err) {
      console.error('Kickall error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to kick members. I might not have admin permissions.' }, { quoted: msg });
    }
  },
};