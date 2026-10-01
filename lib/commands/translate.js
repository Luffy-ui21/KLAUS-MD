/** .translate — Translate text using Google Translate */

module.exports = {
  name: 'translate',
  aliases: ['tr', 'trans'],
  desc: 'Translate text (usage: .translate en Hello)',
  category: 'tools',
  async execute({
  args, reply }) {
  const axios = require('axios');
    if (args.length < 2) return reply('❌ Usage: `.translate <lang> <text>`\nExample: `.translate fr Hello world`');
    const targetLang = args[0].toLowerCase();
    const text = args.slice(1).join(' ');
    if (!text) return reply('❌ Provide text to translate.');

    try {
      // Google Translate unofficial endpoint
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await axios.get(url, { timeout: 8000 });
      const translation = res.data[0].map(t => t[0]).join('');
      const detectedLang = res.data[2];
      await reply(`🌍 *Translation*\n\nDetected: ${detectedLang}\nTo: ${targetLang}\n\n*Original:*\n${text}\n\n*Translation:*\n${translation}`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
