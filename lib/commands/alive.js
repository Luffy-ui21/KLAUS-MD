/** .alive — Show bot status banner */
module.exports = {
  name: 'alive',
  aliases: ['status', 'info'],
  desc: 'Show bot status banner',
  category: 'main',
  async execute({ reply, botName, prefix }) {
    const uptime = process.uptime();
    const hrs = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = Math.floor(uptime % 60);

    await reply(`╔══════════════════════════════╗
║      ${botName} - ALIVE         ║
╚══════════════════════════════╝

🟢 *Status:* Online & Running
⏱️ *Uptime:* ${hrs}h ${mins}m ${secs}s
📝 *Prefix:* ${prefix}
💾 *Memory:* ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB
🟢 *Node:* ${process.version}

_Type ${prefix}menu for commands_`);
  },
};
