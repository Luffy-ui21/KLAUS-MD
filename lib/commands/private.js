/** .private — Set bot to private mode (only owner can use commands) */
const { prisma } = require('../db');

module.exports = {
  name: 'private',
  aliases: ['self', 'selfonly', 'onlyme'],
  desc: 'Set bot to private mode — only YOU can use commands',
  category: 'owner',
  async execute({ reply, dbSession }) {
    if (!dbSession) return reply('❌ No session found.');

    await prisma.botSession.update({
      where: { id: dbSession.id },
      data: { mode: 'private' },
    });

    await reply(`🔒 *Private Mode Activated*

✅ Only YOU can use bot commands now.
❌ Other users' commands will be ignored.

Use \`.public\` to switch back to public mode.`);
  },
};
