import axios from 'axios';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';
import fs from 'fs';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

// Import caption system
let getUserCaption;

async function initializeCaptionSystem() {
  try {
    const captions = await import('../../lib/captionStore.js');
    getUserCaption = captions.getUserCaption;
  } catch (error) {
    getUserCaption = (userId) => `${getBotName()} is the Alpha`;
  }
}

initializeCaptionSystem();

function getCaption(userId) {
  if (typeof getUserCaption === 'function') {
    return getUserCaption(userId);
  }
  return `${getBotName()} is the Alpha`;
}

export default {
  name: "snapchat",
  aliases: ["snap", "sc"],
  description: "Download Snapchat spotlight videos and public content",
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const userId = m.key.participant || m.key.remoteJid;
    try {
      if (!args[0]) {
        await sock.sendMessage(jid, { 
          text: `╭─⌈ 👻 *SNAPCHAT DOWNLOADER* ⌋\n│\n├─⊷ *snapchat <url>*\n│  └⊷ Download Spotlight videos\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}` 
        }, { quoted: m });
        return;
      }

      const url = args[0];
      
      // Validate URL
      if (!isValidSnapchatUrl(url)) {
        await sock.sendMessage(jid, { 
          text: `╭─⌈ ❌ *INVALID URL* ⌋\n│\n├─⊷ *snapchat <url>*\n│  └⊷ Provide a valid Spotlight URL\n╰───` 
        }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Extract video ID
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, { 
          text: `❌ Could not extract video ID from URL`
        }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // Try multiple download methods
      const result = await downloadSpotlightVideo(videoId);
      
      if (!result.success) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, { 
          text: `❌ ${result.error || 'Failed to download video'}`
        }, { quoted: m });
        return;
      }

      // Send the video
      const userCaption = getCaption(userId);
      const maxSize = 48 * 1024 * 1024; // 48MB WhatsApp limit
      
      if (result.fileSize > maxSize) {
        // Compress or send as document
        const compressed = await compressVideo(result.filePath, maxSize);
        
        if (compressed) {
          await sock.sendMessage(jid, {
            video: readFileSync(compressed),
            caption: `👻 *Snapchat Spotlight*\n\n${userCaption}`
          });
          cleanupFile(compressed);
        } else {
          await sock.sendMessage(jid, {
            document: readFileSync(result.filePath),
            fileName: `snapchat_spotlight_${Date.now()}.mp4`,
            mimetype: 'video/mp4',
            caption: `📁 *Snapchat Spotlight*\n\n${userCaption}`
          });
        }
      } else {
        await sock.sendMessage(jid, {
          video: readFileSync(result.filePath),
          caption: `👻 *Snapchat Spotlight*\n\n${userCaption}`
        });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

      // Cleanup
      cleanupFile(result.filePath);

    } catch (error) {
      console.error('Snapchat command error:', error);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { 
        text: `❌ Error: ${error.message.substring(0, 100)}`
      }, { quoted: m });
    }
  },
};

// ==================== URL VALIDATION ====================
function isValidSnapchatUrl(url) {
  const patterns = [
    /https?:\/\/(www\.)?snapchat\.com\/spotlight\/[a-zA-Z0-9_-]+/i,
    /https?:\/\/snapchat\.com\/spotlight\/[a-zA-Z0-9_-]+/i,
    /snapchat\.com\/spotlight\/[a-zA-Z0-9_-]+/i
  ];
  return patterns.some(pattern => pattern.test(url));
}

function extractVideoId(url) {
  // Extract from various URL formats
  const matches = url.match(/\/spotlight\/([a-zA-Z0-9_-]+)/);
  return matches ? matches[1] : url.split('/').pop().split('?')[0];
}

// ==================== DOWNLOAD FUNCTIONS ====================
async function downloadSpotlightVideo(videoId) {
  const tempDir = './temp/snapchat';
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

  const filePath = `${tempDir}/spotlight_${Date.now()}.mp4`;

  try {
    // Try multiple working APIs
    const downloadUrl = await getWorkingDownloadUrl(videoId);
    
    if (!downloadUrl) {
      return { success: false, error: 'No working download service available' };
    }

    // Download the video
    console.log(`Downloading from: ${downloadUrl}`);
    await downloadFile(downloadUrl, filePath);
    
    const stats = fs.statSync(filePath);
    
    if (stats.size === 0) {
      cleanupFile(filePath);
      return { success: false, error: 'Empty file downloaded' };
    }

    return {
      success: true,
      filePath,
      fileSize: stats.size
    };

  } catch (error) {
    console.error('Download error:', error);
    cleanupFile(filePath);
    return { success: false, error: error.message };
  }
}

async function getWorkingDownloadUrl(videoId) {
  // Try these currently working services
  const services = [
    // Service 1: SnapTik alternative
    async () => {
      try {
        const response = await axios.get(`https://api.tiklydown.eu.org/api/download`, {
          params: {
            url: `https://www.snapchat.com/spotlight/${videoId}`
          },
          timeout: 15000
        });
        if (response.data && response.data.videoUrl) {
          return response.data.videoUrl;
        }
      } catch (e) {
        console.log('Tiklydown failed:', e.message);
      }
      return null;
    },

    // Service 2: SSSTik alternative
    async () => {
      try {
        const response = await axios.post('https://ssstik.io/api', {
          url: `https://www.snapchat.com/spotlight/${videoId}`
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });
        if (response.data && response.data.downloadUrl) {
          return response.data.downloadUrl;
        }
      } catch (e) {
        console.log('SSSTik API failed:', e.message);
      }
      return null;
    },

    // Service 3: Savetik
    async () => {
      try {
        const response = await axios.get(`https://savetik.co/api/ajaxSearch`, {
          params: {
            text: `https://www.snapchat.com/spotlight/${videoId}`,
            lang: 'en'
          },
          timeout: 15000
        });
        if (response.data && response.data.links && response.data.links[0]) {
          return response.data.links[0].a;
        }
      } catch (e) {
        console.log('Savetik failed:', e.message);
      }
      return null;
    },

    // Service 4: MusicallyDown
    async () => {
      try {
        const response = await axios.post('https://musicallydown.com/download', 
          `video_url=https://www.snapchat.com/spotlight/${videoId}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
          }
        );
        
        // Parse HTML response
        const html = response.data;
        const match = html.match(/href="([^"]+\.mp4[^"]*)"/);
        if (match && match[1]) {
          return `https://musicallydown.com${match[1]}`;
        }
      } catch (e) {
        console.log('MusicallyDown failed:', e.message);
      }
      return null;
    }
  ];

  // Try each service until one works
  for (const service of services) {
    try {
      const url = await service();
      if (url) {
        console.log(`Found working service with URL: ${url.substring(0, 100)}...`);
        return url;
      }
    } catch (error) {
      console.log('Service attempt failed:', error.message);
      continue;
    }
  }

  return null;
}

// ==================== VIDEO COMPRESSION ====================
async function compressVideo(inputPath, maxSizeBytes) {
  const tempDir = './temp/compressed';
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  
  const outputPath = `${tempDir}/compressed_${Date.now()}.mp4`;
  
  try {
    // Check if ffmpeg is available
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('ffmpeg -version');
    } catch {
      console.log('ffmpeg not available, skipping compression');
      return null;
    }

    // Get video duration
    const ffprobeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    const { stdout: durationStr } = await execAsync(ffprobeCmd);
    const duration = parseFloat(durationStr);
    
    if (!duration || duration <= 0) {
      return null;
    }
    
    // Calculate target bitrate
    const targetBitrate = Math.floor((maxSizeBytes * 8) / duration / 1000) - 128;
    const bitrate = Math.max(500, Math.min(1500, targetBitrate));
    
    // Compress video
    const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "scale='min(720,iw)':-2" -c:v libx264 -preset fast -crf 28 -b:v ${bitrate}k -c:a aac -b:a 64k -y "${outputPath}"`;
    
    await execAsync(ffmpegCmd, { timeout: 30000 });
    
    const stats = fs.statSync(outputPath);
    if (stats.size > 0 && stats.size < maxSizeBytes) {
      return outputPath;
    }
    
    return null;
    
  } catch (error) {
    console.error('Compression error:', error);
    return null;
  }
}

// ==================== UTILITY FUNCTIONS ====================
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const writer = createWriteStream(filePath);
    
    axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.snapchat.com/'
      }
    })
    .then(response => {
      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('video') && !contentType.includes('octet-stream')) {
        reject(new Error('Invalid content type: ' + contentType));
        return;
      }
      
      response.data.pipe(writer);
      
      let downloaded = 0;
      response.data.on('data', (chunk) => {
        downloaded += chunk.length;
        // Optional: Add progress tracking here
      });
      
      writer.on('finish', () => {
        console.log(`Download completed: ${downloaded} bytes`);
        resolve();
      });
      
      writer.on('error', reject);
    })
    .catch(error => {
      // Handle specific error cases
      if (error.code === 'ECONNABORTED') {
        reject(new Error('Download timeout'));
      } else if (error.response) {
        reject(new Error(`Server responded with ${error.response.status}`));
      } else {
        reject(error);
      }
    });
  });
}

function cleanupFile(filePath) {
  setTimeout(() => {
    try {
      if (existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Cleaned up: ${filePath}`);
      }
    } catch (e) {
      console.log('Cleanup error:', e.message);
    }
  }, 5000);
}
