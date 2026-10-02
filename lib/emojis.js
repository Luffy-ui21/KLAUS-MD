// ══════════════════════════════════════════════════════════════════════════
//  lib/emojis.js
//  Centralised emoji constants used by menus, button menus, status helpers,
//  and group-status commands.
//
//  This file was missing from the upstream WOLFBOT v1.1.5 release on GitHub
//  and was reconstructed from the call sites in:
//    - lib/buttonHelper.js
//    - commands/utility/setcaption.js
//    - commands/group/togroupstatus.js
//  Names follow the upstream convention (CATEGORY.NAME). If a future upstream
//  release ships its own emojis.js, prefer it over this reconstruction.
// ══════════════════════════════════════════════════════════════════════════

export const ANIME = {
  U1F49D: '\u{1F49D}', // 💝 Heart with ribbon (matches Unicode codepoint name)
};

export const BRAND = {
  WOLF: '\u{1F43A}', // 
};

export const ETHICAL = {
  PINGPONG: '\u{1F3D3}', // 🏓
};

export const GAMES = {
  GAMEPAD: '\u{1F3AE}', // 🎮
  TROPHY: '\u{1F3C6}',  // 🏆
};

export const GITHUB = {
  GITHUB: '\u{1F419}', // 🐙
};

export const GROUP = {
  CHART:   '\u{1F4CA}', // 📊
  ERROR:   '\u274C',     // ❌
  EYE:     '\u{1F441}', // 👁
  FILE:    '\u{1F4C4}', // 📄
  IDEA:    '\u{1F4A1}', // 💡
  LOADING: '\u23F3',     // ⏳
  NOTE:    '\u{1F4DD}', // 📝
  PEOPLE:  '\u{1F465}', // 👥
  SUCCESS: '\u2705',    // ✅
  UPLOAD:  '\u{1F4E4}', // 📤
  WARNING: '\u26A0\uFE0F', // ⚠️
};

export const MEDIA = {
  DESIGN: '\u{1F3A8}', // 🎨
  IMAGE:  '\u{1F5BC}\uFE0F', // 🖼️
  MUSIC:  '\u{1F3B5}', // 🎵
  VIDEO:  '\u{1F3AC}', // 🎬
};

export const SOCIAL = {
  BOT:    '\u{1F916}', // 🤖
  CROWN:  '\u{1F451}', // 👑
  SHIELD: '\u{1F6E1}\uFE0F', // 🛡️
};

export const STALKER = {
  STALKER: '\u{1F50D}', // 🔍
};

export const STATUS = {
  SPARKLE: '\u2728',   // ✨
  SUCCESS: '\u2705',   // ✅
};

export const UI = {
  CAMERA:    '\u{1F4F7}', // 📷
  CELEBRATE: '\u{1F389}', // 🎉
  CLIPBOARD: '\u{1F4CB}', // 📋
  DOCUMENT:  '\u{1F4C4}', // 📄
  DOWNLOAD:  '\u{1F4E5}', // 📥
  HOME:      '\u{1F3E0}', // 🏠
  NOTE:      '\u{1F4DD}', // 📝
  REFRESH:   '\u{1F504}', // 🔄
  SETTINGS:  '\u2699\uFE0F', // ⚙️
  TOOL:      '\u{1F6E0}\uFE0F', // 🛠️
};

export default {
  ANIME, BRAND, ETHICAL, GAMES, GITHUB, GROUP, MEDIA, SOCIAL, STALKER, STATUS, UI,
};
