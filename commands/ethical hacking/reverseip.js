import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'reverseip',
  alias: ['revip', 'iplookup'],
  description: 'Reverse IP lookup - find domains on same IP',
  category: 'ethical hacking',
  usage: 'reverseip <ip or domain>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔄 *REVERSE IP LOOKUP* ⌋\n│\n├─⊷ *${PREFIX}reverseip <ip or domain>*\n│  └⊷ Find domains hosted on same IP\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}reverseip 8.8.8.8\n│  └⊷ ${PREFIX}reverseip example.com\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      const target = args[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const { data } = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${encodeURIComponent(target)}`, { timeout: 15000 });

      const responseText = typeof data === 'string' ? data.trim() : String(data).trim();

      if (responseText.includes('error') || responseText.includes('API count exceeded') || !responseText) {
        throw new Error(responseText || 'No results returned');
      }

      const domains = responseText.split('\n').filter(d => d.trim() && !d.includes('error'));

      let result = `╭─⌈ 🔄 *REVERSE IP LOOKUP* ⌋\n│\n`;
      result += `├─⊷ *Target:* ${target}\n`;
      result += `├─⊷ *Domains Found:* ${domains.length}\n│\n`;

      if (domains.length > 0) {
        domains.slice(0, 30).forEach(d => {
          result += `├─⊷ ${d.trim()}\n`;
        });
        if (domains.length > 30) {
          result += `├─⊷ ... and ${domains.length - 30} more\n`;
        }
      } else {
        result += `├─⊷ No domains found\n`;
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
