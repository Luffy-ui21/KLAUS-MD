/** .setname — Set group name */
module.exports = {
  name: 'setname',
  aliases: ['setgroupname', 'rename'],
  desc: 'Change the group name (admin only)',
  category: 'admin',
  async execute({ sock, msg, args, from, isGroup, reply }) {
    if (!isGroup) return reply('❌ Group only.');
    const name = args.join(' ');
    if (!name) return reply('❌ Provide a name.\nUsage: `.setname My Cool Group`');
    try {
      await sock.groupUpdateSubject(from, name);
      await reply(`✅ Group name changed to: *${name}*`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
