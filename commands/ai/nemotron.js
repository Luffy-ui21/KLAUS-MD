import { downloadMediaMessage } from 'wolfsocket';
import { chat, vision, visionMulti } from '../../lib/nvidia.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import FFMPEG from '../../lib/ffmpegPath.js';

const MODEL = 'nvidia/nemotron-nano-12b-v2-vl';

const MAX_VIDEO_BYTES = 30 * 1024 * 1024;   // 30 MB hard cap
const MAX_VIDEO_SECS  = 180;                // 3 min hard cap

/* ─────────── video → frames helpers (ffmpeg) ─────────── */

function runCmd(cmd, args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '', stderr = '';
    const t = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => { clearTimeout(t); reject(err); });
    proc.on('close', code => {
      clearTimeout(t);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

async function probeDuration(filepath) {
  const { stdout } = await runCmd('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filepath
  ], 15000);
  const dur = parseFloat(stdout.trim());
  if (!Number.isFinite(dur) || dur <= 0) throw new Error('Could not read video duration');
  return dur;
}

function pickFrameCount(durationSecs) {
  if (durationSecs < 5)   return 4;
  if (durationSecs < 15)  return 6;
  return 8;
}

/**
 * Extract N evenly-spaced frames from a video file.
 * Returns an array of JPEG Buffers in chronological order.
 */
async function extractFrames(videoPath, frameCount, duration, workDir) {
  const fps = frameCount / duration;
  const pattern = path.join(workDir, 'frame_%02d.jpg');

  await runCmd(FFMPEG, [
    '-y',
    '-i', videoPath,
    '-vf', `fps=${fps.toFixed(6)},scale=640:-2:force_original_aspect_ratio=decrease`,
    '-frames:v', String(frameCount),
    '-q:v', '5',
    pattern
  ], 60000);

  const frames = [];
  for (let i = 1; i <= frameCount; i++) {
    const fp = path.join(workDir, `frame_${String(i).padStart(2, '0')}.jpg`);
    try {
      frames.push(await fs.readFile(fp));
    } catch { /* missing frame — skip */ }
  }
  if (frames.length === 0) throw new Error('ffmpeg produced no frames');
  return frames;
}

/* ─────────── command ─────────── */

export default {
  name: 'nemotron',
  description: 'NVIDIA Nemotron Nano 12B VL — text chat, image & video understanding',
  category: 'ai',
  aliases: ['nemo', 'nemoai', 'nvai', 'vlm'],
  usage: 'nemotron [question] | reply to an image/video with .nemotron <question>',

  async execute(sock, m, args, PREFIX) {
    const jid   = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();
    const query = args.length > 0 ? args.join(' ') : '';

    // Detect quoted media
    const quoted      = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImg   = quoted?.imageMessage;
    const quotedVid   = quoted?.videoMessage;

    // Detect an image URL embedded in args
    const urlInArgs   = (query.match(/\bhttps?:\/\/\S+\.(?:jpe?g|png|webp|gif|bmp)(?:\?\S*)?/i) || [])[0];

    if (!query && !quotedImg && !quotedVid) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🎨 *NEMOTRON VL* ⌋\n` +
          `├─⊷ *${PREFIX}nemo <question>*\n` +
          `│  └⊷ Chat, or reply to image/video\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    let workDir = null;

    try {
      await sock.sendMessage(jid, { react: { text: '🎨', key: m.key } });

      let reply;
      let modeLabel = 'TEXT';

      if (quotedVid) {
        modeLabel = 'VIDEO';

        // Pre-flight size check using the WhatsApp metadata
        const declaredSize = Number(quotedVid.fileLength) || 0;
        if (declaredSize > MAX_VIDEO_BYTES) {
          throw new Error(`Video too large (${(declaredSize / 1048576).toFixed(1)} MB > 30 MB cap)`);
        }

        // Download
        const buf = await downloadMediaMessage(
          { key: m.key, message: quoted },
          'buffer',
          {},
          { reuploadRequest: sock.updateMediaMessage, logger: console }
        );
        if (!buf || buf.length === 0) throw new Error('Could not download the video from WhatsApp');
        if (buf.length > MAX_VIDEO_BYTES) {
          throw new Error(`Video too large (${(buf.length / 1048576).toFixed(1)} MB > 30 MB cap)`);
        }

        // Workspace
        const id = randomBytes(6).toString('hex');
        workDir = path.join(tmpdir(), `nemo_vid_${id}`);
        await fs.mkdir(workDir, { recursive: true });
        const videoPath = path.join(workDir, 'in.mp4');
        await fs.writeFile(videoPath, buf);

        // Probe + extract
        const duration = await probeDuration(videoPath);
        if (duration > MAX_VIDEO_SECS) {
          throw new Error(`Video too long (${duration.toFixed(0)} s > 180 s cap)`);
        }
        const frameCount = pickFrameCount(duration);
        const frames = await extractFrames(videoPath, frameCount, duration, workDir);

        const promptText = (query?.trim()) || 'Describe what is happening in this video.';
        const fullPrompt =
          `These are ${frames.length} sequential frames sampled evenly from a ${duration.toFixed(1)}-second video. ` +
          `Treat them as a timeline (frame 1 = start, frame ${frames.length} = end). ` +
          `${promptText}`;

        reply = await visionMulti(fullPrompt, frames, {
          model: MODEL, maxTokens: 2048, timeoutMs: 120000
        });

      } else if (quotedImg) {
        modeLabel = 'IMAGE';
        const buf = await downloadMediaMessage(
          { key: m.key, message: quoted },
          'buffer',
          {},
          { reuploadRequest: sock.updateMediaMessage, logger: console }
        );
        if (!buf || buf.length === 0) throw new Error('Could not download the image from WhatsApp');

        reply = await vision(query || 'Describe this image in detail.', buf, {
          model: MODEL, maxTokens: 2048, timeoutMs: 90000
        });

      } else if (urlInArgs) {
        modeLabel = 'IMAGE';
        const promptOnly = query.replace(urlInArgs, '').trim() || 'Describe this image in detail.';
        reply = await vision(promptOnly, urlInArgs, {
          model: MODEL, maxTokens: 2048, timeoutMs: 90000
        });

      } else {
        reply = await chat(query, {
          model: MODEL,
          system: 'You are Nemotron, a helpful and concise AI assistant by NVIDIA.',
          maxTokens: 2048,
          timeoutMs: 90000
        });
      }

      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text:
          `🎨 *NEMOTRON VL* — ${modeLabel}\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${reply}\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[NEMOTRON] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Nemotron Error*\n\n${err.message}\n\nPlease try again.`
      }, { quoted: m });
    } finally {
      if (workDir) {
        fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
};
