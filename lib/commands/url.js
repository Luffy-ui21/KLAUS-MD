/**
 * .url — Smart URL tool with two modes:
 *
 * Mode 1: Shorten a long URL
 *   .url https://example.com/very/long/link
 *
 * Mode 2: Reply to media → upload to public host → return URL
 *   Reply to image/video/document → .url
 *
 * Try multiple shortening services + multiple upload hosts.
 */

const axios = require('axios');
const FormData = require('form-data');

module.exports = {
  name: 'url',
  aliases: ['shorten', 'shorturl', 'tinyurl', 'tolink', 'tourl'],
  desc: 'Shorten a URL OR convert replied media to a link',
  category: 'tools',
  async execute({ sock, msg, args, reply, from }) {
    // === Mode 2: Reply to media → upload + return URL ===
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    const hasMediaQuoted = quoted && (
      quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage ||
      quoted.audioMessage || quoted.documentMessage
    );

    if (hasMediaQuoted) {
      return await uploadMediaToUrl(sock, msg, reply);
    }

    // === Mode 1: Shorten a URL ===
    const url = args[0];
    if (!url) {
      return reply(
        `📝 *URL TOOL*\n\n` +
        `*1. Shorten a URL:*\n` +
        `  \`.url https://example.com/very/long/link\`\n\n` +
        `*2. Convert media to link:*\n` +
        `  Reply to an image/video/audio/document with \`.url\`\n\n` +
        `_Powered by KLAUS-MD_`
      );
    }

    if (!/^https?:\/\//i.test(url)) {
      return reply('❌ URL must start with `http://` or `https://`\n\nExample: `.url https://example.com`');
    }

    await reply('⏳ Shortening URL...');

    // Try is.gd
    try {
      const res = await axios.get(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
        { timeout: 15000 }
      );
      if (res.data?.shorturl) {
        return reply(
          `✅ *URL Shortened!*\n\n` +
          `📝 *Original:* ${url}\n` +
          `🔗 *Short:* ${res.data.shorturl}\n\n` +
          `_Powered by KLAUS-MD_`
        );
      }
    } catch (e) {
      console.warn('[URL] is.gd failed:', e.message);
    }

    // Try TinyURL
    try {
      const res = await axios.get(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
        { timeout: 15000 }
      );
      if (typeof res.data === 'string' && res.data.startsWith('http')) {
        return reply(
          `✅ *URL Shortened!*\n\n` +
          `📝 *Original:* ${url}\n` +
          `🔗 *Short:* ${res.data}\n\n` +
          `_Powered by KLAUS-MD_`
        );
      }
    } catch (e) {
      console.warn('[URL] TinyURL failed:', e.message);
    }

    // Try ouo.io / shorte.st alternatives
    try {
      const res = await axios.get(
        `https://cdpt.in/shorten?url=${encodeURIComponent(url)}`,
        { timeout: 15000 }
      );
      if (typeof res.data === 'string' && res.data.startsWith('http')) {
        return reply(
          `✅ *URL Shortened!*\n\n` +
          `📝 *Original:* ${url}\n` +
          `🔗 *Short:* ${res.data}\n\n` +
          `_Powered by KLAUS-MD_`
        );
      }
    } catch (e) {
      console.warn('[URL] cdpt failed:', e.message);
    }

    return reply(
      `⚠️ *All URL shorteners unavailable.*\n\n` +
      `📝 *Your URL:* ${url}\n\n` +
      `_Please try again later._`
    );
  },
};

/**
 * Upload media to multiple hosts (try catbox → 0x0 → tmpfiles)
 */
async function uploadMediaToUrl(sock, msg, reply) {
  try {
    await reply('⏳ Uploading media to public host...');

    const contextInfo = msg.message.extendedTextMessage.contextInfo;
    const quotedMsg = contextInfo.quotedMessage;
    const participant = contextInfo.participant || msg.key.remoteJid;
    const stanzaId = contextInfo.stanzaId;

    const fakeMsg = {
      key: {
        remoteJid: msg.key.remoteJid,
        id: stanzaId,
        participant,
        fromMe: false,
      },
      message: quotedMsg,
    };

    let mediaType = 'file';
    let extension = 'bin';

    if (quotedMsg.imageMessage) {
      mediaType = 'image'; extension = 'jpg';
    } else if (quotedMsg.videoMessage) {
      mediaType = 'video'; extension = 'mp4';
    } else if (quotedMsg.audioMessage) {
      mediaType = 'audio'; extension = 'mp3';
    } else if (quotedMsg.stickerMessage) {
      mediaType = 'sticker'; extension = 'webp';
    } else if (quotedMsg.documentMessage) {
      mediaType = 'document';
      extension = quotedMsg.documentMessage.fileName?.split('.').pop() || 'bin';
    }

    // Download the media
    let buffer;
    try {
      const stream = await sock.downloadMediaMessage(fakeMsg);
      buffer = Buffer.isBuffer(stream) ? stream : Buffer.from(stream);
    } catch (e) {
      try {
        const stream2 = await sock.downloadMediaMessage({ key: fakeMsg.key, message: quotedMsg });
        buffer = Buffer.isBuffer(stream2) ? stream2 : Buffer.from(stream2);
      } catch (e2) {
        return reply(`❌ Failed to download media: ${e2.message || e.message}`);
      }
    }

    if (!buffer || buffer.length === 0) {
      return reply('❌ Downloaded media is empty. Try again.');
    }

    console.log(`[URL] Downloaded ${mediaType} (${buffer.length} bytes), uploading...`);

    // Try host 1: catbox.moe
    try {
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', buffer, `media.${extension}`);

      const uploadRes = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const uploadedUrl = typeof uploadRes.data === 'string' ? uploadRes.data.trim() : null;
      if (uploadedUrl && uploadedUrl.startsWith('http')) {
        return reply(
          `✅ *Media uploaded!*\n\n` +
          `📂 *Type:* ${mediaType}\n` +
          `💾 *Size:* ${(buffer.length / 1024).toFixed(1)} KB\n` +
          `🔗 *URL:* ${uploadedUrl}\n\n` +
          `_Permanent public link._\n_Powered by KLAUS-MD_`
        );
      }
    } catch (e) {
      console.warn('[URL] catbox failed:', e.message);
    }

    // Try host 2: 0x0.st
    try {
      const form = new FormData();
      form.append('file', buffer, `media.${extension}`);

      const uploadRes = await axios.post('https://0x0.st', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const uploadedUrl = typeof uploadRes.data === 'string' ? uploadRes.data.trim() : null;
      if (uploadedUrl && uploadedUrl.startsWith('http')) {
        return reply(
          `✅ *Media uploaded!*\n\n` +
          `📂 *Type:* ${mediaType}\n` +
          `💾 *Size:* ${(buffer.length / 1024).toFixed(1)} KB\n` +
          `🔗 *URL:* ${uploadedUrl}\n\n` +
          `_Powered by KLAUS-MD_`
        );
      }
    } catch (e) {
      console.warn('[URL] 0x0.st failed:', e.message);
    }

    // Try host 3: tmpfiles.org
    try {
      const form = new FormData();
      form.append('file', buffer, `media.${extension}`);

      const uploadRes = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (uploadRes.data?.data?.url) {
        const url = uploadRes.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        return reply(
          `✅ *Media uploaded!*\n\n` +
          `📂 *Type:* ${mediaType}\n` +
          `💾 *Size:* ${(buffer.length / 1024).toFixed(1)} KB\n` +
          `🔗 *URL:* ${url}\n\n` +
          `_Powered by KLAUS-MD_`
        );
      }
    } catch (e) {
      console.warn('[URL] tmpfiles failed:', e.message);
    }

    return reply(
      `❌ *All upload hosts failed.*\n\n` +
      `_Media was downloaded (${(buffer.length / 1024).toFixed(1)} KB) but no host accepted it.\n` +
      `Try again later or with a smaller file._`
    );
  } catch (e) {
    console.error('[URL] Upload failed:', e);
    return reply(`❌ Upload failed: ${e.message}`);
  }
}
