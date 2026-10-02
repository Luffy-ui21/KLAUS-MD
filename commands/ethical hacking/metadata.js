import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'metadata',
  alias: ['urlmeta', 'headers', 'urlinfo'],
  description: 'Analyze URL/file metadata from HTTP headers',
  category: 'ethical hacking',
  usage: 'metadata <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔍 *URL METADATA ANALYZER* ⌋\n│\n├─⊷ *${PREFIX}metadata <url>*\n│  └⊷ Analyze HTTP headers and\n│     metadata of any URL\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let url = args[0];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.head(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WOLFBOT/1.0)' },
        validateStatus: () => true
      });

      const h = response.headers;

      function formatBytes(bytes) {
        if (!bytes || isNaN(bytes)) return 'Unknown';
        const b = parseInt(bytes);
        if (b === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }

      let result = `╭─⌈ 🔍 *URL METADATA ANALYZER* ⌋\n│\n`;
      result += `├─⊷ *URL:* ${url}\n`;
      result += `├─⊷ *Status:* ${response.status} ${response.statusText}\n│\n`;
      result += `├─⊷ *Content Info:*\n`;
      result += `│  ├⊷ Type: ${h['content-type'] || 'Unknown'}\n`;
      result += `│  ├⊷ Size: ${formatBytes(h['content-length'])}\n`;
      result += `│  └⊷ Encoding: ${h['content-encoding'] || 'None'}\n│\n`;
      result += `├─⊷ *Server Info:*\n`;
      result += `│  ├⊷ Server: ${h['server'] || 'Hidden'}\n`;
      result += `│  ├⊷ Powered By: ${h['x-powered-by'] || 'Hidden'}\n`;
      result += `│  └⊷ Via: ${h['via'] || 'N/A'}\n│\n`;
      result += `├─⊷ *Cache Info:*\n`;
      result += `│  ├⊷ Cache-Control: ${h['cache-control'] || 'N/A'}\n`;
      result += `│  ├⊷ ETag: ${h['etag'] || 'N/A'}\n`;
      result += `│  ├⊷ Age: ${h['age'] || 'N/A'}\n`;
      result += `│  └⊷ Expires: ${h['expires'] || 'N/A'}\n│\n`;
      result += `├─⊷ *Timestamps:*\n`;
      result += `│  ├⊷ Last-Modified: ${h['last-modified'] || 'N/A'}\n`;
      result += `│  └⊷ Date: ${h['date'] || 'N/A'}\n│\n`;
      result += `├─⊷ *Security Headers:*\n`;
      result += `│  ├⊷ HSTS: ${h['strict-transport-security'] ? '✅' : '❌'}\n`;
      result += `│  ├⊷ CSP: ${h['content-security-policy'] ? '✅' : '❌'}\n`;
      result += `│  ├⊷ X-Frame: ${h['x-frame-options'] || '❌ Missing'}\n`;
      result += `│  ├⊷ X-XSS: ${h['x-xss-protection'] || '❌ Missing'}\n`;
      result += `│  └⊷ X-Content-Type: ${h['x-content-type-options'] || '❌ Missing'}\n│\n`;
      result += `├─⊷ *Connection:*\n`;
      result += `│  ├⊷ Connection: ${h['connection'] || 'N/A'}\n`;
      result += `│  ├⊷ Keep-Alive: ${h['keep-alive'] || 'N/A'}\n`;
      result += `│  └⊷ Transfer: ${h['transfer-encoding'] || 'N/A'}\n│\n`;

      const otherHeaders = Object.keys(h).filter(k =>
        !['content-type', 'content-length', 'content-encoding', 'server',
          'x-powered-by', 'via', 'cache-control', 'etag', 'age', 'expires',
          'last-modified', 'date', 'strict-transport-security',
          'content-security-policy', 'x-frame-options', 'x-xss-protection',
          'x-content-type-options', 'connection', 'keep-alive',
          'transfer-encoding'].includes(k)
      );

      if (otherHeaders.length > 0) {
        result += `├─⊷ *Other Headers:*\n`;
        otherHeaders.slice(0, 8).forEach(k => {
          const val = String(h[k]).substring(0, 60);
          result += `│  ├⊷ ${k}: ${val}\n`;
        });
        if (otherHeaders.length > 8) {
          result += `│  └⊷ ...${otherHeaders.length - 8} more headers\n`;
        }
      }

      result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
