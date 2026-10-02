import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { invalidateMenuImageCache } from "./menu.js";
import { invalidateMenuHelperCache } from "../../lib/menuHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "restoremenuimage",
  aliases: ["restoreimg", "resetmenuimage", "resetmenuimg", "menuimgreset", "rmi"],
  description: "Restore default menu image or from backup",
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    const isOwner = m.sender === global.owner || m.sender === process.env.OWNER_NUMBER;
    if (!isOwner) {
      await sock.sendMessage(jid, { text: "❌ Owner only!" }, { quoted: m });
      return;
    }

    // Custom images live in data/ (git-ignored) so they survive bot updates.
    const dataDir = path.join(process.cwd(), 'data');
    const customImgPath = path.join(dataDir, "wolfbot_menu_custom.jpg");
    const customGifPath = path.join(dataDir, "wolfbot_menu_custom.gif");
    const backupDir = path.join(dataDir, "menu_backups");

    // The git-tracked default image (always exists after a fresh update)
    const defaultImgPath = path.join(__dirname, "media", "wolfbot.jpg");

    try {
      // ── Restore to default (no args) ───────────────────────────────────
      if (args.length === 0) {
        const hasCustom = fs.existsSync(customImgPath) || fs.existsSync(customGifPath);

        if (!hasCustom) {
          // Already on the default — nothing to do
          const defaultBuf = fs.existsSync(defaultImgPath) ? fs.readFileSync(defaultImgPath) : null;
          if (defaultBuf) {
            await sock.sendMessage(jid, {
              image: defaultBuf,
              caption: `ℹ️ *Already on default image.*\n\nUse ${global.prefix}menu to see it.`
            }, { quoted: m });
          } else {
            await sock.sendMessage(jid, { text: "ℹ️ Already on default image." }, { quoted: m });
          }
          return;
        }

        await sock.sendMessage(jid, { react: { text: "⏳", key: m.key } });

        // Back up the current custom files before removing them
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

        if (fs.existsSync(customGifPath)) {
          try { fs.copyFileSync(customGifPath, path.join(backupDir, `wolfbot-backup-${timestamp}.gif`)); } catch {}
          try { fs.unlinkSync(customGifPath); } catch {}
        }
        if (fs.existsSync(customImgPath)) {
          try { fs.copyFileSync(customImgPath, path.join(backupDir, `wolfbot-backup-${timestamp}.jpg`)); } catch {}
          try { fs.unlinkSync(customImgPath); } catch {}
        }

        // Also clear the menuimage.json source record
        try {
          const menuJsonPath = path.join(dataDir, 'menuimage.json');
          if (fs.existsSync(menuJsonPath)) fs.unlinkSync(menuJsonPath);
        } catch {}

        try { invalidateMenuImageCache(); } catch {}
        try { invalidateMenuHelperCache(); } catch {}

        console.log(`✅ Custom menu image removed — falling back to default`);

        await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });

        const defaultBuf = fs.existsSync(defaultImgPath) ? fs.readFileSync(defaultImgPath) : null;
        if (defaultBuf) {
          await sock.sendMessage(jid, {
            image: defaultBuf,
            caption: `✅ *Restored Successfully!*\n\nMenu image is back to default.\nUse ${global.prefix}menu to see it.`
          }, { quoted: m });
        } else {
          await sock.sendMessage(jid, {
            text: `✅ *Restored Successfully!*\n\nMenu image is back to default.\nUse ${global.prefix}menu to see it.`
          }, { quoted: m });
        }
        return;
      }

      // ── List backups ────────────────────────────────────────────────────
      if (args[0] === 'list' || args[0] === 'backups') {
        if (!fs.existsSync(backupDir)) {
          await sock.sendMessage(jid, { text: "❌ No backups found!" }, { quoted: m });
          return;
        }

        const backupFiles = fs.readdirSync(backupDir)
          .filter(file => file.startsWith('wolfbot-backup-') && (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.webp') || file.endsWith('.gif')))
          .sort()
          .reverse()
          .slice(0, 10);

        if (backupFiles.length === 0) {
          await sock.sendMessage(jid, { text: "📁 No backups found!" }, { quoted: m });
          return;
        }

        let backupList = `📁 *Backups* (${backupFiles.length})\n\n`;
        backupFiles.forEach((file, index) => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          const size = (stats.size / 1024 / 1024).toFixed(2);
          const isGif = file.endsWith('.gif');
          backupList += `${index + 1}. ${isGif ? '🎞️' : '🖼️'} ${file}\n`;
          backupList += `   📏 ${size}MB\n\n`;
        });
        backupList += `💡 ${global.prefix}restoremenuimage <number>`;

        await sock.sendMessage(jid, { text: backupList }, { quoted: m });
        return;
      }

      // ── Restore from specific backup number ─────────────────────────────
      const index = parseInt(args[0]) - 1;

      if (!fs.existsSync(backupDir)) {
        await sock.sendMessage(jid, { text: "❌ No backups found!" }, { quoted: m });
        return;
      }

      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('wolfbot-backup-') && (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.webp') || file.endsWith('.gif')))
        .sort()
        .reverse();

      if (backupFiles.length === 0) {
        await sock.sendMessage(jid, { text: "❌ No backups found!" }, { quoted: m });
        return;
      }

      if (isNaN(index) || index < 0 || index >= backupFiles.length) {
        await sock.sendMessage(jid, { text: `❌ Invalid! Use 1-${backupFiles.length}` }, { quoted: m });
        return;
      }

      const backupToRestore = backupFiles[index];
      const backupPath = path.join(backupDir, backupToRestore);
      const isGifBackup = backupToRestore.endsWith('.gif');

      await sock.sendMessage(jid, { react: { text: "⏳", key: m.key } });

      // Remove whichever custom file isn't being restored, set the one that is
      if (isGifBackup) {
        try { if (fs.existsSync(customImgPath)) fs.unlinkSync(customImgPath); } catch {}
        fs.copyFileSync(backupPath, customGifPath);
      } else {
        try { if (fs.existsSync(customGifPath)) fs.unlinkSync(customGifPath); } catch {}
        fs.copyFileSync(backupPath, customImgPath);
      }

      try { invalidateMenuImageCache(); } catch {}
      try { invalidateMenuHelperCache(); } catch {}
      console.log(`✅ Menu ${isGifBackup ? 'GIF' : 'image'} restored from backup: ${backupToRestore}`);

      await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
      await sock.sendMessage(jid, {
        text: `✅ *Restored Successfully!*\n\nBackup #${index + 1} is now active.\nUse ${global.prefix}menu to see it.`
      }, { quoted: m });

    } catch (error) {
      console.error("❌ [RESTOREMENUIMAGE] ERROR:", error);
      await sock.sendMessage(jid, { react: { text: "❌", key: m.key } });
      await sock.sendMessage(jid, { text: "❌ Restore failed" }, { quoted: m });
    }
  },
};
