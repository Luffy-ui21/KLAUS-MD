/** .shutdown — Shut down the bot (every user can shut down their own bot) */
module.exports = {
  name: 'shutdown',
  aliases: ['stop', 'off'],
  desc: 'Shut down your bot instance',
  category: 'owner',
  async execute({ reply }) {
    await reply('🔴 Bot shutting down. Goodbye!');
    setTimeout(() => process.exit(1), 2000);
  },
};
