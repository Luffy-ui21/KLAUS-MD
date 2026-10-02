import axios from 'axios';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: "movie",
  aliases: ["moviesearch", "film", "cinema", "show"],
  category: "search",
  description: "Search for movie information",
  
  async execute(sock, m, args, PREFIX) {
    try {
      const jid = m.key.remoteJid;
      
      // Check if movie name is provided
      if (args.length === 0) {
        return sock.sendMessage(jid, {
          text: `╭─⌈ 🎬 *MOVIE SEARCH* ⌋\n│\n├─⊷ *${PREFIX}movie <title>*\n│  └⊷ Search for movie information\n│\n├─⊷ *Examples:*\n│  └⊷ ${PREFIX}movie Lucifer\n│  └⊷ ${PREFIX}movie The Originals\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }

      const movieName = args.join(' ');
      const encodedName = encodeURIComponent(movieName);
      const apiUrl = `https://apiskeith.vercel.app/search/movie?q=${encodedName}`;

      // Show searching status
      await sock.sendMessage(jid, {
        text: `🔍 *Searching for movie:* "${movieName}"...`
      }, { quoted: m });

      // Fetch movie data from API
      const response = await axios.get(apiUrl, {
        timeout: 60000,
        headers: {
          'User-Agent': 'WolfBot/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.data?.status || !response.data.result) {
        return sock.sendMessage(jid, {
          text: `╭─⌈ ❌ *MOVIE NOT FOUND* ⌋\n│\n│  No results for: "${movieName}"\n│\n├─⊷ *Tips:*\n│  └⊷ Check spelling\n│  └⊷ Try exact movie name\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}movie Avengers\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }

      const movie = response.data.result;
      
      // Build movie information caption
      let caption = `🎬 *${movie.Title}* (${movie.Year})\n`;
      caption += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (movie.Rated && movie.Rated !== 'N/A') {
        caption += `⭐ *Rated:* ${movie.Rated}\n`;
      }
      
      if (movie.Released && movie.Released !== 'N/A') {
        caption += `📅 *Released:* ${movie.Released}\n`;
      }
      
      if (movie.Runtime && movie.Runtime !== 'N/A') {
        caption += `⏱ *Runtime:* ${movie.Runtime}\n`;
      }
      
      if (movie.Genre && movie.Genre !== 'N/A') {
        caption += `🎭 *Genre:* ${movie.Genre}\n`;
      }
      
      if (movie.Director && movie.Director !== 'N/A') {
        caption += `🎥 *Director:* ${movie.Director}\n`;
      }
      
      if (movie.Writer && movie.Writer !== 'N/A') {
        caption += `✍️ *Writer:* ${movie.Writer}\n`;
      }
      
      if (movie.Actors && movie.Actors !== 'N/A') {
        caption += `👥 *Actors:* ${movie.Actors}\n`;
      }
      
      if (movie.Plot && movie.Plot !== 'N/A') {
        caption += `📖 *Plot:* ${movie.Plot}\n`;
      }
      
      if (movie.Language && movie.Language !== 'N/A') {
        caption += `🗣️ *Language:* ${movie.Language}\n`;
      }
      
      if (movie.Country && movie.Country !== 'N/A') {
        caption += `🌍 *Country:* ${movie.Country}\n`;
      }
      
      if (movie.Awards && movie.Awards !== 'N/A') {
        caption += `🏆 *Awards:* ${movie.Awards}\n`;
      }
      
      if (movie.Metascore && movie.Metascore !== 'N/A') {
        caption += `📊 *Metascore:* ${movie.Metascore}\n`;
      }
      
      if (movie.imdbRating && movie.imdbRating !== 'N/A') {
        caption += `⭐ *IMDb Rating:* ${movie.imdbRating}/10\n`;
      }
      
      if (movie.imdbVotes && movie.imdbVotes !== 'N/A') {
        caption += `📈 *IMDb Votes:* ${movie.imdbVotes}\n`;
      }
      
      if (movie.Type && movie.Type !== 'N/A') {
        caption += `📺 *Type:* ${movie.Type}\n`;
      }
      
      if (movie.DVD && movie.DVD !== 'N/A') {
        caption += `💿 *DVD Release:* ${movie.DVD}\n`;
      }
      
      if (movie.BoxOffice && movie.BoxOffice !== 'N/A') {
        caption += `💰 *Box Office:* ${movie.BoxOffice}\n`;
      }
      
      if (movie.Production && movie.Production !== 'N/A') {
        caption += `🏢 *Production:* ${movie.Production}\n`;
      }
      
      if (movie.Website && movie.Website !== 'N/A') {
        caption += `🌐 *Website:* ${movie.Website}\n`;
      }
      
      caption += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      caption += `🔍 *Search:* "${movieName}"\n`;
      caption += `🎯 *API:* apiskeith.vercel.app`;

      // Send movie info with poster
      if (movie.Poster && movie.Poster !== 'N/A') {
        await sock.sendMessage(jid, {
          image: { url: movie.Poster },
          caption: caption
        }, { quoted: m });
      } else {
        // Send without image if no poster
        await sock.sendMessage(jid, {
          text: caption
        }, { quoted: m });
      }
      
      // Send success reaction
      await sock.sendMessage(jid, {
        react: { text: '✅', key: m.key }
      });

    } catch (error) {
      console.error('[MOVIE] Error:', error.message);
      
      let errorMessage = `❌ *Movie Search Failed*\n\n`;
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage += `• Movie API is unavailable\n`;
        errorMessage += `• Try again later\n\n`;
      } else if (error.response) {
        if (error.response.status === 404) {
          errorMessage += `• Movie not found\n`;
          errorMessage += `• Try different name\n\n`;
        } else {
          errorMessage += `• API Error: ${error.response.status}\n\n`;
        }
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += `• Connection timeout\n`;
        errorMessage += `• Try again\n\n`;
      } else {
        errorMessage += `• Error: ${error.message}\n\n`;
      }
      
      errorMessage += `📌 *Usage:* \`${PREFIX}movie movie title\`\n`;
      errorMessage += `📝 *Example:* \`${PREFIX}movie Lucifer\``;
      
      await sock.sendMessage(m.key.remoteJid, {
        text: errorMessage
      }, { quoted: m });
    }
  }
};