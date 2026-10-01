/** .setdesc — Set group description */
module.exports = {
  name: 'setdesc',
  aliases: ['setdescription', 'desc'],
  desc: 'Set the group description (admin only)',
  category: 'admin',
  async execute({ sock, msg, args, from, isGroup, reply }) {
    if (!isGroup) return reply('❌ Group only.');
    const desc = args.join(' ');
    if (!desc) return reply('❌ Provide a description.\nUsage: `.setdesc Welcome to my group`');
    try {
      await sock.groupUpdateDescription(from, desc);
      await reply(`✅ Group description updated.`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
