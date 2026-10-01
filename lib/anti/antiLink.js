/**
 * .antilink — Toggle anti-link protection per group
 *
 * Usage:
 *   .antilink delete    → delete links (warn sender)
 *   .antilink remove    → delete link + remove sender from group
 *   .antilink off       → disable anti-link
 *   .antilink status    → check current setting
 *
 * Admin only (the person running the command must be a group admin).
 * Bot must also be admin to delete/remove.
 */

const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '..', '..', 'anti_link_db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}'); }
  catch { return {}; }
}
function saveDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch {}
}

const LINK_REGEX = /https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|t\.me\//i;

async function check(sock, msg, dbSession) {
  const db = loadDB();
  const gid = msg.key.remoteJid;
  if (!gid.endsWith('@g.us')) return; // Groups only
  if (!db[gid]) return; // Not enabled for this group

  // Skip if this session has antiLink disabled
  if (dbSession && dbSession.antiLink === false) return;

  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (!text) return;
  if (!LINK_REGEX.test(text)) return;

  if (msg.key.fromMe) return; // Don't act on bot's own messages

  try {
    const metadata = await sock.groupMetadata(gid);
    const senderAdmin = metadata.participants.find(p => p.id === msg.key.participant)?.admin;
    if (senderAdmin) return; // Don't act on admins

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botIsAdmin = metadata.participants.find(p => p.id === botId)?.admin;
    if (!botIsAdmin) return;

    // Delete the message
    await sock.sendMessage(gid, { delete: msg.key });

    const action = db[gid]; // 'delete' or 'remove'
    const senderNum = msg.key.participant?.split('@')[0] || 'unknown';

    if (action === 'remove') {
      // Kick the sender
      try {
        await sock.groupParticipantsUpdate(gid, [msg.key.participant], 'remove');
        await sock.sendMessage(gid, {
          text: `🚫 *ANTI-LINK*\n\n@${senderNum} was *removed* for sending a link.\n\n_Rule: No links allowed in this group._`,
          mentions: [msg.key.participant],
        });
      } catch (e) {
        await sock.sendMessage(gid, {
          text: `⚠️ *ANTI-LINK*\n\n@${senderNum} sent a link (deleted).\nFailed to remove: ${e.message}`,
          mentions: [msg.key.participant],
        });
      }
    } else {
      // Just warn
      await sock.sendMessage(gid, {
        text: `🚫 *ANTI-LINK*\n\n@${senderNum}, *links are not allowed in this group.*\n\n_Your message was deleted. Next time you may be removed._`,
        mentions: [msg.key.participant],
      });
    }
  } catch (e) {
    // ignore
  }
}

module.exports = {
  check,
  name: 'antilink',
  aliases: ['antilink'],
  desc: 'Toggle anti-link (delete/remove/off/status)',
  category: 'anti',
  async execute({ sock, msg, args, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only command.');

    // ★ Only the bot owner can configure anti-link
    const { isBotOwner } = require('../utils/permissions');
    if (!isBotOwner(msg, dbSession)) {
      return reply('❌ *Only the bot owner can configure anti-link.*');
    }

    // No bot-admin check needed — the bot is the owner's linked device,
    // so if the owner is admin in the group, the bot can use admin powers.

    const db = loadDB();
    const action = args[0]?.toLowerCase();

    if (action === 'delete') {
      db[from] = 'delete';
      saveDB(db);
      return reply(
        `✅ *Anti-Link enabled (DELETE mode)*\n\n` +
        `📝 *Action:* Delete links + warn sender\n` +
        `🚫 *Links detected:* http://, https://, www., whatsapp.com, wa.me, t.me\n\n` +
        `_Bot will delete any message containing a link._`
      );
    }

    if (action === 'remove') {
      db[from] = 'remove';
      saveDB(db);
      return reply(
        `✅ *Anti-Link enabled (REMOVE mode)*\n\n` +
        `📝 *Action:* Delete link + remove sender from group\n` +
        `🚫 *Links detected:* http://, https://, www., whatsapp.com, wa.me, t.me\n\n` +
        `_⚠️ Anyone sending a link will be kicked!_`
      );
    }

    if (action === 'off') {
      delete db[from];
      saveDB(db);
      return reply('✅ *Anti-Link disabled* for this group.');
    }

    if (action === 'status') {
      const current = db[from];
      if (!current) return reply('📝 *Anti-Link:* 🔴 OFF (disabled)');
      return reply(`📝 *Anti-Link:* 🟢 ON (mode: ${current})`);
    }

    // No valid action → show usage
    return reply(
      `🚫 *ANTI-LINK SETTINGS*\n\n` +
      `📝 *Current:* ${db[from] ? `🟢 ON (mode: ${db[from]})` : '🔴 OFF'}\n\n` +
      `*Usage:*\n` +
      `  \`.antilink delete\`  — delete links + warn sender\n` +
      `  \`.antilink remove\`  — delete link + kick sender\n` +
      `  \`.antilink off\`     — disable anti-link\n` +
      `  \`.antilink status\`  — check current setting\n\n` +
      `_Admin only. Bot must be admin._`
    );
  },
};
