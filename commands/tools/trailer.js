import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Working APIs for trailer
const movieApis = {
  keith: {
    search: async (query) => {
      try {
        const response = await axios.get(
          `https://apiskeith.vercel.app/moviebox/search?q=${encodeURIComponent(query)}`,
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        console.error("Keith movie search error:", error.message);
        return null;
      }
    },
    getTrailer: async (url) => {
      try {
        const response = await axios.get(
          `https://apiskeith.vercel.app/movie/trailer?q=${encodeURIComponent(url)}`,
          { timeout: 15000 }
        );
        return response.data;
      } catch (error) {
        console.error("Keith trailer error:", error.message);
        return null;
      }
    }
  },
  
  // Alternative movie APIs
  omdb: {
    search: async (query) => {
      try {
        const response = await axios.get(
          `https://www.omdbapi.com/?apikey=${process.env.OMDB_API || 'trilogy'}&s=${encodeURIComponent(query)}`,
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        console.error("OMDB error:", error.message);
        return null;
      }
    }
  },
  
  // YouTube as fallback for trailers
  youtube: {
    searchTrailer: async (query) => {
      try {
        const response = await axios.get(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}+trailer+official&key=${process.env.YOUTUBE_API || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'}&type=video`,
          { timeout: 10000 }
        );
        return response.data;
      } catch (error) {
        console.error("YouTube API error:", error.message);
        return null;
      }
    }
  }
};

export default {
  name: "trailer",
  aliases: ["movietrailer", "filmtrailer", "preview", "movietrailers", "filmpromo"],
  category: "Movie",
  description: "Search for a movie and send its trailer video",
  
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const quoted = m.quoted;
    let searchQuery = "";
    
    // Get search query
    if (args.length > 0) {
      searchQuery = args.join(" ").trim();
    } else if (quoted && quoted.text) {
      searchQuery = quoted.text.trim();
        } else {
      const helpText = 
        `╭─⌈ 🎬 *MOVIE TRAILER* ⌋\n│\n├─⊷ *.trailer <movie name>*\n│  └⊷ Download official movie trailer\n│\n├─⊷ *.trailer <YouTube URL>*\n│  └⊷ Download trailer from URL\n│\n├─⊷ *Examples:*\n│  └⊷ .trailer Interstellar\n│  └⊷ .trailer John Wick 4\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      await sock.sendMessage(jid, { text: helpText }, { quoted: m });
      return;
    }
    
    console.log(`🎬 [TRAILER] Searching for: "${searchQuery}"`);
    
    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      
      let movieData = null;
      let trailerUrl = null;
      let trailerInfo = null;
      let apiUsed = "";
      
      // Try Keith API first
      const keithSearch = await movieApis.keith.search(searchQuery);
      if (keithSearch?.status && keithSearch.result?.results?.length > 0) {
        const movie = keithSearch.result.results[0];
        movieData = movie;
        apiUsed = "Keith API";
        
        console.log(`🎬 Found movie: ${movie.title} (${movie.year || 'N/A'})`);
        
        // Get trailer from Keith
        const trailerResponse = await movieApis.keith.getTrailer(movie.url);
        if (trailerResponse?.status && trailerResponse.result?.trailerUrl) {
          trailerUrl = trailerResponse.result.trailerUrl;
          trailerInfo = trailerResponse.result;
          console.log(`✅ Got trailer from Keith API`);
        }
      }
      
      // If Keith API failed, try YouTube search
      if (!trailerUrl) {
        console.log("⚠️ Keith trailer not found, trying YouTube...");
        
        // Prepare YouTube search query
        let youtubeQuery = searchQuery + " official trailer";
        if (movieData?.title) {
          youtubeQuery = `${movieData.title} ${movieData.year || ''} official trailer`;
        }
        
        const youtubeSearch = await movieApis.youtube.searchTrailer(youtubeQuery);
        if (youtubeSearch?.items?.length > 0) {
          const videoId = youtubeSearch.items[0].id.videoId;
          trailerUrl = `https://www.youtube.com/watch?v=${videoId}`;
          apiUsed = "YouTube API";
          console.log(`✅ Got trailer from YouTube`);
          
          // Get video details
          try {
            const videoResponse = await axios.get(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${process.env.YOUTUBE_API || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'}`,
              { timeout: 10000 }
            );
            if (videoResponse.data?.items?.length > 0) {
              trailerInfo = {
                title: videoResponse.data.items[0].snippet.title,
                description: videoResponse.data.items[0].snippet.description.substring(0, 200) + "...",
                duration: videoResponse.data.items[0].contentDetails.duration
              };
            }
          } catch (e) {
            console.log("⚠️ Couldn't fetch YouTube video details");
          }
        }
      }
      
      // If still no trailer, try OMDB for movie info
      if (!movieData) {
        const omdbSearch = await movieApis.omdb.search(searchQuery);
        if (omdbSearch?.Search?.length > 0) {
          const movie = omdbSearch.Search[0];
          movieData = {
            title: movie.Title,
            year: movie.Year,
            type: movie.Type,
            poster: movie.Poster
          };
          console.log(`🎬 Found movie via OMDB: ${movie.Title}`);
        }
      }
      
      // If no trailer found at all
      if (!trailerUrl) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, { 
          text: `❌ No trailer found for "${searchQuery}"\n\nTry:\n• A different movie title\n• Include year (e.g., "Inception 2010")\n• Search on YouTube manually`
        }, { quoted: m });
        return;
      }
      
      const movieTitle = movieData?.title || searchQuery;
      const movieYear = movieData?.year || '';
      
      // Download trailer
      console.log(`⬇️ Downloading trailer from: ${trailerUrl}`);
      
      const tempFile = `/tmp/wolfbot_trailer_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
      
      try {
        // Download video using yt-dlp or similar API
        let downloadUrl = trailerUrl;
        
        // If it's a YouTube URL, use a download API
        if (trailerUrl.includes('youtube.com') || trailerUrl.includes('youtu.be')) {
          try {
            // Try Keith download API for YouTube
            const keithDownload = await axios.get(
              `https://apiskeith.vercel.app/download/video?url=${encodeURIComponent(trailerUrl)}`,
              { timeout: 15000 }
            );
            if (keithDownload.data?.status && keithDownload.data.result) {
              downloadUrl = keithDownload.data.result;
              console.log("✅ Using Keith download API");
            } else {
              // Try alternative download API
              const altDownload = await axios.get(
                `https://api.beautyofweb.com/y2mate?url=${encodeURIComponent(trailerUrl)}&type=mp4`,
                { timeout: 15000 }
              );
              if (altDownload.data?.result?.video?.url) {
                downloadUrl = altDownload.data.result.video.url;
                console.log("✅ Using Y2Mate API");
              }
            }
          } catch (downloadError) {
            console.error("Download API error:", downloadError.message);
          }
        }
        
        // Download the video
        const response = await axios({
          url: downloadUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 120000, // 2 minutes for trailer
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
          }
        });
        
        if (response.status !== 200) {
          throw new Error(`Download failed with status ${response.status}`);
        }
        
        const writer = fs.createWriteStream(tempFile);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        // Check file
        const stats = fs.statSync(tempFile);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        if (stats.size === 0) {
          throw new Error("Downloaded file is empty");
        }
        
        if (fileSizeMB > 100) {
          console.log(`⚠️ File too large: ${fileSizeMB}MB`);
          await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
          await sock.sendMessage(jid, { 
            text: `❌ Trailer too large (${fileSizeMB}MB). Maximum size is 100MB.\n\nTry searching for a shorter teaser trailer.`
          }, { quoted: m });
          fs.unlinkSync(tempFile);
          return;
        }
        
        const fileBuffer = fs.readFileSync(tempFile);
        
        // Get thumbnail
        let thumbnailBuffer = null;
        if (movieData?.poster && movieData.poster !== 'N/A') {
          try {
            const thumbResponse = await axios.get(movieData.poster, {
              responseType: 'arraybuffer',
              timeout: 10000
            });
            thumbnailBuffer = Buffer.from(thumbResponse.data);
          } catch (thumbError) {
            console.log("⚠️ Could not fetch movie poster");
          }
        }
        
        // Prepare caption
        let caption = `🎬 *${movieTitle}*`;
        
        if (movieData?.year) {
          caption += ` (${movieData.year})`;
        }
        
        if (movieData?.rating) {
          caption += `\n⭐ *Rating:* ${movieData.rating}`;
        }
        
        if (movieData?.type) {
          caption += `\n🎞️ *Type:* ${movieData.type}`;
        }
        
        if (trailerInfo?.description) {
          caption += `\n\n📝 *Description:* ${trailerInfo.description}`;
        }
        
        caption += `\n\n📦 *Size:* ${fileSizeMB}MB`;
        caption += `\n🔧 *Source:* ${apiUsed}`;
        
        // Send trailer video
        await sock.sendMessage(jid, {
          video: fileBuffer,
          caption: caption,
          mimetype: 'video/mp4',
          thumbnail: thumbnailBuffer,
          gifPlayback: false
        }, { quoted: m });
        
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
          console.log(`🧹 Cleaned temp file: ${tempFile}`);
        }
        
        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        
        console.log(`✅ [TRAILER] Success: "${movieTitle}" (${fileSizeMB}MB) via ${apiUsed}`);
        
      } catch (downloadError) {
        console.error("❌ [TRAILER] Download error:", downloadError.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        // Send trailer as URL if download fails
        await sock.sendMessage(jid, { 
          text: `❌ Couldn't download trailer. Here's the direct link:\n\n🔗 ${trailerUrl}\n\n*Movie:* ${movieTitle}\n*Source:* ${apiUsed}`
        }, { quoted: m });
        
        if (fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch {}
        }
      }
      
    } catch (error) {
      console.error("❌ [TRAILER] ERROR:", error);
      await sock.sendMessage(jid, { 
        text: `❌ Error: ${error.message}` 
      }, { quoted: m });
    }
  }
};