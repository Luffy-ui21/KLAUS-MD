import db from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const KEY_PREFIX = 'user_notes_';
const MAX_NOTES_PER_USER = 100;
const MAX_NOTE_LENGTH = 1000;

function getUserId(m) {
  const jid = m.key.participant || m.key.remoteJid || '';
  return jid.split(':')[0].split('@')[0];
}

export default {
  name: 'addnote',
  alias: ['savenote', 'newnote'],
  description: 'Save a personal note',
  category: 'notes',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    const text = (args || []).join(' ').trim();
    if (!text) {
      await sock.sendMessage(jid, {
        text:
`╭─⌈ 📝 *ADDNOTE* ⌋
├─⊷ *Usage:* ${PREFIX}addnote <your note>
├─⊷ *Example:* ${PREFIX}addnote I will come tomorrow
├─⊷ *View:* ${PREFIX}mynotes
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
      return;
    }

    if (text.length > MAX_NOTE_LENGTH) {
      await sock.sendMessage(jid, {
        text: `❌ Note too long (max ${MAX_NOTE_LENGTH} characters).`
      }, { quoted: m });
      return;
    }

    try {
      const userId = getUserId(m);
      const key = KEY_PREFIX + userId;
      const existing = await db.getConfig(key, { notes: [] });
      const notes = Array.isArray(existing.notes) ? existing.notes : [];

      if (notes.length >= MAX_NOTES_PER_USER) {
        await sock.sendMessage(jid, {
          text: `❌ You already have ${MAX_NOTES_PER_USER} notes. Delete some via *${PREFIX}mynotes* before adding more.`
        }, { quoted: m });
        return;
      }

      const note = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text,
        savedAt: Date.now()
      };
      notes.push(note);

      await db.setConfig(key, { notes });

      await sock.sendMessage(jid, { react: { text: '📝', key: m.key } });
      await sock.sendMessage(jid, {
        text:
`╭─⌈ ✅ *NOTE SAVED* ⌋
├─⊷ *#${notes.length}*  ${text}
├─⊷ Total notes: *${notes.length}*
├─⊷ View all: *${PREFIX}mynotes*
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    } catch (err) {
      console.error('[addnote]', err.message);
      await sock.sendMessage(jid, { text: `❌ Failed to save note: ${err.message}` }, { quoted: m });
    }
  }
};
