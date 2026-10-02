import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { getBotName } from '../../lib/botname.js';
import { getFooter } from '../../lib/menuHelper.js';
import { getBoxStyleCommands } from './commandList.js';

const exec = promisify(execCallback);
const menuDirectory = path.dirname(fileURLToPath(import.meta.url));
const cacheTtl = 10 * 60 * 1000;
let mediaCache = null;
let mediaCacheAt = 0;

function localPath(...parts) {
  return path.join(process.cwd(), ...parts);
}

async function getMenuMedia() {
  const customGif = localPath('data', 'wolfbot_menu_custom.gif');
  const customImage = localPath('data', 'wolfbot_menu_custom.jpg');
  const bundledGif = path.join(menuDirectory, 'media', 'wolfbot.gif');
  const bundledImage = path.join(menuDirectory, 'media', 'wolfbot.jpg');
  const gifPath = fs.existsSync(customGif) ? customGif : fs.existsSync(bundledGif) ? bundledGif : null;
  const imagePath = fs.existsSync(customImage) ? customImage : fs.existsSync(bundledImage) ? bundledImage : null;
  const now = Date.now();

  if (gifPath) {
    if (!mediaCache || mediaCache.kind !== 'gif' || now - mediaCacheAt > cacheTtl) {
      mediaCache = { kind: 'gif', buffer: fs.readFileSync(gifPath), mp4: null };
      mediaCacheAt = now;
      const tempDir = localPath('tmp');
      const outputPath = path.join(tempDir, 'wolfbot-menu.mp4');
      fs.mkdirSync(tempDir, { recursive: true });
      exec(`ffmpeg -y -i "${gifPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -movflags +faststart -an "${outputPath}"`, { timeout: 25000 })
        .then(() => { mediaCache.mp4 = fs.readFileSync(outputPath); })
        .catch(() => {})
        .finally(() => { try { fs.unlinkSync(outputPath); } catch {} });
    }
    return mediaCache;
  }

  if (imagePath) {
    if (!mediaCache || mediaCache.kind !== 'image' || now - mediaCacheAt > cacheTtl) {
      mediaCache = { kind: 'image', buffer: fs.readFileSync(imagePath) };
      mediaCacheAt = now;
    }
    return mediaCache;
  }

  return null;
}

export function invalidateMenuImageCache() {
  mediaCache = null;
  mediaCacheAt = 0;
}

function getPrefix() {
  return global.prefix || process.env.PREFIX || '.';
}

function buildMenu(message) {
  const prefix = getPrefix();
  const botName = getBotName().toUpperCase();
  const access = message.key.remoteJid?.endsWith('@g.us') ? 'GROUP' : 'PRIVATE';
  const line = '----------------------------------------';

  return [
    `WOLFBOT / ${botName}`,
    line,
    'COMMAND CENTRE',
    `ACCESS   ${access}`,
    `PREFIX   ${prefix}`,
    'STATUS   READY',
    line,
    '',
    getBoxStyleCommands(),
    '',
    line,
    `QUICK: ${prefix}menu | ${prefix}ping`,
    getFooter(message.key.participant || message.key.remoteJid)
  ].join('\n');
}

async function sendMenu(sock, jid, message, text, media) {
  if (media?.kind === 'gif' && media.mp4) {
    await sock.sendMessage(jid, { video: media.mp4, gifPlayback: true, caption: text, mimetype: 'video/mp4' }, { quoted: message });
    return;
  }
  if (media?.buffer) {
    await sock.sendMessage(jid, { image: media.buffer, caption: text, mimetype: 'image/jpeg' }, { quoted: message });
    return;
  }
  await sock.sendMessage(jid, { text }, { quoted: message });
}

export default {
  name: 'menu',
  description: 'Shows the WOLFBOT command centre',
  async execute(sock, message) {
    const jid = message.key.remoteJid;
    const text = buildMenu(message);
    const media = await getMenuMedia();
    await sendMenu(sock, jid, message, text, media);
  }
};
