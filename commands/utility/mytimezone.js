import { getPhoneInfo } from '../../lib/phoneTimezone.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'mytimezone',
  aliases: ['mytz', 'mytime', 'myzone'],
  description: 'Shows your timezone detected from your phone number',
  usage: 'mytimezone',

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const senderJid = m.key.participant || m.key.remoteJid || '';
    const isLid = senderJid.includes('@lid');
    const owner = getOwnerName().toUpperCase();

    const { timezone, country, flag } = getPhoneInfo(senderJid);
    const isUnknown = country === 'Unknown';

    if (isLid && isUnknown) {
      await sock.sendMessage(jid, {
        text:
          `╭─⌈ 🌐 *MY TIMEZONE* ⌋\n` +
          `├─⊷ ⚠️ Could not detect your timezone\n` +
          `├─⊷ Your account uses a privacy ID (LID)\n` +
          `├─⊷ 💡 Try messaging me in DM instead\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
      return;
    }

    const now = new Date();

    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: timezone,
    });

    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: timezone,
    });

    const utcOffset = (() => {
      try {
        const parts = new Intl.DateTimeFormat('en', {
          timeZone: timezone, timeZoneName: 'shortOffset',
        }).formatToParts(now);
        const off = parts.find(p => p.type === 'timeZoneName');
        return off ? off.value : 'UTC';
      } catch { return 'UTC'; }
    })();

    await sock.sendMessage(jid, {
      text:
        `╭─⌈ 🌐 *MY TIMEZONE* ⌋\n` +
        `├─⊷ ${flag} Country  : ${country}\n` +
        `├─⊷ 🕐 Timezone : ${timezone}\n` +
        `├─⊷ 🔢 Offset   : ${utcOffset}\n` +
        `├─⊷ 📅 Date     : ${currentDate}\n` +
        `├─⊷ ⏰ Time     : ${currentTime}\n` +
        `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
    }, { quoted: m });
  },
};
