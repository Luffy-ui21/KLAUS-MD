/** .logo — Generate a text logo image */

module.exports = {
  name: 'logo',
  aliases: ['textlogo', 'cooltext'],
  desc: 'Generate a cool text logo',
  category: 'media',
  async execute({
  sock, msg, args, from, reply }) {
  const axios = require('axios');
    const text = args.join(' ');
    if (!text) return reply('❌ Provide text.\nUsage: `.logo KLAUS-MD`');
    if (text.length > 30) return reply('❌ Text too long (max 30 chars)');

    try {
      // Use a free text-to-image API
      const url = `https://api.flamingtext.com/logo/Design-Fluffy?_variations=true&text=${encodeURIComponent(text)}&_loc=catdynamic&_dynwidth=600`;
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      const buffer = Buffer.from(res.data, 'binary');
      await sock.sendMessage(from, { image: buffer, caption: `✨ Logo: ${text}` }, { quoted: msg });
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
