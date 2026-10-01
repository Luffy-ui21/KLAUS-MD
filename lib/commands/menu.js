/**
 * .menu / .help — Premium menu
 *
 * Two modes:
 *   .menu       → Show bot details + system stats + banner image
 *                 + a hint to type .menu all for full command list
 *   .menu all   → Show the full categorized command list
 *
 * This way the bot details are the "homepage" — clean and fast.
 * Users tap "see more" by typing .menu all.
 */

const fs = require('fs');
const path = require('path');

const BANNER_PATH = path.join(__dirname, '..', '..', 'public', 'assets', 'menu-banner.png');

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands', 'list', '?', 'allmenu', 'menuall'],
  desc: 'Show bot menu (use .menu all for full list)',
  category: 'main',
  async execute({ sock, msg, args, reply, botName, prefix, dbSession, pushName }) {
    // === MODE 2: .menu all → full command list ===
    if (args[0]?.toLowerCase() === 'all') {
      return showFullMenu({ sock, msg, reply, botName, prefix, dbSession, pushName });
    }

    // === MODE 1: .menu → bot details + banner ===
    const mem = process.memoryUsage();
    const memMB = (mem.rss / 1024 / 1024).toFixed(1);
    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
    const speedMs = (process.hrtime()[1] / 1e6).toFixed(4);
    const nodeVer = process.version;
    const platform = require('os').platform();
    const host = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Panel';

    // Count commands
    const { getCommandsList } = require('../handler');
    const commands = getCommandsList();

    const userName = dbSession?.displayName || pushName || msg.pushName || 'User';
    const userNumber = dbSession?.phoneNumber || 'Unknown';
    const mode = dbSession?.mode === 'private' ? 'Private' : 'Public';

    // RAM bar visualization
    const ramPct = Math.min(100, Math.round((mem.rss / (1024 * 1024 * 512)) * 100)); // 512MB cap
    const ramBarLen = 10;
    const ramFilled = Math.round((ramPct / 100) * ramBarLen);
    const ramBar = '█'.repeat(ramFilled) + '░'.repeat(ramBarLen - ramFilled);

    const text = `┏▣ ◈ *${botName.replace(/\s+/g, '_').toUpperCase()} 🟢* ◈
┃ *ᴏᴡɴᴇʀ* : ${userName}
┃ *ɴᴜᴍʙᴇʀ* : ${userNumber}
┃ *ᴘʀᴇғɪx* : [ ${prefix} ]
┃ *ʜᴏsᴛ* : ${host}
┃ *ᴘʟᴜɢɪɴs* : ${commands.length}
┃ *ᴍᴏᴅᴇ* : ${mode}
┃ *ᴠᴇʀsɪᴏɴ* : 1.0.0
┃ *sᴘᴇᴇᴅ* : ${speedMs} ms
┃ *ᴜsᴀɢᴇ* : ${memMB} MB
┃ *ʀᴀᴍ* : [${ramBar}] ${ramPct}%
┃ *ᴜᴘᴛɪᴍᴇ* : ${uptimeStr}
┃ *ɴᴏᴅᴇ* : ${nodeVer}
┗▣

╭═══════════════════════✦═╗
║   *${botName} • POWERED BY KLAUS - NIK.ola*   ║
╚═══════════════════════✦═╝

👋 *Welcome ${userName}!*

📝 *Prefix:* ${prefix}
🟢 *Status:* Online & Responding
📊 *Total Commands:* ${commands.length}

┏▣ ◈ *📋 QUICK ACCESS* ◈
┃➽ ${prefix}menu all    → View all commands
┃➽ ${prefix}ping       → Test bot speed
┃➽ ${prefix}alive      → Bot status
┃➽ ${prefix}repo       → Bot repository
┃➽ ${prefix}whoami     → Your session info
┗▣

_Type *${prefix}menu all* to see all ${commands.length} commands._

_👑 KLAUS-MD - NIK.ola_`;

    // Send with banner image
    if (fs.existsSync(BANNER_PATH)) {
      try {
        const imageBuffer = fs.readFileSync(BANNER_PATH);
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: imageBuffer,
            caption: text,
            mimetype: 'image/png',
            fileName: 'klaus-md-menu.png',
          },
          { quoted: msg }
        );
        return;
      } catch (e) {
        console.error('[MENU] Image send failed:', e.message);
      }
    }

    await reply(text);
  },
};

/**
 * Show the full categorized command list
 */
async function showFullMenu({ sock, msg, reply, botName, prefix, dbSession, pushName }) {
  const { getCommandsList } = require('../handler');
  const commands = getCommandsList();

  // Group by category
  const categories = {};
  for (const c of commands) {
    if (!categories[c.category]) categories[c.category] = [];
    categories[c.category].push(c);
  }

  // Sort categories
  const categoryOrder = ['main', 'group', 'admin', 'anti', 'media', 'tools', 'fun', 'info', 'owner', 'sticker', 'misc'];
  const sortedCats = Object.keys(categories).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const categoryMeta = {
    main: { emoji: '🤖', name: 'MAIN MENU' },
    group: { emoji: '👥', name: 'GROUP MENU' },
    admin: { emoji: '🛡️', name: 'ADMIN MENU' },
    anti: { emoji: '🚫', name: 'ANTI MENU' },
    media: { emoji: '🎬', name: 'MEDIA MENU' },
    download: { emoji: '📥', name: 'DOWNLOAD MENU' },
    tools: { emoji: '🔧', name: 'TOOLS MENU' },
    fun: { emoji: '🎮', name: 'FUN MENU' },
    info: { emoji: 'ℹ️', name: 'INFO MENU' },
    owner: { emoji: '👑', name: 'OWNER MENU' },
    sticker: { emoji: '🎨', name: 'STICKER MENU' },
    misc: { emoji: '📌', name: 'OTHER MENU' },
  };

  let text = `╭═══════════════════════✦═╗
║   *${botName} — FULL COMMAND LIST*   ║
╚═══════════════════════✦═╝
`;

  for (const cat of sortedCats) {
    const cmds = categories[cat];
    const meta = categoryMeta[cat] || { emoji: '📌', name: cat.toUpperCase() + ' MENU' };

    text += `\n┏▣ ◈ *${meta.emoji} ${meta.name}* ◈\n`;
    for (const c of cmds) {
      text += `│➽ ${prefix}${c.name}\n`;
    }
    text += `┗▣\n`;
  }

  text += `
╭═══════════════════════✦═╗
║   *${botName} • POWERED BY KLAUS - NIK.ola*   ║
╚═══════════════════════✦═╝

💡 *Tip:* Type *${prefix}help <command>* for details
📱 *Owner:* KLAUS - NIK.ola
🚀 *Commands:* ${commands.length}

_👑 KLAUS-MD - NIK.ola_`;

  await reply(text);
}
