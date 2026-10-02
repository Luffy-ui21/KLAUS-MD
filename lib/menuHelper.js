import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec as _execCb } from 'child_process';
import { promisify } from 'util';
const _execAsync = promisify(_execCb);
import axios from 'axios';
import os from 'os';
import { getBotName as _getBotName } from './botname.js';
import { getEmoji } from './userEmoji.js';

const DEFAULT_MENU_IMAGE_URL = "https://i.ibb.co/Gvkt4q9d/Chat-GPT-Image-Feb-21-2026-12-47-33-AM.png";

let _cachedImage = null;
let _cachedImageTime = 0;
let _cachedGif = null;
let _cachedGifMp4 = null;
let _gifConversionInProgress = false;
const CACHE_TTL = 10 * 60 * 1000;

export function getBotName() {
  return _getBotName();
}

export function getOwnerName() {
  try {
    const settingsPaths = [
      './bot_settings.json',
      path.join(process.cwd(), 'bot_settings.json'),
    ];
    for (const p of settingsPaths) {
      if (fs.existsSync(p)) {
        try {
          const s = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (s.ownerName && s.ownerName.trim()) return s.ownerName.trim();
        } catch {}
      }
    }

    const ownerPaths = [
      './owner.json',
      path.join(process.cwd(), 'owner.json'),
    ];
    for (const p of ownerPaths) {
      if (fs.existsSync(p)) {
        try {
          const o = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (o.owner && o.owner.trim()) return o.owner.trim();
          if (o.number && o.number.trim()) return o.number.trim();
          if (o.phone && o.phone.trim()) return o.phone.trim();
          if (o.contact && o.contact.trim()) return o.contact.trim();
          if (Array.isArray(o) && o.length > 0) return typeof o[0] === 'string' ? o[0] : 'Unknown';
        } catch {}
      }
    }

    if (global.OWNER_NAME) return global.OWNER_NAME;
    if (global.owner) return global.owner;
  } catch {}
  return 'WOLF';
}

export function getFooter(jid) {
  const emoji = getEmoji(jid || '');
  return `${emoji} *Powered by ${getOwnerName().toUpperCase()} TECH*`;
}

export function getBotMode() {
  try {
    const modePaths = [
      './bot_mode.json',
      path.join(process.cwd(), 'bot_mode.json'),
    ];
    for (const p of modePaths) {
      if (fs.existsSync(p)) {
        try {
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (d.mode) {
            switch (d.mode.toLowerCase()) {
              case 'public': return '🌍 Public';
              case 'silent': return '🔇 Silent';
              case 'private': return '🔒 Private';
              case 'group-only': return '👥 Group Only';
              case 'maintenance': return '🛠️ Maintenance';
              default: return `⚙️ ${d.mode.charAt(0).toUpperCase() + d.mode.slice(1)}`;
            }
          }
        } catch {}
      }
    }
    if (global.BOT_MODE) return global.BOT_MODE === 'silent' ? '🔇 Silent' : '🌍 Public';
    if (global.mode) return global.mode === 'silent' ? '🔇 Silent' : '🌍 Public';
    if (process.env.BOT_MODE) return process.env.BOT_MODE === 'silent' ? '🔇 Silent' : '🌍 Public';
  } catch {}
  return '🌍 Public';
}

export function getBotVersion() {
  try {
    if (global.VERSION) return global.VERSION;
    const settingsPaths = [
      './bot_settings.json',
      path.join(process.cwd(), 'bot_settings.json'),
    ];
    for (const p of settingsPaths) {
      if (fs.existsSync(p)) {
        try {
          const s = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (s.version && s.version.trim()) return s.version.trim();
        } catch {}
      }
    }
    if (process.env.VERSION) return process.env.VERSION;
  } catch {}
  return '1.1.5';
}

export function getDeploymentPlatform() {
  if (process.env.HEROKU_APP_NAME || process.env.DYNO || process.env.HEROKU_API_KEY)
    return { name: 'Heroku', icon: '🦸' };
  if (process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_NAME || process.env.RENDER)
    return { name: 'Render', icon: '⚡' };
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_NAME)
    return { name: 'Railway', icon: '🚂' };
  if (process.env.REPL_ID || process.env.REPLIT_DB_URL || process.env.REPLIT_USER || process.env.REPL_SLUG)
    return { name: 'Replit', icon: '🌀' };
  if (process.env.VERCEL || process.env.VERCEL_ENV)
    return { name: 'Vercel', icon: '▲' };
  if (process.env.GLITCH_PROJECT_REMIX || process.env.GLITCH)
    return { name: 'Glitch', icon: '🎏' };
  if (process.env.KOYEB_APP || process.env.KOYEB_REGION)
    return { name: 'Koyeb', icon: '☁️' };
  if (process.env.PANEL || process.env.PTERODACTYL)
    return { name: 'Panel/VPS', icon: '🖥️' };
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT)
    return { name: 'VPS/SSH', icon: '🖥️' };
  if (process.platform === 'win32') return { name: 'Windows PC', icon: '💻' };
  if (process.platform === 'darwin') return { name: 'MacOS', icon: '🍎' };
  if (process.platform === 'linux') return { name: 'Linux', icon: '🐧' };
  return { name: 'Local', icon: '🏠' };
}

export function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function getRAMUsage() {
  try {
    const mem = process.memoryUsage();
    const used = mem.heapUsed / 1024 / 1024;
    const total = mem.heapTotal / 1024 / 1024;
    const percent = Math.round((used / total) * 100);
    const barLength = 10;
    const filled = Math.round((percent / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    return {
      bar, percent,
      usedMB: Math.round(used * 10) / 10,
      totalMB: Math.round(total * 10) / 10
    };
  } catch {
    return { bar: '░░░░░░░░░░', percent: 0, usedMB: 0, totalMB: 0 };
  }
}

export function buildMenuHeader(menuLabel, prefix) {
  const botName = getBotName();
  const ownerName = getOwnerName();
  const botMode = getBotMode();
  const version = getBotVersion();
  const platform = getDeploymentPlatform();
  const uptime = formatUptime(process.uptime());
  const ram = getRAMUsage();
  const pfx = prefix || global.prefix || process.env.PREFIX || '.';

  return `╭─⌈ \`${botName}\` ⌋
┃ Menu: *${menuLabel}*
┃ Owner: ${ownerName}
┃ Mode: ${botMode}
┃ Prefix: [ ${pfx} ]
┃ Version: ${version}
┃ Panel: ${platform.icon} ${platform.name}
┃ Status: Active
┃ Uptime: ${uptime}
┃ RAM: ${ram.bar} ${ram.percent}%
┃ Memory: ${ram.usedMB}MB / ${ram.totalMB}MB
╰─⊷`;
}

export function createFakeContact(message) {
  const botName = getBotName();
  const id = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
  return {
    key: {
      remoteJid: "status@broadcast",
      fromMe: false,
      id: "WOLF-X"
    },
    message: {
      contactMessage: {
        displayName: botName,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${botName}\nitem1.TEL;waid=${id}:${id}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
      }
    },
    participant: "0@s.whatsapp.net"
  };
}

export function createFadedEffect(text) {
  const fadeChars = ['\u200D', '\u200C', '\u2060', '\uFEFF'];
  const initialFade = Array.from({ length: 90 }, (_, i) => fadeChars[i % fadeChars.length]).join('');
  return `${initialFade}${text}`;
}

export function createReadMoreEffect(text1, text2) {
  const invisibleChars = ['\u200E', '\u200F', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'];
  const invisibleString = Array.from({ length: 550 }, (_, i) => invisibleChars[i % invisibleChars.length]).join('');
  return `${text1}${invisibleString}\n${text2}`;
}

export async function sendLoadingMessage(sock, jid, menuName, m) {
  const botName = getBotName();
  const fkontak = createFakeContact(m);
  await sock.sendMessage(jid, {
    text: `⚡ ${botName} ${menuName} loading...`
  }, { quoted: fkontak });
  await new Promise(resolve => setTimeout(resolve, 800));
  return fkontak;
}

export function invalidateMenuHelperCache() {
  _cachedImage = null;
  _cachedGif = null;
  _cachedGifMp4 = null;
  _cachedImageTime = 0;
}

export async function getMenuMedia() {
  const now = Date.now();
  // Custom images (set by .smi) live in data/ so they survive bot updates.
  // Fall back to the git-tracked defaults in commands/menus/media/.
  const dataDir = path.join(process.cwd(), 'data');
  const menusDir = path.join(process.cwd(), 'commands', 'menus', 'media');
  const mediaDir = path.join(process.cwd(), 'commands', 'media');

  const customGif = path.join(dataDir, 'wolfbot_menu_custom.gif');
  const customImg = path.join(dataDir, 'wolfbot_menu_custom.jpg');
  const gifPath1 = path.join(menusDir, 'wolfbot.gif');
  const gifPath2 = path.join(mediaDir, 'wolfbot.gif');
  const imgPath1 = path.join(menusDir, 'wolfbot.jpg');
  const imgPath2 = path.join(mediaDir, 'wolfbot.jpg');

  const gifPath = fs.existsSync(customGif) ? customGif : fs.existsSync(gifPath1) ? gifPath1 : fs.existsSync(gifPath2) ? gifPath2 : null;
  const imgPath = fs.existsSync(customImg) ? customImg : fs.existsSync(imgPath1) ? imgPath1 : fs.existsSync(imgPath2) ? imgPath2 : null;

  if (gifPath) {
    if (!_cachedGif || (now - _cachedImageTime > CACHE_TTL)) {
      try {
        _cachedGif = fs.readFileSync(gifPath);
        _cachedGifMp4 = null;
        _cachedImageTime = now;
        if (!_gifConversionInProgress) {
          _gifConversionInProgress = true;
          const tmpDir = path.join(process.cwd(), 'tmp');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          const tmpMp4 = path.join(tmpDir, 'menu_gif_cached.mp4');
          _execAsync(`ffmpeg -y -i "${gifPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -movflags +faststart -an "${tmpMp4}"`, { timeout: 25000 })
            .then(() => {
              try { _cachedGifMp4 = fs.readFileSync(tmpMp4); } catch {}
              try { fs.unlinkSync(tmpMp4); } catch {}
            })
            .catch(() => {})
            .finally(() => { _gifConversionInProgress = false; });
        }
      } catch {}
    }
    return { type: 'gif', buffer: _cachedGif, mp4Buffer: _cachedGifMp4 };
  }

  if (imgPath) {
    if (!_cachedImage || (now - _cachedImageTime > CACHE_TTL)) {
      try {
        _cachedImage = fs.readFileSync(imgPath);
        _cachedImageTime = now;
      } catch {}
    }
    return { type: 'image', buffer: _cachedImage };
  }

  return null;
}

export async function getMenuImageBuffer() {
  const media = await getMenuMedia();
  if (media) {
    return media;
  }
  try {
    const res = await axios.get(DEFAULT_MENU_IMAGE_URL, { responseType: 'arraybuffer', timeout: 10000 });
    return { type: 'image', buffer: Buffer.from(res.data) };
  } catch {
    return null;
  }
}

export async function sendMenuMessage(sock, jid, headerText, commandsText, m) {
  const fkontak = await sendLoadingMessage(sock, jid, 'menu', m);
  const fadedHeader = createFadedEffect(headerText);
  const botName = getBotName();
  const ownerNameForFooter = getOwnerName();
  const fullText = createReadMoreEffect(fadedHeader, commandsText + `\n\n *POWERED BY ${ownerNameForFooter.toUpperCase()} TECH* `);

  const media = await getMenuImageBuffer();
  if (media) {
    if (media.type === 'gif' && media.mp4Buffer) {
      await sock.sendMessage(jid, { video: media.mp4Buffer, gifPlayback: true, caption: fullText, mimetype: "video/mp4" }, { quoted: fkontak });
    } else {
      await sock.sendMessage(jid, { image: media.buffer, caption: fullText, mimetype: "image/jpeg" }, { quoted: fkontak });
    }
  } else {
    await sock.sendMessage(jid, { text: fullText }, { quoted: fkontak });
  }
}

export async function sendSubMenu(sock, jid, menuLabel, commandsText, m, prefixOrCustomHeader, extraButtons = []) {
  const botName = getBotName();

  let currentStyle = 1;
  try {
    const styleFilePath = path.join(process.cwd(), 'commands', 'menus', 'current_style.json');
    if (fs.existsSync(styleFilePath)) {
      const styleData = JSON.parse(fs.readFileSync(styleFilePath, 'utf8'));
      currentStyle = styleData.current || 1;
    }
  } catch {}

  let useButtons = currentStyle === 8;
  if (!useButtons) {
    try {
      const { isButtonModeEnabled } = await import('./buttonMode.js');
      useButtons = isButtonModeEnabled();
    } catch {}
  }

  if (useButtons) {
    const prefix = (typeof prefixOrCustomHeader === 'string' && !prefixOrCustomHeader.includes('╭'))
      ? prefixOrCustomHeader
      : (global.prefix || process.env.PREFIX || '.');

    let headerText;
    if (typeof prefixOrCustomHeader === 'string' && prefixOrCustomHeader.includes('╭')) {
      headerText = prefixOrCustomHeader;
    } else {
      headerText = buildMenuHeader(menuLabel, prefix);
    }

    const commands = parseCommandsFromText(commandsText);
    const bodyText = `${headerText}\n\n${commandsText}\n\n *POWERED BY ${getOwnerName().toUpperCase()} TECH* `;

    try {
      const { sendInteractiveWithImage } = await import('./buttonHelper.js');
      const interactiveButtons = commands.slice(0, 8).map(cmd => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: `${prefix}${cmd}`,
          id: `${prefix}${cmd}`
        })
      }));

      for (const eb of extraButtons) {
        interactiveButtons.push({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: eb.display_text,
            id: eb.id
          })
        });
      }

      interactiveButtons.push({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: '🏠 Main Menu',
          id: `${prefix}menu`
        })
      });

      const media = await getMenuImageBuffer();
      await sendInteractiveWithImage(sock, jid, {
        bodyText,
        footerText: ` ${botName} | ${menuLabel}`,
        buttons: interactiveButtons,
        imageBuffer: media?.buffer || null,
        mimetype: 'image/jpeg'
      });
      return;
    } catch (err) {
      console.log(`[SubMenu] Interactive with image failed for ${menuLabel}:`, err.message);
    }

    const fkontak = createFakeContact(m);
    try {
      const media = await getMenuImageBuffer();
      if (media) {
        await sock.sendMessage(jid, { image: media.buffer, caption: bodyText, mimetype: "image/jpeg" }, { quoted: fkontak });
      } else {
        await sock.sendMessage(jid, { text: bodyText }, { quoted: fkontak });
      }
    } catch (err) {
      console.log(`[SubMenu] Fallback send failed for ${menuLabel}:`, err.message);
      await sock.sendMessage(jid, { text: bodyText }, { quoted: fkontak });
    }
    return;
  }

  const fkontak = await sendLoadingMessage(sock, jid, menuLabel, m);

  let headerText;
  if (typeof prefixOrCustomHeader === 'string' && prefixOrCustomHeader.includes('╭')) {
    headerText = prefixOrCustomHeader;
  } else {
    const prefix = typeof prefixOrCustomHeader === 'string' ? prefixOrCustomHeader : undefined;
    headerText = buildMenuHeader(menuLabel, prefix);
  }

  const fadedHeader = createFadedEffect(headerText);
  const fullText = createReadMoreEffect(fadedHeader, commandsText + `\n\n *POWERED BY ${getOwnerName().toUpperCase()} TECH* `);

  const media = await getMenuImageBuffer();
  if (media) {
    if (media.type === 'gif' && media.mp4Buffer) {
      await sock.sendMessage(jid, { video: media.mp4Buffer, gifPlayback: true, caption: fullText, mimetype: "video/mp4" }, { quoted: fkontak });
    } else {
      await sock.sendMessage(jid, { image: media.buffer, caption: fullText, mimetype: "image/jpeg" }, { quoted: fkontak });
    }
  } else {
    await sock.sendMessage(jid, { text: fullText }, { quoted: fkontak });
  }
}

function parseCommandsFromText(text) {
  const commands = [];
  const matches = text.matchAll(/•\s*(\S+)/g);
  for (const match of matches) {
    let cmd = match[1].trim();
    cmd = cmd.replace(/[^a-zA-Z0-9_+\-]/g, '');
    if (cmd && cmd.length > 0 && !commands.includes(cmd)) {
      commands.push(cmd);
    }
  }
  return commands;
}
