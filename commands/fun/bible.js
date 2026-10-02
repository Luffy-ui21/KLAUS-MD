import axios from 'axios';
import { getBotName } from '../../lib/botname.js';

// Matches: Genesis 3:16  |  1 John 3:16  |  Song of Solomon 1:1  |  John 3:16-18
const REFERENCE_REGEX = /^(\d\s+)?[A-Za-z][\w\s]*\s+\d+:\d+(-\d+)?$/i;

export default {
  name: "bible",
  alias: ["bibleverse", "bv", "scripture", "verse"],
  desc: "Look up a Bible verse by reference or search by keyword.",
  use: ".bible Genesis 3:16  OR  .bible <keyword>",

  execute: async (client, msg, args) => {
    const jid = msg.key.remoteJid;
    const query = args?.join(' ')?.trim();

    if (!query) {
      return client.sendMessage(jid, {
        text: [
          `📖 *Bible Command*`,
          ``,
          `*Look up a specific verse:*`,
          `  .bible Genesis 3:16`,
          `  .bible John 3:16`,
          `  .bible 1 Corinthians 13:4`,
          `  .bible Psalm 23:1`,
          ``,
          `*Search by keyword:*`,
          `  .bible love`,
          `  .bible faith`,
          `  .bible grace`,
        ].join('\n'),
      }, { quoted: msg });
    }

    const isReference = REFERENCE_REGEX.test(query);

    try {
      if (isReference) {
        // ── Direct verse lookup via bible-api.com ─────────────────────────
        const encoded = encodeURIComponent(query);
        const res = await axios.get(`https://bible-api.com/${encoded}`, {
          timeout: 10000,
        });

        const data = res.data;
        if (!data?.verses?.length) {
          return client.sendMessage(jid, {
            text: `📖 *Bible*\n\nVerse *"${query}"* not found.\nCheck the book name and reference and try again.`,
          }, { quoted: msg });
        }

        // May return multiple verses for ranges like John 3:16-18
        const verseParts = data.verses.map(v =>
          `*${v.book_name} ${v.chapter}:${v.verse}*\n_"${v.text.replace(/\n/g, ' ').trim()}"_`
        ).join('\n\n');

        const translation = data.translation_name || 'Bible';

        await client.sendMessage(jid, {
          text: [
            `📖 *${data.reference}*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            verseParts,
            ``,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📚 *${translation}*`,
          ].join('\n'),
        }, { quoted: msg });

      } else {
        // ── Keyword search via apiskeith.top ──────────────────────────────
        const page = Math.floor(Math.random() * 3) + 1;

        let res = await axios.get('https://apiskeith.top/bible/search', {
          params: { q: query, page },
          timeout: 10000,
        });

        let result = res.data?.result;

        // If random page returns nothing, fall back to page 1
        if (!result?.verses?.length) {
          res = await axios.get('https://apiskeith.top/bible/search', {
            params: { q: query, page: 1 },
            timeout: 10000,
          });
          result = res.data?.result;
        }

        if (!result?.verses?.length) {
          return client.sendMessage(jid, {
            text: `📖 *Bible Search*\n\nNo verses found for *"${query}"*.\n\nTry a specific reference like:\n  .bible John 3:16\n  .bible Psalm 23:1`,
          }, { quoted: msg });
        }

        const { verses, totalResults, currentPage, totalPages } = result;
        const display = verses.slice(0, 5);

        const verseLines = display.map((v, i) => {
          const text = v.preview.replace(/…$/, '').trim();
          return `*${i + 1}. ${v.reference}*\n_"${text}"_`;
        }).join('\n\n');

        const pageInfo = totalPages > 1
          ? `Showing page ${currentPage} of ${totalPages} · ${totalResults.toLocaleString()} total matches`
          : `${totalResults} verse${totalResults !== 1 ? 's' : ''} found`;

        await client.sendMessage(jid, {
          text: [
            `📖 *Bible Search — "${query}"*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            verseLines,
            ``,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📄 ${pageInfo}`,
            `📚 *KJV*`,
          ].join('\n'),
        }, { quoted: msg });
      }

    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      await client.sendMessage(jid, {
        text: `❌ *${getBotName()}:* ${isTimeout ? 'Bible API timed out. Please try again.' : `Couldn't fetch verse: ${err.message}`}`,
      }, { quoted: msg });
    }
  },
};
