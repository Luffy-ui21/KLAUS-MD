/** .disconnect — Disconnect this bot session (from WhatsApp) */
module.exports = {
  name: 'disconnect',
  aliases: ['logout', 'unpair', 'stop'],
  desc: 'Disconnect the bot from this WhatsApp account',
  category: 'owner',
  async execute({ sock, msg, reply, dbSession }) {
    const { prisma } = require('../db');
    const sessionManager = require('../sessionManager');

    if (!dbSession) return reply('❌ No session found.');

    await reply(`🔌 *Disconnecting KLAUS-MD...*

Goodbye! You can re-pair at any time by visiting the pairing site.`);

    setTimeout(async () => {
      try {
        await sessionManager.removeSession(dbSession.id);
      } catch (e) {
        console.error('Disconnect error:', e);
      }
    }, 1500);
  },
};
