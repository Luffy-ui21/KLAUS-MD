/** .delete — Delete a message (replied to) */
module.exports = {
  name: 'delete',
  aliases: ['del', 'd'],
  desc: 'Delete a replied-to message',
  category: 'admin',
  async execute({ sock, msg, from, reply, botName }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!quoted) return reply('❌ Reply to a message to delete it.\nUsage: `.delete` (reply to a message)');

    try {
      await sock.sendMessage(from, {
        delete: { remoteJid: from, fromMe: false, id: quoted, participant: quotedParticipant }
      });
      await reply(`🗑️ Message deleted by ${botName}`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
