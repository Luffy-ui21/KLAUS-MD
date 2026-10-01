/**
 * .status — Post a text/image as WhatsApp Status (24-hour story)
 *
 * Usage:
 *   .status Hello world!            → post text as status
 *   Send image with caption .status → post image as status
 *   Reply to image → .status caption → post replied image as status
 *
 * This posts to status@broadcast (the bot's actual WhatsApp Status).
 */

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'status',
  aliases: ['story', 'whatsappstatus', 'mystatus'],
  desc: 'Post as WhatsApp Status (24-hour story)',
  category: 'media',
  async execute({ sock, msg, args, reply, from }) {
    const STATUS_JID = 'status@broadcast';
    const text = args.join(' ');

    // Mode 1: Reply to media → post that media as status
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      try {
        // Reply to image
        if (quoted.imageMessage) {
          const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
          let buf = Buffer.alloc(0);
          for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
          await sock.sendMessage(STATUS_JID, { image: buf, caption: text });
          return reply(`✅ *Image posted as WhatsApp Status!*\n📝 Caption: ${text || '(none)'}\n⏰ Visible for 24 hours`);
        }
        // Reply to video
        if (quoted.videoMessage) {
          const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
          let buf = Buffer.alloc(0);
          for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
          await sock.sendMessage(STATUS_JID, { video: buf, caption: text });
          return reply(`✅ *Video posted as WhatsApp Status!*\n📝 Caption: ${text || '(none)'}\n⏰ Visible for 24 hours`);
        }
      } catch (e) {
        return reply(`❌ Failed: ${e.message}`);
      }
    }

    // Mode 2: Image sent with caption .status
    if (msg.message?.imageMessage) {
      try {
        const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
        let buf = Buffer.alloc(0);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
        await sock.sendMessage(STATUS_JID, { image: buf, caption: text });
        return reply(`✅ *Image posted as WhatsApp Status!*\n📝 Caption: ${text || '(none)'}\n⏰ Visible for 24 hours`);
      } catch (e) {
        return reply(`❌ Failed: ${e.message}`);
      }
    }

    // Mode 3: Text status
    if (!text) {
      return reply(
        `📝 *STATUS POSTER*\n\n` +
        `*Usage:*\n` +
        `• \`.status Hello world!\`  → text status\n` +
        `• Send image with caption \`.status Your caption\`  → image status\n` +
        `• Reply to image + \`.status caption\`  → replied image as status\n\n` +
        `_Posts as a 24-hour WhatsApp Status story._`
      );
    }

    try {
      await sock.sendMessage(STATUS_JID, { text });
      return reply(`✅ *Text posted as WhatsApp Status!*\n📝 Text: ${text}\n⏰ Visible for 24 hours`);
    } catch (e) {
      return reply(`❌ Failed: ${e.message}`);
    }
  },
};
