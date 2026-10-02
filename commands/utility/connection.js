// export default {
//   name: 'connection',
//   description: 'Check bot connection status',
//   category: 'utility',
//   alias: ['connect', 'link', 'status', 'info'],

//   async execute(sock, m, args, prefix, options) {
//     const start = Date.now();
    
//     // Send initial syncing message
//     const loadingMessage = await sock.sendMessage(m.key.remoteJid, {
//       text: ` *WolfBot* is checking connection... █▒▒▒▒▒▒▒▒▒`
//     }, { quoted: m });

//     const latency = Date.now() - start;
    
//     // Get owner information
//     const ownerNumber = options.OWNER_NUMBER || 'Not Set';
//     const currentPrefix = prefix;
    
//     // Platform detection
//     function detectPlatform() {
//       if (process.env.PANEL) return 'Panel';
//       if (process.env.HEROKU) return 'Heroku';
//       if (process.env.KATABUMP) return 'Katabump';
//       if (process.env.AITIMY) return 'Aitimy';
//       if (process.env.RENDER) return 'Render';
//       if (process.env.REPLIT) return 'Replit';
//       if (process.env.VERCEL) return 'Vercel';
//       if (process.env.GLITCH) return 'Glitch';
//       return 'Local/VPS';
//     }
    
//     const platform = detectPlatform();
    
//     // Check ultimatefix status
//     let ultimatefixStatus = '❌';
//     if (options.isOwner && options.isOwner()) {
//       ultimatefixStatus = '✅';
//     }
    
//     // Determine connection quality
//     let statusEmoji, statusText, mood;
//     if (latency <= 100) {
//       statusEmoji = "🟢";
//       statusText = "Excellent";
//       mood = "⚡Superb Connection";
//     } else if (latency <= 300) {
//       statusEmoji = "🟡";
//       statusText = "Good";
//       mood = "📡Stable Link";
//     } else {
//       statusEmoji = "🔴";
//       statusText = "Slow";
//       mood = "🌑Needs Optimization";
//     }
    
//     // Get bot uptime
//     const uptime = process.uptime();
//     const hours = Math.floor(uptime / 3600);
//     const minutes = Math.floor((uptime % 3600) / 60);
//     const seconds = Math.floor(uptime % 60);
//     const uptimeText = `${hours}h ${minutes}m ${seconds}s`;
    
//     // Check if user is owner
//     const isOwner = options.isOwner ? options.isOwner() : false;
    
//     // Wait for 1 second total (including time already passed)
//     const timePassed = Date.now() - start;
//     const remainingTime = 1000 - timePassed;
//     if (remainingTime > 0) {
//       await new Promise(resolve => setTimeout(resolve, remainingTime));
//     }

//     // Edit the original message with connection results
//     await sock.sendMessage(m.key.remoteJid, {
//       text: `
// ╭━━🌕 *CONNECTION STATUS* 🌕━━╮
// ┃  ⚡ *User:* ${ownerNumber}
// ┃  🔴 *Prefix:* "${currentPrefix}"
// ┃  *Ultimatefix:* ${ultimatefixStatus}
// ┃  🏗️ *Platform:* ${platform}
// ┃  ⏱️ *Latency:* ${latency}ms ${statusEmoji}
// ┃  ⏰ *Uptime:* ${uptimeText}
// ┃  🔗 *Status:* ${statusText}
// ┃  🎯 *Mood:* ${mood}
// ┃  👑 *Owner:* ${isOwner ? '✅ Yes' : '❌ No'}
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
// _ The Moon Watches — ..._
// `,
//       edit: loadingMessage.key
//     }, { quoted: m });
//   }
// };