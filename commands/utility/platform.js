import os from 'os';
import moment from 'moment-timezone';
import { getBotName } from '../../lib/botname.js';
import { getPlatformInfo } from '../../lib/platformDetect.js';

export default {
  name: 'platform',
  alias: ['hosting', 'host', 'server', 'whereami'],
  description: 'Show where the bot is hosted or running',
  category: 'utility',

  async execute(sock, m, args, PREFIX) {
    try {
      const jid = m.key.remoteJid;

      const platform = getPlatformInfo();

      const uptime = process.uptime();
      const days = Math.floor(uptime / (3600 * 24));
      const hours = Math.floor((uptime % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      let uptimeStr = '';
      if (days > 0) uptimeStr += `${days}d `;
      if (hours > 0) uptimeStr += `${hours}h `;
      if (minutes > 0) uptimeStr += `${minutes}m `;
      uptimeStr += `${seconds}s`;

      const mem = process.memoryUsage();
      const usedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const totalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
      const memPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

      const totalSysMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const freeSysMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

      const cpus = os.cpus();
      const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown';
      const cpuCores = cpus.length;

      const nodeVersion = process.version;
      const osType = os.type();
      const osRelease = os.release();
      const arch = os.arch();
      const hostname = os.hostname();

      const startTime = new Date(Date.now() - uptime * 1000).toLocaleString('en-US', { 
        timeZone: 'Africa/Nairobi',
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const platformText = `
╭━「 *${platform.icon} PLATFORM INFO* 」━╮
│
├─⊷ *🏠 HOSTING*
│  Platform: *${platform.name}*
│  Provider: ${platform.url}
│  Status: ✅ Active & Running
│  Hostname: ${hostname}
│
├─⊷ *💻 SYSTEM*
│  OS: ${osType} ${osRelease}
│  Arch: ${arch}
│  CPU: ${cpuModel}
│  Cores: ${cpuCores}
│  Total RAM: ${totalSysMem} GB
│  Free RAM: ${freeSysMem} GB
│
├─⊷ *⚙️ RUNTIME*
│  Node.js: ${nodeVersion}
│  PID: ${process.pid}
│  Uptime: ${uptimeStr.trim()}
│  Started: ${startTime}
│
├─⊷ *📊 MEMORY USAGE*
│  Heap Used: ${usedMB} MB
│  Heap Total: ${totalMB} MB
│  Usage: ${memPercent}%
│
╰━━━━━━━━━━━━━━━━━╯

 *POWERED BY ${getBotName()}* `.trim();

      await sock.sendMessage(jid, { text: platformText }, { quoted: m });
      
    } catch (err) {
      console.error('[PLATFORM] Error:', err);
      await sock.sendMessage(m.key.remoteJid, { text: '❌ Failed to get platform info.' }, { quoted: m });
    }
  },
};
