/** .public — Set bot to public mode (everyone can use commands) */
const { prisma } = require('../db');

module.exports = {
  name: 'public',
  aliases: ['everyone', 'all', 'open'],
  desc: 'Set bot to public mode — everyone can use commands',
  category: 'owner',
  async execute({ reply, dbSession }) {
    if (!dbSession) return reply('❌ No session found.');

    await prisma.botSession.update({
      where: { id: dbSession.id },
      data: { mode: 'public' },
    });

    await reply(`🌍 *Public Mode Activated*

✅ Everyone can use bot commands now.
⚠️ Anyone in your chats can trigger commands.

Use \`.private\` to switch back to private mode.`);
  },
};
