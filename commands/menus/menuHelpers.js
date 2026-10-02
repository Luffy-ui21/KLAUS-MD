import os from "os";
import { getPlatformInfo } from '../../lib/platformDetect.js';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBotName } from '../../lib/botname.js';

export { getBotName };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getBotMode = () => {
  try {
    const possiblePaths = [
      './bot_mode.json',
      path.join(__dirname, 'bot_mode.json'),
      path.join(__dirname, '../bot_mode.json'),
      path.join(__dirname, '../../bot_mode.json'),
      path.join(__dirname, '../../../bot_mode.json'),
      path.join(__dirname, '../commands/owner/bot_mode.json'),
    ];

    for (const modePath of possiblePaths) {
      if (fs.existsSync(modePath)) {
        try {
          const modeData = JSON.parse(fs.readFileSync(modePath, 'utf8'));

          if (modeData.mode) {
            let displayMode;
            switch(modeData.mode.toLowerCase()) {
              case 'public':
                displayMode = '🌍 Public';
                break;
              case 'silent':
                displayMode = '🔇 Silent';
                break;
              case 'private':
                displayMode = '🔒 Private';
                break;
              case 'group-only':
                displayMode = '👥 Group Only';
                break;
              case 'maintenance':
                displayMode = '🛠️ Maintenance';
                break;
              default:
                displayMode = `⚙️ ${modeData.mode.charAt(0).toUpperCase() + modeData.mode.slice(1)}`;
            }
            return displayMode;
          }
        } catch (parseError) {}
      }
    }

    if (global.BOT_MODE) {
      return global.BOT_MODE === 'silent' ? '🔇 Silent' : '🌍 Public';
    }
    if (global.mode) {
      return global.mode === 'silent' ? '🔇 Silent' : '🌍 Public';
    }
    if (process.env.BOT_MODE) {
      return process.env.BOT_MODE === 'silent' ? '🔇 Silent' : '🌍 Public';
    }

  } catch (error) {}

  return '🌍 Public';
};

export const getOwnerName = () => {
  try {
    const botSettingsPaths = [
      './bot_settings.json',
      path.join(__dirname, 'bot_settings.json'),
      path.join(__dirname, '../bot_settings.json'),
      path.join(__dirname, '../../bot_settings.json'),
    ];

    for (const settingsPath of botSettingsPaths) {
      if (fs.existsSync(settingsPath)) {
        try {
          const settingsData = fs.readFileSync(settingsPath, 'utf8');
          const settings = JSON.parse(settingsData);

          if (settings.ownerName && settings.ownerName.trim() !== '') {
            return settings.ownerName.trim();
          }
        } catch (parseError) {}
      }
    }

    const ownerPath = path.join(__dirname, 'owner.json');
    if (fs.existsSync(ownerPath)) {
      const ownerData = fs.readFileSync(ownerPath, 'utf8');
      const ownerInfo = JSON.parse(ownerData);

      if (ownerInfo.owner && ownerInfo.owner.trim() !== '') {
        return ownerInfo.owner.trim();
      } else if (ownerInfo.number && ownerInfo.number.trim() !== '') {
        return ownerInfo.number.trim();
      } else if (ownerInfo.phone && ownerInfo.phone.trim() !== '') {
        return ownerInfo.phone.trim();
      } else if (ownerInfo.contact && ownerInfo.contact.trim() !== '') {
        return ownerInfo.contact.trim();
      } else if (Array.isArray(ownerInfo) && ownerInfo.length > 0) {
        const owner = typeof ownerInfo[0] === 'string' ? ownerInfo[0] : "Unknown";
        return owner;
      }
    }

    if (global.OWNER_NAME) {
      return global.OWNER_NAME;
    }
    if (global.owner) {
      return global.owner;
    }
    if (process.env.OWNER_NUMBER) {
      return process.env.OWNER_NUMBER;
    }

  } catch (error) {}

  return 'Unknown';
};

export const getBotPrefix = () => {
  try {
    const botSettingsPaths = [
      './bot_settings.json',
      path.join(__dirname, 'bot_settings.json'),
      path.join(__dirname, '../bot_settings.json'),
      path.join(__dirname, '../../bot_settings.json'),
    ];

    for (const settingsPath of botSettingsPaths) {
      if (fs.existsSync(settingsPath)) {
        try {
          const settingsData = fs.readFileSync(settingsPath, 'utf8');
          const settings = JSON.parse(settingsData);

          if (settings.prefix && settings.prefix.trim() !== '') {
            return settings.prefix.trim();
          }
        } catch (parseError) {}
      }
    }

    if (global.prefix) {
      return global.prefix;
    }

    if (process.env.PREFIX) {
      return process.env.PREFIX;
    }

  } catch (error) {}

  return '.';
};

export const getBotVersion = () => {
  try {
    const ownerPath = path.join(__dirname, 'owner.json');
    if (fs.existsSync(ownerPath)) {
      const ownerData = fs.readFileSync(ownerPath, 'utf8');
      const ownerInfo = JSON.parse(ownerData);

      if (ownerInfo.version && ownerInfo.version.trim() !== '') {
        return ownerInfo.version.trim();
      }
    }

    const botSettingsPaths = [
      './bot_settings.json',
      path.join(__dirname, 'bot_settings.json'),
      path.join(__dirname, '../bot_settings.json'),
    ];

    for (const settingsPath of botSettingsPaths) {
      if (fs.existsSync(settingsPath)) {
        try {
          const settingsData = fs.readFileSync(settingsPath, 'utf8');
          const settings = JSON.parse(settingsData);

          if (settings.version && settings.version.trim() !== '') {
            return settings.version.trim();
          }
        } catch (parseError) {}
      }
    }

    if (global.VERSION) {
      return global.VERSION;
    }

    if (global.version) {
      return global.version;
    }

    if (process.env.VERSION) {
      return process.env.VERSION;
    }

  } catch (error) {}

  return 'v1.0.0';
};

export const getDeploymentPlatform = () => getPlatformInfo();


export const formatUptime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

export const getRAMUsage = () => {
  try {
    const mem = process.memoryUsage();
    const used = mem.heapUsed / 1024 / 1024;
    const total = mem.heapTotal / 1024 / 1024;
    const percent = Math.round((used / total) * 100);

    const barLength = 10;
    const filledBars = Math.round((percent / 100) * barLength);
    const emptyBars = barLength - filledBars;

    const barStyle = '█';
    const emptyStyle = '░';

    const memBar = barStyle.repeat(filledBars) + emptyStyle.repeat(emptyBars);

    return {
      bar: memBar,
      percent: percent,
      usedMB: Math.round(used * 100) / 100,
      totalMB: Math.round(total * 100) / 100
    };
  } catch (error) {
    return {
      bar: '░░░░░░░░░░',
      percent: 0,
      usedMB: 0,
      totalMB: 0
    };
  }
};

export const createFadedEffect = (text) => {
  const fadeChars = [
    '\u200D',
    '\u200C',
    '\u2060',
    '\uFEFF',
  ];

  const initialFade = Array.from({ length: 90 }, 
    (_, i) => fadeChars[i % fadeChars.length]
  ).join('');

  return `${initialFade}${text}`;
};

export const createReadMoreEffect = (text1, text2) => {
  const invisibleChars = [
    '\u200E',
    '\u200F',
    '\u200B',
    '\u200C',
    '\u200D',
    '\u2060',
    '\uFEFF',
    '\u180E',
    '\u202A',
    '\u202B',
    '\u202C',
    '\u202D',
    '\u202E',
  ];

  const invisibleString = Array.from({ length: 680 }, 
    (_, i) => invisibleChars[i % invisibleChars.length]
  ).join('');

  return `${text1}${invisibleString}\n\n${text2}`;
};

export const createFakeContact = (message) => {
  const jid = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
  return {
    key: {
      remoteJid: "status@broadcast",
      fromMe: false,
      id: "WOLF-X"
    },
    message: {
      contactMessage: {
        displayName: getBotName(),
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${getBotName()}\nitem1.TEL;waid=${jid}:${jid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
      }
    },
    participant: "0@s.whatsapp.net"
  };
};
