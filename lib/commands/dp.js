/**
 * .dp — Set + view bot display picture (DP)
 *
 * Usage:
 *   .dp       (reply to an image) → set DP for this bot session
 *   .dp view  → view the current DP
 */
const { prisma } = require('../db');

module.exports = {
  name: 'dp',
  aliases: ['setdp', 'botdp', 'profilepic'],
  desc: 'Set the bot display picture',
  category: 'owner',
  async execute({ sock, msg, args, from, reply, dbSession }) {
    const subcmd = args[0]?.toLowerCase();

    // .dp view — fetch from DB and send
    if (subcmd === 'view' || subcmd === 'show') {
      if (!dbSession?.dpUrl) {
        return reply('❌ No DP set. Reply to an image and use `.dp` to set one.');
      }
      try {
        const axios = require('axios');
        const res = await axios.get(dbSession.dpUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const buffer = Buffer.from(res.data, 'binary');
        await sock.sendMessage(from, { image: buffer, caption: '📸 Current bot DP' }, { quoted: msg });
      } catch (e) {
        await reply(`❌ Failed to fetch DP: ${e.message}`);
      }
      return;
    }

    // .dp (reply to image) — set DP
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;
    if (!imageMsg) {
      return reply(`❌ Reply to an image to set as DP.\n\nUsage:\n• \`.dp\` (reply to image) — set DP\n• \`.dp view\` — view current DP`);
    }

    try {
      // Download the image
      const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
      const stream = await downloadContentFromMessage(imageMsg, 'image');
      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // Save to file in public/dp/<sessionId>.jpg
      const fs = require('fs');
      const path = require('path');
      const dpDir = path.join(__dirname, '..', '..', 'public', 'dp');
      if (!fs.existsSync(dpDir)) fs.mkdirSync(dpDir, { recursive: true });
      const dpPath = path.join(dpDir, `${dbSession.id}.jpg`);
      fs.writeFileSync(dpPath, buffer);

      // Update DB with the URL
      const dpUrl = `/dp/${dbSession.id}.jpg`;
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { dpUrl },
      });

      // Set as the bot's WhatsApp profile picture too
      try { await sock.updateProfilePicture(sock.user.id, buffer); } catch {}

      await reply(`✅ DP updated! Use \`.dp view\` to see it.`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
