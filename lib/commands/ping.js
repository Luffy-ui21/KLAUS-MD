/** .ping — Check bot latency */
module.exports = {
  name: 'ping',
  aliases: ['alive', 'speed'],
  desc: 'Check bot response time',
  category: 'main',
  async execute({ reply, botName }) {
    const start = Date.now();
    const msg = await reply('🏓 Pinging...');
    const latency = Date.now() - start;
    await reply(`🏓 *PONG!*

⚡ *Latency:* ${latency}ms
📡 *Status:* Online
✅ *Bot:* ${botName}
⏱️ *Time:* ${new Date().toLocaleTimeString()}`);
  },
};
