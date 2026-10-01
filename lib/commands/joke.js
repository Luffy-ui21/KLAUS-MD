/** .joke — Random joke */

module.exports = {
  name: 'joke',
  aliases: ['haha', 'funny'],
  desc: 'Get a random joke',
  category: 'fun',
  async execute({
  reply }) {
  const axios = require('axios');
    try {
      const res = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 5000 });
      await reply(`😂 *Joke time!*\n\n${res.data.setup}\n\n${res.data.punchline}`);
    } catch {
      await reply(`😂 *Joke time!*\n\nWhy don't programmers like nature?\n\nIt has too many bugs.`);
    }
  },
};
