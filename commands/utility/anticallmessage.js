// commands/utility/anticallmessage.js

import fs from 'fs';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const ANTICALL_FILE = './anticall.json';

function loadAntiCall() {
  try {
    return JSON.parse(fs.readFileSync(ANTICALL_FILE, 'utf8'));
  } catch {
    return { settings: {}, callLogs: [], blockedNumbers: [] };
  }
}

function saveAntiCall(data) {
  try {
    fs.writeFileSync(ANTICALL_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[anticallmessage] save error:', e.message);
  }
}

function cleanJid(jid) {
  if (!jid) return jid;
  const clean = jid.split(':')[0];
  return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

export default {
  name: 'anticallmessage',
  alias: ['anticallmsg', 'acmsg'],
  description: 'Set or view the auto-reply message sent when a call is rejected.',
  ownerOnly: true,
  execute: async (sock, msg, args, prefix, opts) => {
    const jid = msg.key.remoteJid;
    const botJid = cleanJid(sock.user?.id);
    const sub = args[0]?.toLowerCase();
    const ownerName = getOwnerName();

    const data = loadAntiCall();
    if (!data.settings[botJid]) {
      data.settings[botJid] = {
        enabled: false,
        mode: 'decline',
        autoMessage: false,
        message: "Sorry, I don't accept calls. Please send a text message instead.",
        lastUpdated: new Date().toISOString()
      };
    }

    const s = data.settings[botJid];

    // ── SET MESSAGE ──────────────────────────────────────────
    if (!sub || (sub !== 'off' && sub !== 'view' && sub !== 'clear')) {
      const newMsg = args.join(' ').trim();
      if (!newMsg) {
        const helpText =
          `╭─⌈ 📞 *ANTICALL MESSAGE* ⌋\n│\n` +
          `├─⊷ *${prefix}anticallmessage [text]*\n│  └⊷ Set auto-reply message for calls\n` +
          `├─⊷ *${prefix}anticallmessage off*\n│  └⊷ Disable auto-reply message\n` +
          `├─⊷ *${prefix}anticallmessage view*\n│  └⊷ View current message\n│\n` +
          `├─⊷ *Status:* ${s.autoMessage ? '✅ ON' : '❌ OFF'}\n` +
          (s.autoMessage ? `├─⊷ *Message:* _${s.message.substring(0, 50)}${s.message.length > 50 ? '…' : ''}_\n│\n` : `│\n`) +
          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
        return sock.sendMessage(jid, { text: helpText }, { quoted: msg });
      }

      s.autoMessage = true;
      s.message = newMsg;
      s.lastUpdated = new Date().toISOString();
      data.settings[botJid] = s;
      saveAntiCall(data);

      const reply =
        `╭─⌈ 📞 *ANTICALL MESSAGE* ⌋\n│\n` +
        `├─⊷ *Auto-reply:* ✅ ON\n` +
        `├─⊷ *Message:* _${newMsg.substring(0, 50)}${newMsg.length > 50 ? '…' : ''}_\n│\n` +
        `├─⊷ Sent after every rejected call\n` +
        `│  └⊷ Use *${prefix}anticall enable* to activate\n│\n` +
        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
      return sock.sendMessage(jid, { text: reply }, { quoted: msg });
    }

    // ── VIEW ─────────────────────────────────────────────────
    if (sub === 'view') {
      const reply =
        `╭─⌈ 📞 *ANTICALL MESSAGE* ⌋\n│\n` +
        `├─⊷ *Auto-reply:* ${s.autoMessage ? '✅ ON' : '❌ OFF'}\n` +
        (s.autoMessage
          ? `├─⊷ *Message:* _${s.message.substring(0, 50)}${s.message.length > 50 ? '…' : ''}_\n│\n`
          : `│  └⊷ No message set\n│\n`) +
        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
      return sock.sendMessage(jid, { text: reply }, { quoted: msg });
    }

    // ── OFF / CLEAR ──────────────────────────────────────────
    if (sub === 'off' || sub === 'clear') {
      s.autoMessage = false;
      s.lastUpdated = new Date().toISOString();
      data.settings[botJid] = s;
      saveAntiCall(data);

      const reply =
        `╭─⌈ 📞 *ANTICALL MESSAGE* ⌋\n│\n` +
        `├─⊷ *Auto-reply:* ❌ OFF\n` +
        `│  └⊷ No message will be sent after rejected calls\n│\n` +
        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
      return sock.sendMessage(jid, { text: reply }, { quoted: msg });
    }
  }
};
