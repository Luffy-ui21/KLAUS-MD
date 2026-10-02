import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const API_BASE = 'https://apis.xcasper.space/api/sports';

export default {
  name: 'teamnews',
  description: 'Get team-specific sports news',
  category: 'sports',
  alias: ['tnews'],
  usage: 'teamnews <teamname>',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 📰 *TEAM NEWS* ⌋\n` +
          `├─⊷ *${PREFIX}teamnews <team>*\n` +
          `│  └⊷ Get news for a specific team\n` +
          `│\n` +
          `├─ 💡 *Examples:*\n` +
          `│  ⊷ ${PREFIX}teamnews arsenal\n` +
          `│  ⊷ ${PREFIX}teamnews barcelona\n` +
          `│  ⊷ ${PREFIX}teamnews manchester united\n` +
          `│  ⊷ ${PREFIX}tnews chelsea\n` +
          `╰───`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      const team = args.join(' ').toLowerCase();
      const res = await axios.get(`${API_BASE}?action=teamnews&team=${encodeURIComponent(team)}`, { timeout: 20000 });
      const data = res.data;
      const news = data?.news || data?.articles || data?.data || data?.results || (Array.isArray(data) ? data : []);

      if (!news || (Array.isArray(news) && news.length === 0)) throw new Error(`No news found for "${team}"`);

      let text = `╭─⌈ 📰 *${team.toUpperCase()} NEWS* ⌋\n│\n`;
      const list = Array.isArray(news) ? news.slice(0, 10) : [];
      list.forEach((article, i) => {
        const title = article?.title || article?.headline || article?.name || 'Untitled';
        const summary = article?.description || article?.summary || article?.snippet || article?.body || '';
        const source = article?.source || article?.provider || article?.author || '';
        const date = article?.date || article?.publishedAt || article?.published || '';
        let dateStr = '';
        if (date) {
          try { dateStr = new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { dateStr = date; }
        }
        const shortSummary = summary.length > 100 ? summary.substring(0, 97) + '...' : summary;

        text += `├─⊷ *${i + 1}. ${title}*\n`;
        if (shortSummary) text += `│  └⊷ ${shortSummary}\n`;
        if (source || dateStr) text += `│  └⊷ ${source}${source && dateStr ? ' │ ' : ''}${dateStr}\n`;
      });
      text += `╰───\n\n${getFooter(m.key.participant || m.key.remoteJid)}`;
      await sock.sendMessage(jid, { text }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`📰 [TEAMNEWS] News for "${team}" fetched successfully`);

    } catch (error) {
      console.error('❌ [TEAMNEWS]', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `╭─⌈ ❌ *TEAM NEWS ERROR* ⌋\n├─⊷ ${error.message}\n├─⊷ Usage: ${PREFIX}teamnews <teamname>\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }
  }
};
