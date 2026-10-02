import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'securityheaders',
  alias: ['secheaders', 'headercheck'],
  description: 'Check website security headers',
  category: 'ethical hacking',
  usage: 'securityheaders <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🛡️ *SECURITY HEADERS* ⌋\n│\n├─⊷ *${PREFIX}securityheaders <url>*\n│  └⊷ Check website security headers\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}securityheaders google.com\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let target = args[0].trim();
      if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

      const res = await axios.get(target, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        maxRedirects: 5,
        validateStatus: () => true
      });

      const h = res.headers;
      const checks = [
        { name: 'Strict-Transport-Security', key: 'strict-transport-security', desc: 'Enforces HTTPS connections' },
        { name: 'Content-Security-Policy', key: 'content-security-policy', desc: 'Prevents XSS and injection attacks' },
        { name: 'X-Frame-Options', key: 'x-frame-options', desc: 'Prevents clickjacking' },
        { name: 'X-Content-Type-Options', key: 'x-content-type-options', desc: 'Prevents MIME sniffing' },
        { name: 'X-XSS-Protection', key: 'x-xss-protection', desc: 'Legacy XSS filter' },
        { name: 'Referrer-Policy', key: 'referrer-policy', desc: 'Controls referrer information' },
        { name: 'Permissions-Policy', key: 'permissions-policy', desc: 'Controls browser features' }
      ];

      let passed = 0;
      let lines = '';
      for (const c of checks) {
        const val = h[c.key];
        if (val) {
          passed++;
          lines += `├─⊷ ✅ *${c.name}*\n│  └⊷ ${typeof val === 'string' ? val.substring(0, 80) : 'Present'}\n│\n`;
        } else {
          lines += `├─⊷ ❌ *${c.name}*\n│  └⊷ Missing — ${c.desc}\n│\n`;
        }
      }

      const score = Math.round((passed / checks.length) * 100);
      let grade = 'F';
      if (score >= 90) grade = 'A+';
      else if (score >= 80) grade = 'A';
      else if (score >= 70) grade = 'B';
      else if (score >= 55) grade = 'C';
      else if (score >= 40) grade = 'D';

      let extra = '';
      if (h['server']) extra += `├─⊷ *Server:* ${h['server']}\n│\n`;
      if (h['x-powered-by']) extra += `├─⊷ *X-Powered-By:* ${h['x-powered-by']}\n│\n`;

      const result = `╭─⌈ 🛡️ *SECURITY HEADERS CHECK* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *Status:* ${res.status} ${res.statusText}\n│\n${lines}├─⊷ 📊 *Score:* ${passed}/${checks.length} (${score}%)\n├─⊷ 🏅 *Grade:* ${grade}\n│\n${extra}╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
