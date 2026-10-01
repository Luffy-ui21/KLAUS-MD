/** .qr — Generate a QR code from text */

module.exports = {
  name: 'qr',
  aliases: ['qrcode'],
  desc: 'Generate a QR code from text/URL',
  category: 'tools',
  async execute({
  sock, msg, args, from, reply }) {
  const axios = require('axios');
    const text = args.join(' ');
    if (!text) return reply('❌ Provide text or URL to encode.\nUsage: `.qr Hello world` or `.qr https://example.com`');

    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      const buffer = Buffer.from(res.data, 'binary');
      await sock.sendMessage(from, {
        image: buffer,
        caption: `✅ QR Code for:\n${text}`,
      }, { quoted: msg });
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
