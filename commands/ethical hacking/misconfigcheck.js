import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'misconfigcheck',
  alias: ['misconfig', 'servercheck'],
  description: 'Server misconfiguration checker - detects common server misconfigurations',
  category: 'ethical hacking',
  usage: 'misconfigcheck <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🛡️ *SERVER MISCONFIGURATION CHECKER* ⌋\n│\n├─⊷ *${PREFIX}misconfigcheck <url>*\n│  └⊷ Check for common server misconfigurations\n│\n├─⊷ *Checks:*\n│  ├⊷ Directory listing enabled\n│  ├⊷ Server version disclosure\n│  ├⊷ CORS misconfiguration\n│  ├⊷ HTTPS redirect\n│  └⊷ TRACE method enabled\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      let target = args[0];
      if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
      const urlObj = new URL(target);
      const hostname = urlObj.hostname;
      const findings = [];
      let riskScore = 0;

      const response = await axios.get(target, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        maxRedirects: 5,
        validateStatus: () => true
      });

      const headers = response.headers;
      const html = typeof response.data === 'string' ? response.data : '';

      const dirListingPatterns = ['index of /', 'directory listing for', '<title>index of', 'parent directory</a>', '[to parent directory]'];
      const htmlLower = html.toLowerCase();
      const hasDirListing = dirListingPatterns.some(p => htmlLower.includes(p));
      if (hasDirListing) {
        findings.push({ field: 'Directory Listing', status: '❌ Enabled', risk: 'High', detail: 'Directory listing is enabled — exposes file structure' });
        riskScore += 25;
      } else {
        findings.push({ field: 'Directory Listing', status: '✅ Disabled', risk: 'Low', detail: 'Directory listing not detected' });
      }

      const server = headers['server'] || '';
      if (server) {
        const hasVersion = /[\d\.]+/.test(server);
        if (hasVersion) {
          findings.push({ field: 'Server Version', status: '❌ Exposed', risk: 'Medium', detail: `Server: ${server} (version disclosed)` });
          riskScore += 15;
        } else {
          findings.push({ field: 'Server Version', status: '⚠️ Partial', risk: 'Low', detail: `Server: ${server} (no version, but type exposed)` });
          riskScore += 5;
        }
      } else {
        findings.push({ field: 'Server Version', status: '✅ Hidden', risk: 'Low', detail: 'Server header not disclosed' });
      }

      const poweredBy = headers['x-powered-by'] || '';
      if (poweredBy) {
        findings.push({ field: 'X-Powered-By', status: '❌ Exposed', risk: 'Medium', detail: `Technology: ${poweredBy}` });
        riskScore += 10;
      } else {
        findings.push({ field: 'X-Powered-By', status: '✅ Hidden', risk: 'Low', detail: 'Technology stack not disclosed via header' });
      }

      const corsOrigin = headers['access-control-allow-origin'] || '';
      const corsCredentials = headers['access-control-allow-credentials'] || '';
      const corsMethods = headers['access-control-allow-methods'] || '';
      if (corsOrigin === '*') {
        if (corsCredentials.toLowerCase() === 'true') {
          findings.push({ field: 'CORS Policy', status: '❌ Critical', risk: 'Critical', detail: 'Origin: * with credentials allowed — full CORS bypass' });
          riskScore += 25;
        } else {
          findings.push({ field: 'CORS Policy', status: '⚠️ Permissive', risk: 'Medium', detail: 'Access-Control-Allow-Origin: * (any origin)' });
          riskScore += 10;
        }
      } else if (corsOrigin) {
        findings.push({ field: 'CORS Policy', status: '✅ Restricted', risk: 'Low', detail: `Origin: ${corsOrigin}` });
      } else {
        findings.push({ field: 'CORS Policy', status: '✅ Default', risk: 'Low', detail: 'No CORS headers (same-origin enforced)' });
      }

      let httpsRedirect = false;
      try {
        const httpResp = await axios.get(`http://${hostname}`, {
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: () => true,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (httpResp.status === 301 || httpResp.status === 302) {
          const location = (httpResp.headers['location'] || '').toLowerCase();
          httpsRedirect = location.startsWith('https://');
        }
        if (httpsRedirect) {
          findings.push({ field: 'HTTPS Redirect', status: '✅ Enabled', risk: 'Low', detail: 'HTTP redirects to HTTPS' });
        } else {
          findings.push({ field: 'HTTPS Redirect', status: '❌ Missing', risk: 'High', detail: 'HTTP does not redirect to HTTPS' });
          riskScore += 15;
        }
      } catch {
        findings.push({ field: 'HTTPS Redirect', status: 'ℹ️ N/A', risk: 'Info', detail: 'Could not check HTTP redirect (port 80 may be closed)' });
      }

      const hsts = headers['strict-transport-security'] || '';
      if (hsts) {
        const maxAge = hsts.match(/max-age=(\d+)/);
        const includesSub = /includeSubDomains/i.test(hsts);
        const preload = /preload/i.test(hsts);
        findings.push({ field: 'HSTS', status: '✅ Enabled', risk: 'Low', detail: `max-age=${maxAge ? maxAge[1] : '?'}${includesSub ? ' +subdomains' : ''}${preload ? ' +preload' : ''}` });
      } else {
        findings.push({ field: 'HSTS', status: '❌ Missing', risk: 'Medium', detail: 'No Strict-Transport-Security header' });
        riskScore += 10;
      }

      try {
        const traceResp = await axios({ method: 'TRACE', url: target, timeout: 8000, validateStatus: () => true });
        if (traceResp.status === 200) {
          findings.push({ field: 'TRACE Method', status: '❌ Enabled', risk: 'Medium', detail: 'TRACE method is enabled — potential XST vulnerability' });
          riskScore += 10;
        } else {
          findings.push({ field: 'TRACE Method', status: '✅ Disabled', risk: 'Low', detail: `TRACE returned ${traceResp.status}` });
        }
      } catch {
        findings.push({ field: 'TRACE Method', status: '✅ Blocked', risk: 'Low', detail: 'TRACE method appears disabled' });
      }

      const aspnetDebug = headers['x-aspnet-version'] || '';
      const aspnetMvc = headers['x-aspnetmvc-version'] || '';
      if (aspnetDebug || aspnetMvc) {
        findings.push({ field: 'ASP.NET Debug', status: '❌ Exposed', risk: 'Medium', detail: `ASP.NET: ${aspnetDebug || aspnetMvc}` });
        riskScore += 5;
      }

      riskScore = Math.min(riskScore, 100);
      let riskLevel = riskScore >= 50 ? '🔴 HIGH' : riskScore >= 25 ? '🟡 MEDIUM' : '🟢 LOW';

      let result = `╭─⌈ 🛡️ *SERVER MISCONFIGURATION CHECK* ⌋\n│\n`;
      result += `├─⊷ *Target:* ${target}\n`;
      result += `├─⊷ *Status Code:* ${response.status}\n`;
      result += `├─⊷ *Risk Score:* ${riskScore}/100 (${riskLevel})\n│\n`;
      result += `├─⌈ 📋 *FINDINGS* ⌋\n│\n`;

      for (const f of findings) {
        result += `├─⊷ *${f.field}:* ${f.status}\n`;
        result += `│  └⊷ Risk: ${f.risk} — ${f.detail}\n│\n`;
      }

      result += `├─⌈ 💡 *RECOMMENDATIONS* ⌋\n│\n`;
      result += `├─⊷ Disable directory listing\n`;
      result += `├─⊷ Remove server version from headers\n`;
      result += `├─⊷ Configure restrictive CORS policies\n`;
      result += `├─⊷ Enable HTTPS redirect and HSTS\n`;
      result += `├─⊷ Disable TRACE and unnecessary HTTP methods\n`;
      result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
