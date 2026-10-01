/**
 * .groupst — Post media as WhatsApp Status (story)
 *
 * Usage:
 *   Reply to an image/video → .groupst [caption]
 *   The bot posts the media as a WhatsApp Status update (24-hour story)
 *
 * ⚠️ IMPORTANT: WhatsApp Status (story) can only be posted from the
 * PRIMARY device, not from linked devices (which is what the bot is).
 *
 * If this command doesn't show a status, it's because WhatsApp blocks
 * linked devices from posting status updates. The command still works
 * (it sends to status@broadcast), but WhatsApp may silently ignore it.
 *
 * As an alternative, this command also reposts the media into the group
 * with a "Group Status" header — so at least group members see it.
 */

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'groupst',
  aliases: ['gst', 'groupstatus', 'gs', 'status', 'story'],
  desc: 'Post replied media as WhatsApp Status + group announcement',
  category: 'media',
  async execute({ sock, msg, args, from, isGroup, reply, botName }) {
    if (!isGroup) return reply('❌ This command only works in groups.');

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      return reply(
        `❌ *Reply to an image, video, or audio* to post it.\n\n` +
        `*Usage:*\n` +
        `• Reply to media + \`.groupst\`\n` +
        `• Reply to media + \`.groupst Your caption\`\n\n` +
        `_Posts as a group announcement + attempts WhatsApp Status._`
      );
    }

    const caption = args.length ? args.join(' ') : '';
    let groupName = 'this group';
    try {
      groupName = (await sock.groupMetadata(from)).subject;
    } catch {}

    const statusHeader = `📊 *${groupName} Status*\n_${msg.pushName || 'Someone'} posted:_\n\n${caption}`;
    const STATUS_JID = 'status@broadcast';
    let statusPosted = false;

    try {
      // Image
      if (quoted.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        let buf = Buffer.alloc(0);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

        // 1. Try posting as WhatsApp Status (may silently fail on linked devices)
        try {
          await sock.sendMessage(STATUS_JID, { image: buf, caption });
          statusPosted = true;
          console.log('[GROUPST] Posted to status@broadcast');
        } catch (e) {
          console.warn('[GROUPST] Status post failed:', e.message);
        }

        // 2. ALSO post as group announcement (so group members definitely see it)
        await sock.sendMessage(from, {
          image: buf,
          caption: statusHeader,
        }, { quoted: msg });

        return reply(
          `✅ *Posted!*\n\n` +
          `📊 *Group announcement:* ✅ posted\n` +
          `📱 *WhatsApp Status:* ${statusPosted ? '✅ posted (may take a few minutes to appear)' : '⚠️ failed — WhatsApp may block status posts from linked devices'}\n\n` +
          `_If status doesn't appear, it's because WhatsApp restricts status posts to the primary device only._`
        );
      }

      // Video
      if (quoted.videoMessage) {
        const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
        let buf = Buffer.alloc(0);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

        try {
          await sock.sendMessage(STATUS_JID, { video: buf, caption });
          statusPosted = true;
        } catch (e) {
          console.warn('[GROUPST] Status post failed:', e.message);
        }

        await sock.sendMessage(from, {
          video: buf,
          caption: statusHeader,
        }, { quoted: msg });

        return reply(
          `✅ *Posted!*\n\n` +
          `📊 *Group announcement:* ✅\n` +
          `📱 *WhatsApp Status:* ${statusPosted ? '✅' : '⚠️ (linked device restriction)'}`
        );
      }

      // Audio
      if (quoted.audioMessage) {
        const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio');
        let buf = Buffer.alloc(0);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

        await sock.sendMessage(from, {
          audio: buf,
          mimetype: 'audio/mpeg',
          ptt: quoted.audioMessage.ptt || false,
        }, { quoted: msg });

        return reply(`✅ *Audio posted as group announcement!*`);
      }

      // Sticker
      if (quoted.stickerMessage) {
        const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
        let buf = Buffer.alloc(0);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

        await sock.sendMessage(from, { sticker: buf }, { quoted: msg });
        return reply(`✅ *Sticker posted as group announcement!*`);
      }

      // Text
      if (quoted.conversation || quoted.extendedTextMessage?.text) {
        const text = quoted.conversation || quoted.extendedTextMessage.text;
        await sock.sendMessage(from, {
          text: statusHeader + '\n\n' + text,
        }, { quoted: msg });
        return reply(`✅ *Text posted as group announcement!*`);
      }

      return reply('❌ No media found in the replied message.');
    } catch (e) {
      console.error('[GROUPST] Error:', e);
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
