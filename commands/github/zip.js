import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { REPO, REPO_URL, REPO_ZIP } from '../../lib/repoConfig.js';

export default {
  name: "zip",
  aliases: ["repozip", "dlrepo", "downloadrepo", "__repo_zip__"],
  description: "Downloads and sends the bot repo as a zip file",
  ownerOnly: false,

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      const res = await axios.get(REPO_ZIP, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: { 'User-Agent': 'WolfBot' },
        maxRedirects: 5
      });

      const zipBuf = Buffer.from(res.data);
      const sizeMB = (zipBuf.byteLength / 1024 / 1024).toFixed(1);

      await sock.sendMessage(jid, {
        document: zipBuf,
        mimetype: 'application/zip',
        fileName: `${REPO}-main.zip`,
        caption: `📦 *${REPO}* — ${sizeMB} MB\n🔗 ${REPO_URL}\n\n ${getBotName()}`
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (e) {
      console.error('[ZIP] Error:', e.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Failed to download zip.\n\n💡 Download manually:\n${REPO_ZIP}`
      }, { quoted: m });
    }
  }
};