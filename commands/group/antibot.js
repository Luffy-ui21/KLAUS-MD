import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const BRAND = () => getOwnerName().toUpperCase();

// ─── Bot detection ────────────────────────────────────────────────────────────
// These are the key signals that reliably identify automated/bot messages.

// Known automated/bot library message-ID prefixes (uppercase hex)
//   BAE5 — Baileys
//   B24E — Baileys variant / forks
//   3F   — older bot frameworks
//   F2   — some custom forks
// 3EB0 = WhatsApp Web (real humans) — only flagged if length is wrong
const BOT_KEY_PREFIXES = ['BAE5', 'B24E', '3F00', '3F0', 'F20', 'BB0', 'BAH'];

// Real WA Web ID = exactly 32 chars uppercase hex.
// Real mobile native ID = 16-22 chars uppercase hex/alphanumeric.
// Anything containing lowercase, or non-hex chars (apart from `_-:`),
// or a bizarre length is a strong bot signal.
const VALID_ID_RE = /^[0-9A-F]+$/;

// Message types that are never bot content — always skip these
const SKIP_MSG_TYPES = [
  'reactionMessage',
  'protocolMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'ephemeralMessage',
  'pollUpdateMessage',
];

function looksLikeBotId(id) {
  if (!id) return false;

  // 1. Known bot framework prefixes
  if (BOT_KEY_PREFIXES.some(p => id.startsWith(p))) return true;

  // 2. WA messages are always uppercase hex. Lowercase letters → bot.
  if (/[a-z]/.test(id)) return true;

  // 3. Real WA IDs use only [0-9A-F]. Underscores, dashes, etc → bot.
  //    Exception: WA Business Cloud API uses "wamid." prefix — those go through
  //    the official channel and never appear via Baileys connections, so we don't
  //    have to worry about false-positives here.
  if (!VALID_ID_RE.test(id)) return true;

  // 4. Length sanity: real WA IDs are 16, 20, 22, or 32 chars.
  //    Short IDs (< 16) are almost always from janky bot libraries.
  if (id.length < 16) return true;

  return false;
}

export function isBotMessage(msg) {
  const m = msg?.message;
  if (!m) return false;

  // Skip reactions, protocol and other system message types
  if (SKIP_MSG_TYPES.some(t => m[t] !== undefined)) return false;

  // 1. Suspicious message ID
  const id = msg?.key?.id || '';
  if (looksLikeBotId(id)) return true;

  // 2. Interactive message types only bots/apps send
  if (m.buttonsMessage)             return true;
  if (m.listMessage)                return true;
  if (m.templateMessage)            return true;
  if (m.interactiveMessage)         return true;
  if (m.botInvokeMessage)           return true;
  if (m.interactiveResponseMessage) return true;
  if (m.templateButtonReplyMessage) return true;
  if (m.buttonsResponseMessage)     return true;
  if (m.listResponseMessage)        return true;

  // 3. Newsletter / channel forwards are commonly bot-driven spam vectors
  //    (real users rarely forward channel posts into groups)
  const ctx = m.extendedTextMessage?.contextInfo
           || m.imageMessage?.contextInfo
           || m.videoMessage?.contextInfo
           || m.documentMessage?.contextInfo;

  // 4. Very high forwarding score (automated chain messages)
  const fwdScore = ctx?.forwardingScore || 0;
  if (fwdScore >= 5) return true;   // tightened: real chain-forwards rarely exceed 4

  // 5. forwardedNewsletterMessageInfo — channel-forward spam from bots
  if (ctx?.forwardedNewsletterMessageInfo) return true;

  // 6. externalAdReply with sourceUrl — bots often inject these for ads/spam
  if (ctx?.externalAdReply?.sourceUrl) return true;

  return false;
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function loadConfig() {
  if (typeof globalThis._antibotConfig === 'object' && globalThis._antibotConfig !== null) {
    return globalThis._antibotConfig;
  }
  return {};
}

function saveConfig(data) {
  globalThis._antibotConfig = data;
  if (typeof globalThis._saveAntibotConfig === 'function') {
    globalThis._saveAntibotConfig(data);
  }
}

export function isEnabled(chatJid) {
  const config = loadConfig();
  return config[chatJid]?.enabled === true;
}

export function getMode(chatJid) {
  const config = loadConfig();
  return config[chatJid]?.mode || 'delete';
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
  name: 'antibot',
  alias: ['antibots', 'nobot', 'botguard'],
  description: 'Block bot messages in groups. Modes: warn / delete / kick',
  category: 'group',

  isBotMessage,
  isEnabled,
  getMode,

  async execute(sock, msg, args, PREFIX, extra) {
    const chatId = msg.key.remoteJid;

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups.'
      }, { quoted: msg });
    }

    let groupMeta;
    try {
      groupMeta = await sock.groupMetadata(chatId);
    } catch {
      return sock.sendMessage(chatId, { text: '❌ Failed to fetch group info.' }, { quoted: msg });
    }

    const senderJid   = msg.key.participant || chatId;
    const senderClean = senderJid.split(':')[0].split('@')[0];
    const senderP     = groupMeta.participants.find(
      p => p.id.split(':')[0].split('@')[0] === senderClean
    );
    const isAdmin = senderP?.admin === 'admin' || senderP?.admin === 'superadmin';
    const isOwner = typeof extra?.isOwner === 'function' ? extra.isOwner() : !!extra?.isOwner;
    const isSudo  = typeof extra?.isSudo  === 'function' ? extra.isSudo()  : !!extra?.isSudo;

    if (!isAdmin && !isOwner && !isSudo) {
      return sock.sendMessage(chatId, {
        text: '❌ Only group admins can change anti-bot settings.'
      }, { quoted: msg });
    }

    const config = loadConfig();
    const gc     = config[chatId] || {};
    const sub    = (args[0] || '').toLowerCase();
    const modeArg = (args[1] || '').toLowerCase();

    // ── Status / no arg ──────────────────────────────────────────────────────
    if (!sub || sub === 'status') {
      const enabled    = gc.enabled === true;
      const mode       = gc.mode || 'delete';
      const statusIcon = enabled ? `✅ ON [${mode.toUpperCase()}]` : '❌ OFF';
      return sock.sendMessage(chatId, {
        text:
          `╭─⌈ 🤖 *ANTI-BOT* ⌋\n` +
          `├─⊷ *Status:* ${statusIcon}\n` +
          `│\n` +
          `├─⊷ *${PREFIX}antibot on warn*\n` +
          `│  └⊷ Warn sender & delete msg\n` +
          `├─⊷ *${PREFIX}antibot on delete*\n` +
          `│  └⊷ Silently delete bot msgs\n` +
          `├─⊷ *${PREFIX}antibot on kick*\n` +
          `│  └⊷ Delete msg & kick sender\n` +
          `├─⊷ *${PREFIX}antibot off*\n` +
          `│  └⊷ Disable protection\n` +
          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
    }

    // ── Enable ───────────────────────────────────────────────────────────────
    if (sub === 'on') {
      const validModes = ['warn', 'delete', 'kick'];
      const mode = validModes.includes(modeArg) ? modeArg : 'delete';

      config[chatId] = { ...gc, enabled: true, mode };
      saveConfig(config);

      return sock.sendMessage(chatId, {
        text:
          `╭─⌈ 🤖 *ANTI-BOT ENABLED* ⌋\n` +
          `├─⊷ *Mode:* ${mode.toUpperCase()}\n` +
          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
    }

    // ── Disable ──────────────────────────────────────────────────────────────
    if (sub === 'off') {
      config[chatId] = { ...gc, enabled: false };
      saveConfig(config);
      return sock.sendMessage(chatId, {
        text: `╭─⌈ 🤖 *ANTI-BOT DISABLED* ⌋\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text:
        `╭─⌈ 🤖 *ANTI-BOT* ⌋\n` +
        `│\n` +
        `├─⊷ *${PREFIX}antibot on warn*\n` +
        `│  └⊷ Warn sender & delete msg\n` +
        `├─⊷ *${PREFIX}antibot on delete*\n` +
        `│  └⊷ Silently delete bot msgs\n` +
        `├─⊷ *${PREFIX}antibot on kick*\n` +
        `│  └⊷ Delete msg & kick sender\n` +
        `├─⊷ *${PREFIX}antibot off*\n` +
        `│  └⊷ Disable protection\n` +
        `├─⊷ *${PREFIX}antibot status*\n` +
        `│  └⊷ View current settings\n` +
        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
    }, { quoted: msg });
  }
};

