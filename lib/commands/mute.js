/** .mute — Mute the group (owner only) */
const { isBotOwner } = require('../utils/permissions');

module.exports = {
  name: 'mute',
  aliases: ['close', 'lock'],
  desc: 'Mute the group (only admins can send messages) — owner only',
  category: 'admin',
  async execute({ sock, msg, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only.');
    if (!isBotOwner(msg, dbSession)) return reply('❌ *Only the bot owner can use this command.*');

    try {
      await sock.groupSettingUpdate(from, 'announcement');
      await reply('🔒 *Group muted.* Only admins can send messages now.');
    } catch (e) {
      await reply(`❌ Failed to mute: ${e.message}\n\n_Make sure you're admin in this group._`);
    }
  },
};
