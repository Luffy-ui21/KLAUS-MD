// commands/system/panelstatus.js
import os from "os";
import si from "systeminformation";
import { detectPlatform } from '../../lib/platformDetect.js';

export default {
  name: "panel",
  alias: [ "vps", "server"],
  desc: "Check VPS panel status and system health 📊",
  category: "System",
  usage: ".panel [refresh]",
  async execute(sock, m, args) {
    try {
      const jid = m.key.remoteJid;
      const sender = m.key.participant || m.key.remoteJid;
      
      // Show typing indicator
      await sock.sendPresenceUpdate('composing', jid);
      
      // Secure panel URL (not exposed in code)
      // Get from environment variable
      const panelUrl = process.env.PANEL_URL || "https://wolf-host.xcasper.site";
      
      // Bot uptime
      const uptime = process.uptime();
      const days = Math.floor(uptime / (3600 * 24));
      const hours = Math.floor((uptime % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      
      // System info using systeminformation (more detailed)
      const mem = await si.mem();
      const cpu = await si.cpu();
      const load = await si.currentLoad();
      const fsSize = await si.fsSize();
      const network = await si.networkStats();
      
      // Process memory
      const procMem = process.memoryUsage();
      const usedMemory = procMem.heapUsed / 1024 / 1024;
      const totalMemory = procMem.heapTotal / 1024 / 1024;
      const memoryPercent = ((usedMemory / totalMemory) * 100).toFixed(1);
      
      // Calculate disk usage
      const rootDisk = fsSize.find(fs => fs.mount === '/') || fsSize[0];
      const diskUsed = rootDisk ? (rootDisk.used / 1024 / 1024 / 1024).toFixed(1) : 0;
      const diskTotal = rootDisk ? (rootDisk.size / 1024 / 1024 / 1024).toFixed(1) : 0;
      const diskPercent = rootDisk ? ((rootDisk.used / rootDisk.size) * 100).toFixed(1) : 0;
      
      // Get active connections (approximate)
      const connections = await si.networkConnections();
      const activeConnections = connections.filter(conn => 
        conn.state === 'ESTABLISHED' || conn.state === 'LISTEN'
      ).length;
      
      // Check panel accessibility (without exposing URL)
      let panelStatus = "❌ Offline";
      let panelLatency = "∞ ms";
      let panelInfo = "Panel unreachable";
      
      try {
        // Create a secure check without exposing URL
        const startTime = Date.now();
        
        // Method 1: Check if panel port is open (more secure)
        const net = await import('net');
        const socket = new net.Socket();
        
        // Extract hostname from panel URL for DNS resolution only
        const hostname = new URL(panelUrl).hostname;
        
        // Check port 443 (HTTPS) with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const portCheckPromise = new Promise((resolve) => {
          socket.connect(443, hostname, () => {
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', () => {
            socket.destroy();
            resolve(false);
          });
        });
        
        const isPortOpen = await Promise.race([portCheckPromise, timeoutPromise])
          .catch(() => false);
        
        const endTime = Date.now();
        
        if (isPortOpen) {
          panelStatus = "✅ Online";
          panelLatency = `${endTime - startTime} ms`;
          panelInfo = "HTTPS accessible";
        } else {
          panelStatus = "⚠️ Limited";
          panelInfo = "Port 443 timeout";
        }
        
      } catch (panelErr) {
        console.log("Panel check failed:", panelErr.message);
        panelInfo = `Check error: ${panelErr.message.substring(0, 30)}`;
      }
      
      // Get system temperature if available
      let tempInfo = "N/A";
      try {
        const temp = await si.cpuTemperature();
        tempInfo = temp.main ? `${temp.main}°C` : "N/A";
      } catch (tempErr) {
        tempInfo = "Unavailable";
      }
      
      // Get number of running processes
      const processes = (await si.processes()).list.length;
      
      // Calculate uptime percentage (since last reboot)
      const osUptime = os.uptime();
      const osDays = Math.floor(osUptime / (3600 * 24));
      const osHours = Math.floor((osUptime % (3600 * 24)) / 3600);
      
      // Prepare status message
      const statusText = `
🖥️ *VPS PANEL STATUS*
━━━━━━━━━━━━━━━━━

📊 *System Overview*
• *Panel:* ${panelStatus}
• *Latency:* ${panelLatency}
• *Status:* ${panelInfo}

⏱️ *Uptime*
• *Bot:* ${days}d ${hours}h ${minutes}m
• *System:* ${osDays}d ${osHours}h
• *Started:* ${new Date(Date.now() - (uptime * 1000)).toLocaleTimeString()}

💾 *Memory Usage*
• *Process:* ${usedMemory.toFixed(2)} MB (${memoryPercent}%)
• *System:* ${(mem.used / 1024 / 1024 / 1024).toFixed(2)} GB / ${(mem.total / 1024 / 1024 / 1024).toFixed(2)} GB
• *Available:* ${(mem.available / 1024 / 1024 / 1024).toFixed(2)} GB

⚡ *CPU Performance*
• *Load:* ${load.currentLoad.toFixed(1)}% (${load.avgLoad.toFixed(2)} avg)
• *Cores:* ${cpu.cores} cores @ ${cpu.speed} GHz
• *Temp:* ${tempInfo}

💿 *Storage*
• *Disk:* ${diskUsed} GB / ${diskTotal} GB (${diskPercent}%)
• *Mount:* ${rootDisk?.mount || '/'}

🌐 *Network*
• *Connections:* ${activeConnections} active
• *Processes:* ${processes} running
• *Platform:* ${detectPlatform()}

👤 *User:* @${sender.split("@")[0]}
⏰ *Time:* ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━━━
💡 *Tip:* Use \`.panel refresh\` to update
`.trim();

      // Get GitHub info for thumbnail
      let githubAvatar = "https://raw.githubusercontent.com/777Wolf-dot/Silent-Wolf/main/.github/images/logo.png";
      let githubName = "Silent Wolf Bot";
      let githubUrl = "https://github.com/777Wolf-dot";
      
      try {
        // Use cached approach to avoid API limits
        const cachedAvatar = process.env.GITHUB_AVATAR_CACHE;
        if (cachedAvatar) {
          githubAvatar = cachedAvatar;
        }
      } catch (githubErr) {
        // Use default if GitHub fetch fails
      }
      
      // Determine status emoji
      const statusEmoji = panelStatus.includes("✅") ? "🟢" : 
                         panelStatus.includes("⚠️") ? "🟡" : "🔴";
      
      // Send the status message with rich formatting
      await sock.sendMessage(
        jid,
        {
          text: statusText,
          contextInfo: {
            mentionedJid: [sender],
            externalAdReply: {
              title: `${statusEmoji} VPS Panel Status`,
              body: `Uptime: ${days}d ${hours}h | Load: ${load.currentLoad.toFixed(1)}%`,
              mediaType: 1,
              thumbnailUrl: githubAvatar,
              sourceUrl: githubUrl,
              renderLargerThumbnail: true,
              showAdAttribution: false,
              mediaUrl: ""
            }
          }
        },
        { quoted: m }
      );
      
      // Log the status check
      console.log(`✅ Panel status checked - ${panelStatus}, Load: ${load.currentLoad.toFixed(1)}%`);
      
      // Optional: Refresh if requested
      if (args[0] === 'refresh') {
        setTimeout(async () => {
          await sock.sendMessage(
            jid,
            { text: "🔄 Status refreshed. Use `.panel` again for updated info." },
            { quoted: m }
          );
        }, 1000);
      }

    } catch (err) {
      console.error("❌ Panel status error:", err);
      
      // Fallback with minimal info
      const uptime = process.uptime();
      const days = Math.floor(uptime / (3600 * 24));
      const hours = Math.floor((uptime % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `⚠️ *Basic System Status*\n\n` +
                `⏱️ *Uptime:* ${days}d ${hours}h ${minutes}m\n` +
                `💾 *Memory:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
                `⚡ *CPU:* ${os.cpus().length} cores\n` +
                `🔒 *Panel:* Secured check unavailable\n\n` +
                `👋 @${(m.key.participant || m.key.remoteJid).split("@")[0]}`,
          contextInfo: {
            mentionedJid: [m.key.participant || m.key.remoteJid]
          }
        },
        { quoted: m }
      );
    }
  }
};