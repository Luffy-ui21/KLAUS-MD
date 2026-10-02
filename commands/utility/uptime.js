import moment from 'moment-timezone';
import { getBotName } from '../../lib/botname.js';

export default {
  name: 'uptime',
  aliases: ['runtime'],
  description: 'Check how long the bot has been running',
  category: 'utility',

  async execute(sock, m, args, PREFIX) {
    try {
      const jid = m.key.remoteJid;
      const botName = getBotName();

      const uptime  = process.uptime();
      const days    = Math.floor(uptime / 86400);
      const hours   = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      let uptimeStr = '';
      if (days > 0)    uptimeStr += `${days}days : `;
      uptimeStr += `${hours}hrs : ${minutes}mins : ${seconds}secs`;

      const text =
        `╭─⌈ ⏱️ *${botName}* ⌋\n` +
        `│ Uptime : ${uptimeStr}\n` +
        `╰⊷ *${botName}*`;

      const fkontak = {
        key: {
          participant: '0@s.whatsapp.net',
          remoteJid:   jid,
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

      await sock.sendMessage(jid, { text }, { quoted: fkontak });
      try { await sock.sendMessage(jid, { react: { text: '⏱️', key: m.key } }); } catch {}

    } catch (err) {
      console.log(`[UPTIME-ERR] jid=${m.key.remoteJid} err=${err?.message || err}`);
      try {
        const uptime  = process.uptime();
        const hours   = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        await sock.sendMessage(m.key.remoteJid, {
          text: `⏱️ ${getBotName()}: ${hours}hrs : ${minutes}mins`
        }, { quoted: m });
      } catch (err2) {
        console.log(`[UPTIME-FALLBACK-ERR] jid=${m.key.remoteJid} err=${err2?.message || err2}`);
      }
    }
  }
};
