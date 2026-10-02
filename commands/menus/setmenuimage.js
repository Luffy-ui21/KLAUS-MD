import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { downloadContentFromMessage } from "wolfsocket";
import { execSync } from "child_process";
import { invalidateMenuImageCache } from "./menu.js";
import { invalidateMenuHelperCache } from "../../lib/menuHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "setmenuimage",
  alias: ["smi", "mi"],
  description: "Set menu image from reply, image, profile pic, or URL",
  category: "owner",
  ownerOnly: true,

  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const { jidManager } = extra;

    const isOwner = jidManager.isOwner(m);
    const isFromMe = m.key.fromMe;
    const senderJid = m.key.participant || jid;
    const cleaned = jidManager.cleanJid(senderJid);

    if (!isOwner) {
      let errorMsg = `❌ *Owner Only Command!*\n\n`;
      errorMsg += `Only the bot owner can set menu image.\n\n`;
      errorMsg += `🔍 *Debug Info:*\n`;
      errorMsg += `├─ Your JID: ${cleaned.cleanJid}\n`;
      errorMsg += `├─ Your Number: ${cleaned.cleanNumber || 'N/A'}\n`;
      errorMsg += `├─ Type: ${cleaned.isLid ? 'LID 🔗' : 'Regular 📱'}\n`;
      errorMsg += `├─ From Me: ${isFromMe ? '✅ YES' : '❌ NO'}\n`;

      const ownerInfo = jidManager.getOwnerInfo ? jidManager.getOwnerInfo() : {};
      errorMsg += `└─ Owner Number: ${ownerInfo.cleanNumber || 'Not set'}\n\n`;

      if (cleaned.isLid && isFromMe) {
        errorMsg += `⚠️ *Issue Detected:*\n`;
        errorMsg += `You're using a linked device (LID).\n`;
        errorMsg += `Try using \`${PREFIX}fixowner\` or \`${PREFIX}forceownerlid\`\n`;
      } else if (!ownerInfo.cleanNumber) {
        errorMsg += `⚠️ *Issue Detected:*\n`;
        errorMsg += `Owner not set in jidManager!\n`;
        errorMsg += `Try using \`${PREFIX}debugchat fix\`\n`;
      }

      return sock.sendMessage(jid, { text: errorMsg }, { quoted: m });
    }

    const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.message?.imageMessage?.contextInfo || m.message?.videoMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;
    let quotedImage = quotedMsg?.imageMessage || quotedMsg?.viewOnceMessage?.message?.imageMessage || quotedMsg?.viewOnceMessageV2?.message?.imageMessage;
    let quotedVideo = quotedMsg?.videoMessage;
    const directImage = m.message?.imageMessage;
    const directVideo = m.message?.videoMessage;

    const isQuotedGif = quotedVideo && quotedVideo.gifPlayback === true;
    const isDirectGif = directVideo && directVideo.gifPlayback === true;

    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = contextInfo?.participant;
    const replyTarget = mentioned || quotedParticipant;

    const hasReplyImage = !!quotedImage;
    const hasReplyGif = !!isQuotedGif;
    const hasDirectImage = !!directImage;
    const hasDirectGif = !!isDirectGif;
    const hasUrl = args.length > 0 && args[0].startsWith('http');
    const hasReplyPerson = !!replyTarget && !hasReplyImage && !hasReplyGif;

    if (!hasReplyImage && !hasDirectImage && !hasUrl && !hasReplyPerson && !hasReplyGif && !hasDirectGif) {
      await sock.sendMessage(jid, {
        text: `🖼️ *Set Menu Image*\n\nUsage:\n• Reply to an image: \`${PREFIX}smi\`\n• Reply to a GIF: \`${PREFIX}smi\` (animated menu!)\n• Reply to a person: \`${PREFIX}smi\` (uses their profile pic)\n• Mention someone: \`${PREFIX}smi @user\`\n• Send with image: attach image with caption \`${PREFIX}smi\`\n• Use URL: \`${PREFIX}smi <image_url>\`\n\n⚠️ Supports JPG/PNG/WebP/GIF (max 10MB)\n\n📋 *Styles that use this image (1–9):*\n• Style 1 — Image Menu\n• Style 6 — Faded + Image\n• Style 7 — Image + Text\n• Style 9 — Full List + Image\n\n💡 Use \`${PREFIX}menustyle\` to switch styles.`
      }, { quoted: m });
      return;
    }

    await sock.sendMessage(jid, { react: { text: "⏳", key: m.key } });

    try {
      let imageBuffer;
      let contentType = 'image/jpeg';
      let sourceLabel = '';

      let isGifSource = false;

      if (hasDirectGif) {
        sourceLabel = 'attached GIF';
        isGifSource = true;
        console.log(`🎞️ Owner ${cleaned.cleanNumber} setting menu GIF from ${sourceLabel}`);
        const stream = await downloadContentFromMessage(directVideo, 'video');
        const chunks = [];
        for await (const chunk of stream) { chunks.push(chunk); }
        imageBuffer = Buffer.concat(chunks);
        contentType = 'video/mp4';

      } else if (hasReplyGif) {
        sourceLabel = 'replied GIF';
        isGifSource = true;
        console.log(`🎞️ Owner ${cleaned.cleanNumber} setting menu GIF from ${sourceLabel}`);
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        const chunks = [];
        for await (const chunk of stream) { chunks.push(chunk); }
        imageBuffer = Buffer.concat(chunks);
        contentType = 'video/mp4';

      } else if (hasDirectImage) {
        sourceLabel = 'attached image';
        console.log(`🖼️ Owner ${cleaned.cleanNumber} setting menu image from ${sourceLabel}`);
        const stream = await downloadContentFromMessage(directImage, 'image');
        const chunks = [];
        for await (const chunk of stream) { chunks.push(chunk); }
        imageBuffer = Buffer.concat(chunks);
        contentType = directImage.mimetype || 'image/jpeg';

      } else if (hasReplyImage) {
        sourceLabel = 'replied image';
        console.log(`🖼️ Owner ${cleaned.cleanNumber} setting menu image from ${sourceLabel}`);
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        const chunks = [];
        for await (const chunk of stream) { chunks.push(chunk); }
        imageBuffer = Buffer.concat(chunks);
        contentType = quotedImage.mimetype || 'image/jpeg';

      } else if (hasReplyPerson) {
        const targetClean = jidManager.cleanJid(replyTarget);
        sourceLabel = `profile pic of ${targetClean.cleanNumber || replyTarget}`;
        console.log(`🖼️ Owner ${cleaned.cleanNumber} setting menu image from ${sourceLabel}`);

        // Build an ordered list of JIDs to try, most likely to work first.
        // quotedParticipant often has a device suffix (e.g. 2782…:12@s.whatsapp.net)
        // which profilePictureUrl rejects — so use the cleaned JID first.
        const jidsToTry = new Set();
        if (!targetClean.isLid) {
          jidsToTry.add(targetClean.cleanJid);                          // no device suffix
          if (targetClean.cleanNumber) jidsToTry.add(`${targetClean.cleanNumber}@s.whatsapp.net`);
        } else {
          // For LID JIDs try the bare @lid first, then attempt phone@s.whatsapp.net
          jidsToTry.add(replyTarget);
          if (targetClean.cleanNumber) jidsToTry.add(`${targetClean.cleanNumber}@s.whatsapp.net`);
        }
        jidsToTry.add(replyTarget); // raw original as last resort

        let ppUrl;
        for (const tryJid of jidsToTry) {
          try {
            ppUrl = await sock.profilePictureUrl(tryJid, "image");
            console.log(`📸 Got DP from JID: ${tryJid}`);
            break;
          } catch {}
        }

        if (!ppUrl) {
          await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
          await sock.sendMessage(jid, {
            text: "❌ *Could not fetch profile picture*\n\nThe user may have their profile picture hidden or doesn't have one set."
          }, { quoted: m });
          return;
        }

        const response = await axios({
          method: 'GET',
          url: ppUrl,
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        imageBuffer = Buffer.from(response.data);
        contentType = response.headers['content-type'] || 'image/jpeg';

      } else {
        let imageUrl = args[0];
        sourceLabel = 'URL';

        if (!imageUrl.startsWith('http')) {
          await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
          await sock.sendMessage(jid, {
            text: "❌ Invalid URL! Must start with http:// or https://"
          }, { quoted: m });
          return;
        }

        try {
          const url = new URL(imageUrl);
          const blacklistedParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'msclkid'];
          blacklistedParams.forEach(param => url.searchParams.delete(param));
          imageUrl = url.toString();
        } catch (e) {}

        console.log(`🌐 Owner ${cleaned.cleanNumber} setting menu image from: ${imageUrl}`);

        const response = await axios({
          method: 'GET',
          url: imageUrl,
          responseType: 'arraybuffer',
          timeout: 25000,
          maxContentLength: 15 * 1024 * 1024,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          decompress: true,
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          }
        });

        contentType = response.headers['content-type'] || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          const urlLower = imageUrl.toLowerCase();
          const hasImageExtension = urlLower.includes('.jpg') || urlLower.includes('.jpeg') ||
                                   urlLower.includes('.png') || urlLower.includes('.webp') ||
                                   urlLower.includes('.gif');
          if (!hasImageExtension) {
            await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
            await sock.sendMessage(jid, {
              text: "❌ *Not a valid image URL*\n\nPlease provide a direct link to an image file."
            }, { quoted: m });
            return;
          }
        }

        imageBuffer = Buffer.from(response.data);
      }

      const fileSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);

      if (imageBuffer.length > 10 * 1024 * 1024) {
        await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
        await sock.sendMessage(jid, {
          text: `❌ *Image too large!* (${fileSizeMB}MB > 10MB limit)\n\nPlease use a smaller image.`
        }, { quoted: m });
        return;
      }

      if (imageBuffer.length < 2048) {
        await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
        await sock.sendMessage(jid, {
          text: "❌ *Image too small or corrupted*\n\nImage file appears to be invalid."
        }, { quoted: m });
        return;
      }

      console.log(`✅ Media downloaded: ${fileSizeMB}MB, type: ${contentType}`);

      // Custom images are stored in data/ (git-ignored) so they survive bot updates.
      // The git-tracked commands/menus/media/wolfbot.jpg remains as the default fallback.
      const dataDir = path.join(process.cwd(), 'data');
      const wolfbotImgPath = path.join(dataDir, "wolfbot_menu_custom.jpg");
      const wolfbotGifPath = path.join(dataDir, "wolfbot_menu_custom.gif");
      const backupDir = path.join(dataDir, "menu_backups");

      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

      if (isGifSource) {
        if (fs.existsSync(wolfbotGifPath)) {
          try {
            fs.copyFileSync(wolfbotGifPath, path.join(backupDir, `wolfbot-backup-${timestamp}.gif`));
          } catch {}
        }
        if (fs.existsSync(wolfbotImgPath)) {
          try { fs.unlinkSync(wolfbotImgPath); } catch {}
        }
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tmpMp4 = path.join(tmpDir, `menuimg_${Date.now()}.mp4`);
        fs.writeFileSync(tmpMp4, imageBuffer);
        try {
          execSync(`ffmpeg -y -i "${tmpMp4}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15" -loop 0 "${wolfbotGifPath}" 2>/dev/null`, { timeout: 30000 });
          console.log(`✅ Menu GIF converted and saved: ${wolfbotGifPath}`);
        } catch (e) {
          fs.writeFileSync(wolfbotGifPath, imageBuffer);
          console.log(`⚠️ ffmpeg conversion failed, saved raw data: ${wolfbotGifPath}`);
        }
        try { fs.unlinkSync(tmpMp4); } catch {}
      } else {
        if (fs.existsSync(wolfbotImgPath)) {
          try {
            fs.copyFileSync(wolfbotImgPath, path.join(backupDir, `wolfbot-backup-${timestamp}.jpg`));
          } catch {}
        }
        if (fs.existsSync(wolfbotGifPath)) {
          try { fs.unlinkSync(wolfbotGifPath); } catch {}
        }
        fs.writeFileSync(wolfbotImgPath, imageBuffer);
        console.log(`✅ Menu image saved: ${wolfbotImgPath}`);
      }

      const wolfbotPath = isGifSource ? wolfbotGifPath : wolfbotImgPath;

      const stats = fs.statSync(wolfbotPath);
      if (stats.size === 0) throw new Error("Saved file is empty");

      try { invalidateMenuImageCache(); } catch {}
      try { invalidateMenuHelperCache(); } catch {}

      // Persist the source info so .getsettings can show the real source
      try {
        const actualUrl = hasUrl ? args[0] : null;
        const source = hasUrl ? 'URL' : (hasReplyPerson ? 'Profile pic' : sourceLabel);
        fs.writeFileSync(
          path.join(dataDir, 'menuimage.json'),
          JSON.stringify({ source, url: actualUrl, updatedAt: new Date().toISOString() }, null, 2)
        );
      } catch {}

      await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
      await sock.sendMessage(jid, {
        text: `✅ *Menu Image Set Successfully!*\n\nSource: ${sourceLabel}\nUse ${PREFIX}menu to see it.`
      }, { quoted: m });

      console.log(`✅ Menu image updated successfully by owner ${cleaned.cleanNumber}`);

    } catch (error) {
      console.error("❌ [SETMENUIMAGE] ERROR:", error);

      await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });

      let errorMessage = "❌ *Failed to set menu image*\n\n";

      if (error.code === 'ENOTFOUND') {
        errorMessage += "• Domain not found";
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += "• Download timeout (25s)";
      } else if (error.response?.status === 404) {
        errorMessage += "• Image not found (404)";
      } else if (error.response?.status === 403) {
        errorMessage += "• Access denied (403)";
      } else if (error.message.includes('ENOENT')) {
        errorMessage += "• Could not save image file";
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage += "• Connection refused";
      } else {
        errorMessage += `• ${error.message}`;
      }

      errorMessage += `\n\nPlease try again.`;

      await sock.sendMessage(jid, { text: errorMessage }, { quoted: m });
    }
  },
};
