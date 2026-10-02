import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'sitemap',
  alias: ['sitemapcheck', 'sitemapxml'],
  description: 'Check sitemap.xml of a website',
  category: 'ethical hacking',
  usage: 'sitemap <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🗺️ *SITEMAP CHECKER* ⌋\n│\n├─⊷ *${PREFIX}sitemap <url>*\n│  └⊷ Check sitemap.xml of a website\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}sitemap google.com\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let target = args[0].trim().replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

      const paths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap1.xml', '/wp-sitemap.xml'];
      let sitemapData = null;
      let sitemapUrl = '';

      for (const p of paths) {
        try {
          const res = await axios.get(target + p, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            maxRedirects: 5,
            validateStatus: (s) => s < 500
          });
          if (res.status === 200 && res.data && typeof res.data === 'string' && res.data.includes('<')) {
            sitemapData = res.data;
            sitemapUrl = target + p;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!sitemapData) {
        const result = `╭─⌈ 🗺️ *SITEMAP CHECK* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *Status:* ❌ No sitemap.xml found\n│\n├─⊷ Checked: ${paths.join(', ')}\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;
        await sock.sendMessage(jid, { text: result }, { quoted: m });
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return;
      }

      const urlMatches = sitemapData.match(/<loc>(.*?)<\/loc>/gi) || [];
      const urls = urlMatches.map(u => u.replace(/<\/?loc>/gi, ''));

      const lastmodMatches = sitemapData.match(/<lastmod>(.*?)<\/lastmod>/gi) || [];
      const lastmods = lastmodMatches.map(l => l.replace(/<\/?lastmod>/gi, ''));

      const isSitemapIndex = sitemapData.includes('<sitemapindex');
      const type = isSitemapIndex ? 'Sitemap Index' : 'URL Sitemap';

      let output = `╭─⌈ 🗺️ *SITEMAP ANALYSIS* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *Found:* ${sitemapUrl}\n├─⊷ *Type:* ${type}\n├─⊷ *Total URLs:* ${urls.length}\n│\n`;

      if (urls.length > 0) {
        output += `├─⊷ 📄 *${isSitemapIndex ? 'Sub-Sitemaps' : 'URLs'}:*\n`;
        urls.slice(0, 20).forEach((url, i) => {
          const mod = lastmods[i] ? ` (${lastmods[i]})` : '';
          output += `│  └⊷ ${i + 1}. ${url.length > 60 ? url.substring(0, 60) + '...' : url}${mod}\n`;
        });
        if (urls.length > 20) {
          output += `│  └⊷ ...and ${urls.length - 20} more URLs\n`;
        }
        output += `│\n`;
      }

      const sizeKB = (Buffer.byteLength(sitemapData, 'utf8') / 1024).toFixed(1);
      output += `├─⊷ 📦 *File Size:* ${sizeKB} KB\n│\n`;

      output += `╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: output }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
