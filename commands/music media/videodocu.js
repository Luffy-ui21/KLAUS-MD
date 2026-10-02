// import axios from "axios";
// import yts from "yt-search";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Video download APIs
// const videoAPIs = {
//   izumi: {
//     baseURL: "https://api.izumi-slow.xyz",
//     getVideo: async (youtubeUrl, quality = "720") => {
//       try {
//         const apiUrl = `${videoAPIs.izumi.baseURL}/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&format=${quality}`;
//         const res = await axios.get(apiUrl, {
//           timeout: 30000,
//           headers: {
//             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//             'Accept': 'application/json'
//           }
//         });
        
//         if (res?.data?.result?.download) {
//           return {
//             success: true,
//             download: res.data.result.download,
//             title: res.data.result.title || "YouTube Video",
//             quality: quality,
//             source: "izumi"
//           };
//         }
//         throw new Error('Izumi API: No download link');
//       } catch (error) {
//         return { success: false, error: error.message };
//       }
//     }
//   },
  
//   okatsu: {
//     getVideo: async (youtubeUrl) => {
//       try {
//         const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
//         const res = await axios.get(apiUrl, {
//           timeout: 30000,
//           headers: {
//             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//             'Accept': 'application/json'
//           }
//         });
        
//         if (res?.data?.result?.mp4) {
//           return {
//             success: true,
//             download: res.data.result.mp4,
//             title: res.data.result.title || "YouTube Video",
//             quality: "720p",
//             source: "okatsu"
//           };
//         }
//         throw new Error('Okatsu API: No mp4 link');
//       } catch (error) {
//         return { success: false, error: error.message };
//       }
//     }
//   }
// };

// // Helper to extract YouTube ID
// const extractYouTubeId = (url) => {
//   const patterns = [
//     /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
//     /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
//     /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
//     /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
//     /youtu\.be\/([a-zA-Z0-9_-]{11})/
//   ];
  
//   for (const pattern of patterns) {
//     if (pattern.test(url)) {
//       return url.match(pattern)[1];
//     }
//   }
//   return null;
// };

// // Main command
// export default {
//   name: "video",
//   aliases: ["vid", "ytv", "ytvideo", "ytmp4"],
//   description: "Download YouTube videos with quality options",
//   async execute(sock, m, args) {
//     const jid = m.key.remoteJid;
//     const qualityOptions = ["144", "240", "360", "480", "720", "1080"];
    
//     try {
//       if (args.length === 0) {
//         await sock.sendMessage(jid, { 
//           text: `🎬 *YouTube Video Downloader*\n\nUsage:\n• \`video [quality] song name\`\n• \`video [quality] https://youtube.com/...\`\n.`
//         }, { quoted: m });
//         return;
//       }

//       // Parse quality and search query
//       let quality = "720"; // Default
//       let searchQuery = args.join(" ");
      
//       // Check if first arg is a quality option
//       if (qualityOptions.includes(args[0].toLowerCase())) {
//         quality = args[0].toLowerCase();
//         searchQuery = args.slice(1).join(" ");
//       } else if (args[0].startsWith("--quality=") || args[0].startsWith("-q=")) {
//         // Alternative format: --quality=720
//         const match = args[0].match(/[=](.+)/);
//         if (match && qualityOptions.includes(match[1])) {
//           quality = match[1];
//           searchQuery = args.slice(1).join(" ");
//         }
//       }

//       console.log(`🎬 [VIDEO] Request: "${searchQuery}" Quality: ${quality}p`);

//       // Send initial status
//       const statusMsg = await sock.sendMessage(jid, { 
//         text: `🔍 *Searching*: "${searchQuery}"\n📹 *Quality:* ${quality}p`
//       }, { quoted: m });

//       // Determine if input is YouTube link or search query
//       let videoUrl = '';
//       let videoTitle = '';
//       let videoThumbnail = '';
      
//       // Check if it's a URL
//       const isUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');
      
//       if (isUrl) {
//         videoUrl = searchQuery;
//         const videoId = extractYouTubeId(videoUrl);
        
//         if (!videoId) {
//           await sock.sendMessage(jid, { 
//             text: `❌ Invalid YouTube URL\nPlease provide a valid YouTube link.`,
//             edit: statusMsg.key 
//           });
//           return;
//         }
        
//         // Fetch video info
//         try {
//           await sock.sendMessage(jid, { 
//             text: `🔍 *Searching*: "${searchQuery}"\n📹 *Quality:* ${quality}p\n📡 Fetching video info...`,
//             edit: statusMsg.key 
//           });
          
//           const { videos } = await yts({ videoId });
//           if (videos && videos.length > 0) {
//             videoTitle = videos[0].title;
//             videoThumbnail = videos[0].thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
//           } else {
//             videoTitle = "YouTube Video";
//             videoThumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
//           }
//         } catch (infoError) {
//           videoTitle = "YouTube Video";
//           videoThumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
//         }
//       } else {
//         // Search YouTube
//         try {
//           await sock.sendMessage(jid, { 
//             text: `🔍 *Searching*: "${searchQuery}"\n📹 *Quality:* ${quality}p\n📡 Looking for best match...`,
//             edit: statusMsg.key 
//           });
          
//           const { videos } = await yts(searchQuery);
//           if (!videos || videos.length === 0) {
//             await sock.sendMessage(jid, { 
//               text: `❌ No videos found for "${searchQuery}"\nTry different keywords or use direct YouTube link.`,
//               edit: statusMsg.key 
//             });
//             return;
//           }
          
//           videoUrl = videos[0].url;
//           videoTitle = videos[0].title;
//           videoThumbnail = videos[0].thumbnail;
          
//           console.log(`🎬 [VIDEO] Found: ${videoTitle} - ${videoUrl}`);
          
//           await sock.sendMessage(jid, { 
//             text: `🔍 *Searching*: "${searchQuery}" ✅\n🎬 *Found:* ${videoTitle}\n📹 *Quality:* ${quality}p\n⬇️ *Getting download link...*`,
//             edit: statusMsg.key 
//           });
          
//         } catch (searchError) {
//           console.error("❌ [VIDEO] Search error:", searchError);
//           await sock.sendMessage(jid, { 
//             text: `❌ Search failed. Please use direct YouTube link.\nExample: video 720 https://youtube.com/watch?v=...`,
//             edit: statusMsg.key 
//           });
//           return;
//         }
//       }

//       // Try multiple APIs sequentially
//       let videoResult = null;
//       const apisToTry = [
//         () => videoAPIs.izumi.getVideo(videoUrl, quality),
//         () => videoAPIs.okatsu.getVideo(videoUrl)
//       ];
      
//       for (const apiCall of apisToTry) {
//         try {
//           console.log(`🎬 [VIDEO] Trying ${apiCall.name || 'API'}...`);
//           const result = await apiCall();
          
//           if (result.success) {
//             videoResult = result;
//             console.log(`✅ [VIDEO] Got link from ${result.source}: ${result.download.substring(0, 50)}...`);
//             break;
//           }
//         } catch (apiError) {
//           console.log(`⚠️ [VIDEO] API failed:`, apiError.message);
//           continue;
//         }
//       }

//       if (!videoResult) {
//         await sock.sendMessage(jid, { 
//           text: `❌ All download services failed\nPlease try again later or try different quality.`,
//           edit: statusMsg.key 
//         });
//         return;
//       }

//       // Update status
//       await sock.sendMessage(jid, { 
//         text: `🔍 *Searching*: "${searchQuery}" ✅\n⬇️ *Getting download link...* ✅\n📥 *Downloading video (${quality}p)...*`,
//         edit: statusMsg.key 
//       });

//       // Download the video file
//       const tempDir = path.join(__dirname, "../temp");
//       if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      
//       const fileName = `${Date.now()}_${videoTitle.substring(0, 30).replace(/[^\w\s.-]/gi, '')}.mp4`;
//       const tempFile = path.join(tempDir, fileName);
      
//       try {
//         // Download video with progress tracking
//         const response = await axios({
//           url: videoResult.download,
//           method: 'GET',
//           responseType: 'stream',
//           timeout: 120000, // 2 minute timeout for videos
//           headers: {
//             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//             'Referer': 'https://www.youtube.com/'
//           }
//         });

//         if (response.status !== 200) {
//           throw new Error(`Download failed with status: ${response.status}`);
//         }

//         // Stream to file
//         const writer = fs.createWriteStream(tempFile);
//         let downloadedBytes = 0;
//         const totalBytes = parseInt(response.headers['content-length']) || 0;
        
//         response.data.on('data', (chunk) => {
//           downloadedBytes += chunk.length;
//           // Log progress every 5MB
//           if (totalBytes && downloadedBytes % (5 * 1024 * 1024) < chunk.length) {
//             const percent = Math.round((downloadedBytes / totalBytes) * 100);
//             console.log(`📥 [VIDEO] Download: ${percent}% (${Math.round(downloadedBytes/1024/1024)}MB)`);
//           }
//         });
        
//         response.data.pipe(writer);
        
//         await new Promise((resolve, reject) => {
//           writer.on('finish', resolve);
//           writer.on('error', reject);
//         });

//         // Check file
//         const stats = fs.statSync(tempFile);
//         const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        
//         if (stats.size === 0) {
//           throw new Error("Downloaded file is empty");
//         }

//         // WhatsApp video limit is ~16MB
//         if (parseFloat(fileSizeMB) > 16) {
//           await sock.sendMessage(jid, { 
//             text: `❌ Video too large: ${fileSizeMB}MB\nMax size: 16MB\nTry lower quality (144-480) or shorter video.`,
//             edit: statusMsg.key 
//           });
          
//           if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
//           return;
//         }

//         // Get thumbnail if not already available
//         if (!videoThumbnail) {
//           const videoId = extractYouTubeId(videoUrl);
//           videoThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
//         }

//         // Send video
//         await sock.sendMessage(jid, {
//           video: fs.readFileSync(tempFile),
//           caption: `🎬 *${videoTitle}*\n📹 ${quality}p • ${fileSizeMB}MB\n > WolfBot`,
//           fileName: `${videoTitle.substring(0, 50)}.mp4`.replace(/[^\w\s.-]/gi, ''),
//           mimetype: 'video/mp4',
//           contextInfo: {
//             externalAdReply: {
//               title: videoTitle.substring(0, 70),
//               body: `YouTube Video • ${quality}p`,
//               mediaType: 2,
//               thumbnailUrl: videoThumbnail,
//               mediaUrl: videoUrl,
//               sourceUrl: videoUrl,
//               showAdAttribution: false
//             }
//           }
//         }, { quoted: m });

//         // Clean up
//         if (fs.existsSync(tempFile)) {
//           fs.unlinkSync(tempFile);
//           console.log(`✅ [VIDEO] Cleaned up: ${tempFile}`);
//         }

//         // Success message
//         await sock.sendMessage(jid, { 
//           text: `✅ *Video Sent!*\n\n🎬 ${videoTitle}\n📹 ${quality}p • ${fileSizeMB}MB\n⚡ Source: ${videoResult.source}`,
//           edit: statusMsg.key 
//         });

//         console.log(`✅ [VIDEO] Success: ${videoTitle} (${quality}p, ${fileSizeMB}MB)`);

//       } catch (downloadError) {
//         console.error("❌ [VIDEO] Download error:", downloadError);
        
//         let errorMsg = `❌ Failed to download video (${quality}p)`;
        
//         if (downloadError.message.includes('timeout')) {
//           errorMsg += '\n⏱ Download timed out. Try lower quality.';
//         } else if (downloadError.message.includes('ENOTFOUND') || downloadError.message.includes('ECONNREFUSED')) {
//           errorMsg += '\n🌐 Network error. Check your connection.';
//         } else if (downloadError.response?.status === 403) {
//           errorMsg += '\n🔒 Access denied. Video might be restricted.';
//         } else if (downloadError.message.includes('file is empty')) {
//           errorMsg += '\n📦 Downloaded file is empty. Try different quality.';
//         }
        
//         errorMsg += `\n\n*Tip:* Try lower quality (144, 240, 360) for faster download.`;
        
//         await sock.sendMessage(jid, { 
//           text: errorMsg,
//           edit: statusMsg.key 
//         });
        
//         // Clean up on error
//         if (fs.existsSync(tempFile)) {
//           fs.unlinkSync(tempFile);
//           console.log(`🧹 [VIDEO] Cleaned up failed: ${tempFile}`);
//         }
//       }

//     } catch (error) {
//       console.error("❌ [VIDEO] Fatal error:", error);
      
//       await sock.sendMessage(jid, { 
//         text: `❌ An error occurred\n💡 Try:\n1. Lower quality (144-480)\n2. Shorter video\n3. Direct YouTube link\n4. Try again later\n\nError: ${error.message.substring(0, 100)}`
//       }, { quoted: m });
//     }
//   },
// };





















import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBotName } from '../../lib/botname.js';
import { queryXWolfVideo } from '../../lib/xwolfApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Updated Video download APIs from the second example
const videoAPIs = {
  xwolf: {
    getVideo: async (youtubeUrl) => {
      try {
        const r = await queryXWolfVideo(youtubeUrl);
        if (r?.success && r?.data?.download_url) {
          return {
            success: true,
            download: r.data.download_url,
            title:    r.data.title    || "YouTube Video",
            quality:  r.data.quality  || "720p",
            source:   r.endpoint || "xwolf"
          };
        }
        throw new Error('xwolf: no download_url');
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  yupra: {
    getVideo: async (youtubeUrl) => {
      try {
        const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await axios.get(apiUrl, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (res?.data?.success && res?.data?.data?.download_url) {
          return {
            success: true,
            download: res.data.data.download_url,
            title: res.data.data.title || "YouTube Video",
            quality: res.data.data.quality || "720p",
            source: "yupra"
          };
        }
        throw new Error('Yupra API: No download link');
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  
  okatsu: {
    getVideo: async (youtubeUrl) => {
      try {
        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await axios.get(apiUrl, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (res?.data?.result?.mp4) {
          return {
            success: true,
            download: res.data.result.mp4,
            title: res.data.result.title || "YouTube Video",
            quality: res.data.result.quality || "720p",
            source: "okatsu"
          };
        }
        throw new Error('Okatsu API: No mp4 link');
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
};

// Helper to extract YouTube ID
const extractYouTubeId = (url) => {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(url)) {
      return url.match(pattern)[1];
    }
  }
  return null;
};

// Main command
export default {
  name: "videodoc",
  //aliases: ["vid", "ytvdoc", "ytvideo", "ytmp4"],
  description: "Download YouTube videos with multiple API sources",
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    
    try {
      if (args.length === 0) {
        await sock.sendMessage(jid, { 
          text: `🎬 *YouTube Video Downloader*\n\nUsage:\n• \`video song name\`\n• \`video https://youtube.com/watch?v=...\`\n\nExample: video Not Like Us`
        }, { quoted: m });
        return;
      }

      const searchQuery = args.join(" ");
      console.log(`🎬 [VIDEO] Request: "${searchQuery}"`);

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Determine if input is YouTube link or search query
      let videoUrl = '';
      let videoTitle = '';
      let videoThumbnail = '';
      
      // Check if it's a URL
      const isUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');
      
      if (isUrl) {
        videoUrl = searchQuery;
        const videoId = extractYouTubeId(videoUrl);
        
        if (!videoId) {
          await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
          await sock.sendMessage(jid, { 
            text: `❌ Invalid YouTube URL\nPlease provide a valid YouTube link.`
          }, { quoted: m });
          return;
        }
        
        // Fetch video info
        try {
          const { videos } = await yts({ videoId });
          if (videos && videos.length > 0) {
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
          } else {
            videoTitle = "YouTube Video";
            videoThumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
          }
        } catch (infoError) {
          videoTitle = "YouTube Video";
          videoThumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        }
      } else {
        // Search YouTube
        try {
          const { videos } = await yts(searchQuery);
          if (!videos || videos.length === 0) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, { 
              text: `❌ No videos found for "${searchQuery}"\nTry different keywords or use direct YouTube link.`
            }, { quoted: m });
            return;
          }
          
          videoUrl = videos[0].url;
          videoTitle = videos[0].title;
          videoThumbnail = videos[0].thumbnail;
          
          console.log(`🎬 [VIDEO] Found: ${videoTitle} - ${videoUrl}`);
          
        } catch (searchError) {
          console.error("❌ [VIDEO] Search error:", searchError);
          await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
          await sock.sendMessage(jid, { 
            text: `❌ Search failed. Please use direct YouTube link.\nExample: video https://youtube.com/watch?v=...`
          }, { quoted: m });
          return;
        }
      }

      let videoResult = null;
      let tempFile    = null;
      let stats       = null;
      let fileSizeMB  = null;
      const apisToTry = [
        () => videoAPIs.xwolf.getVideo(videoUrl),
        () => videoAPIs.yupra.getVideo(videoUrl),
        () => videoAPIs.okatsu.getVideo(videoUrl)
      ];

      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      // Try resolve+download per API; on either failure, try the next API
      for (let i = 0; i < apisToTry.length; i++) {
        const apiCall = apisToTry[i];
        const apiName = Object.keys(videoAPIs)[i];

        try {
          console.log(`🎬 [VIDEO] Trying ${apiName} API...`);
          await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

          const result = await apiCall();
          if (!result?.success || !result?.download) {
            console.log(`⚠️ [VIDEO] ${apiName}: resolve failed (${result?.error || 'no download URL'})`);
            continue;
          }
          console.log(`🔗 [VIDEO] ${apiName}: ${result.download.substring(0, 60)}...`);

          const fileName = `${Date.now()}_${videoTitle.substring(0, 30).replace(/[^\w\s.-]/gi, '')}.mp4`;
          const candidateFile = path.join(tempDir, fileName);

          const response = await axios({
            url: result.download,
            method: 'GET',
            responseType: 'stream',
            timeout: 120000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.youtube.com/'
            }
          });
          if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

          const writer = fs.createWriteStream(candidateFile);
          let downloadedBytes = 0;
          const totalBytes = parseInt(response.headers['content-length']) || 0;
          response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes && downloadedBytes % (5 * 1024 * 1024) < chunk.length) {
              const percent = Math.round((downloadedBytes / totalBytes) * 100);
              console.log(`📥 [VIDEO] Download: ${percent}% (${Math.round(downloadedBytes/1024/1024)}MB)`);
            }
          });
          response.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          const candidateStats = fs.statSync(candidateFile);
          if (candidateStats.size < 10000) {
            try { fs.unlinkSync(candidateFile); } catch {}
            throw new Error(`file too small (${candidateStats.size} bytes)`);
          }

          videoResult = result;
          tempFile    = candidateFile;
          stats       = candidateStats;
          fileSizeMB  = (stats.size / (1024 * 1024)).toFixed(1);
          console.log(`✅ [VIDEO] ${apiName}: downloaded ${fileSizeMB}MB`);
          break;
        } catch (apiError) {
          console.log(`⚠️ [VIDEO] ${apiName} failed: ${apiError.message}`);
        }
      }

      if (!videoResult || !tempFile) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, {
          text: `❌ All download services failed\nPlease try again later.`
        }, { quoted: m });
        return;
      }

      try {

        // WhatsApp video limit is ~16MB
        if (parseFloat(fileSizeMB) > 16) {
          await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
          await sock.sendMessage(jid, { 
            text: `❌ Video too large: ${fileSizeMB}MB\nMax size: 16MB\nTry shorter video or use .audio command for music only.`
          }, { quoted: m });
          
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          return;
        }

        // Send video as document (following second example pattern)
        await sock.sendMessage(jid, {
          document: fs.readFileSync(tempFile),
          mimetype: "video/mp4",
          fileName: `${videoTitle.substring(0, 100)}.mp4`.replace(/[^\w\s.-]/gi, ''),
          caption: `🎬 *${videoTitle}*\n📹 ${videoResult.quality} • ${fileSizeMB}MB\n⚡ Source: ${videoResult.source}`,
          contextInfo: {
            externalAdReply: {
              title: videoTitle.substring(0, 70),
              body: `YouTube Video • ${getBotName()}`,
              mediaType: 2,
              thumbnailUrl: videoThumbnail,
              mediaUrl: videoUrl,
              sourceUrl: videoUrl,
              showAdAttribution: false,
              renderLargerThumbnail: false
            }
          }
        }, { quoted: m });

        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
          console.log(`✅ [VIDEO] Cleaned up: ${tempFile}`);
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

        console.log(`✅ [VIDEO] Success: ${videoTitle} (${fileSizeMB}MB)`);

      } catch (downloadError) {
        console.error("❌ [VIDEO] Download error:", downloadError);
        
        let errorMsg = `❌ Failed to download video`;
        
        if (downloadError.message.includes('timeout')) {
          errorMsg += '\n⏱ Download timed out. Video might be too long.';
        } else if (downloadError.message.includes('ENOTFOUND') || downloadError.message.includes('ECONNREFUSED')) {
          errorMsg += '\n🌐 Network error. Check your connection.';
        } else if (downloadError.response?.status === 403) {
          errorMsg += '\n🔒 Access denied. Video might be restricted.';
        } else if (downloadError.message.includes('file is empty')) {
          errorMsg += '\n📦 Downloaded file is empty. Try again.';
        }
        
        errorMsg += `\n\n*Tip:* Try shorter videos for better success rate.`;
        
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, { 
          text: errorMsg
        }, { quoted: m });
        
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
          console.log(`🧹 [VIDEO] Cleaned up failed: ${tempFile}`);
        }
      }

    } catch (error) {
      console.error("❌ [VIDEO] Fatal error:", error);
      
      await sock.sendMessage(jid, { 
        text: `❌ An error occurred\n💡 Try:\n1. Direct YouTube link\n2. Shorter video\n3. Try again later\n\nError: ${error.message.substring(0, 100)}`
      }, { quoted: m });
    }
  }
};