import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'redirectcheck',
  alias: ['redirect', 'redirects'],
  description: 'Check HTTP redirect chain',
  category: 'ethical hacking',
  usage: 'redirectcheck <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔀 *REDIRECT CHECKER* ⌋\n│\n├─⊷ *${PREFIX}redirectcheck <url>*\n│  └⊷ Check HTTP redirect chain\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}redirectcheck http://google.com\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let target = args[0].trim();
      if (!/^https?:\/\//i.test(target)) target = 'http://' + target;

      const chain = [];
      let currentUrl = target;
      const maxRedirects = 10;

      for (let i = 0; i < maxRedirects; i++) {
        try {
          const res = await axios.get(currentUrl, {
            timeout: 10000,
            maxRedirects: 0,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            validateStatus: () => true
          });

          chain.push({
            step: i + 1,
            url: currentUrl,
            status: res.status,
            statusText: res.statusText,
            server: res.headers['server'] || '-',
            location: res.headers['location'] || null
          });

          if (res.status >= 300 && res.status < 400 && res.headers['location']) {
            let nextUrl = res.headers['location'];
            if (nextUrl.startsWith('/')) {
              const urlObj = new URL(currentUrl);
              nextUrl = urlObj.origin + nextUrl;
            } else if (!nextUrl.startsWith('http')) {
              const urlObj = new URL(currentUrl);
              nextUrl = urlObj.origin + '/' + nextUrl;
            }
            currentUrl = nextUrl;
          } else {
            break;
          }
        } catch (err) {
          chain.push({
            step: i + 1,
            url: currentUrl,
            status: 'Error',
            statusText: err.message,
            server: '-',
            location: null
          });
          break;
        }
      }

      const redirectCount = chain.filter(c => c.status >= 300 && c.status < 400).length;
      const finalUrl = chain[chain.length - 1]?.url || target;
      const finalStatus = chain[chain.length - 1]?.status || 'Unknown';

      let output = `╭─⌈ 🔀 *REDIRECT CHAIN ANALYSIS* ⌋\n│\n├─⊷ *Initial URL:* ${target}\n├─⊷ *Final URL:* ${finalUrl}\n├─⊷ *Redirects:* ${redirectCount}\n├─⊷ *Final Status:* ${finalStatus}\n│\n`;

      output += `├─⊷ 🔗 *Redirect Chain:*\n│\n`;

      chain.forEach((step, i) => {
        const statusIcon = step.status >= 200 && step.status < 300 ? '✅' :
                           step.status >= 300 && step.status < 400 ? '🔀' : '❌';
        output += `├─⊷ ${statusIcon} *Step ${step.step}*\n`;
        output += `│  └⊷ URL: ${step.url.length > 60 ? step.url.substring(0, 60) + '...' : step.url}\n`;
        output += `│  └⊷ Status: ${step.status} ${step.statusText}\n`;
        if (step.server !== '-') output += `│  └⊷ Server: ${step.server}\n`;
        if (step.location) output += `│  └⊷ → Redirects to: ${step.location.length > 50 ? step.location.substring(0, 50) + '...' : step.location}\n`;
        output += `│\n`;
      });

      if (redirectCount === 0) {
        output += `├─⊷ ✅ No redirects detected\n│\n`;
      } else if (redirectCount > 3) {
        output += `├─⊷ ⚠️ Too many redirects may\n│  └⊷ affect performance and SEO\n│\n`;
      }

      const httpToHttps = chain.some((c, i) => c.url.startsWith('http://') && chain[i + 1]?.url.startsWith('https://'));
      if (httpToHttps) {
        output += `├─⊷ 🔒 HTTP→HTTPS upgrade detected\n│\n`;
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
