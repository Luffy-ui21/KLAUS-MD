import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "wolfsocket";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📤 URL Command - Upload media and get permanent URLs
 * Uses ImgBB for images and other services for other files
 */

// ============================================
// EMBEDDED API KEYS
// ============================================

function getImgBBKey() {
  // Embedded ImgBB API key (60c3e5e339bbed1a90470b2938feab62)
  const keyCodes = [
    54, 48, 99, 51, 101, 53, 101, 51,   // 60c3e5e3
    51, 57, 98, 98, 101, 100, 49, 97,   // 39bbed1a
    57, 48, 52, 55, 48, 98, 50, 57,     // 90470b29
    51, 56, 102, 101, 97, 98, 54, 50    // 38feab62
  ];
  
  return keyCodes.map(c => String.fromCharCode(c)).join('');
}

// ============================================
// CONFIGURATION
// ============================================

const UPLOAD_SERVICES = {
    // Primary: ImgBB (images only, permanent)
    IMGBB: {
        name: 'ImgBB',
        url: 'https://api.imgbb.com/1/upload',
        apiKey: getImgBBKey(),
        maxSize: 32 * 1024 * 1024, // 32MB
        supported: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
        permanent: true,
        getUrl: (response) => response.data?.url || null
    },
    
    // Secondary: Telegraph (images only, no API key)
    TELEGRAPH: {
        name: 'Telegra.ph',
        url: 'https://telegra.ph/upload',
        maxSize: 5 * 1024 * 1024, // 5MB
        supported: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        permanent: true,
        getUrl: (response) => response && response[0] && response[0].src ? 
                `https://telegra.ph${response[0].src}` : null
    },
    
    // Backup: 0x0.st (all files, temporary)
    ZEROXZERO: {
        name: '0x0.st',
        url: 'https://0x0.st',
        maxSize: 512 * 1024 * 1024, // 512MB
        supported: '*',
        permanent: false,
        getUrl: (response) => response.trim() || null
    },
    
    // Alternative: File.io (all files, temporary)
    FILEIO: {
        name: 'File.io',
        url: 'https://file.io',
        maxSize: 2 * 1024 * 1024 * 1024, // 2GB
        supported: '*',
        permanent: false,
        getUrl: (response) => {
            try {
                const data = JSON.parse(response);
                return data.success ? data.link : null;
            } catch {
                return null;
            }
        }
    }
};

// Supported file types
const SUPPORTED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', // Images
    '.mp4', '.mov', '.avi', '.mkv', '.webm',          // Videos
    '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', // Documents
    '.mp3', '.wav', '.ogg', '.m4a'                    // Audio
];

// Temporary directory
const TEMP_DIR = path.join(process.cwd(), 'temp_url_uploads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Clean old temp files
function cleanupOldFiles() {
    try {
        if (!fs.existsSync(TEMP_DIR)) return;
        
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const file of files) {
            try {
                const filePath = path.join(TEMP_DIR, file);
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > oneHour) {
                    fs.unlinkSync(filePath);
                }
            } catch {}
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Generate unique filename
function generateUniqueFilename(originalName = 'file') {
    const ext = path.extname(originalName).toLowerCase() || 
                getExtensionFromBuffer(originalName) || 
                '.jpg';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `upload_${timestamp}_${random}${ext}`;
}

// Get extension from buffer
function getExtensionFromBuffer(buffer) {
    if (!buffer || buffer.length < 4) return null;
    
    const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
    
    // Image formats
    if (hex.startsWith('FFD8FF')) return '.jpg';
    if (hex.startsWith('89504E47')) return '.png';
    if (hex.startsWith('47494638')) return '.gif';
    if (hex.startsWith('52494646') && buffer.includes('WEBP')) return '.webp';
    if (hex.startsWith('424D')) return '.bmp';
    
    // Video formats (simplified)
    if (hex.includes('66747970') || hex.includes('6D6F6F76')) return '.mp4';
    if (hex.startsWith('1A45DFA3')) return '.webm';
    
    // Document formats
    if (hex.startsWith('25504446')) return '.pdf';
    if (buffer.includes('%PDF')) return '.pdf';
    
    return null;
}

// Get content type
function getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    const typeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4'
    };
    
    return typeMap[ext] || 'application/octet-stream';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if file is supported
function isFileSupported(filename, buffer = null) {
    const ext = path.extname(filename).toLowerCase();
    
    // Check extension
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
        return true;
    }
    
    // If no extension but we have buffer, try to detect
    if (buffer && !ext) {
        const detectedExt = getExtensionFromBuffer(buffer);
        return detectedExt && SUPPORTED_EXTENSIONS.includes(detectedExt);
    }
    
    return false;
}

// Get file info
function getFileInfo(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        const typeMap = {
            '.jpg': 'JPEG Image',
            '.jpeg': 'JPEG Image',
            '.png': 'PNG Image',
            '.gif': 'GIF Image',
            '.webp': 'WebP Image',
            '.bmp': 'Bitmap Image',
            '.mp4': 'MP4 Video',
            '.mov': 'QuickTime Video',
            '.avi': 'AVI Video',
            '.mkv': 'Matroska Video',
            '.webm': 'WebM Video',
            '.pdf': 'PDF Document',
            '.txt': 'Text File',
            '.doc': 'Word Document',
            '.docx': 'Word Document',
            '.xls': 'Excel Spreadsheet',
            '.xlsx': 'Excel Spreadsheet',
            '.mp3': 'MP3 Audio',
            '.wav': 'WAV Audio',
            '.ogg': 'OGG Audio',
            '.m4a': 'MP4 Audio'
        };
        
        return {
            type: typeMap[ext] || 'Unknown File',
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            extension: ext,
            filename: path.basename(filePath)
        };
    } catch (error) {
        return null;
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

// Upload to ImgBB
async function uploadToImgBB(buffer, filename) {
    try {
        console.log(`📤 Uploading to ImgBB: ${filename}`);
        
        const base64 = buffer.toString("base64");
        const apiKey = UPLOAD_SERVICES.IMGBB.apiKey;
        
        const formData = new URLSearchParams();
        formData.append("key", apiKey);
        formData.append("image", base64);
        formData.append("name", filename);
        formData.append("expiration", "0"); // Never expire
        
        const response = await axios.post(
            UPLOAD_SERVICES.IMGBB.url,
            formData.toString(),
            {
                headers: { 
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                timeout: 45000
            }
        );
        
        console.log('ImgBB Response:', response.data);
        
        if (response.data.success && response.data.data) {
            const data = response.data.data;
            return {
                success: true,
                url: data.url,
                displayUrl: data.display_url,
                thumb: data.thumb?.url || data.url,
                deleteUrl: data.delete_url,
                id: data.id,
                format: data.image?.extension || 'jpg',
                width: data.width,
                height: data.height,
                size: data.size,
                service: 'ImgBB',
                permanent: true
            };
        }
        
        return {
            success: false,
            error: response.data.error?.message || "ImgBB upload failed"
        };
        
    } catch (error) {
        console.error('ImgBB upload error:', error.response?.data || error.message);
        
        let errorMsg = "ImgBB upload failed";
        if (error.response?.data?.error?.code === 105) {
            errorMsg = "Invalid ImgBB API key";
        } else if (error.response?.data?.error?.code === 120) {
            errorMsg = "File too large (max 32MB)";
        } else if (error.code === 'ECONNABORTED') {
            errorMsg = "Upload timeout";
        }
        
        return {
            success: false,
            error: errorMsg
        };
    }
}

// Upload to Telegra.ph (images only, axios-based)
async function uploadToTelegraph(buffer, filename) {
    try {
        console.log(`📤 Uploading to Telegraph: ${filename}`);
        const form = new FormData();
        form.append('file', buffer, { filename, contentType: getContentType(filename) });
        const response = await axios.post('https://telegra.ph/upload', form, {
            headers: form.getHeaders(),
            timeout: 20000
        });
        const src = response.data?.[0]?.src;
        if (src) {
            return { success: true, url: `https://telegra.ph${src}`, service: 'Telegra.ph', permanent: true };
        }
        return { success: false, error: 'Telegraph upload failed' };
    } catch (error) {
        console.error('Telegraph upload error:', error.message);
        return { success: false, error: 'Telegraph upload failed' };
    }
}

// Upload to Catbox.moe (all files, permanent, up to 200MB — best for audio)
async function uploadToCatbox(buffer, filename) {
    try {
        console.log(`📤 Uploading to Catbox.moe: ${filename}`);
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('userhash', '');
        form.append('fileToUpload', buffer, { filename, contentType: getContentType(filename) });
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 60000,
            maxContentLength: 200 * 1024 * 1024
        });
        const url = (response.data || '').trim();
        if (url.startsWith('https://')) {
            return { success: true, url, service: 'Catbox.moe', permanent: true };
        }
        return { success: false, error: `Catbox error: ${url}` };
    } catch (error) {
        console.error('Catbox upload error:', error.message);
        return { success: false, error: 'Catbox upload failed' };
    }
}

// Upload to transfer.sh (all files, 14-day temp link)
async function uploadToTransferSh(buffer, filename) {
    try {
        console.log(`📤 Uploading to transfer.sh: ${filename}`);
        const response = await axios.put(
            `https://transfer.sh/${encodeURIComponent(filename)}`,
            buffer,
            {
                headers: {
                    'Content-Type': getContentType(filename),
                    'Max-Days': '14',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 60000,
                maxContentLength: 200 * 1024 * 1024
            }
        );
        const url = (response.data || '').trim();
        if (url.startsWith('https://')) {
            return { success: true, url, service: 'transfer.sh (14 days)', permanent: false };
        }
        return { success: false, error: 'transfer.sh upload failed' };
    } catch (error) {
        console.error('transfer.sh upload error:', error.message);
        return { success: false, error: 'transfer.sh upload failed' };
    }
}

// Main upload function with fallbacks
async function uploadFile(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();
    const fileSize = buffer.length;
    const isAudio = ['.mp3', '.m4a', '.ogg', '.wav', '.aac', '.flac'].includes(ext);
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);

    console.log(`📄 File: ${filename}, Size: ${formatFileSize(fileSize)}, Ext: ${ext}`);

    // For audio: go straight to Catbox (permanent) → transfer.sh (14 days)
    if (isAudio) {
        console.log('🔄 Trying Catbox.moe (audio)...');
        const r1 = await uploadToCatbox(buffer, filename);
        if (r1.success) return r1;

        console.log('🔄 Trying transfer.sh (audio)...');
        const r2 = await uploadToTransferSh(buffer, filename);
        if (r2.success) return r2;

        return { success: false, error: 'All audio upload services failed' };
    }

    // For images: ImgBB → Telegraph → Catbox
    if (isImage) {
        if (fileSize <= UPLOAD_SERVICES.IMGBB.maxSize) {
            console.log('🔄 Trying ImgBB...');
            const r1 = await uploadToImgBB(buffer, filename);
            if (r1.success) return r1;
        }
        if (fileSize <= UPLOAD_SERVICES.TELEGRAPH.maxSize) {
            console.log('🔄 Trying Telegraph...');
            const r2 = await uploadToTelegraph(buffer, filename);
            if (r2.success) return r2;
        }
    }

    // For everything else (video, docs, etc.): Catbox → transfer.sh
    console.log('🔄 Trying Catbox.moe...');
    const rc = await uploadToCatbox(buffer, filename);
    if (rc.success) return rc;

    console.log('🔄 Trying transfer.sh...');
    const rt = await uploadToTransferSh(buffer, filename);
    if (rt.success) return rt;

    return { success: false, error: 'All upload services failed' };
}

// ============================================
// MAIN COMMAND
// ============================================

export default {
    name: "url",
    description: "Upload media/files and get shareable URLs",
    category: "utility",
    usage: "Reply to any media with .url",
    
    async execute(sock, m, args) {
        const jid = m.key.remoteJid;
        
        cleanupOldFiles();
        
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasUrl = args.length > 0 && args[0].startsWith('http');
        
        if (!quoted && !hasUrl) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 📤 *URL UPLOAD* ⌋\n` +
                      `├─⊷ *.url* (reply to media)\n` +
                      `│  └⊷ Upload & get permanent URL\n` +
                      `├─⊷ *.url <image_url>*\n` +
                      `│  └⊷ Re-upload from URL\n` +
                      `├─⊷ *Supported:* Images, Videos, Docs, Audio\n` +
                      `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }
        
        try {
            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
            
            let buffer, filename;
            
            if (hasUrl) {
                const imageUrl = args[0];
                
                try {
                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    filename = generateUniqueFilename(path.basename(imageUrl.split('?')[0]));
                } catch (error) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(jid, { text: `❌ *URL download failed:* ${error.message}` }, { quoted: m });
                }
                
            } else {
                const messageObj = {
                    key: m.key,
                    message: quoted
                };
                
                try {
                    buffer = await downloadMediaMessage(
                        messageObj,
                        "buffer",
                        {},
                        { 
                            reuploadRequest: sock.updateMediaMessage,
                            logger: console
                        }
                    );
                    
                    if (!buffer || buffer.length === 0) {
                        throw new Error("Empty buffer received");
                    }
                    
                    let originalName = 'file';
                    if (quoted.documentMessage?.fileName) {
                        originalName = quoted.documentMessage.fileName;
                    } else if (quoted.imageMessage) {
                        originalName = 'image.jpg';
                    } else if (quoted.videoMessage) {
                        originalName = 'video.mp4';
                    } else if (quoted.audioMessage) {
                        const mime = quoted.audioMessage.mimetype || '';
                        if (mime.includes('ogg')) originalName = 'audio.ogg';
                        else if (mime.includes('mp4') || mime.includes('m4a')) originalName = 'audio.m4a';
                        else originalName = 'audio.mp3';
                    }
                    
                    filename = generateUniqueFilename(originalName);
                } catch (error) {
                    console.error('Download error:', error);
                    await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(jid, { text: '❌ *Failed to download media*\n\nTry sending a fresh image.' }, { quoted: m });
                }
            }
            
            if (!isFileSupported(filename, buffer)) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(jid, { text: `❌ *File type not supported*\n\nSupported: JPG, PNG, GIF, WebP, MP4, PDF, MP3` }, { quoted: m });
            }
            
            const fileSizeMB = buffer.length / (1024 * 1024);
            
            await sock.sendMessage(jid, { react: { text: '📤', key: m.key } });
            
            const uploadResult = await uploadFile(buffer, filename);
            
            if (!uploadResult.success) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(jid, { text: `❌ *Upload Failed:* ${uploadResult.error}` }, { quoted: m });
            }
            
            const { url, thumb } = uploadResult;

            const isAudioFile = ['.mp3', '.m4a', '.ogg', '.wav', '.aac'].some(e => filename.endsWith(e));
            const audioHint = isAudioFile ? `\n\n_Tip: use *?musicmode add ${url}* to add to music mode_` : '';
            const successCaption = `${url}${audioHint}`;

            try {
                const { createRequire } = await import('module');
                const require = createRequire(import.meta.url);
                const { sendInteractiveMessage } = require('wolfbtns');
                await sendInteractiveMessage(sock, jid, {
                    text: successCaption,
                    footer: getBotName(),
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy URL',
                                copy_code: url
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🌐 Open in Browser',
                                url: url
                            })
                        }
                    ]
                });
            } catch (btnErr) {
                console.log('[URL] Buttons failed:', btnErr.message);
                await sock.sendMessage(jid, { text: successCaption }, { quoted: m });
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
            
        } catch (error) {
            console.error('URL command error:', error);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return sock.sendMessage(jid, { text: `❌ *Error:* ${error.message || 'Unknown error'}` }, { quoted: m });
        }
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const urlUtils = {
    upload: async (buffer, filename = 'file') => {
        return await uploadFile(buffer, filename);
    },
    
    getServices: () => {
        return Object.values(UPLOAD_SERVICES).map(service => ({
            name: service.name,
            maxSize: formatFileSize(service.maxSize),
            supported: service.supported === '*' ? 'All files' : service.supported.join(', '),
            permanent: service.permanent ? 'Yes' : 'No (14 days)'
        }));
    },
    
    getApiKeyStatus: () => {
        const apiKey = getImgBBKey();
        return {
            configured: apiKey && apiKey.length === 32,
            length: apiKey?.length || 0,
            valid: apiKey?.startsWith('60c3e5e3') || false,
            preview: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : 'Not set'
        };
    },
    
    clearTemp: () => {
        try {
            if (!fs.existsSync(TEMP_DIR)) return '✅ No temp directory';
            
            const files = fs.readdirSync(TEMP_DIR);
            let deleted = 0;
            
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(TEMP_DIR, file));
                    deleted++;
                } catch {}
            }
            
            return `✅ Cleared ${deleted} temporary files`;
        } catch (error) {
            return `❌ Error: ${error.message}`;
        }
    }
};