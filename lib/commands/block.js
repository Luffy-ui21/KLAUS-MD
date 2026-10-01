/** .block — Block a user */
module.exports = {
  name: 'block',
  aliases: ['banuser'],
  desc: 'Block a user from messaging you',
  category: 'owner',
  async execute({ sock, msg, from, reply }) {
    let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) target = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) {
      // If in DM, block the current chat partner
      if (!from.endsWith('@g.us')) target = from;
    }
    if (!target) return reply('❌ Mention or reply to the user you want to block.');

    try {
      await sock.updateBlockStatus(target, 'block');
      await reply(`✅ Blocked @${target.split('@')[0]}`, { mentions: [target] });
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
