/**
 * .test — Ultra-simple test command that can NEVER fail
 *
 * Use this to verify the bot is alive and responding.
 * No DB calls, no image loading, no external APIs — just a text reply.
 */

module.exports = {
  name: 'test',
  aliases: ['check', 'working', 'bot'],
  desc: 'Test if bot is alive (always works)',
  category: 'main',
  async execute({ reply, botName }) {
    await reply(
      `✅ *BOT IS WORKING!*\n\n` +
      `🤖 *Bot:* ${botName}\n` +
      `⏰ *Time:* ${new Date().toLocaleString()}\n` +
      `🟢 *Status:* Online & responding\n\n` +
      `_If you see this, the message handler is working perfectly._`
    );
  },
};
