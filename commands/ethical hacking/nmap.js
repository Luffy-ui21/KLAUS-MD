import fetch from 'node-fetch';
import dns from 'dns';
import { promisify } from 'util';
import net from 'net';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dnsResolve = promisify(dns.resolve4);
const dnsResolveMx = promisify(dns.resolveMx);
const dnsResolveTxt = promisify(dns.resolveTxt);
const dnsResolveNs = promisify(dns.resolveNs);
const execAsync = promisify(exec);

// Helper functions
function isValidHost(host) {
  // Check if it's a valid domain or IP
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return domainRegex.test(host) || ipRegex.test(host);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Common ports to scan
const COMMON_PORTS = {
  web: [80, 443, 8080, 8443],
  mail: [25, 587, 465, 993, 995],
  ssh: [22],
  ftp: [21, 990],
  dns: [53],
  database: [3306, 5432, 27017, 6379],
  rdp: [3389],
  vpn: [1194, 1723],
  other: [123, 161, 389, 636, 1433, 1521, 2483, 2484]
};

// Common service fingerprints
const SERVICE_FINGERPRINTS = {
  22: { name: 'SSH', security: 'Medium', description: 'Secure Shell - Used for remote administration' },
  80: { name: 'HTTP', security: 'Low', description: 'Web Server - Unencrypted web traffic' },
  443: { name: 'HTTPS', security: 'Medium', description: 'Secure Web Server - Encrypted web traffic' },
  21: { name: 'FTP', security: 'Low', description: 'File Transfer Protocol - Unencrypted file transfer' },
  25: { name: 'SMTP', security: 'Low', description: 'Mail Server - Email delivery' },
  53: { name: 'DNS', security: 'Medium', description: 'Domain Name System - Domain resolution' },
  3306: { name: 'MySQL', security: 'Medium', description: 'MySQL Database' },
  3389: { name: 'RDP', security: 'High', description: 'Remote Desktop - Windows remote access' },
  8080: { name: 'HTTP-ALT', security: 'Low', description: 'Alternative HTTP port' },
  8443: { name: 'HTTPS-ALT', security: 'Medium', description: 'Alternative HTTPS port' }
};

// Scan a single port
async function scanPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let result = {
      port: port,
      open: false,
      service: SERVICE_FINGERPRINTS[port]?.name || 'Unknown',
      banner: ''
    };
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      result.open = true;
      socket.destroy();
      resolve(result);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(result);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(result);
    });
    
    socket.on('data', (data) => {
      result.banner = data.toString().substring(0, 100);
      socket.destroy();
      resolve(result);
    });
    
    try {
      socket.connect(port, host);
    } catch (error) {
      resolve(result);
    }
  });
}

// DNS enumeration
async function dnsEnumeration(domain) {
  const results = {
    a: [],
    mx: [],
    txt: [],
    ns: [],
    cname: null,
    soa: null
  };
  
  try {
    // A records (IP addresses)
    try {
      const addresses = await dnsResolve(domain);
      results.a = addresses;
    } catch (error) {
      results.a = [];
    }
    
    // MX records (mail servers)
    try {
      const mxRecords = await dnsResolveMx(domain);
      results.mx = mxRecords.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      results.mx = [];
    }
    
    // TXT records
    try {
      const txtRecords = await dnsResolveTxt(domain);
      results.txt = txtRecords.flat();
    } catch (error) {
      results.txt = [];
    }
    
    // NS records
    try {
      const nsRecords = await dnsResolveNs(domain);
      results.ns = nsRecords;
    } catch (error) {
      results.ns = [];
    }
    
  } catch (error) {
    console.log('DNS enumeration error:', error.message);
  }
  
  return results;
}

// WHOIS lookup using API
async function whoisLookup(domain) {
  try {
    const response = await fetch(`https://api.whoisfreaks.com/v1.0/whois?apiKey=demo&whois=live&domainName=${domain}`);
    const data = await response.json();
    
    return {
      registrar: data.registrar || 'Unknown',
      created: data.created_date || 'Unknown',
      updated: data.updated_date || 'Unknown',
      expires: data.expiry_date || 'Unknown',
      nameservers: data.name_servers || [],
      status: data.domain_status || 'Unknown'
    };
  } catch (error) {
    // Fallback to other API
    try {
      const response = await fetch(`https://api.ip2whois.com/v2?key=YOUR_API_KEY&domain=${domain}`);
      const data = await response.json();
      
      return {
        registrar: data.registrar || 'Unknown',
        created: data.create_date || 'Unknown',
        updated: data.update_date || 'Unknown',
        expires: data.expire_date || 'Unknown',
        nameservers: data.nameservers || [],
        status: data.status || 'Unknown'
      };
    } catch (error2) {
      return { error: 'WHOIS lookup failed' };
    }
  }
}

// Security headers check
async function checkSecurityHeaders(host) {
  const headers = {
    https: false,
    hsts: false,
    csp: false,
    xframe: false,
    xcontent: false
  };
  
  try {
    const response = await fetch(`https://${host}`, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }).catch(() => null);
    
    if (response) {
      headers.https = true;
      headers.hsts = response.headers.has('strict-transport-security');
      headers.csp = response.headers.has('content-security-policy');
      headers.xframe = response.headers.has('x-frame-options');
      headers.xcontent = response.headers.has('x-content-type-options') && 
                         response.headers.get('x-content-type-options') === 'nosniff';
    }
  } catch (error) {
    // Try HTTP
    try {
      const response = await fetch(`http://${host}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).catch(() => null);
      
      if (response) {
        headers.csp = response.headers.has('content-security-policy');
        headers.xframe = response.headers.has('x-frame-options');
        headers.xcontent = response.headers.has('x-content-type-options') && 
                           response.headers.get('x-content-type-options') === 'nosniff';
      }
    } catch (error2) {
      // Ignore
    }
  }
  
  return headers;
}

// Subdomain enumeration
async function enumerateSubdomains(domain) {
  const commonSubdomains = [
    'www', 'mail', 'ftp', 'smtp', 'pop', 'imap', 'webmail',
    'admin', 'blog', 'shop', 'store', 'api', 'dev', 'test',
    'staging', 'secure', 'portal', 'cpanel', 'webdisk', 'whm',
    'autodiscover', 'owa', 'exchange', 'lync', 'teams', 'sharepoint',
    'git', 'svn', 'jenkins', 'docker', 'registry', 'vpn',
    'ns1', 'ns2', 'ns3', 'ns4', 'dns1', 'dns2', 'mx1', 'mx2'
  ];
  
  const found = [];
  
  // Check a few common subdomains
  for (const sub of commonSubdomains.slice(0, 10)) {
    try {
      const host = `${sub}.${domain}`;
      const addresses = await dnsResolve(host).catch(() => []);
      if (addresses.length > 0) {
        found.push({ subdomain: host, ips: addresses });
      }
    } catch (error) {
      // Continue
    }
    await delay(100); // Rate limiting
  }
  
  return found;
}

// Vulnerability checks
function checkCommonVulnerabilities(scanResults) {
  const vulnerabilities = [];
  
  // Check for common insecure configurations
  if (scanResults.ports.some(p => p.port === 21 && p.open)) {
    vulnerabilities.push({
      severity: 'High',
      service: 'FTP (Port 21)',
      issue: 'FTP is running without encryption',
      recommendation: 'Use SFTP or FTPS instead'
    });
  }
  
  if (scanResults.ports.some(p => p.port === 23 && p.open)) {
    vulnerabilities.push({
      severity: 'Critical',
      service: 'Telnet (Port 23)',
      issue: 'Telnet transmits data in plaintext',
      recommendation: 'Disable Telnet, use SSH instead'
    });
  }
  
  if (scanResults.ports.some(p => p.port === 3389 && p.open)) {
    vulnerabilities.push({
      severity: 'High',
      service: 'RDP (Port 3389)',
      issue: 'Remote Desktop exposed to internet',
      recommendation: 'Use VPN or restrict IP access'
    });
  }
  
  if (scanResults.ports.some(p => p.port === 80 && p.open && !scanResults.ports.some(p2 => p2.port === 443 && p2.open))) {
    vulnerabilities.push({
      severity: 'Medium',
      service: 'HTTP (Port 80)',
      issue: 'HTTP without HTTPS redirect',
      recommendation: 'Enable HTTPS and redirect HTTP to HTTPS'
    });
  }
  
  if (scanResults.securityHeaders && !scanResults.securityHeaders.https) {
    vulnerabilities.push({
      severity: 'Medium',
      service: 'Web',
      issue: 'HTTPS not enabled',
      recommendation: 'Install SSL certificate and enforce HTTPS'
    });
  }
  
  return vulnerabilities;
}

// Format scan results
function formatScanReport(target, scanResults) {
  let report = `🔍 *NETWORK SCAN REPORT*\n\n`;
  report += `🎯 *Target:* ${target}\n`;
  report += `📅 *Scan Date:* ${new Date().toLocaleString()}\n`;
  report += `⏱️ *Scan Duration:* ${scanResults.scanDuration}ms\n\n`;
  
  // IP Information
  if (scanResults.ip) {
    report += `📡 *IP ADDRESS*\n`;
    report += `• IP: ${scanResults.ip}\n`;
    if (scanResults.hostname) {
      report += `• Hostname: ${scanResults.hostname}\n`;
    }
    report += `\n`;
  }
  
  // DNS Information
  if (scanResults.dns && (scanResults.dns.a.length > 0 || scanResults.dns.mx.length > 0)) {
    report += `🌐 *DNS INFORMATION*\n`;
    
    if (scanResults.dns.a.length > 0) {
      report += `• A Records: ${scanResults.dns.a.join(', ')}\n`;
    }
    
    if (scanResults.dns.mx.length > 0) {
      report += `• MX Records:\n`;
      scanResults.dns.mx.forEach(mx => {
        report += `  ${mx.exchange} (Priority: ${mx.priority})\n`;
      });
    }
    
    if (scanResults.dns.ns.length > 0) {
      report += `• NS Records: ${scanResults.dns.ns.join(', ')}\n`;
    }
    
    if (scanResults.dns.txt.length > 0) {
      report += `• TXT Records: ${scanResults.dns.txt.slice(0, 3).join(', ')}\n`;
      if (scanResults.dns.txt.length > 3) {
        report += `  ... and ${scanResults.dns.txt.length - 3} more\n`;
      }
    }
    
    report += `\n`;
  }
  
  // Open Ports
  if (scanResults.ports && scanResults.ports.length > 0) {
    const openPorts = scanResults.ports.filter(p => p.open);
    const closedPorts = scanResults.ports.filter(p => !p.open);
    
    report += `🚪 *PORT SCAN RESULTS*\n`;
    report += `• Scanned: ${scanResults.ports.length} ports\n`;
    report += `• Open: ${openPorts.length} ports\n`;
    report += `• Closed: ${closedPorts.length} ports\n\n`;
    
    if (openPorts.length > 0) {
      report += `📋 *OPEN PORTS:*\n`;
      openPorts.forEach(port => {
        const service = SERVICE_FINGERPRINTS[port.port] || { name: 'Unknown', security: 'Unknown' };
        report += `• Port ${port.port} (${service.name}) - ${service.security} risk\n`;
        if (port.banner) {
          report += `  Banner: ${port.banner.substring(0, 40)}...\n`;
        }
      });
      report += `\n`;
    }
  }
  
  // Security Headers
  if (scanResults.securityHeaders) {
    report += `🛡️ *WEB SECURITY HEADERS*\n`;
    report += `• HTTPS: ${scanResults.securityHeaders.https ? '✅ Enabled' : '❌ Not enabled'}\n`;
    report += `• HSTS: ${scanResults.securityHeaders.hsts ? '✅ Present' : '❌ Missing'}\n`;
    report += `• CSP: ${scanResults.securityHeaders.csp ? '✅ Present' : '❌ Missing'}\n`;
    report += `• X-Frame-Options: ${scanResults.securityHeaders.xframe ? '✅ Present' : '❌ Missing'}\n`;
    report += `• X-Content-Type-Options: ${scanResults.securityHeaders.xcontent ? '✅ Present' : '❌ Missing'}\n`;
    report += `\n`;
  }
  
  // Subdomains
  if (scanResults.subdomains && scanResults.subdomains.length > 0) {
    report += `🌍 *SUBDOMAINS FOUND*\n`;
    scanResults.subdomains.slice(0, 5).forEach(sub => {
      report += `• ${sub.subdomain} (${sub.ips.join(', ')})\n`;
    });
    if (scanResults.subdomains.length > 5) {
      report += `... and ${scanResults.subdomains.length - 5} more\n`;
    }
    report += `\n`;
  }
  
  // Vulnerabilities
  if (scanResults.vulnerabilities && scanResults.vulnerabilities.length > 0) {
    report += `⚠️ *SECURITY VULNERABILITIES*\n`;
    scanResults.vulnerabilities.forEach((vuln, i) => {
      report += `${i + 1}. [${vuln.severity}] ${vuln.service}\n`;
      report += `   Issue: ${vuln.issue}\n`;
      report += `   Fix: ${vuln.recommendation}\n`;
    });
    report += `\n`;
  }
  
  // WHOIS Information
  if (scanResults.whois && !scanResults.whois.error) {
    report += `📋 *WHOIS INFORMATION*\n`;
    report += `• Registrar: ${scanResults.whois.registrar}\n`;
    report += `• Created: ${scanResults.whois.created}\n`;
    report += `• Updated: ${scanResults.whois.updated}\n`;
    report += `• Expires: ${scanResults.whois.expires}\n`;
    if (scanResults.whois.nameservers.length > 0) {
      report += `• Nameservers: ${scanResults.whois.nameservers.join(', ')}\n`;
    }
    report += `• Status: ${scanResults.whois.status}\n`;
    report += `\n`;
  }
  
  // Security Score
  let securityScore = 100;
  if (scanResults.vulnerabilities) {
    securityScore -= scanResults.vulnerabilities.length * 10;
  }
  if (scanResults.securityHeaders) {
    if (!scanResults.securityHeaders.https) securityScore -= 20;
    if (!scanResults.securityHeaders.hsts) securityScore -= 10;
    if (!scanResults.securityHeaders.csp) securityScore -= 10;
  }
  securityScore = Math.max(0, securityScore);
  
  report += `📊 *SECURITY SCORE:* ${securityScore}/100\n`;
  if (securityScore >= 80) report += `✅ Good security posture\n`;
  else if (securityScore >= 60) report += `⚠️ Needs improvement\n`;
  else report += `❌ Poor security - immediate attention needed\n`;
  
  report += `\n💡 *RECOMMENDATIONS:*\n`;
  report += `1. Close unnecessary open ports\n`;
  report += `2. Enable HTTPS and security headers\n`;
  report += `3. Regular security audits\n`;
  report += `4. Keep software updated\n`;
  
  return report;
}

export default {
  name: "nmap",
  description: "Network scanner and security analyzer",
  category: "utility",
  usage: ".nmap <target> [options]\nOptions: -p <ports>, -f (fast), -s (stealth), -v (verbose)",
  
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    
    // Store message key for editing
    let currentMessageKey = null;
    
    const sendUpdate = async (text, isEdit = false) => {
      try {
        if (isEdit && currentMessageKey) {
          await sock.sendMessage(jid, { 
            text,
            edit: currentMessageKey
          }, { quoted: m });
        } else {
          const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
          currentMessageKey = newMsg.key;
        }
      } catch (error) {
        const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
        currentMessageKey = newMsg.key;
      }
    };
    
    // Show help if no arguments
    if (args.length === 0) {
      const helpText = `╭─⌈ 🔍 *NETWORK SCANNER (NMAP)* ⌋\n│\n├─⊷ *.nmap <target>*\n│  └⊷ Basic network scan\n│\n├─⊷ *.nmap <target> -f*\n│  └⊷ Fast scan\n│\n├─⊷ *.nmap <target> -p 80,443*\n│  └⊷ Specific ports scan\n│\n├─⊷ *.nmap <target> -s*\n│  └⊷ Stealth/slow scan\n│\n├─⊷ *.nmap <target> -v*\n│  └⊷ Verbose scan\n│\n├─⊷ *What it scans:*\n│  └⊷ DNS records, common ports, security headers, subdomains, WHOIS, vulnerabilities\n│\n├─⊷ ⚠️ *Disclaimer:* Use only on systems you own or have permission to scan!\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      await sendUpdate(helpText);
      return;
    }
    
    // Parse arguments
    const target = args[0];
    const options = {
      fast: args.includes('-f'),
      stealth: args.includes('-s'),
      verbose: args.includes('-v'),
      ports: []
    };
    
    // Extract custom ports
    const portIndex = args.indexOf('-p');
    if (portIndex !== -1 && args[portIndex + 1]) {
      const portArg = args[portIndex + 1];
      options.ports = portArg.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p < 65536);
    }
    
    // Validate target
    if (!isValidHost(target)) {
      await sendUpdate(`╭─⌈ ❌ *INVALID TARGET* ⌋\n│\n├─⊷ Provide a valid domain or IP address\n│\n├─⊷ *.nmap example.com*\n├─⊷ *.nmap 192.168.1.1*\n├─⊷ *.nmap 8.8.8.8*\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`);
      return;
    }
    
    // Warning message
    await sendUpdate(`⚠️ *SECURITY WARNING*\n\n` +
      `You are about to scan: ${target}\n\n` +
      `*Legal Notice:*\n` +
      `• Only scan systems you own or have explicit permission to scan\n` +
      `• Unauthorized scanning may be illegal\n` +
      `• Use at your own risk\n\n` +
      `Type \`yes\` to continue or anything else to cancel.`);
    
    // Wait for confirmation
    try {
      const confirmation = await new Promise((resolve, reject) => {
        const handler = async (msg) => {
          if (msg.key.remoteJid === jid && !msg.key.fromMe) {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            resolve(text.toLowerCase());
          }
        };
        
        sock.ev.on('messages.upsert', ({ messages }) => {
          if (messages[0]) handler(messages[0]);
        });
        
        // Timeout after 30 seconds
        setTimeout(() => resolve('timeout'), 30000);
      });
      
      if (confirmation !== 'yes') {
        await sendUpdate(`❌ *Scan cancelled*\n\nUser did not confirm or timeout reached.`);
        return;
      }
    } catch (error) {
      await sendUpdate(`❌ *Confirmation error*\n\nCould not get user confirmation.`);
      return;
    }
    
    try {
      const startTime = Date.now();
      
      // Start scan
      await sendUpdate(`🚀 *Starting Network Scan*\n\n` +
        `🎯 Target: ${target}\n` +
        `⚡ Mode: ${options.fast ? 'Fast' : options.stealth ? 'Stealth' : 'Normal'}\n` +
        `🕐 Started: ${new Date().toLocaleTimeString()}\n\n` +
        `⏳ Step 1/6: Resolving DNS...`);
      
      // 1. DNS Resolution
      const dnsResults = await dnsEnumeration(target);
      const ip = dnsResults.a[0] || target;
      
      await sendUpdate(`🚀 *Network Scan in Progress*\n\n` +
        `🎯 Target: ${target}\n` +
        `📡 IP: ${ip}\n\n` +
        `✅ Step 1: DNS resolved\n` +
        `⏳ Step 2/6: WHOIS lookup...`, true);
      
      // 2. WHOIS Lookup (async - run in background)
      const whoisPromise = whoisLookup(target);
      
      await sendUpdate(`🚀 *Network Scan in Progress*\n\n` +
        `🎯 Target: ${target}\n` +
        `📡 IP: ${ip}\n\n` +
        `✅ Step 1: DNS resolved\n` +
        `✅ Step 2: WHOIS lookup started\n` +
        `⏳ Step 3/6: Checking security headers...`, true);
      
      // 3. Security Headers
      const securityHeaders = await checkSecurityHeaders(target);
      
      await sendUpdate(`🚀 *Network Scan in Progress*\n\n` +
        `🎯 Target: ${target}\n` +
        `📡 IP: ${ip}\n\n` +
        `✅ Step 1: DNS resolved\n` +
        `✅ Step 2: WHOIS lookup started\n` +
        `✅ Step 3: Security headers checked\n` +
        `⏳ Step 4/6: Scanning ports...`, true);
      
      // 4. Port Scanning
      let portsToScan = options.ports.length > 0 ? options.ports : [];
      
      if (portsToScan.length === 0) {
        // Use default ports based on mode
        if (options.fast) {
          portsToScan = [...COMMON_PORTS.web, ...COMMON_PORTS.ssh, ...COMMON_PORTS.mail.slice(0, 2)];
        } else if (options.stealth) {
          portsToScan = Object.values(COMMON_PORTS).flat().slice(0, 30);
        } else {
          portsToScan = Object.values(COMMON_PORTS).flat().slice(0, 50);
        }
      }
      
      const portResults = [];
      const batchSize = options.stealth ? 2 : options.fast ? 10 : 5;
      
      for (let i = 0; i < portsToScan.length; i += batchSize) {
        const batch = portsToScan.slice(i, i + batchSize);
        const batchPromises = batch.map(port => scanPort(ip, port, options.stealth ? 5000 : 2000));
        
        const batchResults = await Promise.all(batchPromises);
        portResults.push(...batchResults);
        
        // Update progress
        const progress = Math.round(((i + batchSize) / portsToScan.length) * 100);
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        
        await sendUpdate(`🚀 *Network Scan in Progress*\n\n` +
          `🎯 Target: ${target}\n` +
          `📡 IP: ${ip}\n\n` +
          `✅ Step 1: DNS resolved\n` +
          `✅ Step 2: WHOIS lookup started\n` +
          `✅ Step 3: Security headers checked\n` +
          `🔍 Step 4: Scanning ports ${i + 1}-${Math.min(i + batchSize, portsToScan.length)}/${portsToScan.length}\n\n` +
          `${progressBar} ${progress}%`, true);
        
        if (options.stealth) {
          await delay(1000); // Slow down for stealth
        }
      }
      
      await sendUpdate(`🚀 *Network Scan in Progress*\n\n` +
        `🎯 Target: ${target}\n` +
        `📡 IP: ${ip}\n\n` +
        `✅ Step 1: DNS resolved\n` +
        `✅ Step 2: WHOIS lookup started\n` +
        `✅ Step 3: Security headers checked\n` +
        `✅ Step 4: Ports scanned (${portResults.filter(p => p.open).length} open)\n` +
        `⏳ Step 5/6: Enumerating subdomains...`, true);
      
      // 5. Subdomain Enumeration
      const subdomains = await enumerateSubdomains(target);
      
      await sendUpdate(`🚀 *Network Scan in Progress*\n\n` +
        `🎯 Target: ${target}\n` +
        `📡 IP: ${ip}\n\n` +
        `✅ Step 1: DNS resolved\n` +
        `✅ Step 2: WHOIS lookup started\n` +
        `✅ Step 3: Security headers checked\n` +
        `✅ Step 4: Ports scanned\n` +
        `✅ Step 5: Subdomains enumerated (${subdomains.length} found)\n` +
        `⏳ Step 6/6: Analyzing vulnerabilities...`, true);
      
      // 6. Get WHOIS results
      const whoisResults = await whoisPromise;
      
      // 7. Vulnerability Analysis
      const scanData = {
        ip: ip,
        ports: portResults,
        securityHeaders: securityHeaders,
        dns: dnsResults,
        subdomains: subdomains,
        whois: whoisResults
      };
      
      const vulnerabilities = checkCommonVulnerabilities(scanData);
      
      // Complete scan
      const scanDuration = Date.now() - startTime;
      
      const finalResults = {
        target: target,
        ip: ip,
        ports: portResults,
        securityHeaders: securityHeaders,
        dns: dnsResults,
        subdomains: subdomains,
        whois: whoisResults,
        vulnerabilities: vulnerabilities,
        scanDuration: scanDuration
      };
      
      // Generate report
      const report = formatScanReport(target, finalResults);
      
      await sendUpdate(report, true);
      
      // Send additional details if verbose
      if (options.verbose && portResults.filter(p => p.open).length > 0) {
        const openPorts = portResults.filter(p => p.open);
        let verboseReport = `📋 *VERBOSE PORT DETAILS*\n\n`;
        
        openPorts.forEach(port => {
          const service = SERVICE_FINGERPRINTS[port.port] || { name: 'Unknown', security: 'Unknown', description: '' };
          verboseReport += `🚪 *Port ${port.port} (${service.name})*\n`;
          verboseReport += `• Security: ${service.security}\n`;
          verboseReport += `• Description: ${service.description}\n`;
          if (port.banner) {
            verboseReport += `• Banner: ${port.banner}\n`;
          }
          verboseReport += `\n`;
        });
        
        if (verboseReport.length > 4000) {
          verboseReport = verboseReport.substring(0, 3900) + `\n\n... (truncated due to length)`;
        }
        
        await sock.sendMessage(jid, { text: verboseReport }, { quoted: m });
      }
      
    } catch (error) {
      console.error('Nmap scan error:', error);
      
      let errorMsg = `❌ *Scan Failed*\n\n`;
      errorMsg += `🎯 Target: ${target}\n\n`;
      errorMsg += `💥 Error: ${error.message}\n\n`;
      
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorMsg += `The scan timed out. The target might be:\n`;
        errorMsg += `• Blocking requests\n`;
        errorMsg += `• Behind a firewall\n`;
        errorMsg += `• Unreachable from this server\n`;
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        errorMsg += `Could not resolve the domain name.\n`;
        errorMsg += `Check if the domain exists and is spelled correctly.`;
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
        errorMsg += `Connection was refused or reset.\n`;
        errorMsg += `The target might be actively blocking scans.`;
      } else {
        errorMsg += `An unexpected error occurred during the scan.\n`;
        errorMsg += `Try again with fewer ports or a different target.`;
      }
      
      errorMsg += `\n\n💡 *Tip:* Try .nmap <target> -f for faster scan`;
      
      await sendUpdate(errorMsg, true);
    }
  }
};