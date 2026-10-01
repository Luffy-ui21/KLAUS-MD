/** .weather — Get weather for a city */
module.exports = {
  name: 'weather',
  aliases: ['w', 'forecast'],
  desc: 'Get the current weather for a city',
  category: 'tools',
  async execute({
  args, reply }) {
  const axios = require('axios');
    const city = args.join(' ');
    if (!city) return reply('❌ Provide a city name.\nUsage: `.weather Nairobi`');
    try {
      const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=3`, {
        timeout: 8000, headers: { 'User-Agent': 'curl' },
      });
      await reply(`🌤️ *Weather*\n\n${res.data}`);
    } catch (e) { await reply(`❌ Failed: ${e.message}`); }
  },
};
