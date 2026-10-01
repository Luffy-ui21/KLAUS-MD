/** .vv — Download view-once media */
module.exports = {
  name: 'vv',
  aliases: ['viewonce', 'rvo', 'view'],
  desc: 'Download a view-once message',
  category: 'media',
  async execute({ sock, msg, from, reply }) {
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return reply('❌ Reply to a view-once message.\nUsage: `.vv` (reply to view-once)');

    let mediaMessage, type, mimetype;
    if (quoted.viewOnceMessageV2?.message?.imageMessage) {
      mediaMessage = quoted.viewOnceMessageV2.message.imageMessage;
      type = 'image';
      mimetype = mediaMessage.mimetype;
    } else if (quoted.viewOnceMessageV2?.message?.videoMessage) {
      mediaMessage = quoted.viewOnceMessageV2.message.videoMessage;
      type = 'video';
      mimetype = mediaMessage.mimetype;
    } else if (quoted.imageMessage) {
      mediaMessage = quoted.imageMessage;
      type = 'image';
      mimetype = mediaMessage.mimetype;
    } else if (quoted.videoMessage) {
      mediaMessage = quoted.videoMessage;
      type = 'video';
      mimetype = mediaMessage.mimetype;
    } else if (quoted.audioMessage) {
      mediaMessage = quoted.audioMessage;
      type = 'audio';
      mimetype = mediaMessage.mimetype;
    }

    if (!mediaMessage) return reply('❌ No view-once media found in the replied message.');

    try {
      const stream = await downloadContentFromMessage(mediaMessage, type);
      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      if (type === 'image') {
        await sock.sendMessage(from, { image: buffer, caption: '✅ View-once image unlocked' });
      } else if (type === 'video') {
        await sock.sendMessage(from, { video: buffer, caption: '✅ View-once video unlocked' });
      } else if (type === 'audio') {
        await sock.sendMessage(from, { audio: buffer, mimetype: 'audio/mpeg' });
      }
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
