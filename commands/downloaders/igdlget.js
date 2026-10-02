import fs from 'fs';
import { existsSync } from 'fs';
import { getActionSession, deleteActionSession } from '../../lib/actionSession.js';
import { downloadInstagram } from './instagram.js';
import { getBotName } from '../../lib/botname.js';

export default {
  name: 'igdlget',
  aliases: [],
  description: 'Download Instagram media from preview session',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const senderClean = (m.key.participant || m.key.remoteJid).split(':')[0].split('@')[0];
    const sessionKey = `ig:${senderClean}:${jid.split('@')[0]}`;
    const session = getActionSession(sessionKey);

    if (!session || !session.url) {
      await sock.sendMessage(jid, {
        text: `❌ No Instagram download session found.\nPlease send the Instagram URL again with \`${PREFIX || '.'}instagram <url>\``
      }, { quoted: m });
      return;
    }

    deleteActionSession(sessionKey);
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    const result = await downloadInstagram(session.url);

    if (!result.success) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Download failed: ${result.error || 'Unknown error'}\n\n📱 Try manual: https://snapinsta.app`
      }, { quoted: m });
      return;
    }

    const botName = getBotName();
    let sentCount = 0;

    for (const { filePath, isVideo } of result.items) {
      try {
        const buf = fs.readFileSync(filePath);
        const sizeMB = (buf.length / 1024 / 1024).toFixed(1);
        if (parseFloat(sizeMB) > 50) continue;

        const caption = sentCount === 0
          ? `📷 *Instagram ${isVideo ? 'Video' : 'Photo'}*\n📦 ${sizeMB}MB |  ${botName}`
          : `Part ${sentCount + 1} | ${sizeMB}MB`;

        if (isVideo) {
          await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m });
        } else {
          await sock.sendMessage(jid, { image: buf, caption }, { quoted: m });
        }
        sentCount++;
        if (sentCount < result.items.length) await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.log(`[IG/igdlget] send failed: ${e.message}`);
      } finally {
        try { if (filePath && existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
      }
    }

    if (sentCount > 0) {
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } else {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ All items were too large or failed.\n\n💡 Try manually: https://snapinsta.app`
      }, { quoted: m });
    }
  }
};
