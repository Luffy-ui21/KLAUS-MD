import fs from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { getActionSession, deleteActionSession } from '../../lib/actionSession.js';
import { downloadFacebook, downloadToFile } from './facebook.js';
import { getBotName } from '../../lib/botname.js';

export default {
  name: 'fbdlget',
  aliases: [],
  description: 'Download Facebook video from preview session',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const senderClean = (m.key.participant || m.key.remoteJid).split(':')[0].split('@')[0];
    const sessionKey = `fb:${senderClean}:${jid.split('@')[0]}`;
    const session = getActionSession(sessionKey);

    if (!session || !session.url) {
      await sock.sendMessage(jid, {
        text: `❌ No Facebook download session found.\nPlease send the Facebook URL again with \`${PREFIX || '.'}facebook <url>\``
      }, { quoted: m });
      return;
    }

    deleteActionSession(sessionKey);
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    const result = await downloadFacebook(session.url);

    if (!result.success) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Download failed: ${result.error || 'Unknown error'}\n\n💡 Try: https://fbdown.net`
      }, { quoted: m });
      return;
    }

    const { videoUrl, title, description } = result;

    try {
      const tempDir = '/tmp';
      const tempFile = `${tempDir}/wolfbot_fb_${Date.now()}.mp4`;

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });
      await downloadToFile(videoUrl, tempFile);

      const fileSize = fs.statSync(tempFile).size;
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);

      if (parseFloat(sizeMB) > 16) {
        await sock.sendMessage(jid, {
          text: `⚠️ Video is ${sizeMB}MB — too large for WhatsApp (16MB limit)\n\n💡 Direct link:\n${videoUrl}`
        }, { quoted: m });
        if (existsSync(tempFile)) fs.unlinkSync(tempFile);
        return;
      }

      let caption = '📘 *Facebook Video*';
      if (title) caption += `\n\n*${title}*`;
      if (description) caption += `\n${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`;

      await sock.sendMessage(jid, {
        video: fs.readFileSync(tempFile),
        mimetype: 'video/mp4',
        caption
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      if (existsSync(tempFile)) fs.unlinkSync(tempFile);

    } catch (e) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Failed to send video: ${e.message}\n\n💡 Direct link:\n${videoUrl}`
      }, { quoted: m });
    }
  }
};
