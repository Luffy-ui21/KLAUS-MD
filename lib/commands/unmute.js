/** .unmute — Unmute the group (owner only) */
const { isBotOwner } = require('../utils/permissions');

module.exports = {
  name: 'unmute',
  aliases: ['open', 'unlock'],
  desc: 'Unmute the group (everyone can send messages) — owner only',
  category: 'admin',
  async execute({ sock, msg, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only.');
    if (!isBotOwner(msg, dbSession)) return reply('❌ *Only the bot owner can use this command.*');

    try {
      await sock.groupSettingUpdate(from, 'not_announcement');
      await reply('🔓 *Group unmuted.* Everyone can send messages now.');
    } catch (e) {
      await reply(`❌ Failed to unmute: ${e.message}\n\n_Make sure you're admin in this group._`);
    }
  },
};
