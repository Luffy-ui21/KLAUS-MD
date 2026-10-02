import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import crypto from 'crypto';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'filehash',
  alias: ['urlhash', 'checksum'],
  description: 'Generate file hashes from URL download',
  category: 'ethical hacking',
  usage: 'filehash <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔍 *FILE HASH GENERATOR* ⌋\n│\n├─⊷ *${PREFIX}filehash <url>*\n│  └⊷ Download file and compute\n│     MD5, SHA1, SHA256 hashes\n│\n├─⊷ *Max download:* 5MB\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let url = args[0];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const maxSize = 5 * 1024 * 1024;

      const headRes = await axios.head(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WOLFBOT/1.0)' },
        validateStatus: () => true
      }).catch(() => null);

      const contentLength = headRes?.headers?.['content-length'] ? parseInt(headRes.headers['content-length']) : null;
      const contentType = headRes?.headers?.['content-type'] || 'Unknown';

      if (contentLength && contentLength > maxSize) {
        return sock.sendMessage(jid, { text: `❌ File too large (${(contentLength / 1024 / 1024).toFixed(2)} MB). Max is 5MB.` }, { quoted: m });
      }

      const response = await axios.get(url, {
        timeout: 30000,
        responseType: 'arraybuffer',
        maxContentLength: maxSize,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WOLFBOT/1.0)' }
      });

      const buffer = Buffer.from(response.data);
      const fileSize = buffer.length;

      const md5 = crypto.createHash('md5').update(buffer).digest('hex');
      const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const sha512 = crypto.createHash('sha512').update(buffer).digest('hex');

      function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      let result = `╭─⌈ 🔍 *FILE HASH GENERATOR* ⌋\n│\n`;
      result += `├─⊷ *URL:* ${url.substring(0, 60)}${url.length > 60 ? '...' : ''}\n│\n`;
      result += `├─⊷ *File Info:*\n`;
      result += `│  ├⊷ Size: ${formatBytes(fileSize)}\n`;
      result += `│  ├⊷ Type: ${contentType}\n`;
      result += `│  └⊷ Status: ${response.status}\n│\n`;
      result += `├─⊷ *MD5:*\n│  └⊷ \`${md5}\`\n│\n`;
      result += `├─⊷ *SHA-1:*\n│  └⊷ \`${sha1}\`\n│\n`;
      result += `├─⊷ *SHA-256:*\n│  └⊷ \`${sha256}\`\n│\n`;
      result += `├─⊷ *SHA-512:*\n│  └⊷ \`${sha512}\`\n│\n`;
      result += `├─⊷ *Use these hashes to:*\n`;
      result += `│  ├⊷ Verify file integrity\n`;
      result += `│  ├⊷ Check against VirusTotal\n`;
      result += `│  └⊷ Compare with official checksums\n`;
      result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
