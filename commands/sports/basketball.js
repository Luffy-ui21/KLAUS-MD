import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export default {
  name: 'basketball',
  description: 'Get live NBA basketball scores and standings',
  category: 'sports',
  aliases: ['nba', 'hoops'],
  usage: 'basketball [scores|standings]',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🏀 *NBA BASKETBALL* ⌋\n├─⊷ *${PREFIX}basketball scores*\n│  └⊷ Today's NBA scores\n├─⊷ *${PREFIX}basketball standings*\n│  └⊷ NBA standings\n├─⊷ *${PREFIX}nba scores*\n│  └⊷ Alias for basketball\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      const sub = args[0].toLowerCase();

      if (sub === 'standings') {
        const res = await axios.get(`${ESPN_BASE}/basketball/nba/standings`, { timeout: 15000 });
        const groups = res.data?.children || [];
        let text = `╭─⌈ 🏀 *NBA STANDINGS* ⌋\n│\n`;

        for (const group of groups) {
          const conf = group.name || 'Conference';
          text += `├─⊷ 📋 *${conf}*\n`;
          const entries = group.standings?.entries || [];
          entries.slice(0, 8).forEach((team, i) => {
            const s = team.stats || [];
            const w = s.find(x => x.name === 'wins')?.value || 0;
            const l = s.find(x => x.name === 'losses')?.value || 0;
            const name = team.team?.displayName || 'Unknown';
            const short = name.length > 18 ? name.substring(0, 16) + '..' : name;
            text += `│  └⊷ *${i + 1}.* ${short} │ ${w}W-${l}L\n`;
          });
        }
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
      } else {
        const res = await axios.get(`${ESPN_BASE}/basketball/nba/scoreboard`, { timeout: 15000 });
        const events = res.data?.events || [];
        if (events.length === 0) throw new Error('No NBA games found today');

        let text = `╭─⌈ 🏀 *NBA SCORES* ⌋\n│\n`;
        events.slice(0, 15).forEach(ev => {
          const comp = ev.competitions?.[0];
          const teams = comp?.competitors || [];
          const home = teams.find(t => t.homeAway === 'home');
          const away = teams.find(t => t.homeAway === 'away');
          const status = ev.status?.type?.shortDetail || '';
          text += `├─⊷ ${away?.team?.abbreviation || '???'} *${away?.score || '0'}* @ ${home?.team?.abbreviation || '???'} *${home?.score || '0'}*\n`;
          text += `│  └⊷ ${status}\n`;
        });
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (error) {
      console.error('❌ [BASKETBALL]', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `╭─⌈ ❌ *BASKETBALL ERROR* ⌋\n├─⊷ ${error.message}\n├─⊷ Try again later\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }
  }
};
