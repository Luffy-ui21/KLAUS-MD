/**
 * .setprefix — Change the command prefix for THIS user's bot instance
 *
 * Usage:
 *   .setprefix !        →  !menu, !ping, etc.
 *   .setprefix .        →  .menu, .ping (default)
 *   .setprefix #        →  #menu, #ping
 *   .setprefix /        →  /menu, /ping
 */

const { prisma } = require('../db');

module.exports = {
  name: 'setprefix',
  aliases: ['prefix', 'changeprefix'],
  desc: 'Change your bot command prefix',
  category: 'owner',
  async execute({ reply, args, dbSession, prefix }) {
    const newPrefix = args[0];

    if (!newPrefix) {
      return reply(`📝 *Current prefix:* \`${prefix}\`

*Usage:* \`${prefix}setprefix <new-prefix>\`

*Examples:*
  \`${prefix}setprefix !\`  →  !menu, !ping, etc.
  \`${prefix}setprefix .\`  →  .menu, .ping (default)
  \`${prefix}setprefix #\`  →  #menu, #ping
  \`${prefix}setprefix /\`  →  /menu, /ping

_Prefix must be 1-3 characters. Letters and digits not recommended._`);
    }

    // Validate: 1-3 chars, not a letter/digit (to avoid collisions with words)
    if (newPrefix.length > 3) {
      return reply('❌ Prefix too long. Max 3 characters.');
    }
    if (/^[a-zA-Z0-9]/.test(newPrefix)) {
      return reply('❌ Prefix shouldn\'t start with a letter or digit (would conflict with normal text).\n\n_Examples: `!`, `.`, `#`, `/`, `?`, `*`_');
    }

    if (!dbSession) {
      return reply('❌ No session record. Please re-pair.');
    }

    try {
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { prefix: newPrefix },
      });
      await reply(`✅ *Prefix changed!*\n\n📝 *Old prefix:* \`${prefix}\`\n🆕 *New prefix:* \`${newPrefix}\`\n\nTry: \`${newPrefix}menu\` to test it.`);
    } catch (e) {
      await reply(`❌ Failed to set prefix: ${e.message}`);
    }
  },
};
