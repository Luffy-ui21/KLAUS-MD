import axios from "axios";
import { getBotName } from '../../lib/botname.js';
import { downloadMediaMessage } from "wolfsocket";
import crypto from "crypto";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: "imgbb",
  description: "Convert replied image to ImgBB URL directly",
  category: "utility",
  usage: "Reply to an image with .imgbb",

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    try {
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted?.imageMessage) {
        return sock.sendMessage(
          jid,
          {
            text: `╭─⌈ 📸 *IMGBB* ⌋\n│\n├─⊷ *.imgbb* (reply to image)\n│  └⊷ Upload to ImgBB\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
          },
          { quoted: m }
        );
      }

      const apiKey = getImgBBKey();
      
      if (!apiKey || apiKey.length !== 32) {
        return sock.sendMessage(
          jid,
          {
            text: `❌ *API Key Issue*\n` +
                  `The ImgBB API key is not properly configured.\n\n` +
                  `🔧 *Fix:*\n` +
                  `Contact bot developer for API key update.`
          },
          { quoted: m }
        );
      }

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      let imageBuffer;
      try {
        const messageObj = {
          key: m.key,
          message: { ...quoted }
        };
        
        imageBuffer = await downloadMediaMessage(
          messageObj,
          "buffer",
          {},
          { 
            reuploadRequest: sock.updateMediaMessage,
            logger: console
          }
        );

        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error("Received empty image buffer");
        }

      } catch (err) {
        console.error("❌ Download Error:", err.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: "❌ *Failed to download image*\n\nTry sending a fresh image." }, { quoted: m });
      }

      const fileSizeMB = imageBuffer.length / (1024 * 1024);
      if (fileSizeMB > 32) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ *File too large* (${fileSizeMB.toFixed(1)} MB)\nLimit: 32 MB` }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '📤', key: m.key } });

      const result = await uploadToImgBB(imageBuffer, apiKey);

      if (!result.success) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `❌ *Upload Failed:* ${result.error}` }, { quoted: m });
      }

      const successText = result.url;

      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const { sendInteractiveMessage } = require('wolfbtns');
        await sendInteractiveMessage(sock, jid, {
          image: { url: result.thumb || result.url },
          text: successText,
          footer: `${getBotName()}`,
          interactiveButtons: [
            {
              name: 'cta_copy',
              buttonParamsJson: JSON.stringify({
                display_text: '📋 Copy URL',
                copy_code: result.url
              })
            },
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: '🌐 Open in Browser',
                url: result.url
              })
            }
          ]
        });
      } catch (btnErr) {
        console.log("[IMGBB] Buttons failed:", btnErr.message);
        await sock.sendMessage(jid, { text: successText }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error("❌ [IMGBB COMMAND ERROR]:", err);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      return sock.sendMessage(jid, { text: `❌ *Error:* ${err.message || 'Unknown error'}` }, { quoted: m });
    }
  }
};

function getImgBBKey() {
  const keyCodes = [
    54, 48, 99, 51, 101, 53, 101, 51,
    51, 57, 98, 98, 101, 100, 49, 97,
    57, 48, 52, 55, 48, 98, 50, 57,
    51, 56, 102, 101, 97, 98, 54, 50
  ];
  
  const apiKey = keyCodes.map(c => String.fromCharCode(c)).join('');
  
  if (apiKey.length === 32 && apiKey.startsWith('60c3e5e3')) {
    return apiKey;
  }
  
  return [
    '60c3e5', 'e339bb', 'ed1a90', '470b29', 
    '38feab', '62'
  ].join('');
}

async function uploadToImgBB(buffer, apiKey) {
  try {
    const base64 = buffer.toString("base64");
    
    const formData = new URLSearchParams();
    formData.append("key", apiKey);
    formData.append("image", base64);
    formData.append("expiration", "0");
    
    const res = await axios.post(
      "https://api.imgbb.com/1/upload",
      formData.toString(),
      {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: 45000
      }
    );

    if (res.data.success && res.data.data) {
      const data = res.data.data;
      return {
        success: true,
        url: data.url,
        displayUrl: data.display_url,
        thumb: data.thumb?.url || data.url,
        deleteUrl: data.delete_url,
        id: data.id,
        format: data.image?.extension || data.format,
        width: data.width,
        height: data.height,
        size: data.size,
        time: data.time
      };
    }

    return {
      success: false,
      error: res.data.error?.message || "Unknown ImgBB error",
      code: res.data.error?.code
    };

  } catch (e) {
    console.error("❌ ImgBB Upload Error:", e.response?.data || e.message);
    
    let errorMsg = "Upload failed";
    
    if (e.response?.data?.error?.code) {
      const code = e.response.data.error.code;
      const messages = {
        100: "No image data received",
        105: "Invalid API key",
        110: "Invalid image format",
        120: "Image too large (max 32MB)",
        130: "Upload timeout",
        140: "Too many requests",
        310: "Invalid image source / corrupted data"
      };
      errorMsg = messages[code] || `Error code: ${code}`;
    } else if (e.code === 'ECONNABORTED') {
      errorMsg = "Upload timeout (45 seconds)";
    } else if (e.message?.includes('Network Error')) {
      errorMsg = "Network error - check internet connection";
    } else if (e.response?.status === 429) {
      errorMsg = "Too many requests - try again later";
    }
    
    return { 
      success: false, 
      error: errorMsg,
      details: e.message 
    };
  }
}

function isValidImage(buffer) {
  if (!buffer || buffer.length < 100) return false;
  
  const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
  
  if (hex.startsWith('FFD8FF')) return true;
  if (hex.startsWith('89504E470D0A1A0A')) return true;
  if (hex.startsWith('47494638')) return true;
  if (hex.startsWith('52494646') && buffer.includes('WEBP')) return true;
  
  return false;
}

export const imgbbUtils = {
  upload: async (buffer) => {
    const apiKey = getImgBBKey();
    return await uploadToImgBB(buffer, apiKey);
  },
  
  validate: (buffer) => isValidImage(buffer),
  
  getApiKeyStatus: () => {
    const key = getImgBBKey();
    return {
      configured: key && key.length === 32,
      length: key?.length || 0,
      valid: key?.startsWith('60c3e5e3') || false
    };
  }
};
