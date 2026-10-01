/** .demote — Remove admin role (owner only) */
const { isBotOwner } = require('../utils/permissions');

module.exports = {
  name: 'demote',
  aliases: ['unadmin'],
  desc: 'Demote an admin to member (owner only)',
  category: 'admin',
  async execute({ sock, msg, args, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only.');
    if (!isBotOwner(msg, dbSession)) return reply('❌ *Only the bot owner can use this command.*');

    let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quoted) target = quoted;
    }
    if (!target) return reply('❌ Mention or reply to the user.\nUsage: `.demote @user`');

    try {
      await sock.groupParticipantsUpdate(from, [target], 'demote');
      await reply(`✅ Demoted @${target.split('@')[0]} to member`, { mentions: [target] });
    } catch (e) {
      await reply(`❌ Failed to demote: ${e.message}\n\n_Make sure you're admin in this group._`);
    }
  },
};
