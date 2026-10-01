/** .google — Google search */

module.exports = {
  name: 'google',
  aliases: ['g', 'search'],
  desc: 'Google search results',
  category: 'tools',
  async execute({
  args, reply }) {
  const axios = require('axios');
    const query = args.join(' ');
    if (!query) return reply('❌ Provide a search query.\nUsage: `.google best restaurants in Nairobi`');

    try {
      // Use DuckDuckGo Instant Answer API (no key needed)
      const res = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, { timeout: 8000 });
      const data = res.data;

      let text = `🔍 *Google search: ${query}*\n\n`;
      if (data.AbstractText) {
        text += `${data.AbstractText}\n\n`;
        if (data.AbstractURL) text += `🔗 ${data.AbstractURL}\n`;
      } else if (data.RelatedTopics && data.RelatedTopics.length) {
        const top = data.RelatedTopics.slice(0, 5);
        for (const t of top) {
          if (t.Text) text += `• ${t.Text.slice(0, 100)}\n`;
        }
      } else {
        text += `_No instant results. Try a more specific query._\n\n`;
        text += `🔍 https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
      await reply(text);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
