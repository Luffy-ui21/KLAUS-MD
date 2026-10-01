/** .fact — Random fact */

module.exports = {
  name: 'fact',
  aliases: ['facts', 'randomfact'],
  desc: 'Get a random useless fact',
  category: 'fun',
  async execute({
  reply }) {
  const axios = require('axios');
    try {
      const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: 5000 });
      const fact = res.data.text || res.data;
      await reply(`📌 *Did you know?*\n\n${fact}`);
    } catch {
      await reply(`📌 *Did you know?*\n\nHoney never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that's still edible.`);
    }
  },
};
