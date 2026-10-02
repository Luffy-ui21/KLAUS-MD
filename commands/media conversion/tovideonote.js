import { downloadContentFromMessage } from 'wolfsocket';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import FFMPEG from '../../lib/ffmpegPath.js';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const execFileAsync = promisify(execFile);

const MAX_DURATION_S = 60;          // WhatsApp PTV cap
const SIZE_PX        = 640;          // square output dimensions
const MAX_INPUT_MB   = 50;           // safety cap

export default {
  name: 'tovideonote',
  alias: ['videonote', 'ptv', 'tovn', 'vnote'],
  description: 'Convert a video to a circular WhatsApp video note (PTV)',
  category: 'converter',

  async execute(sock, m, args) {
    const jid   = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    // Locate a video — quoted, or sent inline with the command
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const videoMessage =
        quoted?.videoMessage
     || m.message?.videoMessage
     || null;

    if (!videoMessage) {
      await sock.sendMessage(jid, {
        text:
          `╭─⌈ ⭕ *TO VIDEO NOTE* ⌋\n` +
          `├─⊷ Reply to a *video* with *.videonote*\n` +
          `│  └⊷ Converts to a circular video note\n` +
          `├─⊷ Max duration: 60 s (auto-trimmed)\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
      return;
    }

    // Pre-flight size check
    const declaredBytes = Number(videoMessage.fileLength) || 0;
    if (declaredBytes > MAX_INPUT_MB * 1024 * 1024) {
      await sock.sendMessage(jid, {
        text: `❌ Video too large (${(declaredBytes / 1048576).toFixed(1)} MB > ${MAX_INPUT_MB} MB cap).`
      }, { quoted: m });
      return;
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const ts         = Date.now();
    const inputPath  = path.join(tmpDir, `vn_in_${ts}.mp4`);
    const outputPath = path.join(tmpDir, `vn_out_${ts}.mp4`);

    try {
      // Download
      const stream = await downloadContentFromMessage(videoMessage, 'video');
      const chunks = [];
      for await (const c of stream) chunks.push(c);
      const buf = Buffer.concat(chunks);

      if (buf.length < 100) throw new Error('Downloaded video is empty');
      if (buf.length > MAX_INPUT_MB * 1024 * 1024) {
        throw new Error(`Video too large (${(buf.length / 1048576).toFixed(1)} MB)`);
      }

      await fs.promises.writeFile(inputPath, buf);

      // Center-crop to square, scale to SIZE_PX, cap duration, re-encode for PTV
      // -movflags +faststart so WhatsApp can start playback before full download
      await execFileAsync(FFMPEG, [
        '-y',
        '-i', inputPath,
        '-t', String(MAX_DURATION_S),
        '-vf', `crop='min(iw,ih):min(iw,ih)',scale=${SIZE_PX}:${SIZE_PX}:flags=lanczos,setsar=1`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '26',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ac', '1',
        '-ar', '44100',
        '-movflags', '+faststart',
        outputPath
      ], { timeout: 90000 });

      if (!fs.existsSync(outputPath)) throw new Error('ffmpeg produced no output');

      const outBuf  = await fs.promises.readFile(outputPath);
      const sizeKB  = (outBuf.length / 1024).toFixed(1);

      // Send as PTV (Push-To-Video / video note). Baileys wraps it in a ptvMessage
      // envelope when `ptv: true` is set, which makes WhatsApp render it as a circle.
      await sock.sendMessage(jid, {
        video: outBuf,
        ptv:   true,
        mimetype: 'video/mp4'
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`✅ [VIDEONOTE] Converted (${sizeKB} KB)`);

    } catch (err) {
      console.error('❌ [VIDEONOTE] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      const friendly =
        /timeout|killed/i.test(err.message)
          ? 'Conversion timed out — try a shorter video.'
          : err.message;
      await sock.sendMessage(jid, {
        text: `❌ *Could not convert to video note*\n\n${friendly}`
      }, { quoted: m });
    } finally {
      try { if (fs.existsSync(inputPath))  fs.unlinkSync(inputPath);  } catch {}
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    }
  }
};
