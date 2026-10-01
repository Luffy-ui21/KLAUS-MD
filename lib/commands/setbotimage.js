/**
 * .setbotimage — Set the bot's WhatsApp profile picture
 *
 * Usage:
 *   .setbotimage https://example.com/image.jpg   (from URL)
 *   Reply to an image → .setbotimage                (from replied media)
 *   Send image with caption .setbotimage            (from attached media)
 *
 * Uses sharp to resize to 640x640 JPEG (WhatsApp requirement).
 */

const axios = require('axios');

module.exports = {
  name: 'setbotimage',
  aliases: ['setbotpic', 'botpic', 'setpic', 'setprofilepic', 'changebotimage'],
  desc: 'Set bot profile picture from URL or image',
  category: 'owner',
  async execute({ sock, msg, args, reply }) {
    let imageBuffer;
    let source = '';

    // Mode 1: Image sent with caption .setbotimage
    if (msg.message?.imageMessage) {
      try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
        imageBuffer = Buffer.alloc(0);
        for await (const chunk of stream) imageBuffer = Buffer.concat([imageBuffer, chunk]);
        source = 'attached image';
      } catch (e) {
        return reply(`❌ Failed to download attached image: ${e.message}`);
      }
    }

    // Mode 2: Reply to an image
    if (!imageBuffer) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted?.imageMessage) {
        try {
          const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
          const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
          imageBuffer = Buffer.alloc(0);
          for await (const chunk of stream) imageBuffer = Buffer.concat([imageBuffer, chunk]);
          source = 'replied image';
        } catch (e) {
          return reply(`❌ Failed to download replied image: ${e.message}`);
        }
      }
    }

    // Mode 3: From URL
    if (!imageBuffer && args[0]) {
      const url = args[0];
      if (!/^https?:\/\//i.test(url)) {
        return reply(
          `❌ URL must start with \`http://\` or \`https://\`\n\n` +
          `*Usage:*\n` +
          `• \`.setbotimage https://example.com/image.jpg\`\n` +
          `• Reply to an image → \`.setbotimage\`\n` +
          `• Send image with caption \`.setbotimage\``
        );
      }
      await reply('⏳ Downloading image from URL...');
      try {
        const res = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          maxRedirects: 5,
        });
        imageBuffer = Buffer.from(res.data, 'binary');
        source = url;
      } catch (e) {
        return reply(`❌ Failed to download image from URL: ${e.message}`);
      }
    }

    if (!imageBuffer) {
      return reply(
        `📝 *SET BOT IMAGE*\n\n` +
        `*Usage:*\n` +
        `• \`.setbotimage https://example.com/image.jpg\`\n` +
        `• Reply to an image → \`.setbotimage\`\n` +
        `• Send image with caption \`.setbotimage\`\n\n` +
        `_Sets the bot's WhatsApp profile picture._`
      );
    }

    if (imageBuffer.length === 0) {
      return reply('❌ Downloaded image is empty.');
    }

    await reply('⏳ Processing image + uploading as profile picture...');

    // Convert to 640x640 JPEG using sharp
    try {
      const sharp = require('sharp');
      imageBuffer = await sharp(imageBuffer)
        .resize(640, 640, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (e) {
      console.warn('[SETBOTIMAGE] Sharp resize failed, using raw:', e.message);
      // Try without sharp — just send as-is
    }

    // Set the profile picture via Baileys
    try {
      await sock.updateProfilePicture(sock.user.id, imageBuffer);
      return reply(
        `✅ *Bot profile picture updated!*\n\n` +
        `📸 *Source:* ${source}\n` +
        `💾 *Size:* ${(imageBuffer.length / 1024).toFixed(1)} KB\n\n` +
        `_It may take a few minutes to appear on all devices._`
      );
    } catch (e) {
      console.error('[SETBOTIMAGE] Failed:', e);
      return reply(
        `❌ Failed to set profile picture: ${e.message}\n\n` +
        `_Note: WhatsApp may rate-limit profile picture changes.\n` +
        `Try again in a few minutes._`
      );
    }
  },
};
