import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'robotscheck',
  alias: ['robots', 'robotstxt'],
  description: 'Check robots.txt file of a website',
  category: 'ethical hacking',
  usage: 'robotscheck <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🤖 *ROBOTS.TXT CHECKER* ⌋\n│\n├─⊷ *${PREFIX}robotscheck <url>*\n│  └⊷ Check robots.txt file\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}robotscheck google.com\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let target = args[0].trim().replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
      const robotsUrl = target + '/robots.txt';

      const res = await axios.get(robotsUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        maxRedirects: 5,
        validateStatus: (s) => s < 500
      });

      if (res.status === 404 || !res.data || typeof res.data !== 'string' || res.data.trim().startsWith('<!')) {
        const result = `╭─⌈ 🤖 *ROBOTS.TXT CHECK* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *Status:* ❌ No robots.txt found\n│\n├─⊷ The website does not have a\n│  └⊷ robots.txt file\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;
        await sock.sendMessage(jid, { text: result }, { quoted: m });
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return;
      }

      const content = res.data.trim();
      const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

      let userAgents = [];
      let allows = [];
      let disallows = [];
      let sitemaps = [];
      let crawlDelay = null;

      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.startsWith('user-agent:')) {
          userAgents.push(line.split(':').slice(1).join(':').trim());
        } else if (lower.startsWith('disallow:')) {
          disallows.push(line.split(':').slice(1).join(':').trim() || '/');
        } else if (lower.startsWith('allow:')) {
          allows.push(line.split(':').slice(1).join(':').trim());
        } else if (lower.startsWith('sitemap:')) {
          sitemaps.push(line.split('sitemap:')[1]?.trim() || line.split('Sitemap:')[1]?.trim());
        } else if (lower.startsWith('crawl-delay:')) {
          crawlDelay = line.split(':').slice(1).join(':').trim();
        }
      }

      let output = `╭─⌈ 🤖 *ROBOTS.TXT ANALYSIS* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *Status:* ✅ Found (${lines.length} rules)\n│\n`;

      if (userAgents.length > 0) {
        output += `├─⊷ 👤 *User-Agents:* ${[...new Set(userAgents)].length}\n`;
        [...new Set(userAgents)].slice(0, 10).forEach(ua => {
          output += `│  └⊷ ${ua}\n`;
        });
        output += `│\n`;
      }

      if (disallows.length > 0) {
        output += `├─⊷ 🚫 *Disallowed Paths:* ${disallows.length}\n`;
        disallows.slice(0, 15).forEach(d => {
          output += `│  └⊷ ${d}\n`;
        });
        if (disallows.length > 15) output += `│  └⊷ ...and ${disallows.length - 15} more\n`;
        output += `│\n`;
      }

      if (allows.length > 0) {
        output += `├─⊷ ✅ *Allowed Paths:* ${allows.length}\n`;
        allows.slice(0, 10).forEach(a => {
          output += `│  └⊷ ${a}\n`;
        });
        if (allows.length > 10) output += `│  └⊷ ...and ${allows.length - 10} more\n`;
        output += `│\n`;
      }

      if (sitemaps.length > 0) {
        output += `├─⊷ 🗺️ *Sitemaps:* ${sitemaps.length}\n`;
        sitemaps.forEach(s => {
          output += `│  └⊷ ${s}\n`;
        });
        output += `│\n`;
      }

      if (crawlDelay) {
        output += `├─⊷ ⏱️ *Crawl Delay:* ${crawlDelay}s\n│\n`;
      }

      output += `╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: output }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
