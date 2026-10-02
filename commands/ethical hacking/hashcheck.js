import crypto from 'crypto';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'hashcheck',
  alias: ['hash', 'generatehash'],
  description: 'Generate multiple hashes from text',
  category: 'ethical hacking',
  usage: 'hashcheck <text>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔐 *HASH GENERATOR* ⌋\n│\n├─⊷ *${PREFIX}hashcheck <text>*\n│  └⊷ Generate MD5, SHA1, SHA256,\n│     SHA512, RIPEMD160 hashes\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      const input = args.join(' ');
      const algorithms = ['md5', 'sha1', 'sha256', 'sha512', 'ripemd160'];
      const hashes = {};

      for (const algo of algorithms) {
        hashes[algo] = crypto.createHash(algo).update(input).digest('hex');
      }

      const hmacSha256 = crypto.createHmac('sha256', 'wolfbot').update(input).digest('hex');
      const base64 = Buffer.from(input).toString('base64');

      let result = `╭─⌈ 🔐 *HASH GENERATOR* ⌋\n│\n`;
      result += `├─⊷ *Input:* \`${input.substring(0, 40)}${input.length > 40 ? '...' : ''}\`\n`;
      result += `├─⊷ *Length:* ${input.length} chars\n│\n`;
      result += `├─⊷ *MD5:*\n│  └⊷ \`${hashes.md5}\`\n│\n`;
      result += `├─⊷ *SHA-1:*\n│  └⊷ \`${hashes.sha1}\`\n│\n`;
      result += `├─⊷ *SHA-256:*\n│  └⊷ \`${hashes.sha256}\`\n│\n`;
      result += `├─⊷ *SHA-512:*\n│  └⊷ \`${hashes.sha512}\`\n│\n`;
      result += `├─⊷ *RIPEMD-160:*\n│  └⊷ \`${hashes.ripemd160}\`\n│\n`;
      result += `├─⊷ *HMAC-SHA256:*\n│  └⊷ \`${hmacSha256}\`\n│\n`;
      result += `├─⊷ *Base64:*\n│  └⊷ \`${base64}\`\n│\n`;
      result += `╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
