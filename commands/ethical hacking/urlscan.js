import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'urlscan',
  alias: ['scanurl', 'sitescan'],
  description: 'Scan URL/domain using urlscan.io',
  category: 'ethical hacking',
  usage: 'urlscan <domain>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔍 *URL SCANNER* ⌋\n│\n├─⊷ *${PREFIX}urlscan <domain>*\n│  └⊷ Scan domain using urlscan.io\n│     Shows scans, verdicts, IPs,\n│     technologies and more\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let domain = args[0].replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

      const response = await axios.get(`https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}&size=5`, {
        timeout: 15000,
        headers: { 'User-Agent': 'WOLFBOT/1.0' }
      });

      const data = response.data;
      const results = data.results || [];
      const total = data.total || 0;

      let result = `╭─⌈ 🔍 *URL SCANNER* ⌋\n│\n`;
      result += `├─⊷ *Domain:* ${domain}\n`;
      result += `├─⊷ *Total Scans:* ${total}\n│\n`;

      if (results.length === 0) {
        result += `├─⊷ *Status:* No scans found for this domain\n│\n`;
        result += `├─⊷ ℹ️ This domain hasn't been scanned\n│  on urlscan.io yet.\n`;
      } else {
        const ips = new Set();
        const countries = new Set();
        const servers = new Set();
        const verdicts = [];

        results.forEach((r) => {
          if (r.page) {
            if (r.page.ip) ips.add(r.page.ip);
            if (r.page.country) countries.add(r.page.country);
            if (r.page.server) servers.add(r.page.server);
          }
          if (r.verdicts) {
            if (r.verdicts.overall) {
              verdicts.push(r.verdicts.overall);
            }
          }
        });

        if (ips.size > 0) {
          result += `├─⊷ *IP Addresses:*\n`;
          [...ips].slice(0, 5).forEach(ip => {
            result += `│  └⊷ ${ip}\n`;
          });
          result += `│\n`;
        }

        if (countries.size > 0) {
          result += `├─⊷ *Countries:* ${[...countries].join(', ')}\n│\n`;
        }

        if (servers.size > 0) {
          result += `├─⊷ *Servers:* ${[...servers].slice(0, 3).join(', ')}\n│\n`;
        }

        const maliciousCount = verdicts.filter(v => v.malicious).length;
        if (verdicts.length > 0) {
          result += `├─⊷ *Verdicts:*\n`;
          result += `│  ├⊷ Malicious: ${maliciousCount > 0 ? `🔴 ${maliciousCount}/${verdicts.length}` : `🟢 0/${verdicts.length}`}\n`;
          const avgScore = verdicts.reduce((a, v) => a + (v.score || 0), 0) / verdicts.length;
          result += `│  └⊷ Avg Score: ${avgScore.toFixed(0)}/100\n│\n`;
        }

        result += `├─⊷ *Recent Scans:*\n`;
        results.slice(0, 5).forEach((r, i) => {
          const page = r.page || {};
          const task = r.task || {};
          const date = task.time ? new Date(task.time).toLocaleDateString() : 'Unknown';
          result += `│  ${i + 1}. ${page.url || domain}\n`;
          result += `│     📅 ${date} | ${page.status || 'N/A'}\n`;
          if (page.title) result += `│     📄 ${page.title.substring(0, 40)}\n`;
          if (r.result) result += `│     🔗 ${r.result}\n`;
        });
      }

      result += `│\n├─⊷ *Full Report:*\n`;
      result += `│  └⊷ https://urlscan.io/domain/${domain}\n`;
      result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
