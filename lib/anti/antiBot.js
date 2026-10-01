/** Anti-bot — Detects + removes other bots in groups */
const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '..', '..', 'anti_bot_db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}'); }
  catch { return {}; }
}
function saveDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
  catch {}
}

// Detect common bot prefixes — these are words that almost every WhatsApp bot responds to
const BOT_PREFIXES = ['!', '.', '/', '#', '$', '%', '^', '&', '*'];
const COMMON_BOT_CMDS = ['menu', 'help', 'alive', 'ping', 'sticker', 'tagall', 'klaus', 'nikola'];

async function check(sock, msg, dbSession) {
  const db = loadDB();
  const gid = msg.key.remoteJid;
  if (!gid.endsWith('@g.us')) return;
  if (!db[gid]) return;

  // Skip if this session has antiBot disabled
  if (dbSession && dbSession.antiBot === false) return;

  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (!text) return;
  if (msg.key.fromMe) return; // Don't flag ourselves

  // Heuristic: looks like a bot command
  const looksLikeBotCmd = BOT_PREFIXES.some(p =>
    text.startsWith(p) && COMMON_BOT_CMDS.some(c => text.slice(1).toLowerCase().startsWith(c))
  );
  if (!looksLikeBotCmd) return;

  // Also check: is this sender another bot? (Look for typical bot fingerprints in their messages)
  // Most bots reply with their own prefix — so we wait for a "menu" reply in the next few seconds
  // For simplicity, just flag the suspicious command:

  try {
    const metadata = await sock.groupMetadata(gid);
    const senderAdmin = metadata.participants.find(p => p.id === msg.key.participant)?.admin;
    if (senderAdmin) return; // Don't act on admins

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botIsAdmin = metadata.participants.find(p => p.id === botId)?.admin;
    if (!botIsAdmin) return;

    // Delete the bot command + warn
    await sock.sendMessage(gid, { delete: msg.key });
    await sock.sendMessage(gid, {
      text: `🚫 @${msg.key.participant.split('@')[0]} *detected as a bot — please disable other bots in this group.*`,
      mentions: [msg.key.participant],
    });
  } catch {}
}

module.exports = {
  check,
  name: 'antibot',
  aliases: ['antibot'],
  desc: 'Toggle anti-bot detection (on/off) for the group',
  category: 'anti',
  async execute({ sock, msg, args, from, isGroup, reply }) {
    if (!isGroup) return reply('❌ Group only.');
    const metadata = await sock.groupMetadata(from);
    const senderAdmin = metadata.participants.find(p => p.id === (msg.key.participant || msg.key.remoteJid))?.admin;
    if (!senderAdmin) return reply('❌ Admin only.');

    const db = loadDB();
    const action = args[0]?.toLowerCase();
    if (action === 'on') db[from] = true;
    else if (action === 'off') delete db[from];
    else return reply('Usage: `.antibot on|off`');
    saveDB(db);
    await reply(`✅ Anti-bot set to *${action}* for this group.`);
  },
};
