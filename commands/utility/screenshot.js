import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'screenshot',
  description: 'Take a screenshot of any website',
  category: 'tools',
  aliases: ['ss', 'webshot', 'webcapture', 'capture', 'snapshot', 'screengrab', 'websnap'],
  usage: 'screenshot [website_url]',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📸 *WEBSITE SCREENSHOT* ⌋\n│\n├─⊷ *${PREFIX}screenshot <URL>*\n│  └⊷ Take a screenshot of any website\n│\n├─⊷ *${PREFIX}ss google.com*\n│  └⊷ Also works without https://\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`
      }, { quoted: m });
    }

    let url = args.join(' ').trim();
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      new URL(url);
    } catch {
      return sock.sendMessage(jid, {
        text: `❌ *Invalid URL*\n\nPlease use format: https://example.com`
      }, { quoted: m });
    }

    let domain = '';
    try { domain = new URL(url).hostname.replace('www.', ''); } catch { domain = url; }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      let screenshotBuffer = null;
      let serviceUsed = '';

      const services = [
        {
          name: 'Screenshot Machine',
          getUrl: () => `https://image.thum.io/get/width/1280/crop/800/noanimate/${url}`,
          type: 'image'
        },
        {
          name: 'Screenshotlayer',
          getUrl: () => `https://api.screenshotlayer.com/api/capture?access_key=free&url=${encodeURIComponent(url)}&viewport=1280x800&format=PNG`,
          type: 'image'
        },
        {
          name: 'Google PageSpeed',
          getUrl: () => `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&strategy=desktop&screenshot=true`,
          type: 'json'
        },
        {
          name: 'Microlink',
          getUrl: () => `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`,
          type: 'redirect'
        }
      ];

      for (let i = 0; i < services.length; i++) {
        const svc = services[i];
        try {
          console.log(`📸 Trying: ${svc.name}`);

          if (svc.type === 'json') {
            const resp = await axios.get(svc.getUrl(), { timeout: 25000 });
            const screenshot = resp.data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
            if (screenshot && screenshot.startsWith('data:image')) {
              const base64Data = screenshot.split(',')[1];
              screenshotBuffer = Buffer.from(base64Data, 'base64');
              if (screenshotBuffer.length > 5000) {
                serviceUsed = svc.name;
                break;
              }
            }
            continue;
          }

          if (svc.type === 'redirect') {
            const resp = await axios.get(svc.getUrl(), { timeout: 15000 });
            const imgUrl = resp.data?.data?.screenshot?.url || resp.data?.screenshot?.url;
            if (imgUrl) {
              const imgResp = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000 });
              if (imgResp.data.length > 5000) {
                screenshotBuffer = Buffer.from(imgResp.data);
                serviceUsed = svc.name;
                break;
              }
            }
            continue;
          }

          if (svc.type === 'image') {
            const resp = await axios.get(svc.getUrl(), {
              responseType: 'arraybuffer',
              timeout: 25000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'image/*' }
            });
            const ct = resp.headers['content-type'] || '';
            if (ct.includes('image/') && resp.data.length > 5000) {
              screenshotBuffer = Buffer.from(resp.data);
              serviceUsed = svc.name;
              break;
            }
          }
        } catch (err) {
          console.log(`❌ ${svc.name}: ${err.message}`);
        }
      }

      if (!screenshotBuffer) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *Screenshot Failed*\n\nAll services unavailable for: ${domain}\n\n💡 Try simpler sites like google.com`
        }, { quoted: m });
      }

      const fileSize = (screenshotBuffer.length / 1024).toFixed(1);

      await sock.sendMessage(jid, {
        image: screenshotBuffer,
        caption: `📸 *${domain}*\n🔗 ${url}\n💾 ${fileSize}KB\n\n> *${getOwnerName().toUpperCase()} TECH*`,
        mimetype: 'image/png'
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`✅ Screenshot sent: ${domain} (${fileSize}KB via ${serviceUsed})`);

    } catch (error) {
      console.error('❌ Screenshot error:', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Screenshot Failed*\n\nError: ${error.message}\n\n💡 Try: \`${PREFIX}ss google.com\``
      }, { quoted: m });
    }
  }
};
