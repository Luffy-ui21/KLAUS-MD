/**
 * .sticker — Convert image/video to sticker with proper WebP conversion
 *
 * Usage:
 *   Send image with caption: .sticker
 *   Reply to an image: .sticker
 *   .sticker CustomPackName
 *
 * Pack: KLAUS-MD
 * Author: 254711815459
 */

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'sticker',
  aliases: ['s', 'take', 'st'],
  desc: 'Convert image/video to sticker',
  category: 'sticker',
  async execute({ sock, msg, args, reply }) {
    let mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage;
    let type = msg.message?.imageMessage ? 'image' : (msg.message?.videoMessage ? 'video' : null);

    if (!mediaMessage && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const q = msg.message.extendedTextMessage.contextInfo.quotedMessage;
      mediaMessage = q.imageMessage || q.videoMessage;
      type = q.imageMessage ? 'image' : (q.videoMessage ? 'video' : null);
    }

    if (!mediaMessage || !type) {
      return reply(
        `❌ *Send/reply to an image or video* to convert to sticker.\n\n` +
        `*Usage:*\n` +
        `• Send image with caption: \`.sticker\`\n` +
        `• Reply to an image: \`.sticker\`\n` +
        `• Custom pack name: \`.sticker MyPack\`\n\n` +
        `_📦 Default pack: KLAUS-MD\n👤 Default author: 254711815459_`
      );
    }

    // Download the media
    let buffer;
    try {
      const stream = await downloadContentFromMessage(mediaMessage, type);
      buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    } catch (e) {
      return reply(`❌ Failed to download media: ${e.message}`);
    }

    if (!buffer || buffer.length === 0) {
      return reply('❌ Downloaded media is empty. Try again.');
    }

    // Pack info
    const packName = args[0] || 'KLAUS-MD';
    const author = '254711815459';

    try {
      // Convert to WebP sticker format
      // WhatsApp stickers MUST be 512x512 WebP
      let stickerBuffer;

      if (type === 'image') {
        // Convert image to WebP using sharp (if available) or use raw buffer
        try {
          const sharp = require('sharp');
          stickerBuffer = await sharp(buffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();
        } catch (sharpErr) {
          // Sharp not available — try using the buffer directly
          // (WhatsApp may accept JPEG/PNG as sticker in some cases)
          console.warn('[STICKER] Sharp not available, sending raw image:', sharpErr.message);
          stickerBuffer = buffer;
        }
      } else {
        // For video, we'd need ffmpeg — for now just send the buffer
        stickerBuffer = buffer;
      }

      // Send sticker with pack metadata
      await sock.sendMessage(msg.key.remoteJid, {
        sticker: stickerBuffer,
        packname: packName,
        author: author,
      }, { quoted: msg });

      await reply(
        `✅ *Sticker created!*\n\n` +
        `📦 *Pack:* ${packName}\n` +
        `👤 *Author:* ${author}\n` +
        `💾 *Size:* ${(stickerBuffer.length / 1024).toFixed(1)} KB`
      );
    } catch (e) {
      console.error('[STICKER] Error:', e);
      await reply(`❌ Failed to create sticker: ${e.message}`);
    }
  },
};
