/** .link — Get group invite link */
module.exports = {
  name: 'link',
  aliases: ['invitelink', 'grouplink', 'glink'],
  desc: 'Get the group invite link',
  category: 'group',
  async execute({ sock, msg, from, isGroup, reply }) {
    if (!isGroup) return reply('❌ Group only.');
    try {
      const code = await sock.groupInviteCode(from);
      await reply(`🔗 *Group Invite Link:*\nhttps://chat.whatsapp.com/${code}`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
