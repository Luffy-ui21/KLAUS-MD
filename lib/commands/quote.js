/** .quote — Random inspirational quote */

module.exports = {
  name: 'quote',
  aliases: ['q', 'inspire'],
  desc: 'Get a random inspirational quote',
  category: 'fun',
  async execute({
  reply }) {
  const axios = require('axios');
    try {
      const res = await axios.get('https://api.quotable.io/random', { timeout: 5000 });
      await reply(`💬 *"${res.data.content}"*\n\n— *${res.data.author}*`);
    } catch {
      const fallback = ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Be the change you wish to see in the world.', 'Success is not final, failure is not fatal: it is the courage to continue that counts.'];
      const q = fallback[Math.floor(Math.random() * fallback.length)];
      await reply(`💬 *"${q}"*`);
    }
  },
};
