import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const API_BASE = 'https://apis.xcasper.space/api/sports';

export default {
  name: 'football',
  description: 'Get live football scores, standings, fixtures, top scorers & stats',
  category: 'sports',
  alias: ['soccer', 'epl', 'premierleague'],
  usage: 'football [scores|standings|fixtures|topscorers|stats] [league]',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    const leagueMap = {
      epl: 'eng.1', eng: 'eng.1', premier: 'eng.1',
      laliga: 'esp.1', esp: 'esp.1', spain: 'esp.1',
      bundesliga: 'ger.1', ger: 'ger.1', germany: 'ger.1',
      seriea: 'ita.1', ita: 'ita.1', italy: 'ita.1',
      ligue1: 'fra.1', fra: 'fra.1', france: 'fra.1'
    };
    const leagueNames = {
      'eng.1': 'Premier League', 'esp.1': 'La Liga',
      'ita.1': 'Serie A', 'ger.1': 'Bundesliga',
      'fra.1': 'Ligue 1'
    };

    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      return sock.sendMessage(jid, {
        text: `╭─⌈ ⚽ *FOOTBALL / SOCCER* ⌋\n` +
          `│\n` +
          `├─⊷ *${PREFIX}football scores*\n` +
          `│  └⊷ Live/recent match scores\n` +
          `├─⊷ *${PREFIX}football standings [league]*\n` +
          `│  └⊷ League table (default: EPL)\n` +
          `├─⊷ *${PREFIX}football fixtures*\n` +
          `│  └⊷ Upcoming fixtures\n` +
          `├─⊷ *${PREFIX}football topscorers [league]*\n` +
          `│  └⊷ Top goal scorers\n` +
          `├─⊷ *${PREFIX}football stats [league]*\n` +
          `│  └⊷ League statistics\n` +
          `│\n` +
          `├─ 📋 *Available Leagues:*\n` +
          `│  ⊷ epl / eng - Premier League\n` +
          `│  ⊷ laliga / esp - La Liga\n` +
          `│  ⊷ bundesliga / ger - Bundesliga\n` +
          `│  ⊷ seriea / ita - Serie A\n` +
          `│  ⊷ ligue1 / fra - Ligue 1\n` +
          `╰───`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      const sub = args[0].toLowerCase();
      const leagueArg = args[1]?.toLowerCase();
      const slug = leagueMap[leagueArg] || leagueMap[sub] || 'eng.1';
      const leagueName = leagueNames[slug] || 'Premier League';

      if (sub === 'scores' || sub === 'live' || sub === 'matches') {
        const res = await axios.get(`${API_BASE}?action=matches`, { timeout: 20000 });
        const data = res.data;
        const matches = data?.matches || data?.data || data?.results || (Array.isArray(data) ? data : []);

        if (!matches || matches.length === 0) throw new Error('No matches found');

        let text = `╭─⌈ ⚽ *LIVE / RECENT MATCHES* ⌋\n│\n`;
        const list = Array.isArray(matches) ? matches.slice(0, 15) : [];
        list.forEach(match => {
          const home = match?.homeTeam?.name || match?.home?.name || match?.homeTeam || match?.teams?.home?.name || 'Home';
          const away = match?.awayTeam?.name || match?.away?.name || match?.awayTeam || match?.teams?.away?.name || 'Away';
          const homeScore = match?.homeScore ?? match?.score?.home ?? match?.goals?.home ?? match?.home?.score ?? '-';
          const awayScore = match?.awayScore ?? match?.score?.away ?? match?.goals?.away ?? match?.away?.score ?? '-';
          const status = match?.status || match?.state || match?.matchStatus || match?.statusText || '';
          const league = match?.league?.name || match?.competition?.name || '';
          const matchId = match?.id || match?.matchId || match?.match_id || '';
          text += `├─⊷ ${home} *${homeScore}* - *${awayScore}* ${away}\n`;
          text += `│  └⊷ ${status}${league ? ` │ ${league}` : ''}${matchId ? ` │ ID: ${matchId}` : ''}\n`;
        });
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
        console.log('⚽ [FOOTBALL] Scores fetched successfully');

      } else if (sub === 'standings' || sub === 'table') {
        const res = await axios.get(`${API_BASE}?action=standings&slug=${slug}`, { timeout: 20000 });
        const data = res.data;
        const standings = data?.standings || data?.data || data?.table || data?.results || (Array.isArray(data) ? data : []);

        if (!standings || (Array.isArray(standings) && standings.length === 0)) throw new Error('No standings data available');

        let text = `╭─⌈ ⚽ *${leagueName.toUpperCase()} STANDINGS* ⌋\n│\n`;
        const list = Array.isArray(standings) ? standings.slice(0, 20) : [];
        list.forEach((team, i) => {
          const rank = team?.rank || team?.position || (i + 1);
          const name = team?.team?.name || team?.name || team?.teamName || team?.team?.displayName || 'Unknown';
          const short = name.length > 16 ? name.substring(0, 14) + '..' : name;
          const pts = team?.points ?? team?.pts ?? team?.stats?.points ?? '-';
          const w = team?.wins ?? team?.win ?? team?.stats?.wins ?? team?.w ?? '-';
          const d = team?.draws ?? team?.draw ?? team?.stats?.draws ?? team?.d ?? '-';
          const l = team?.losses ?? team?.loss ?? team?.stats?.losses ?? team?.l ?? '-';
          const gf = team?.goalsFor ?? team?.gf ?? team?.stats?.goalsFor ?? '';
          const ga = team?.goalsAgainst ?? team?.ga ?? team?.stats?.goalsAgainst ?? '';
          const goalStr = (gf !== '' && ga !== '') ? ` │ ${gf}:${ga}` : '';
          text += `├─⊷ *${rank}.* ${short} │ ${pts}pts │ ${w}W ${d}D ${l}L${goalStr}\n`;
        });
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
        console.log(`⚽ [FOOTBALL] Standings for ${leagueName} fetched`);

      } else if (sub === 'fixtures' || sub === 'upcoming') {
        const res = await axios.get(`${API_BASE}?action=fixtures`, { timeout: 20000 });
        const data = res.data;
        const fixtures = data?.fixtures || data?.data || data?.matches || data?.results || (Array.isArray(data) ? data : []);

        if (!fixtures || (Array.isArray(fixtures) && fixtures.length === 0)) throw new Error('No fixtures found');

        let text = `╭─⌈ ⚽ *UPCOMING FIXTURES* ⌋\n│\n`;
        const list = Array.isArray(fixtures) ? fixtures.slice(0, 15) : [];
        list.forEach(match => {
          const home = match?.homeTeam?.name || match?.home?.name || match?.homeTeam || match?.teams?.home?.name || 'Home';
          const away = match?.awayTeam?.name || match?.away?.name || match?.awayTeam || match?.teams?.away?.name || 'Away';
          const date = match?.date || match?.utcDate || match?.matchDate || match?.kickoff || '';
          const league = match?.league?.name || match?.competition?.name || '';
          const venue = match?.venue || match?.stadium || '';
          let dateStr = '';
          if (date) {
            try { dateStr = new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { dateStr = date; }
          }
          text += `├─⊷ ${home} vs ${away}\n`;
          text += `│  └⊷ ${dateStr}${league ? ` │ ${league}` : ''}${venue ? ` │ ${venue}` : ''}\n`;
        });
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
        console.log('⚽ [FOOTBALL] Fixtures fetched successfully');

      } else if (sub === 'topscorers' || sub === 'scorers' || sub === 'goals') {
        const res = await axios.get(`${API_BASE}?action=topscorers&slug=${slug}`, { timeout: 20000 });
        const data = res.data;
        const scorers = data?.scorers || data?.data || data?.topScorers || data?.results || data?.players || (Array.isArray(data) ? data : []);

        if (!scorers || (Array.isArray(scorers) && scorers.length === 0)) throw new Error('No top scorers data available');

        let text = `╭─⌈ ⚽ *${leagueName.toUpperCase()} TOP SCORERS* ⌋\n│\n`;
        const list = Array.isArray(scorers) ? scorers.slice(0, 15) : [];
        list.forEach((player, i) => {
          const name = player?.player?.name || player?.name || player?.playerName || 'Unknown';
          const goals = player?.goals ?? player?.numberOfGoals ?? player?.stats?.goals ?? player?.value ?? '-';
          const team = player?.team?.name || player?.teamName || player?.team || '';
          const assists = player?.assists ?? player?.stats?.assists ?? '';
          text += `├─⊷ *${i + 1}.* ${name} │ ⚽ ${goals}${assists !== '' ? ` │ 🅰️ ${assists}` : ''}${team ? ` │ ${team}` : ''}\n`;
        });
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
        console.log(`⚽ [FOOTBALL] Top scorers for ${leagueName} fetched`);

      } else if (sub === 'stats' || sub === 'statistics') {
        const res = await axios.get(`${API_BASE}?action=statistics&slug=${slug}`, { timeout: 20000 });
        const data = res.data;
        const stats = data?.statistics || data?.data || data?.stats || data?.results || data;

        if (!stats) throw new Error('No statistics data available');

        let text = `╭─⌈ ⚽ *${leagueName.toUpperCase()} STATISTICS* ⌋\n│\n`;
        if (Array.isArray(stats)) {
          stats.slice(0, 15).forEach(stat => {
            const label = stat?.label || stat?.name || stat?.category || stat?.type || 'Stat';
            const value = stat?.value || stat?.displayValue || stat?.count || '';
            const player = stat?.player?.name || stat?.playerName || stat?.leader || '';
            const team = stat?.team?.name || stat?.teamName || '';
            text += `├─⊷ *${label}:* ${value}${player ? ` - ${player}` : ''}${team ? ` (${team})` : ''}\n`;
          });
        } else if (typeof stats === 'object') {
          Object.entries(stats).slice(0, 15).forEach(([key, val]) => {
            if (typeof val === 'object' && val !== null) {
              const display = val?.value || val?.name || val?.displayValue || JSON.stringify(val).substring(0, 50);
              text += `├─⊷ *${key}:* ${display}\n`;
            } else {
              text += `├─⊷ *${key}:* ${val}\n`;
            }
          });
        }
        text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
        await sock.sendMessage(jid, { text }, { quoted: m });
        console.log(`⚽ [FOOTBALL] Statistics for ${leagueName} fetched`);

      } else {
        const trySlug = leagueMap[sub];
        if (trySlug) {
          const res = await axios.get(`${API_BASE}?action=standings&slug=${trySlug}`, { timeout: 20000 });
          const data = res.data;
          const standings = data?.standings || data?.data || data?.table || data?.results || (Array.isArray(data) ? data : []);
          const ln = leagueNames[trySlug] || sub;
          let text = `╭─⌈ ⚽ *${ln.toUpperCase()} STANDINGS* ⌋\n│\n`;
          const list = Array.isArray(standings) ? standings.slice(0, 20) : [];
          list.forEach((team, i) => {
            const rank = team?.rank || team?.position || (i + 1);
            const name = team?.team?.name || team?.name || team?.teamName || 'Unknown';
            const short = name.length > 16 ? name.substring(0, 14) + '..' : name;
            const pts = team?.points ?? team?.pts ?? '-';
            text += `├─⊷ *${rank}.* ${short} │ ${pts}pts\n`;
          });
          text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
          await sock.sendMessage(jid, { text }, { quoted: m });
        } else {
          return sock.sendMessage(jid, {
            text: `╭─⌈ ⚽ *FOOTBALL HELP* ⌋\n` +
              `├─⊷ Unknown subcommand: *${sub}*\n` +
              `├─⊷ Use *${PREFIX}football* for help\n` +
              `╰───`
          }, { quoted: m });
        }
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (error) {
      console.error('❌ [FOOTBALL]', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `╭─⌈ ❌ *FOOTBALL ERROR* ⌋\n├─⊷ ${error.message}\n├─⊷ Try again later\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }
  }
};
