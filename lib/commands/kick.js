/**
 * .kick — Remove a user from the group
 * Only the bot owner (the user who paired) can run this.
 *
 * Since the bot is the owner's linked WhatsApp device, the bot inherits
 * the owner's group admin status — no separate "make bot admin" needed.
 */

const { isBotOwner } = require('../utils/permissions');

module.exports = {
  name: 'kick',
  aliases: ['remove', 'ban'],
  desc: 'Kick a user from the group (owner only)',
  category: 'admin',
  async execute({ sock, msg, args, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only command.');

    if (!isBotOwner(msg, dbSession)) {
      return reply('❌ *Only the bot owner can use this command.*');
    }

    let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quoted) target = quoted;
    }
    if (!target) return reply('❌ Mention or reply to the user you want to kick.\n\nUsage: `.kick @user`');

    try {
      await sock.groupParticipantsUpdate(from, [target], 'remove');
      await reply(`✅ Kicked @${target.split('@')[0]}`, { mentions: [target] });
    } catch (e) {
      const errMsg = e.message || '';
      if (errMsg.includes('admin') || errMsg.includes('403') || errMsg.includes('not-authorized')) {
        return reply(
          `❌ *Failed to kick — you may not be admin in this group.*\n\n` +
          `_Make sure YOU (the bot owner) are an admin of this group, then try again._\n\n` +
          `Technical: ${errMsg}`
        );
      }
      await reply(`❌ Failed to kick: ${errMsg}`);
    }
  },
};
