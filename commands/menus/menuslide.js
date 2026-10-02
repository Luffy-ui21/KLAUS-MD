import { createRequire } from 'module';
import { getOwnerName } from '../../lib/menuHelper.js';
import { getBotName } from '../../lib/botname.js';

const _require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = _require('wolfbtns'); } catch {}

const BRAND = () => getOwnerName().toUpperCase();

// ─── Slide definitions (commands stored without prefix) ───────────────────────
const SLIDES = [
  {
    icon: '🤖', title: 'AI & Models',
    cmds: ['chatgpt', 'gemini', 'grok', 'deepseek', 'claude', 'mistral', 'vision', 'summarize', 'aimenu']
  },
  {
    icon: '🎬', title: 'Image & Video Gen',
    cmds: ['imagine', 'flux', 'anime', 'art', 'real', 'remini', 'videogen', 'removebg', 'imagemenu']
  },
  {
    icon: '🎌', title: 'Anime & Fun',
    cmds: ['hug', 'pat', 'kiss', 'waifu', 'neko', 'dance', 'cry', 'slap', 'cuddle', 'hack', 'quote', 'joke', 'funmenu', 'animemenu']
  },
  {
    icon: '⚙️', title: 'Automation',
    cmds: ['autoread', 'autoreact', 'autotyping', 'autoviewstatus', 'autodownloadstatus', 'autoreactstatus', 'autorecording', 'automenu']
  },
  {
    icon: '🎨', title: 'Design & Logos',
    cmds: ['logo', 'firelogo', 'neonlogo', 'goldlogo', 'diamondlogo', 'dragonlogo', 'rainbowlogo', 'brandlogo', 'logomenu']
  },
  {
    icon: '⬇️', title: 'Downloaders',
  },
  {
    icon: '🔐', title: 'Security & Hacking',
    cmds: ['nmap', 'whois', 'dnslookup', 'sslcheck', 'portscan', 'sqlicheck', 'xsscheck', 'leakcheck', 'securitymenu']
  },
  {
    icon: '📸', title: 'Photo Effects',
    cmds: ['neon', 'text3d', 'graffiti', 'hologram', 'metal', 'matrix', 'gradient', 'photofunia', 'ephotomenu']
  },
  {
    icon: '👥', title: 'Group Management',
    cmds: ['antilink', 'welcome', 'joinapproval', 'onlyadmins', 'kick', 'ban', 'tagall', 'mute', 'promote', 'demote', 'disp', 'groupmenu']
  },
  {
    icon: '🎵', title: 'Music & Media',
    cmds: ['play', 'song', 'lyrics', 'shazam', 'tosticker', 'toaudio', 'tts', 'trim', 'musicmenu']
  },
  {
    icon: '🗞️', title: 'News & Sports',
    cmds: ['bbcnews', 'technews', 'football', 'cricket', 'basketball', 'f1', 'tennis', 'sportsnews', 'sportsmenu']
  },
  {
    icon: '🕵️', title: 'Stalker & Tools',
  },
  {
    icon: '👑', title: 'Owner & Admin',
    cmds: ['restart', 'reload', 'setbotname', 'setprefix', 'addsudo', 'block', 'anticall', 'mode', 'ownermenu']
  }
];

const TOTAL = SLIDES.length;

// ─── Build text for one slide ─────────────────────────────────────────────────
function buildSlideText(index, botName, prefix) {
  const slide = SLIDES[index];
  const lines = [
    `╭─⌈ ${slide.icon} *${slide.title.toUpperCase()}* ⌋`,
    ...slide.cmds.map(cmd => `│ • ${prefix}${cmd}`),
    `├── Slide *${index + 1}/${TOTAL}*`,
    `╰⊷ *${botName}*`
  ];
  return lines.join('\n');
}

// ─── Build navigation buttons ─────────────────────────────────────────────────
function buildButtons(index, prefix) {
  const buttons = [];

  if (index > 0) {
    buttons.push({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: `◀ ${SLIDES[index - 1].icon} ${SLIDES[index - 1].title}`,
        id: `${prefix}menuslide ${index}`
      })
    });
  }

  if (index < TOTAL - 1) {
    buttons.push({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: `${SLIDES[index + 1].icon} ${SLIDES[index + 1].title} ▶`,
        id: `${prefix}menuslide ${index + 2}`
      })
    });
  }

  buttons.push({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: index === 0 ? '📋 All Categories' : '🏠 First Slide',
      id: index === 0 ? `${prefix}menuslide ${TOTAL}` : `${prefix}menuslide 1`
    })
  });

  return buttons;
}

// ─── Command export ───────────────────────────────────────────────────────────
export default {
  name: 'menuslide',
  alias: ['slidemenu', 'cmds'],
  description: `Browse all ${TOTAL} command categories as interactive slides. Usage: <prefix>menuslide [1-${TOTAL}]`,

  async execute(sock, msg, args) {
    const chatId  = msg.key.remoteJid;
    const prefix  = global.prefix || process.env.PREFIX || '.';
    const botName = getBotName() || BRAND();

    let slideIndex = 0;
    if (args[0]) {
      const n = parseInt(args[0], 10);
      if (!isNaN(n) && n >= 1 && n <= TOTAL) slideIndex = n - 1;
    }

    const text    = buildSlideText(slideIndex, botName, prefix);
    const buttons = buildButtons(slideIndex, prefix);
    const footer  = ` ${botName} • ${TOTAL} categories`;

    if (giftedBtns) {
      try {
        return await giftedBtns.sendInteractiveMessage(sock, chatId, {
          text,
          footer,
          interactiveButtons: buttons
        });
      } catch {}
    }

    // Fallback: plain text with navigation hint
    const navHint = [
      slideIndex > 0         ? `◀ *${prefix}menuslide ${slideIndex}*` : null,
      slideIndex < TOTAL - 1 ? `▶ *${prefix}menuslide ${slideIndex + 2}*` : null,
    ].filter(Boolean).join('   ');

    return sock.sendMessage(chatId, {
      text: text + (navHint ? `\n\n${navHint}` : '')
    }, { quoted: msg });
  }
};
