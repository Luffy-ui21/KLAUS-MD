import tls from 'tls';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'tlsinfo',
  alias: ['tls', 'tlscheck'],
  description: 'Get TLS connection information for a domain',
  category: 'ethical hacking',
  usage: 'tlsinfo <domain>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔐 *TLS INFORMATION* ⌋\n│\n├─⊷ *${PREFIX}tlsinfo <domain>*\n│  └⊷ Check TLS version and cipher details\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}tlsinfo google.com\n│  └⊷ ${PREFIX}tlsinfo github.com\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      const host = args[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '');

      const tlsVersions = ['TLSv1.3', 'TLSv1.2', 'TLSv1.1', 'TLSv1'];
      const supportedVersions = [];

      for (const ver of tlsVersions) {
        try {
          await new Promise((resolve, reject) => {
            const socket = tls.connect(443, host, {
              servername: host,
              rejectUnauthorized: false,
              minVersion: ver,
              maxVersion: ver
            }, () => {
              supportedVersions.push(ver);
              socket.destroy();
              resolve();
            });
            socket.setTimeout(5000);
            socket.on('timeout', () => { socket.destroy(); resolve(); });
            socket.on('error', () => { socket.destroy(); resolve(); });
          });
        } catch (e) {}
      }

      const mainInfo = await new Promise((resolve, reject) => {
        const socket = tls.connect(443, host, { servername: host, rejectUnauthorized: false }, () => {
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          const cert = socket.getPeerCertificate();
          const ephemeral = socket.getEphemeralKeyInfo();

          socket.destroy();
          resolve({
            protocol: protocol || 'Unknown',
            cipherName: cipher ? cipher.name : 'Unknown',
            cipherVersion: cipher ? cipher.version : 'Unknown',
            cipherBits: cipher ? cipher.standardName || cipher.name : 'Unknown',
            keyExchange: ephemeral ? `${ephemeral.type || 'Unknown'} (${ephemeral.size || '?'} bits)` : 'Unknown',
            certBits: cert ? cert.bits : 'Unknown',
            certAlgo: cert ? (cert.asn1Curve || cert.sigalg || 'RSA') : 'Unknown'
          });
        });
        socket.setTimeout(10000);
        socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timed out')); });
        socket.on('error', (err) => { socket.destroy(); reject(err); });
      });

      const hasTls12Plus = supportedVersions.includes('TLSv1.2') || supportedVersions.includes('TLSv1.3');
      const hasInsecure = supportedVersions.includes('TLSv1') || supportedVersions.includes('TLSv1.1');

      let securityRating = '🟢 Secure';
      if (hasInsecure && hasTls12Plus) securityRating = '🟡 Acceptable (legacy TLS enabled)';
      else if (hasInsecure && !hasTls12Plus) securityRating = '🔴 Insecure (no TLS 1.2+)';

      const result = `╭─⌈ 🔐 *TLS INFORMATION* ⌋\n│\n├─⊷ *Host:* ${host}\n├─⊷ *Security:* ${securityRating}\n│\n├─⊷ *── Active Connection ──*\n├─⊷ *Protocol:* ${mainInfo.protocol}\n├─⊷ *Cipher:* ${mainInfo.cipherName}\n├─⊷ *Cipher Standard:* ${mainInfo.cipherBits}\n├─⊷ *Key Exchange:* ${mainInfo.keyExchange}\n├─⊷ *Cert Key Size:* ${mainInfo.certBits} bits\n│\n├─⊷ *── Supported Versions ──*\n├─⊷ *TLSv1.3:* ${supportedVersions.includes('TLSv1.3') ? '✅ Supported' : '❌ Not Supported'}\n├─⊷ *TLSv1.2:* ${supportedVersions.includes('TLSv1.2') ? '✅ Supported' : '❌ Not Supported'}\n├─⊷ *TLSv1.1:* ${supportedVersions.includes('TLSv1.1') ? '⚠️ Supported (Deprecated)' : '✅ Disabled'}\n├─⊷ *TLSv1.0:* ${supportedVersions.includes('TLSv1') ? '⚠️ Supported (Deprecated)' : '✅ Disabled'}\n│\n├─⊷ *TLS 1.2+ Support:* ${hasTls12Plus ? '✅ Yes' : '❌ No'}\n├─⊷ *Legacy TLS:* ${hasInsecure ? '⚠️ Enabled' : '✅ Disabled'}\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
