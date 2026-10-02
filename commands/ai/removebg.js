// import axios from 'axios';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export default {
//   name: 'removebg',
//   description: 'Remove background from image',
//   category: 'ai',
//   aliases: ['rmbg', 'bgremove', 'nobg', 'transparentbg'],
  
//   async execute(sock, m, args, PREFIX, extra) {
//     const jid = m.key.remoteJid;
    
//     // Check if message is replied to an image
//     const quoted = m.quoted;
    
//     if (!quoted) {
//       return sock.sendMessage(jid, { 
//         text: `📌 *Usage:* Reply to an image with \`${PREFIX}removebg\`\n\nExample: Reply to an image and type ${PREFIX}removebg` 
//       }, { quoted: m });
//     }
    
//     // Check if quoted message has image
//     if (!quoted.message?.imageMessage) {
//       return sock.sendMessage(jid, { 
//         text: '❌ Please reply to an image message' 
//       }, { quoted: m });
//     }

//     try {
//       // Send processing message
//       const statusMsg = await sock.sendMessage(jid, { 
//         text: '🔄 *Processing image... Removing background...*' 
//       }, { quoted: m });
      
//       // Get the image buffer from quoted message
//       let imageBuffer;
//       try {
//         const stream = await sock.downloadMediaMessage(quoted);
//         imageBuffer = Buffer.from(stream);
//       } catch (downloadError) {
//         console.error('❌ [RemoveBG] Download error:', downloadError);
//         await sock.sendMessage(jid, { 
//           text: '❌ Failed to download image. Please try again.',
//           edit: statusMsg.key 
//         });
//         return;
//       }
      
//       // Create temp directory
//       const tempDir = path.join(__dirname, '../temp');
//       if (!fs.existsSync(tempDir)) {
//         fs.mkdirSync(tempDir, { recursive: true });
//       }
      
//       // Save image temporarily
//       const tempFilePath = path.join(tempDir, `image_${Date.now()}.jpg`);
//       fs.writeFileSync(tempFilePath, imageBuffer);
      
//       console.log('📸 Image saved temporarily, uploading...');
      
//       // Upload to free image hosting to get URL (using ptpimg as example)
//       let imageUrl;
//       try {
//         // Try different upload methods
//         imageUrl = await uploadToFreeHosting(tempFilePath);
//         if (!imageUrl) {
//           throw new Error('Failed to upload image');
//         }
//         console.log(`✅ Image uploaded: ${imageUrl}`);
//       } catch (uploadError) {
//         console.error('❌ [RemoveBG] Upload error:', uploadError);
        
//         // Try alternative upload method
//         imageUrl = await uploadToAlternativeHosting(tempFilePath);
//         if (!imageUrl) {
//           await sock.sendMessage(jid, { 
//             text: '❌ Failed to upload image for processing. Please try another image.',
//             edit: statusMsg.key 
//           });
          
//           // Clean up
//           if (fs.existsSync(tempFilePath)) {
//             try { fs.unlinkSync(tempFilePath); } catch {}
//           }
//           return;
//         }
//       }
      
//       // Update status
//       await sock.sendMessage(jid, { 
//         text: '🔄 *Image uploaded... Processing with AI...*',
//         edit: statusMsg.key 
//       });
      
//       // Call removebg API
//       console.log(`🔗 Calling removebg API for: ${imageUrl.substring(0, 50)}...`);
      
//       const response = await axios({
//         method: 'GET',
//         url: 'https://apiskeith.vercel.app/ai/removebg',
//         params: {
//           url: imageUrl
//         },
//         timeout: 60000, // 60 seconds timeout
//         headers: {
//           'User-Agent': 'WhatsApp-Bot/1.0',
//           'Accept': 'application/json',
//           'Referer': 'https://apiskeith.vercel.app/',
//           'Cache-Control': 'no-cache'
//         }
//       });
      
//       console.log(`✅ RemoveBG API response status: ${response.status}`);
      
//       // Parse response
//       let resultUrl = '';
      
//       if (response.data && typeof response.data === 'object') {
//         const data = response.data;
        
//         if (data.status === true && data.result) {
//           resultUrl = data.result;
//         } else if (data.url) {
//           resultUrl = data.url;
//         } else if (data.image) {
//           resultUrl = data.image;
//         } else if (data.output) {
//           resultUrl = data.output;
//         } else if (data.error) {
//           throw new Error(data.error || 'RemoveBG API error');
//         }
//       } else if (typeof response.data === 'string') {
//         // Check if it's a URL
//         if (response.data.startsWith('http')) {
//           resultUrl = response.data;
//         }
//       }
      
//       if (!resultUrl || !resultUrl.startsWith('http')) {
//         throw new Error('No valid image URL returned from API');
//       }
      
//       // Clean up temp file
//       if (fs.existsSync(tempFilePath)) {
//         try { fs.unlinkSync(tempFilePath); } catch {}
//       }
      
//       console.log(`✅ RemoveBG result: ${resultUrl}`);
      
//       // Send final result
//       await sock.sendMessage(jid, { 
//         text: '🔄 *Background removed successfully!* ✅\n⬇️ *Sending result...*',
//         edit: statusMsg.key 
//       });
      
//       // Send the processed image
//       await sock.sendMessage(jid, {
//         image: { url: resultUrl },
//         caption: '✨ *Background removed successfully!*'
//       }, { quoted: m });
      
//       // Send success message
//       await sock.sendMessage(jid, { 
//         text: '✅ *Background removal complete!*',
//         edit: statusMsg.key 
//       });
      
//     } catch (error) {
//       console.error('❌ [RemoveBG] ERROR:', error);
      
//       let errorMessage = '❌ *Failed to remove background*\n\n';
      
//       if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
//         errorMessage += '• RemoveBG API is unavailable\n';
//         errorMessage += '• Please try again later\n';
//       } else if (error.code === 'ETIMEDOUT') {
//         errorMessage += '• Request timed out (60s)\n';
//         errorMessage += '• Image may be too large\n';
//         errorMessage += '• Try a smaller image\n';
//       } else if (error.response?.status === 429) {
//         errorMessage += '• Rate limit exceeded\n';
//         errorMessage += '• Too many requests\n';
//         errorMessage += '• Wait 2-3 minutes\n';
//       } else if (error.response?.status === 400) {
//         errorMessage += '• Invalid image format\n';
//         errorMessage += '• Image may be corrupted\n';
//       } else if (error.message) {
//         errorMessage += `• Error: ${error.message}\n`;
//       }
      
//       errorMessage += '\n💡 *Tips:*\n';
//       errorMessage += '• Use clear images with distinct foreground\n';
//       errorMessage += '• Avoid complex backgrounds\n';
//       errorMessage += '• Try smaller image sizes\n';
//       errorMessage += '• Ensure good lighting in the image\n';
      
//       await sock.sendMessage(jid, { 
//         text: errorMessage 
//       }, { quoted: m });
//     }
//   }
// };

// // Helper function to upload image to free hosting
// async function uploadToFreeHosting(filePath) {
//   try {
//     const formData = new FormData();
//     formData.append('file', fs.createReadStream(filePath));
    
//     // Try imgbb
//     const response = await axios.post('https://api.imgbb.com/1/upload?key=YOUR_API_KEY_HERE', formData, {
//       headers: {
//         ...formData.getHeaders(),
//         'Accept': 'application/json'
//       },
//       timeout: 30000
//     });
    
//     if (response.data?.data?.url) {
//       return response.data.data.url;
//     }
//   } catch (error) {
//     console.log('imgbb failed, trying alternative...');
//   }
  
//   // Try freeimage.host as fallback
//   try {
//     const formData = new FormData();
//     formData.append('source', fs.createReadStream(filePath));
    
//     const response = await axios.post('https://freeimage.host/api/1/upload', formData, {
//       headers: {
//         ...formData.getHeaders(),
//         'Accept': 'application/json'
//       },
//       params: {
//         key: '6d207e02198a847aa98d0a2a901485a5' // Public demo key
//       },
//       timeout: 30000
//     });
    
//     if (response.data?.image?.url) {
//       return response.data.image.url;
//     }
//   } catch (error) {
//     console.log('freeimage.host failed');
//   }
  
//   return null;
// }

// // Alternative upload method
// async function uploadToAlternativeHosting(filePath) {
//   try {
//     // Try ptpimg.me
//     const formData = new FormData();
//     formData.append('file-upload[0]', fs.createReadStream(filePath));
    
//     const response = await axios.post('https://ptpimg.me/upload.php', formData, {
//       headers: {
//         ...formData.getHeaders(),
//         'Accept': 'application/json'
//       },
//       timeout: 30000
//     });
    
//     if (response.data && Array.isArray(response.data) && response.data[0]?.code) {
//       return `https://ptpimg.me/${response.data[0].code}.${response.data[0].ext}`;
//     }
//   } catch (error) {
//     console.log('ptpimg failed');
//   }
  
//   // Last resort: base64 encode
//   try {
//     const imageBuffer = fs.readFileSync(filePath);
//     const base64Image = imageBuffer.toString('base64');
//     return `data:image/jpeg;base64,${base64Image}`;
//   } catch (error) {
//     console.log('Base64 conversion failed');
//     return null;
//   }
// }


















import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage } from "wolfsocket";
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "removebg",
  description: "Remove background from replied image",
  category: "ai",
  aliases: ["rmbg", "bgremove", "nobg", "transparentbg"],
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    
    try {
      // Check if message is a reply to an image
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted?.imageMessage) {
        return sock.sendMessage(
          jid,
          {
            text: `╭─⌈ 🎨 *REMOVE BG* ⌋\n├─⊷ Reply to image with *${PREFIX}removebg*\n│  └⊷ Remove image background\n├─⊷ *${PREFIX}rmbg*\n│  └⊷ Alias for removebg\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
          },
          { quoted: m }
        );
      }

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Download image from WhatsApp
      let imageBuffer;
      try {
        console.log("📥 Downloading image for removebg...");
        
        // Create message object for download
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

        console.log(`✅ Downloaded ${imageBuffer.length} bytes for removebg`);

      } catch (err) {
        console.error("❌ RemoveBG Download Error:", err.message);
        return sock.sendMessage(
          jid,
          { 
            text: "❌ *Failed to download image*\n\n" +
                  "Possible reasons:\n" +
                  "• Image might be too old\n" +
                  "• Media encryption issue\n" +
                  "• Try sending the image again\n\n" +
                  "💡 *Tip:* Send a fresh image for best results"
          },
          { quoted: m }
        );
      }

      // Check file size
      const fileSizeMB = imageBuffer.length / (1024 * 1024);
      if (fileSizeMB > 5) { // Lower limit for better API compatibility
        return sock.sendMessage(
          jid,
          { 
            text: `❌ *File Too Large*\n\n` +
                  `Size: ${fileSizeMB.toFixed(2)} MB\n` +
                  `Limit: 5 MB\n\n` +
                  `💡 *Solution:*\n` +
                  `• Compress the image\n` +
                  `• Use smaller image\n` +
                  `• Crop unnecessary areas`
          },
          { quoted: m }
        );
      }

      // Upload to free image hosting
      console.log("🌐 Uploading to image hosting...");
      const uploadedUrl = await uploadToFreeImageHosting(imageBuffer);
      
      if (!uploadedUrl || !uploadedUrl.startsWith('http')) {
        throw new Error('Failed to upload image to hosting service');
      }

      console.log(`✅ Image uploaded: ${uploadedUrl}`);

      // Call removebg API with URL parameter
      console.log(`🔗 Calling removebg API with URL: ${uploadedUrl}`);
      
      let resultUrl = '';
      
      try {
        const response = await axios({
          method: 'GET',
          url: 'https://apiskeith.vercel.app/ai/removebg',
          params: {
            url: uploadedUrl
          },
          timeout: 60000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'WhatsApp-Bot/1.0'
          }
        });
        
        console.log(`✅ RemoveBG API response status: ${response.status}`);
        
        if (response.data && typeof response.data === 'object') {
          const data = response.data;
          
          if (data.status === true && data.result) {
            resultUrl = data.result;
          } else if (data.url) {
            resultUrl = data.url;
          } else if (data.image) {
            resultUrl = data.image;
          } else if (data.error) {
            throw new Error(data.error);
          } else {
            // Try to find any URL in the response
            const jsonString = JSON.stringify(data);
            const urlMatch = jsonString.match(/https?:\/\/[^\s"']+/);
            if (urlMatch) {
              resultUrl = urlMatch[0];
            }
          }
        }
        
      } catch (apiErr) {
        console.error("❌ RemoveBG API Error:", apiErr.message);
        
        try {
          // Try with different parameter name
          const response2 = await axios.get(
            `https://apiskeith.vercel.app/ai/removebg?image=${encodeURIComponent(uploadedUrl)}`,
            { timeout: 60000 }
          );
          
          if (response2.data?.status === true && response2.data?.result) {
            resultUrl = response2.data.result;
          }
        } catch (secondErr) {
          throw new Error(`API failed: ${apiErr.message} | Alternative: ${secondErr.message}`);
        }
      }
      
      if (!resultUrl || !resultUrl.startsWith('http')) {
        throw new Error('No valid image URL returned from API');
      }

      console.log(`✅ RemoveBG result: ${resultUrl}`);
      
      // Send the processed image
      await sock.sendMessage(
        jid,
        {
          image: { url: resultUrl },
          caption: `✨ *Background removed successfully!*\n` +
                   `✅ AI processing completed\n` +
                   `⚡ Powered by Keith API`
        },
        { quoted: m }
      );

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [RemoveBG] ERROR:', error);
      
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      
      let errorMessage = '❌ *Background removal failed*\n\n';
      
      if (error.message?.includes('413')) {
        errorMessage += '• Image too large for API\n';
        errorMessage += '• Try smaller image (<2MB)\n';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage += '• RemoveBG API is unavailable\n';
        errorMessage += '• Please try again later\n';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += '• Request timed out (60s)\n';
        errorMessage += '• Try a smaller image\n';
      } else if (error.message?.includes('No valid image')) {
        errorMessage += '• API returned invalid response\n';
        errorMessage += '• Try a different image\n';
      } else if (error.message?.includes('Failed to upload')) {
        errorMessage += '• Image hosting service failed\n';
        errorMessage += '• Try again in a minute\n';
      } else if (error.message) {
        errorMessage += `• ${error.message}\n`;
      }
      
      errorMessage += '\n💡 *Tips for better results:*\n';
      errorMessage += '• Use images <2MB\n';
      errorMessage += '• Clear foreground objects\n';
      errorMessage += '• Simple backgrounds\n';
      errorMessage += '• Good lighting\n';
      errorMessage += '• PNG format works best\n\n';
      errorMessage += `🔄 *Try again:* Reply to image with \`${PREFIX}removebg\``;

      await sock.sendMessage(
        jid,
        { text: errorMessage },
        { quoted: m }
      );
    }
  }
};

// Improved image hosting function
async function uploadToFreeImageHosting(buffer) {
  // Try multiple free image hosting services
  const hostingServices = [
    uploadToPtPImg,
    uploadToImgBB,  // Using the same as imgbb command
    uploadToFreeImageHost
  ];
  
  for (const uploadFunc of hostingServices) {
    try {
      console.log(`Trying ${uploadFunc.name}...`);
      const url = await uploadFunc(buffer);
      if (url && url.startsWith('http')) {
        console.log(`✅ Success with ${uploadFunc.name}: ${url}`);
        return url;
      }
    } catch (error) {
      console.log(`❌ ${uploadFunc.name} failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('All image hosting services failed');
}

// PtPImg upload function
async function uploadToPtPImg(buffer) {
  try {
    const base64 = buffer.toString('base64');
    const formData = new URLSearchParams();
    formData.append("file-upload[0]", base64);
    
    const response = await axios.post(
      "https://ptpimg.me/upload.php",
      formData.toString(),
      {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: 30000
      }
    );
    
    if (response.data && Array.isArray(response.data) && response.data[0]?.code) {
      return `https://ptpimg.me/${response.data[0].code}.${response.data[0].ext}`;
    }
    
    return null;
    
  } catch (error) {
    throw new Error(`PtPImg: ${error.message}`);
  }
}

// ImgBB upload function (using your existing method)
async function uploadToImgBB(buffer) {
  try {
    const base64 = buffer.toString('base64');
    
    // Using a public demo key or your existing key
    const apiKey = '60c3e5e339bbed1a90470b2938feab62'; // Your key from imgbb command
    
    const formData = new URLSearchParams();
    formData.append("key", apiKey);
    formData.append("image", base64);
    formData.append("expiration", "600"); // 10 minutes
    
    const response = await axios.post(
      "https://api.imgbb.com/1/upload",
      formData.toString(),
      {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: 30000
      }
    );
    
    if (response.data?.success && response.data?.data?.url) {
      return response.data.data.url;
    }
    
    return null;
    
  } catch (error) {
    throw new Error(`ImgBB: ${error.message}`);
  }
}

// FreeImage.Host upload function
async function uploadToFreeImageHost(buffer) {
  try {
    const formData = new FormData();
    formData.append('source', Buffer.from(buffer));
    
    const response = await axios.post(
      'https://freeimage.host/api/1/upload',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        params: {
          key: '6d207e02198a847aa98d0a2a901485a5' // Public demo key
        },
        timeout: 30000
      }
    );
    
    if (response.data?.image?.url) {
      return response.data.image.url;
    }
    
    return null;
    
  } catch (error) {
    throw new Error(`FreeImage: ${error.message}`);
  }
}