import db from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const KEY_PREFIX = 'user_notes_';

function getUserId(m) {
  const jid = m.key.participant || m.key.remoteJid || '';
  return jid.split(':')[0].split('@')[0];
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return ''; }
}

export default {
  name: 'mynotes',
  alias: ['notes', 'listnotes', 'shownotes'],
  description: 'View your saved notes',
  category: 'notes',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    try {
      const userId = getUserId(m);
      const key = KEY_PREFIX + userId;
      const data = await db.getConfig(key, { notes: [] });
      const notes = Array.isArray(data.notes) ? data.notes : [];

      const sub = (args[0] || '').toLowerCase();

      // ── delete one ──────────────────────────────────────────
      if (sub === 'del' || sub === 'delete' || sub === 'rm') {
        const idx = parseInt(args[1], 10);
        if (!idx || idx < 1 || idx > notes.length) {
          await sock.sendMessage(jid, {
            text: `❌ Invalid number.\n*Usage:* ${PREFIX}mynotes del <number>`
          }, { quoted: m });
          return;
        }
        const removed = notes.splice(idx - 1, 1)[0];
        await db.setConfig(key, { notes });
        await sock.sendMessage(jid, { react: { text: '🗑️', key: m.key } });
        await sock.sendMessage(jid, {
          text:
`╭─⌈ 🗑️ *NOTE DELETED* ⌋
├─⊷ ${removed.text}
├─⊷ Remaining: *${notes.length}*
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
        return;
      }

      // ── clear all ────────────────────────────────────────────
      if (sub === 'clear' || sub === 'clearall' || sub === 'wipe') {
        if (!notes.length) {
          await sock.sendMessage(jid, { text: '📝 You have no notes to clear.' }, { quoted: m });
          return;
        }
        await db.setConfig(key, { notes: [] });
        await sock.sendMessage(jid, { react: { text: '🧹', key: m.key } });
        await sock.sendMessage(jid, {
          text:
`╭─⌈ 🧹 *NOTES CLEARED* ⌋
├─⊷ Removed *${notes.length}* notes
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
        return;
      }

      // ── list ─────────────────────────────────────────────────
      if (!notes.length) {
        await sock.sendMessage(jid, {
          text:
`╭─⌈ 📝 *MY NOTES* ⌋
├─⊷ You have no saved notes
├─⊷ *Add one:* ${PREFIX}addnote <text>
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
        return;
      }

      const lines = notes.map((n, i) =>
`├─⊷ *${i + 1}.* ${n.text}
│   └⊷ _${fmtDate(n.savedAt)}_`
      ).join('\n');

      const out =
`╭─⌈ 📝 *MY NOTES (${notes.length})* ⌋
${lines}
├─⊷ *Add:* ${PREFIX}addnote <text>
├─⊷ *Delete:* ${PREFIX}mynotes del <num>
├─⊷ *Clear all:* ${PREFIX}mynotes clear
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

      await sock.sendMessage(jid, { text: out }, { quoted: m });
    } catch (err) {
      console.error('[mynotes]', err.message);
      await sock.sendMessage(jid, { text: `❌ Failed to load notes: ${err.message}` }, { quoted: m });
    }
  }
};
