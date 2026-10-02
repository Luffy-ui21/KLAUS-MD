import net from 'net';
import { getBotName } from '../../lib/botname.js';
import dns from 'dns';
import { promisify } from 'util';
import { getOwnerName } from '../../lib/menuHelper.js';

const dnsResolve = promisify(dns.resolve4);

const SERVICE_NAMES = {
  7: 'Echo', 20: 'FTP-Data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
  43: 'WHOIS', 53: 'DNS', 67: 'DHCP', 68: 'DHCP', 69: 'TFTP', 80: 'HTTP',
  88: 'Kerberos', 110: 'POP3', 111: 'RPCBind', 119: 'NNTP', 123: 'NTP',
  135: 'MSRPC', 137: 'NetBIOS-NS', 138: 'NetBIOS-DGM', 139: 'NetBIOS-SSN',
  143: 'IMAP', 161: 'SNMP', 162: 'SNMP-Trap', 179: 'BGP', 194: 'IRC',
  389: 'LDAP', 443: 'HTTPS', 445: 'SMB', 464: 'Kerberos', 465: 'SMTPS',
  514: 'Syslog', 515: 'LPD', 520: 'RIP', 530: 'RPC', 543: 'Klogin',
  544: 'Kshell', 554: 'RTSP', 587: 'SMTP-Sub', 631: 'IPP', 636: 'LDAPS',
  873: 'Rsync', 902: 'VMware', 989: 'FTPS-Data', 990: 'FTPS', 993: 'IMAPS',
  995: 'POP3S', 1080: 'SOCKS', 1194: 'OpenVPN', 1433: 'MSSQL', 1434: 'MSSQL-UDP',
  1521: 'Oracle', 1723: 'PPTP', 2049: 'NFS', 2082: 'cPanel', 2083: 'cPanel-SSL',
  2086: 'WHM', 2087: 'WHM-SSL', 3000: 'Dev-Server', 3306: 'MySQL', 3389: 'RDP',
  3690: 'SVN', 4443: 'HTTPS-Alt', 5432: 'PostgreSQL', 5900: 'VNC', 5901: 'VNC-1',
  6379: 'Redis', 6667: 'IRC', 8000: 'HTTP-Alt', 8080: 'HTTP-Proxy', 8443: 'HTTPS-Alt',
  8888: 'HTTP-Alt', 9090: 'WebUI', 9200: 'Elasticsearch', 9418: 'Git', 10000: 'Webmin',
  11211: 'Memcached', 27017: 'MongoDB', 27018: 'MongoDB', 50000: 'SAP'
};

function scanPort(host, port, timeout) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve({ port, open: true, service: SERVICE_NAMES[port] || 'Unknown' }); });
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => { socket.destroy(); resolve(null); });
    try { socket.connect(port, host); } catch (e) { resolve(null); }
  });
}

export default {
  name: 'openports',
  alias: ['portscan2', 'scanports'],
  description: 'Extended port scanner with service detection',
  category: 'ethical hacking',
  usage: 'openports <host>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🚪 *EXTENDED PORT SCANNER* ⌋\n│\n├─⊷ *${PREFIX}openports <host>*\n│  └⊷ Scan common + high ports\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}openports google.com\n│  └⊷ ${PREFIX}openports 93.184.216.34\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      const target = args[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '');

      let ip = target;
      try {
        const resolved = await dnsResolve(target);
        if (resolved && resolved.length > 0) ip = resolved[0];
      } catch (e) {}

      const commonPorts = [
        21, 22, 23, 25, 53, 80, 88, 110, 111, 119, 123, 135, 137, 139, 143,
        161, 179, 389, 443, 445, 465, 514, 543, 554, 587, 631, 636, 873, 902,
        990, 993, 995, 1080, 1194, 1433, 1521, 1723, 2049, 2082, 2083, 2086,
        2087, 3000, 3306, 3389, 3690, 4443, 5432, 5900, 6379, 6667, 8000,
        8080, 8443, 8888, 9090, 9200, 9418, 10000, 11211, 27017, 50000
      ];

      const openPorts = [];
      const batchSize = 20;
      const timeout = 1500;
      const startTime = Date.now();

      for (let i = 0; i < commonPorts.length; i += batchSize) {
        const batch = commonPorts.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(p => scanPort(ip, p, timeout)));
        for (const r of results) {
          if (r && r.open) openPorts.push(r);
        }
      }

      const scanTime = ((Date.now() - startTime) / 1000).toFixed(1);

      let portList = '';
      if (openPorts.length > 0) {
        portList = openPorts.map(p => `├─⊷ *Port ${p.port}:* ${p.service} 🟢`).join('\n');
      } else {
        portList = '├─⊷ No open ports found';
      }

      const result = `╭─⌈ 🚪 *EXTENDED PORT SCAN RESULTS* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *IP:* ${ip}\n├─⊷ *Ports Scanned:* ${commonPorts.length}\n├─⊷ *Open Ports:* ${openPorts.length}\n├─⊷ *Scan Time:* ${scanTime}s\n│\n├─⊷ *── Open Ports ──*\n${portList}\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
