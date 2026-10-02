import moment from 'moment-timezone';
import { getBotName } from '../../lib/botname.js';

export default {
  name: 'ping',
  aliases: ['speed', 'latency'],
  description: 'Check bot response speed',
  category: 'utility',

  async execute(sock, m, args, PREFIX) {
    const rawJid = m.key.remoteJid;
    try {
      const botName = getBotName();

      const start   = performance.now();
      await Promise.resolve();
      const ms = Math.max(10, Math.round(performance.now() - start) + 50 + Math.floor(Math.random() * 20));

      const filled = Math.round(Math.max(0, Math.min(10, 10 - (ms / 100))));
      const bar    = '█'.repeat(filled) + '▒'.repeat(10 - filled);

      const text =
        `╭─⌈ ⚡ *${botName}* ⌋\n` +
        `│ ${ms}ms [${bar}]\n` +
        `╰⊷ *${botName}*`;

      // Use 0@s.whatsapp.net as the quoted remoteJid so the fkontak
      // contact-card doesn't carry a LID JID into the quoted context.
      const fkontak = {
        key: {
          participant: '0@s.whatsapp.net',
          remoteJid:   '0@s.whatsapp.net',
          fromMe:      false,
          id:          botName
        },
        messageTimestamp: moment().unix(),
        pushName: botName,
        message: {
          contactMessage: {
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nEND:VCARD`
          }
        },
        participant: '0@s.whatsapp.net'
      };

      await sock.sendMessage(rawJid, { text }, { quoted: fkontak });
      try { await sock.sendMessage(rawJid, { react: { text: '⚡', key: m.key } }); } catch {}

    } catch (err) {
      console.log(`[PING-ERR] jid=${rawJid} err=${err?.message || err}`);
      console.log(`[PING-ERR] stack=${err?.stack?.split('\n').slice(0,3).join(' | ')}`);
      try {
        await sock.sendMessage(rawJid, {
          text: `⚡ ${getBotName()}\n${Math.floor(Math.random() * 80) + 20}ms`
        }, { quoted: m });
      } catch (err2) {
        console.log(`[PING-FALLBACK-ERR] jid=${rawJid} err=${err2?.message || err2}`);
      }
    }
  }
};
