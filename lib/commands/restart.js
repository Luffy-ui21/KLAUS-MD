/** .restart — Restart the bot (every user can restart their own bot) */
module.exports = {
  name: 'restart',
  aliases: ['reboot'],
  desc: 'Restart your bot instance',
  category: 'owner',
  async execute({ reply }) {
    // Every user who paired is the owner of their own bot instance
    await reply('🔄 Restarting your bot in 3 seconds...');
    setTimeout(() => process.exit(0), 3000);
  },
};
