import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'pinghost',
  alias: ['ping', 'nping'],
  description: 'Ping a host to check availability and response times',
  category: 'ethical hacking',
  usage: 'pinghost <host>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🏓 *PING HOST* ⌋\n│\n├─⊷ *${PREFIX}pinghost <host>*\n│  └⊷ Ping a host to check availability\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}pinghost google.com\n│  └⊷ ${PREFIX}pinghost 8.8.8.8\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      const target = args[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const { data } = await axios.get(`https://api.hackertarget.com/nping/?q=${encodeURIComponent(target)}`, { timeout: 30000 });

      if (typeof data === 'string' && (data.includes('error') || data.includes('API count'))) {
        throw new Error(data.trim());
      }

      const lines = data.trim().split('\n');
      let minTime = 'N/A', maxTime = 'N/A', avgTime = 'N/A', packetLoss = 'N/A';
      const rawLines = [];

      for (const line of lines) {
        if (line.includes('rtt min')) {
          const match = line.match(/= ([\d.]+)\/([\d.]+)\/([\d.]+)/);
          if (match) {
            minTime = `${match[1]}ms`;
            avgTime = `${match[2]}ms`;
            maxTime = `${match[3]}ms`;
          }
        }
        if (line.includes('packet loss') || line.includes('Lost')) {
          const match = line.match(/([\d.]+)%/);
          if (match) packetLoss = `${match[1]}%`;
        }
        if (line.trim()) rawLines.push(line.trim());
      }

      let status = '🟢 Online';
      if (packetLoss !== 'N/A' && parseFloat(packetLoss) === 100) status = '🔴 Offline';
      else if (packetLoss !== 'N/A' && parseFloat(packetLoss) > 0) status = '🟡 Partial Loss';

      const result = `╭─⌈ 🏓 *PING HOST RESULTS* ⌋\n│\n├─⊷ *Target:* ${target}\n├─⊷ *Status:* ${status}\n│\n├─⊷ *Min Response:* ${minTime}\n├─⊷ *Avg Response:* ${avgTime}\n├─⊷ *Max Response:* ${maxTime}\n├─⊷ *Packet Loss:* ${packetLoss}\n│\n├─⊷ *Raw Output:*\n${rawLines.slice(0, 10).map(l => `│  ${l}`).join('\n')}\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
