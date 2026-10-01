/** .promote — Make user admin (owner only) */
const { isBotOwner } = require('../utils/permissions');

module.exports = {
  name: 'promote',
  aliases: ['admin'],
  desc: 'Promote a user to admin (owner only)',
  category: 'admin',
  async execute({ sock, msg, args, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only.');
    if (!isBotOwner(msg, dbSession)) return reply('❌ *Only the bot owner can use this command.*');

    let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quoted) target = quoted;
    }
    if (!target) return reply('❌ Mention or reply to the user.\nUsage: `.promote @user`');

    try {
      await sock.groupParticipantsUpdate(from, [target], 'promote');
      await reply(`✅ Promoted @${target.split('@')[0]} to admin`, { mentions: [target] });
    } catch (e) {
      await reply(`❌ Failed to promote: ${e.message}\n\n_Make sure you're admin in this group._`);
    }
  },
};
