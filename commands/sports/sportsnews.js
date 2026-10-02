import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const API_BASE = 'https://apis.xcasper.space/api/sports';

export default {
  name: 'sportsnews',
  description: 'Get latest sports news',
  category: 'sports',
  alias: ['snews', 'sportnews'],
  usage: 'sportsnews',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      const res = await axios.get(`${API_BASE}?action=news`, { timeout: 20000 });
      const data = res.data;
      const news = data?.news || data?.articles || data?.data || data?.results || (Array.isArray(data) ? data : []);

      if (!news || (Array.isArray(news) && news.length === 0)) throw new Error('No sports news available');

      let text = `╭─⌈ 📰 *SPORTS NEWS* ⌋\n│\n`;
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
      console.log('📰 [SPORTSNEWS] News fetched successfully');

    } catch (error) {
      console.error('❌ [SPORTSNEWS]', error.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `╭─⌈ ❌ *SPORTS NEWS ERROR* ⌋\n├─⊷ ${error.message}\n├─⊷ Try again later\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }
  }
};
