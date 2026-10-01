/**
 * Welcome — Greet new group members + goodbye leaving members
 */
const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '..', '..', 'welcome_db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}'); }
  catch { return {}; }
}

async function handleGroupJoin(sock, event) {
  const gid = event.id;
  if (!gid.endsWith('@g.us')) return;
  const db = loadDB();
  if (db[gid] === false) return; // explicitly disabled

  for (const participant of event.participants) {
    try {
      const metadata = await sock.groupMetadata(gid);
      const groupName = metadata.subject;
      const memberCount = metadata.participants.length;

      const welcome = `╔══════════════════════════════╗
║     🎉 *WELCOME!* 🎉            ║
╚══════════════════════════════╝

👋 Welcome @${participant.split('@')[0]} to *${groupName}*!

👥 You are member #${memberCount}

📜 *Group Rules:*
• Be respectful
• No spamming
• No links without permission
• Have fun!

_Type .menu to see bot commands._

_— Powered by KLAUS-MD_`;

      await sock.sendMessage(gid, {
        text: welcome,
        mentions: [participant],
      });
    } catch {}
  }
}

async function handleGroupLeave(sock, event) {
  const gid = event.id;
  if (!gid.endsWith('@g.us')) return;
  const db = loadDB();
  if (db[gid] === false) return;

  for (const participant of event.participants) {
    try {
      await sock.sendMessage(gid, {
        text: `👋 @${participant.split('@')[0]} has left the group.\n_Goodbye! We'll miss you._`,
        mentions: [participant],
      });
    } catch {}
  }
}

module.exports = { handleGroupJoin, handleGroupLeave };
