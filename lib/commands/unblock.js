/** .unblock — Unblock a user */
module.exports = {
  name: 'unblock',
  aliases: ['unbanuser'],
  desc: 'Unblock a previously blocked user',
  category: 'owner',
  async execute({ sock, msg, from, reply }) {
    let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) target = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return reply('❌ Mention or reply to the user you want to unblock.');

    try {
      await sock.updateBlockStatus(target, 'unblock');
      await reply(`✅ Unblocked @${target.split('@')[0]}`, { mentions: [target] });
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
