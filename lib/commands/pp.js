/** .pp — Change profile picture */
module.exports = {
  name: 'pp',
  aliases: ['setpp', 'profilepic'],
  desc: 'Set your profile picture (reply to an image)',
  category: 'owner',
  async execute({ sock, msg, from, reply }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;
    if (!imageMsg) return reply('❌ Reply to an image to set as profile picture.\nUsage: `.pp` (reply to image)');

    try {
      const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
      const stream = await downloadContentFromMessage(imageMsg, 'image');
      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.updateProfilePicture(sock.user.id, buffer);
      await reply('✅ Profile picture updated.');
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
