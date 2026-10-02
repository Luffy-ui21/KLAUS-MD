// ====== commands/ai/chatbot.js ======
// W.O.L.F Chatbot — a public-facing AI assistant for group chats and DMs.
//
// Unlike Wolf AI (lib/wolfai.js) which is a private JARVIS for the owner,
// the chatbot is designed for regular users.  It responds to free-form text
// in groups and DMs when chatbot mode is active.
//
// Features:
//   • Multi-turn conversation memory (last 20 messages, 1-hour expiry)
//   • Intent detection — recognises requests like "play a song", "make an image"
//     and executes the corresponding bot command
//   • Pending action flow — if the user says "play something" without specifying
//     a song, the bot asks what they want and waits for the follow-up
//   • Automatic fallback through 7 AI models in priority order
//   • Full identity scrubbing (GPT, Claude, etc. → chatbot name)
//
// Config stored in data/chatbot/chatbot_config_<botId>.json:
//   mode           — off | on | groups | dms | both
//   preferredModel — which AI model to try first
//   chatbotName    — the chatbot's display name (default: "W.O.L.F")
//   techName       — the company/creator name shown in AI identity (default: "WOLF TECH")
//   allowedGroups  — whitelist of group JIDs (if set, only these groups)
//   allowedDMs     — whitelist of DM numbers (if set, only these contacts)
//   stats          — running counters for total queries and media actions
//
// Conversations stored in data/chatbot/conversations/<botId>/<userId>.json
// (one file per WhatsApp JID, trimmed to last 20 messages).

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { normalizeMessageContent, jidNormalizedUser, downloadMediaMessage } from 'wolfsocket';
import supabase from '../../lib/database.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { getPhoneFromLid } from '../../lib/sudo-store.js';
import {
  AI_MODELS,
  MODEL_PRIORITY,
  extractXWolfResponse,
  getAIQuerySources,
  getModelList
} from '../../lib/aiModels.js';
import { vision as nvidiaVision, image as nvidiaImage } from '../../lib/nvidia.js';
import {
  loadProfile, saveProfile, learnFromMessage, buildProfileContext, getPersonalizedGreeting
} from '../../lib/userProfile.js';
import { resolveJid } from '../tools/getjid.js';

// ── Data directory paths ───────────────────────────────────────────────────
const DATA_DIR         = './data/chatbot';
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');

// ── listgroups reply-with-number cache ────────────────────────────────────
// Maps sent message ID → sorted array of { gid, name } so that when the
// owner replies to a listgroups message with a plain number we can look up
// the group and show its JID with a copy button.
// Exposed on globalThis so index.js can route plain-number replies here
// the same way it routes plain-number replies to mygroups.
const _lgCache = new Map();
globalThis._chatbotGroupListCache = _lgCache;
const _LG_MAX  = 30;

// ── Per-group user-filter helpers ─────────────────────────────────────────
// Resolves all @mentions (including LIDs) + plain numbers from args to proper
// phone-number JIDs (e.g. 254712345678@s.whatsapp.net).
// args[0] is the sub-command so number parsing starts at args[1].
async function _extractTargetUsers(sock, m, args) {
  const chatJid = m.key.remoteJid;
  const users = new Set();
  const mentions = (m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])
    .filter(j => j && !j.includes('status'));

  if (mentions.length > 0) {
    // Prefer @mention JIDs — resolve any LIDs to real phone JIDs.
    // Do NOT also parse numbers from args: the args text already contains
    // the phone-number representation of the same mention (e.g. @36817063669874),
    // which would cause a duplicate entry.
    for (const jid of mentions) {
      try {
        const resolved = await resolveJid(sock, jid, chatJid);
        users.add(resolved);
      } catch { users.add(jid); }
    }
  } else {
    // No @mentions — fall back to parsing plain phone numbers from args.
    // args[0] is the sub-command so start at args[1].
    for (let i = 1; i < args.length; i++) {
      const num = String(args[i]).replace(/[^0-9]/g, '');
      if (num.length >= 7) users.add(`${num}@s.whatsapp.net`);
    }
  }
  return [...users];
}

// Returns false when the sender is blocked by the per-group user filter.
// senderJid should already be a resolved phone-number JID when possible.
function _checkGroupUserFilter(config, groupJid, senderJid) {
  const filter = (config.groupUserFilters || {})[groupJid];
  if (!filter || !filter.users || filter.users.length === 0) return true; // no filter
  const senderNum = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  const inList = filter.users.some(u => {
    const uNum = u.split('@')[0].split(':')[0].replace(/\D/g, '');
    return uNum === senderNum;
  });
  if (filter.mode === 'allow') return inList;   // allow-only: must be in list
  if (filter.mode === 'block') return !inList;  // block-list: must NOT be in list
  return true;
}

// ── Bot ID helpers ─────────────────────────────────────────────────────────
// Each bot number gets its own config and conversation directory so two bot
// numbers on the same host don't share state.

function getBotId() {
  // Try the database-stored ID first
  const dbId = supabase.getConfigBotId ? supabase.getConfigBotId() : 'default';
  if (dbId && dbId !== 'default') {
    const candidate = path.join(DATA_DIR, `chatbot_config_${dbId}.json`);
    if (fs.existsSync(candidate)) return dbId;
  }
  // Fallback: use the owner's phone number from globals (covers LID-vs-phone mismatch)
  const ownerNum = (global.OWNER_CLEAN_NUMBER || global.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
  if (ownerNum) {
    const candidate = path.join(DATA_DIR, `chatbot_config_${ownerNum}.json`);
    if (fs.existsSync(candidate)) return ownerNum;
  }
  // Last resort: scan data/chatbot/ for any existing config file
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('chatbot_config_') && f.endsWith('.json'));
    if (files.length > 0) {
      const match = files[0].replace('chatbot_config_', '').replace('.json', '');
      return match;
    }
  } catch {}
  return ownerNum || dbId || 'default';
}

// Return the path to the config JSON file for this bot instance.
function getConfigFile() {
  const botId = getBotId();
  return path.join(DATA_DIR, `chatbot_config_${botId}.json`);
}

// Return the path to the per-bot conversations directory.
function getConversationsDir() {
  const botId = getBotId();
  return path.join(DATA_DIR, 'conversations', botId);
}

// ── Pending actions ────────────────────────────────────────────────────────
// When the chatbot detects a vague intent (e.g. "play something") it asks
// a clarifying question and waits for the next message from the same sender.
// pendingActions maps "senderJid::chatId" → { type, command, timestamp }.
// Actions expire after 2 minutes to avoid stale state.
const pendingActions   = new Map();
const PENDING_TIMEOUT  = 120000; // 2 minutes

// ══════════════════════════════════════════════════════════════════════════
// SECTION 1 — AI model registry
// ══════════════════════════════════════════════════════════════════════════
// All 37 models are defined in lib/aiModels.js and imported above.
// AI_MODELS, MODEL_PRIORITY, buildTextUrl, buildVisionUrl, extractXWolfResponse
// are all available from that import — no Pollinations dependency needed.

// ══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Intent detection
// ══════════════════════════════════════════════════════════════════════════
// Before sending a message to the AI, the chatbot tries to detect whether
// the user wants a specific media action (generate image, play song, etc.).
// If an action is detected, the bot executes the corresponding command
// instead of (or in addition to) replying with text.

// Emoji reactions sent while the media command is running (visual feedback)
const MEDIA_REACTIONS = {
  imagine: '🎨',
  play:    '🎵',
  video:   '🎬',
  song:    '🎶'
};

// Prompts sent when the user's request is too vague (no specific target given)
const MEDIA_PROMPTS = {
  image:     { ask: `Sure! Describe the image you'd like me to generate 🎨`,        confirm: `Got it! Let me create that for you... 🎨`      },
  playAudio: { ask: `Of course! What song or music would you like me to play? 🎵`,  confirm: `Great choice! Let me find that for you... 🎵`   },
  playVideo: { ask: `Sure thing! What video would you like me to find? 🎬`,          confirm: `On it! Finding that video for you... 🎬`        },
  song:      { ask: `Sure! Which song would you like me to download? 🎶`,            confirm: `Alright! Downloading that for you... 🎶`         }
};

// INTENT_PATTERNS — one entry per action type.
// Each entry has:
//   vaguePatterns   — regex list matching requests without a specific target
//                     ("generate an image" — needs a follow-up question)
//   specificPatterns — regex list matching requests with a clear target
//                     ("generate an image of a sunset" — execute immediately)
//   extractQuery    — function that strips filler words from the matched text
//                     to produce a clean search query
//   command         — the bot command name to execute
const INTENT_PATTERNS = {
  image: {
    vaguePatterns: [
      /^(?:can you |could you |wolf,?\s+)?(?:generate|create|make|draw|design|paint|sketch)\s+(?:an?\s+)?(?:image|picture|photo|art|artwork|illustration|pic|img|drawing|painting)\s*\??$/i,
      /^(?:can you |could you |wolf,?\s+)?(?:generate|create|make|draw|design)\s+(?:for me|something|an image|a picture)\s*\??$/i,
      /^(?:i want|i need|i'd like)\s+(?:an?\s+)?(?:image|picture|photo|art|drawing)\s*\.?$/i,
      /^(?:generate|create|make|draw)\s+(?:an?\s+)?(?:image|picture|photo)\s*\??$/i
    ],
    specificPatterns: [
      /^(?:generate|create|make|draw|design|paint|sketch)\s+(?:an?\s+)?(?:image|picture|photo|art|artwork|illustration|pic|img|drawing|painting)\s+(?:of|about|for|with|showing)\s+.{3,}/i,
      /^(?:generate|create|make|draw|design|paint|sketch)\s+(?:me\s+)?(?:an?\s+)?.{5,}/i,
      /(?:image|picture|photo|art|drawing|painting)\s+(?:of|about|for|with)\s+.{3,}/i,
      /^imagine\s+.{3,}/i,
      /^(?:can you |please |wolf,?\s+)?(?:generate|create|make|draw|design)\s+(?:an?\s+)?(?:image|picture|photo)\s+(?:of|about|for|with|showing)\s+.{3,}/i
    ],
    extractQuery: (text) => {
      let query = text;
      query = query.replace(/^(?:can you |could you |please |wolf,?\s+)?(?:generate|create|make|draw|design|paint|sketch)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|art|artwork|illustration|pic|img|drawing|painting)\s*(?:of|about|for|with|showing)?\s*/i, '');
      query = query.replace(/^imagine\s+/i, '');
      query = query.replace(/^(?:can you |could you |please |wolf,?\s+)?(?:generate|create|make|draw|design|paint|sketch)\s+(?:me\s+)?(?:an?\s+)?/i, '');
      return query.trim();
    },
    command: 'imagine'
  },
  playAudio: {
    vaguePatterns: [
      /^(?:can you |could you |wolf,?\s+)?(?:play|sing|find)\s+(?:a\s+)?(?:song|music|something|audio)\s*\??$/i,
      /^(?:play|sing)\s+(?:me\s+)?(?:something|a song|music)\s*\??$/i,
      /^(?:i want to (?:hear|listen to)|let me hear)\s+(?:a\s+)?(?:song|music|something)\s*\??$/i
    ],
    specificPatterns: [
      /^(?:play|sing|find me|put on|listen to)\s+(?:the\s+)?(?:song\s+)?(?!(?:a\s+)?(?:song|music|something|audio)\s*\??$).{3,}/i,
      /^(?:can you |please |wolf,?\s+)?(?:play|sing|find me|put on)\s+(?!(?:a\s+)?(?:song|music|something)\s*\??$).{3,}/i,
      /^(?:play|download)\s+(?:me\s+)?(?:the\s+)?(?:song|music|audio|mp3)\s+.{3,}/i,
      /^(?:i want to (?:hear|listen)|let me hear|play me)\s+.{3,}/i
    ],
    extractQuery: (text) => {
      let query = text;
      query = query.replace(/^(?:can you |could you |please |wolf,?\s+)?(?:play|sing|find me|put on|listen to|download)\s+(?:me\s+)?(?:the\s+)?(?:song|music|track|audio|mp3)?\s*/i, '');
      query = query.replace(/^(?:i want to (?:hear|listen)|let me hear|play me)\s+/i, '');
      query = query.replace(/\s+(?:on youtube|from youtube|for me|please)$/i, '');
      return query.trim();
    },
    command: 'play'
  },
  playVideo: {
    vaguePatterns: [
      /^(?:can you |could you |wolf,?\s+)?(?:play|download|get|find|show)\s+(?:a\s+)?(?:video|vid|clip)\s*\??$/i,
      /^(?:i want to (?:watch|see)|let me (?:watch|see)|show me)\s+(?:a\s+)?(?:video|something)\s*\??$/i
    ],
    specificPatterns: [
      /^(?:play|download|get|find|show)\s+(?:the\s+)?(?:video|vid|clip|movie)\s+(?:of|about|for)?\s*.{3,}/i,
      /^(?:play|download|get|find|show)\s+(?:me\s+)?(?:the\s+)?video\s+.{3,}/i,
      /^(?:can you |please |wolf,?\s+)?(?:play|download|get|show)\s+(?:the\s+)?(?:video|vid)\s+.{3,}/i,
      /^(?:i want to (?:watch|see)|let me (?:watch|see)|show me)\s+.{3,}/i,
      /^(?:play|download)\s+.{3,}\s+video$/i
    ],
    extractQuery: (text) => {
      let query = text;
      query = query.replace(/^(?:can you |could you |please |wolf,?\s+)?(?:play|download|get|find|show)\s+(?:me\s+)?(?:the\s+)?(?:video|vid|clip|movie)\s*(?:of|about|for)?\s*/i, '');
      query = query.replace(/^(?:i want to (?:watch|see)|let me (?:watch|see)|show me)\s+/i, '');
      query = query.replace(/\s+(?:video|vid|clip)$/i, '');
      query = query.replace(/\s+(?:on youtube|from youtube|for me|please)$/i, '');
      return query.trim();
    },
    command: 'video'
  },
  song: {
    vaguePatterns: [
      /^(?:can you |could you |wolf,?\s+)?(?:download|get|send|give)\s+(?:me\s+)?(?:a\s+)?(?:song|music|audio)\s*\??$/i
    ],
    specificPatterns: [
      /^(?:download|get)\s+(?:the\s+)?(?:song|music|audio|mp3)\s+.{3,}/i,
      /^(?:send|give)\s+(?:me\s+)?(?:the\s+)?(?:song|music|audio)\s+.{3,}/i
    ],
    extractQuery: (text) => {
      let query = text;
      query = query.replace(/^(?:download|get|send|give)\s+(?:me\s+)?(?:the\s+)?(?:song|music|audio|mp3)\s*/i, '');
      query = query.replace(/\s+(?:for me|please)$/i, '');
      return query.trim();
    },
    command: 'song'
  }
};

// Try to detect a media action intent from a free-form text message.
// Returns { type, command, query, vague } or null.
// `vague` is true when the request is missing a specific target.
function detectIntent(text) {
  const trimmed = text.trim();
  if (trimmed.length < 4) return null;

  for (const [intentKey, intent] of Object.entries(INTENT_PATTERNS)) {
    // Skip playAudio if the message already looks like a video request
    if (intentKey === 'playAudio') {
      const isVideo = INTENT_PATTERNS.playVideo.vaguePatterns.some(p => p.test(trimmed)) ||
                      INTENT_PATTERNS.playVideo.specificPatterns.some(p => p.test(trimmed));
      if (isVideo) continue;
    }

    // Vague patterns match first — these trigger the clarifying question flow
    for (const pattern of intent.vaguePatterns) {
      if (pattern.test(trimmed)) {
        return { type: intentKey, command: intent.command, query: '', vague: true };
      }
    }

    // Specific patterns match when a query target is present — execute immediately
    for (const pattern of intent.specificPatterns) {
      if (pattern.test(trimmed)) {
        const query = intent.extractQuery(trimmed);
        if (query && query.length >= 2) {
          return { type: intentKey, command: intent.command, query, vague: false };
        }
      }
    }
  }

  return null; // no media intent detected — treat as a regular AI chat message
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Pending action management
// ══════════════════════════════════════════════════════════════════════════

// Composite key so two different senders in the same group don't share state
function pendingKey(senderJid, chatId) {
  return `${senderJid}::${chatId}`;
}

// Record a pending clarification action.  Auto-expires after PENDING_TIMEOUT ms.
function setPendingAction(senderJid, chatId, actionType, command) {
  const key = pendingKey(senderJid, chatId);
  pendingActions.set(key, { type: actionType, command, timestamp: Date.now() });
  // Self-cleaning timer to prevent stale entries in the Map
  setTimeout(() => {
    const pending = pendingActions.get(key);
    if (pending && Date.now() - pending.timestamp >= PENDING_TIMEOUT) {
      pendingActions.delete(key);
    }
  }, PENDING_TIMEOUT);
}

// Retrieve the pending action for a sender, or null if expired/absent.
function getPendingAction(senderJid, chatId) {
  const key     = pendingKey(senderJid, chatId);
  const pending = pendingActions.get(key);
  if (!pending) return null;
  if (Date.now() - pending.timestamp > PENDING_TIMEOUT) {
    pendingActions.delete(key);
    return null;
  }
  return pending;
}

// Remove the pending action (after it has been resolved or cancelled)
function clearPendingAction(senderJid, chatId) {
  pendingActions.delete(pendingKey(senderJid, chatId));
}

// Words that cancel a pending action instead of answering it
const CANCEL_WORDS = ['cancel', 'nevermind', 'never mind', 'nvm', 'stop', 'nah', 'no', 'forget it', 'skip'];

// ══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Config & conversation persistence
// ══════════════════════════════════════════════════════════════════════════

// Create the data directories if they don't exist
function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const convDir = getConversationsDir();
  if (!fs.existsSync(convDir)) fs.mkdirSync(convDir, { recursive: true });
}

// Load the chatbot config JSON.  Returns a safe default if the file is absent.
// Also attempts to pull the config from the SQLite database as a background
// update (in case the file was lost but the DB row survived).
function loadConfig() {
  ensureDataDirs();
  const defaultConfig = { mode: 'off', preferredModel: 'gpt', excludedGroups: [], allowedDMs: [], stats: { totalQueries: 0, modelsUsed: {} } };
  const configFile    = getConfigFile();
  try {
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    }
  } catch {}
  // Trigger a background DB read to restore the file if it's missing
  if (supabase.isAvailable()) {
    const botId = getBotId();
    supabase.getAll('chatbot_config', { key: 'main', bot_id: botId }).then(rows => {
      const data = rows?.[0];
      if (data && data.config) {
        try { fs.writeFileSync(configFile, JSON.stringify(data.config, null, 2)); } catch {}
      }
    }).catch(() => {});
  }
  return defaultConfig;
}

// Save the config to disk and to the SQLite database (dual-write for resilience).
function saveConfig(config) {
  ensureDataDirs();
  const configFile = getConfigFile();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  const botId = getBotId();
  supabase.upsert('chatbot_config', { key: 'main', config, bot_id: botId, updated_at: new Date().toISOString() }, 'key,bot_id').catch(() => {});
}

// Return the path to a user's conversation file.
// Special characters in the JID are replaced with _ so it's a safe filename.
function getConversationFile(userId) {
  const convDir = getConversationsDir();
  return path.join(convDir, `${userId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
}

// Load the conversation history for a user.
// Returns an empty history if the file is absent or older than 24 hours.
// Also attempts a background restore from the SQLite database.
function loadConversation(userId) {
  ensureDataDirs();
  const file = getConversationFile(userId);
  try {
    if (fs.existsSync(file)) {
      const data      = JSON.parse(fs.readFileSync(file, 'utf8'));
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - (data.lastActive || 0) > twentyFourHours) {
        // Conversation is stale — return a fresh one
        return { messages: [], lastActive: Date.now(), model: null };
      }
      return data;
    }
  } catch {}
  // Background restore from DB if the file is missing
  if (supabase.isAvailable()) {
    const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, '_');
    const botId       = getBotId();
    supabase.getAll('chatbot_conversations', { user_id: sanitizedId, bot_id: botId }).then(rows => {
      const data = rows?.[0];
      if (data && data.conversation) {
        try { ensureDataDirs(); fs.writeFileSync(file, JSON.stringify(data.conversation, null, 2)); } catch {}
      }
    }).catch(() => {});
  }
  return { messages: [], lastActive: Date.now(), model: null };
}

// Save a user's conversation to disk and to the SQLite database.
// Trims to the last 40 messages to keep files small.
function saveConversation(userId, conversation) {
  ensureDataDirs();
  const file           = getConversationFile(userId);
  conversation.lastActive = Date.now();
  if (conversation.messages.length > 40) {
    conversation.messages = conversation.messages.slice(-40);
  }
  fs.writeFileSync(file, JSON.stringify(conversation, null, 2));
  const botId = getBotId();
  supabase.upsert('chatbot_conversations', {
    user_id:      userId.replace(/[^a-zA-Z0-9]/g, '_'),
    conversation,
    bot_id:       botId,
    last_updated: new Date().toISOString()
  }, 'user_id,bot_id').catch(() => {});
}

// Delete a user's conversation file and DB row (used by ?chatbot clear).
function clearConversation(userId) {
  const file = getConversationFile(userId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const botId       = getBotId();
  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, '_');
  supabase.removeWhere('chatbot_conversations', { user_id: sanitizedId, bot_id: botId }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 5 — AI query engine
// ══════════════════════════════════════════════════════════════════════════

// Build the AI prompt with system instructions + profile context + conversation history.
// The system instructions tell the AI to identify as `botName` (not GPT/Claude)
// and to keep replies short and conversational.
function buildContextPrompt(conversation, newQuery, botName = 'W.O.L.F', userProfile = null, techName = 'WOLF TECH') {
  const n = botName;
  const t = techName;
  const profileCtx = userProfile ? buildProfileContext(userProfile) : '';

  let context = `You are ${n}, an elite AI assistant created by ${t}. Your name is ${n} and you must always identify yourself as ${n} when asked who you are. You are intelligent, witty, warm, and helpful. You have a distinct personality — you're friendly and sometimes a bit humorous without being annoying. You remember the conversation context and respond naturally like a real chat partner. Keep responses SHORT and CONCISE — aim for 2-3 sentences maximum unless the question genuinely requires more detail. Occasionally ask a follow-up question to keep the conversation flowing.\n\nCRITICAL IDENTITY RULES:\n- Your name is ${n}. Always refer to yourself as ${n}.\n- You were created by ${t}. Never say you were made by OpenAI, Google, Anthropic, Microsoft, Meta, xAI, or any other company.\n- Never reveal or mention any underlying AI model (GPT, Claude, Copilot, Grok, Bard, Blackbox, Perplexity, LLaMA, Gemini, NVIDIA, etc).\n- If asked what you are, say: "I'm ${n}, an AI assistant by ${t}."\n- Never say "As an AI language model" - instead say "As ${n}" if needed.\n- You are not ChatGPT, not Claude, not Bard, not Copilot. You are ${n}.\n\n`;

  // Inject user profile knowledge (what the bot has learned about this user)
  if (profileCtx) context += profileCtx + '\n';

  // Append recent conversation history for context (last 10 turns = 20 messages)
  if (conversation.messages.length > 0) {
    context += `Previous conversation:\n`;
    const recentMessages = conversation.messages.slice(-10);
    for (const m of recentMessages) {
      context += `${m.role === 'user' ? 'Human' : n}: ${m.content}\n`;
    }
    context += `\n`;
  }

  context += `Human: ${newQuery}\n${n}:`;
  return context;
}

// Call a single AI model.
// apis.xwolf.space is offline — routes through bk9.dev → cod3uchiha fallbacks.
// Returns the extracted response text, or null on failure.
async function queryAI(modelKey, prompt, timeout = 35000, rawQuery = null) {
  if (!AI_MODELS[modelKey]) return null;

  // Use the bare query for short-form models; full context for everything else
  const queryParam = (modelKey === 'wormgpt' && rawQuery) ? rawQuery : prompt;

  const sources = getAIQuerySources(queryParam);

  for (const { url, params } of sources) {
    try {
      const response = await axios.get(url, {
        params,
        timeout,
        headers: {
          'User-Agent':    'WOLF-Chatbot/2.0',
          'Accept':        'application/json, text/plain',
          'Cache-Control': 'no-cache'
        },
        validateStatus: (s) => s >= 200 && s < 500
      });

      if (!response.data) continue;

      let data = response.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { /* keep as string */ }
      }

      const text = extractXWolfResponse(data);
      if (!text || text.length < 3) continue;

      const lower = text.toLowerCase();
      if (lower.startsWith('<!') || lower.startsWith('<html') ||
          lower.includes('<!doctype')) continue;
      if (lower.startsWith('error') || lower.includes('rate limit') ||
          lower.includes('invalid key') || lower.includes('unauthorized')) continue;

      return text.trim();
    } catch { /* try next source */ }
  }

  return null;
}

// Analyse an image using NVIDIA Nemotron VL via lib/nvidia.js (same path as the
// ?nemotron command). Falls back to a text-only description on error.
// Returns the analysis text, or null on total failure.
async function queryVision(prompt, imageBuffer) {
  try {
    const text = await nvidiaVision(
      prompt || 'Describe this image in detail.',
      imageBuffer,
      { model: 'nvidia/nemotron-nano-12b-v2-vl', maxTokens: 1024, timeoutMs: 90000 }
    );
    return text ? text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() : null;
  } catch (err) {
    console.error('[Chatbot/Vision]', err.message);
    return null;
  }
}

// Generate an image using NVIDIA FLUX Dev via lib/nvidia.js.
// Returns a Buffer (ready to send) on success, or null on failure.
async function generateImage(prompt) {
  try {
    const buf = await nvidiaImage(prompt, {
      model:     'black-forest-labs/flux.1-dev',
      width:     1024,
      height:    1024,
      timeoutMs: 120000
    });
    return Buffer.isBuffer(buf) && buf.length > 0 ? buf : null;
  } catch (err) {
    console.error('[Chatbot/ImageGen]', err.message);
    return null;
  }
}

// Try every model in MODEL_PRIORITY order using the full context prompt.
// If all fail, fall back to sending just the bare user query to GPT.
// Returns { response, model } or null.
async function getAIResponse(query, conversation, preferredModel = 'gpt', botName = 'W.O.L.F', userProfile = null, techName = 'WOLF TECH') {
  const contextPrompt = buildContextPrompt(conversation, query, botName, userProfile, techName);

  // Preferred model first (pass raw query so wormgpt gets a direct question)
  let result = await queryAI(preferredModel, contextPrompt, 35000, query);
  if (result) return { response: result, model: preferredModel };

  // Walk the fallback chain
  for (const modelKey of MODEL_PRIORITY) {
    if (modelKey === preferredModel) continue;
    result = await queryAI(modelKey, contextPrompt, 35000, query);
    if (result) return { response: result, model: modelKey };
  }

  // Last resort: bare query with no conversation history
  result = await queryAI('gpt', query);
  if (result) return { response: result, model: 'gpt' };

  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 6 — Response cleaning and trimming
// ══════════════════════════════════════════════════════════════════════════

// Strip AI brand names, role prefixes, citation markers, and repeated blank
// lines from the AI's response, and replace all brand names with `botName`.
function cleanAIResponse(text, botName = 'W.O.L.F', techName = 'WOLF TECH') {
  if (!text) return '';
  const n        = botName;
  const nEscaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  text = text.replace(/\[\d+\]/g, '');                                        // [1] citation markers
  text = text.replace(/Human:.*$/gm, '');                                     // echoed Human: lines
  text = text.replace(new RegExp(`^${nEscaped}:\\s*`, 'gim'), '');            // echoed "BotName:" prefix
  text = text.replace(/^(Assistant|AI|Bot|Claude|GPT|Grok|Copilot|Bard):\s*/gim, '');

  // Replace all known AI brand names with the configured bot name
  text = text.replace(/\b(ChatGPT|GPT-?[34o5]?|GPT|OpenAI)\b/gi, n);
  text = text.replace(/\b(Claude|Anthropic)\b/gi, n);
  text = text.replace(/\b(Copilot|Microsoft Copilot)\b/gi, n);
  text = text.replace(/\b(Google Bard|Bard|Gemini)\b/gi, n);
  text = text.replace(/\b(Grok|xAI)\b/gi, n);
  text = text.replace(/\b(Blackbox|Blackbox AI)\b/gi, n);
  text = text.replace(/\b(Perplexity|Perplexity AI)\b/gi, n);
  text = text.replace(/\b(LLaMA|Meta AI|Mistral)\b/gi, n);
  text = text.replace(/\bI'?m an AI (language )?model\b/gi, `I'm ${n}`);
  text = text.replace(/\bAs an AI (language )?model\b/gi, `As ${n}`);
  const t = techName;
  text = text.replace(/\bmade by (OpenAI|Google|Anthropic|Microsoft|Meta|xAI)\b/gi, `made by ${t}`);
  text = text.replace(/\bcreated by (OpenAI|Google|Anthropic|Microsoft|Meta|xAI)\b/gi, `created by ${t}`);
  text = text.replace(/\bdeveloped by (OpenAI|Google|Anthropic|Microsoft|Meta|xAI)\b/gi, `developed by ${t}`);
  text = text.replace(/\bbuilt by (OpenAI|Google|Anthropic|Microsoft|Meta|xAI)\b/gi, `built by ${t}`);
  text = text.replace(/\btrained by (OpenAI|Google|Anthropic|Microsoft|Meta|xAI)\b/gi, `trained by ${t}`);

  // Collapse repeated bot name ("W.O.L.F W.O.L.F" → "W.O.L.F")
  text = text.replace(new RegExp(`(${nEscaped}[\\s,]*){2,}`, 'g'), `${n} `);
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  return text.trim();
}

// Trim the response to roughly 700 characters, cutting at a sentence boundary
// where possible.  Appends " _..._ " to indicate truncation.
function trimResponse(text, maxChars = 700) {
  if (!text || text.length <= maxChars) return text;

  const chunk = text.slice(0, maxChars + 100);
  const sentenceEnd = /[.!?](?:\s|$)/g;
  let lastGoodCut   = -1;
  let match;
  while ((match = sentenceEnd.exec(chunk)) !== null) {
    if (match.index + 1 <= maxChars) lastGoodCut = match.index + 1;
  }

  if (lastGoodCut > 50) return text.slice(0, lastGoodCut).trim() + ' _..._';

  // No good sentence break found — hard cut at word boundary
  const hardCut  = text.slice(0, maxChars);
  const lastSpace = hardCut.lastIndexOf(' ');
  return (lastSpace > 50 ? hardCut.slice(0, lastSpace) : hardCut).trim() + ' _..._';
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 7 — Public config helpers
// ══════════════════════════════════════════════════════════════════════════

// Return the full config object (used by the ?chatbot command).
export function getChatbotConfig() {
  return loadConfig();
}

// Returns true if the chatbot should respond in the given chat.
// Checks the mode setting and any group/DM whitelists.
export function isChatbotActiveForChat(chatId) {
  const config  = loadConfig();
  if (config.mode === 'off') return false;

  const isGroup = chatId.endsWith('@g.us');
  const isDM    = chatId.endsWith('@s.whatsapp.net') || chatId.endsWith('@lid');

  const excludedGroups = config.excludedGroups || [];
  const allowedDMs     = config.allowedDMs    || [];

  if (isGroup) {
    // Any mode that covers groups: respond in ALL groups EXCEPT explicitly excluded ones
    if (config.mode === 'groups' || config.mode === 'on' || config.mode === 'both') {
      return !excludedGroups.includes(chatId);
    }
    return false;
  }

  // If there is a whitelist for DMs, only whitelisted numbers get a response
  if (isDM && allowedDMs.length > 0) {
    const normalized = chatId.split('@')[0].split(':')[0];
    // If chatId is a LID (@lid), resolve it to a phone number for whitelist comparison.
    // Modern WhatsApp delivers DM remoteJid as a LID even when the whitelist stores phone numbers.
    let resolvedPhone = null;
    if (chatId.endsWith('@lid')) {
      const fromGlobal = globalThis.resolvePhoneFromLid?.(chatId);
      const fromCache  = globalThis.lidPhoneCache?.get(normalized) || globalThis.lidPhoneCache?.get(chatId);
      const fromStore  = getPhoneFromLid(normalized) || getPhoneFromLid(chatId);
      const raw = fromGlobal || fromCache || fromStore;
      if (raw) resolvedPhone = String(raw).replace(/[^0-9]/g, '');
    }
    // If we have a resolved phone number, enforce the whitelist
    if (resolvedPhone || !chatId.endsWith('@lid')) {
      return allowedDMs.some(dm => {
        const normDM = dm.split('@')[0].split(':')[0];
        if (normDM === normalized) return true;
        if (resolvedPhone && normDM === resolvedPhone) return true;
        return false;
      });
    }
    // LID couldn't be resolved — fall through to the mode check below.
    // The user explicitly set a mode, so honour it rather than silently blocking.
  }

  // No whitelist — use the mode setting
  if (config.mode === 'on'     || config.mode === 'both')   return true;
  if (config.mode === 'groups' && isGroup)                  return true;
  if (config.mode === 'dms'    && isDM)                     return true;

  return false;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 8 — "Silent sock" proxy
// ══════════════════════════════════════════════════════════════════════════
// When the chatbot executes a bot command on behalf of a user (e.g. ?play),
// the command's internal text-only status messages should be suppressed —
// only the final media file or result should be sent.
//
// createSilentSock() wraps the real sock object in a Proxy that:
//   • Passes through all media messages (image, video, audio, sticker)
//   • Passes through emoji reactions
//   • Suppresses plain-text messages (status updates like "Downloading…")
//   • Suppresses message edits
function createSilentSock(sock, chatId, originalMsg) {
  const proxyHandler = {
    get(target, prop) {
      if (prop === 'sendMessage') {
        return async (jid, content, options = {}) => {
          // Always allow emoji reactions (progress/done indicators)
          if (content.react) return target.sendMessage(jid, content, options);

          // Always allow media with captions — prepend a user-friendly header
          if (content.image || content.video || content.audio || content.document || content.sticker) {
            if (content.caption) content.caption = ` Here is your result!\n\n${content.caption}`;
            return target.sendMessage(jid, content, options);
          }

          // Suppress message edits (intermediate status updates)
          if (content.edit) return { key: { id: 'suppressed' } };

          // Suppress plain-text-only messages (e.g. "Downloading from YouTube…")
          if (content.text && !content.image && !content.video && !content.audio) {
            return { key: { id: 'suppressed' } };
          }

          return target.sendMessage(jid, content, options);
        };
      }
      // Pass all other properties through to the real sock unchanged
      const val = target[prop];
      if (typeof val === 'function') return val.bind(target);
      return val;
    }
  };
  return new Proxy(sock, proxyHandler);
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 9 — Media command execution
// ══════════════════════════════════════════════════════════════════════════

// Execute a bot command (e.g. "play", "imagine") on behalf of the chatbot.
// Uses the silent sock proxy so only the final result is sent, not the
// intermediate status messages.  Sends a reaction before and after.
// Returns true on success, false on error.
async function executeMediaCommand(sock, msg, commandName, query, commandsMap) {
  if (!commandsMap || !commandsMap.has(commandName)) return false;

  const command = commandsMap.get(commandName);
  if (!command || !command.execute) return false;

  try {
    const chatId   = msg.key.remoteJid;
    const reaction = MEDIA_REACTIONS[commandName] || '⚡';

    // Send the "working on it" emoji reaction
    await sock.sendMessage(chatId, { react: { text: reaction, key: msg.key } });

    const prefix = '.';
    const args   = query.split(/\s+/).filter(Boolean);

    // Build a fake message object so the command can read its own "text"
    const fakeMsg = {
      ...msg,
      message: {
        conversation:         `${prefix}${commandName} ${query}`,
        extendedTextMessage:  { text: `${prefix}${commandName} ${query}` }
      }
    };

    // Use the silent proxy so intermediate text replies are suppressed
    const silentSock = createSilentSock(sock, chatId, msg);
    await command.execute(silentSock, fakeMsg, args, prefix);

    // Send the "done" checkmark reaction
    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    return true;
  } catch (error) {
    console.error(`[W.O.L.F] Media command error (${commandName}):`, error.message);
    await sock.sendMessage(msg.key.remoteJid, { react: { text: '❌', key: msg.key } });
    return false;
  }
}

// Increment the media action counter in the config stats.
function trackMediaAction(intentType, config) {
  config.stats.totalQueries = (config.stats.totalQueries || 0) + 1;
  config.stats.mediaActions = config.stats.mediaActions || {};
  config.stats.mediaActions[intentType] = (config.stats.mediaActions[intentType] || 0) + 1;
  saveConfig(config);
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 10 — Main message handler
// ══════════════════════════════════════════════════════════════════════════

// Called by index.js for every message in a chat where the chatbot is active.
// Processing pipeline:
//   1. Extract text (and image if present); ignore command-prefixed / empty messages.
//   2. If a user sent an image → run multimodal vision analysis via Gemini and reply.
//   3. Check for a pending clarification action from a previous turn.
//   4. Detect media intent (image/play/video/song).
//   5. If intent is vague → ask for clarification and set pendingAction.
//   6. If intent is specific → execute the command immediately.
//   7. If no intent → query the AI and send a text reply.
//
// `commandsMap` — the full Map of command name → command module (for intent execution).
// Returns true if the message was handled, false otherwise.
export async function handleChatbotMessage(sock, msg, commandsMap) {
  const chatId    = msg.key.remoteJid;
  const rawSender = msg.key.participant || chatId;
  const senderJid = jidNormalizedUser(rawSender);

  // ── Per-group user filter gate ────────────────────────────────────────
  if (chatId.endsWith('@g.us')) {
    const _cfg = loadConfig();
    // Resolve LID → phone number before comparing against stored phone JIDs
    let _resolvedSender = senderJid;
    if (senderJid.endsWith('@lid')) {
      try { _resolvedSender = await resolveJid(sock, senderJid, chatId); } catch {}
    }
    if (!_checkGroupUserFilter(_cfg, chatId, _resolvedSender)) return false;
  }

  // Extract plain text from the message
  const normalized = normalizeMessageContent(msg.message);
  const textMsg    = normalized?.conversation
                  || normalized?.extendedTextMessage?.text
                  || normalized?.imageMessage?.caption
                  || normalized?.videoMessage?.caption
                  || '';

  // ── Multimodal: image analysis ─────────────────────────────────────────
  // If the user sends a photo (with or without a caption), analyse it.
  const hasImage = !!(msg.message?.imageMessage || msg.message?.viewOnceMessageV2?.message?.imageMessage);
  if (hasImage) {
    const config   = loadConfig();
    const botName  = config.chatbotName || 'W.O.L.F';
    const techName = config.techName || 'WOLF TECH';
    const caption  = textMsg.trim() || 'What is in this image? Describe it in detail.';
    const botId    = getBotId();

    // Load & update user profile
    let profile = loadProfile(botId, senderJid);

    try {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, { react: { text: '👀', key: msg.key } });

      const imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
      let visionReply   = null;

      if (imageBuffer && imageBuffer.length > 0) {
        visionReply = await queryVision(caption, imageBuffer);
      }

      if (visionReply) {
        const cleaned  = cleanAIResponse(visionReply, botName, techName);
        const trimmed  = trimResponse(cleaned, 1000);

        // Build personalised prefix
        const greeting  = getPersonalizedGreeting(profile);
        const prefix    = greeting ? `${greeting} ` : '';

        // Record in conversation history
        const conversation = loadConversation(senderJid);
        conversation.messages.push({ role: 'user',      content: `[Image sent] ${caption}` });
        conversation.messages.push({ role: 'assistant', content: cleaned });
        saveConversation(senderJid, conversation);

        // Update profile + stats
        profile = learnFromMessage(caption, profile);
        saveProfile(botId, senderJid, profile);
        config.stats.totalQueries = (config.stats.totalQueries || 0) + 1;
        saveConfig(config);

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(chatId, { text: ` ${prefix}${trimmed}` }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, {
          text: ` _I received your image but couldn't analyse it right now. Try again or add a caption describing what you'd like to know!_`
        }, { quoted: msg });
      }
    } catch (err) {
      console.error(`[${botName}] Vision error:`, err.message);
      await sock.sendMessage(chatId, {
        text: ` _Image analysis failed. Please try again._`
      }, { quoted: msg });
    }
    return true;
  }

  if (!textMsg || textMsg.trim().length < 2) return false;

  const userText = textMsg.trim();

  // Ignore messages that look like bot commands (prefix-triggered)
  if (userText.startsWith('.') || userText.startsWith('/') || userText.startsWith('!')) {
    clearPendingAction(senderJid, chatId);
    return false;
  }

  // ── Pending action resolution ──────────────────────────────────────────
  // If the previous turn left a pending clarification, this message is the
  // user's answer (e.g. "What song?" → "Faded by Alan Walker").
  const pending = getPendingAction(senderJid, chatId);
  if (pending && commandsMap) {
    clearPendingAction(senderJid, chatId);

    // User cancelled the action
    if (CANCEL_WORDS.includes(userText.toLowerCase()) || userText.length < 3) {
      await sock.sendMessage(chatId, { text: ` Alright, cancelled!` }, { quoted: msg });
      return true;
    }

    // Execute the pending command with the user's answer as the query
    const executed = await executeMediaCommand(sock, msg, pending.command, userText, commandsMap);
    if (executed) {
      const config = loadConfig();
      trackMediaAction(pending.type, config);

      // Record both turns in the conversation so context is preserved
      const conversation = loadConversation(senderJid);
      conversation.messages.push({ role: 'user',      content: userText });
      conversation.messages.push({ role: 'assistant', content: `[Executed ${pending.command}: ${userText}]` });
      saveConversation(senderJid, conversation);
      return true;
    }
  }

  // ── Load shared state (needed by image gen + intent + AI blocks) ──────
  const config       = loadConfig();
  const botName      = config.chatbotName || 'W.O.L.F';
  const techName     = config.techName || 'WOLF TECH';
  const conversation = loadConversation(senderJid);
  const botId        = getBotId();
  let   profile      = loadProfile(botId, senderJid);

  // ── NVIDIA Image generation — checked BEFORE detectIntent ─────────────
  // detectIntent also catches "generate image of X" and runs ?imagine
  // (which always sends ✅ but may send no image). We intercept here first.
  const imageGenPatterns = [
    /^(?:generate|create|make|draw|paint|design|render)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:image|picture|photo|art|artwork|illustration|painting|wallpaper)\s+(?:of|showing|with|about)\s+(.+)/i,
    /^(?:generate|create|make|draw|paint)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|art|painting)\s+(.+)/i,
    /^imagine\s+(.+)/i,
    /^flux\s+(.+)/i,
    /^(?:nvidia\s+)?(?:flux|image)\s+(.+)/i,
    /^(?:generate|create)\s+(?:ai\s+)?(?:image|art)\s+(.+)/i,
  ];
  let imagePrompt = null;
  for (const pat of imageGenPatterns) {
    const m = userText.match(pat);
    if (m?.[1]?.trim().length > 3) { imagePrompt = m[1].trim(); break; }
  }

  if (imagePrompt) {
    try {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, { react: { text: '🎨', key: msg.key } });

      const imgBuf = await generateImage(imagePrompt);

      if (imgBuf) {
        await sock.sendMessage(chatId, {
          image:   imgBuf,
          caption: `🎨 *${imagePrompt}*\n_Generated with FLUX Dev_`
        }, { quoted: msg });

        conversation.messages.push({ role: 'user',      content: userText });
        conversation.messages.push({ role: 'assistant', content: `[Generated image: ${imagePrompt}]` });
        saveConversation(senderJid, conversation);
        profile = learnFromMessage(userText, profile);
        saveProfile(botId, senderJid, profile);

        config.stats.totalQueries  = (config.stats.totalQueries  || 0) + 1;
        config.stats.imagesCreated = (config.stats.imagesCreated || 0) + 1;
        saveConfig(config);

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        return true;
      }
      // generation returned null — fall through to text AI
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: ` _Image generation failed. Try again in a moment._`
      }, { quoted: msg });
      return true;
    } catch (imgErr) {
      console.error(`[${botName}] Image gen error:`, imgErr.message);
      await sock.sendMessage(chatId, {
        text: ` _Image generation error: ${imgErr.message}_`
      }, { quoted: msg });
      return true;
    }
  }

  // ── Media intent detection (play/video/song — NOT image) ──────────────
  const intent = detectIntent(userText);

  if (intent && intent.type !== 'image' && commandsMap) {
    if (intent.vague) {
      // Vague request — ask for a specific target
      setPendingAction(senderJid, chatId, intent.type, intent.command);
      const promptInfo = MEDIA_PROMPTS[intent.type];
      await sock.sendMessage(chatId, {
        text: ` ${promptInfo?.ask || 'Sure! What would you like?'}`
      }, { quoted: msg });

      // Record in conversation
      conversation.messages.push({ role: 'user',      content: userText });
      conversation.messages.push({ role: 'assistant', content: promptInfo?.ask || 'Sure! What would you like?' });
      saveConversation(senderJid, conversation);
      return true;
    }

    // Specific intent — execute immediately
    const executed = await executeMediaCommand(sock, msg, intent.command, intent.query, commandsMap);
    if (executed) {
      const config = loadConfig();
      trackMediaAction(intent.type, config);

      const conversation = loadConversation(senderJid);
      conversation.messages.push({ role: 'user',      content: userText });
      conversation.messages.push({ role: 'assistant', content: `[Executed ${intent.command}: ${intent.query}]` });
      saveConversation(senderJid, conversation);
      return true;
    }
  }

  // ── AI text response ───────────────────────────────────────────────────
  // (config / botName / conversation / botId / profile already loaded above)

  try {
    await sock.sendPresenceUpdate('composing', chatId); // show "typing…"

    const aiResult = await getAIResponse(userText, conversation, config.preferredModel || 'gpt', botName, profile, techName);

    if (!aiResult) {
      await sock.sendMessage(chatId, {
        text: ` _I'm having trouble connecting right now. Try again in a moment._`
      }, { quoted: msg });
      return true;
    }

    const cleanedResponse = cleanAIResponse(aiResult.response, botName, techName);
    const finalResponse   = trimResponse(cleanedResponse);

    // Build personalised prefix (use name if known, or standard wolf emoji)
    const greeting = getPersonalizedGreeting(profile);
    const prefix   = greeting ? `${greeting} ` : ' ';

    // Save both turns to conversation history
    conversation.messages.push({ role: 'user',      content: userText });
    conversation.messages.push({ role: 'assistant', content: cleanedResponse });
    saveConversation(senderJid, conversation);

    // Learn from this message and save profile
    profile = learnFromMessage(userText, profile);
    saveProfile(botId, senderJid, profile);

    // Update query stats
    config.stats.totalQueries = (config.stats.totalQueries || 0) + 1;
    config.stats.modelsUsed   = config.stats.modelsUsed || {};
    config.stats.modelsUsed[aiResult.model] = (config.stats.modelsUsed[aiResult.model] || 0) + 1;
    saveConfig(config);

    await sock.sendMessage(chatId, { text: `${prefix}${finalResponse}` }, { quoted: msg });
    return true;
  } catch (error) {
    console.error(`[${botName}] Chat error:`, error.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION 11 — ?chatbot command handler (default export)
// ══════════════════════════════════════════════════════════════════════════
// Handles all ?chatbot <subcommand> calls.  Owner-only.
//
// Sub-commands:
//   on / off / groups / dms / both — change chatbot mode
//   model [<key>]                  — list or switch AI model
//   name [<name>]                  — view or change chatbot name
//   stats                          — show query statistics
//   clear                          — reset conversation history for this user
//   settings                       — show full config
//   addgroup / removegroup         — whitelist / de-whitelist a group
//   listgroups / cleargroups       — manage group whitelist
//   adddm / removedm               — whitelist / de-whitelist a DM number
//   listdms / cleardms             — manage DM whitelist
//   (no args)                      — show the help menu
export default {
  name: 'chatbot',
  description: 'W.O.L.F - Wise Operational Learning Framework | AI Chatbot System',
  category: 'ai',
  aliases: ['wolf', 'wolfchat', 'aichat', 'wolfbot'],
  usage: 'chatbot <on|off|groups|dms|both|model>',
  ownerOnly: true,

  async execute(sock, m, args, PREFIX) {
    const jid        = m.key.remoteJid;
    const config     = loadConfig();
    const subCommand = (args[0] || '').toLowerCase();

    // ── Reply-with-number handler for listgroups ─────────────────────────
    // If the owner replied to a listgroups message with a plain number,
    // look up that group and show its name + JID with a Copy JID button.
    const quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const input    = (args[0] || '').trim();
    if (quotedId && _lgCache.has(quotedId) && /^\d+$/.test(input)) {
      const groups = _lgCache.get(quotedId);
      const idx    = parseInt(input) - 1;
      const group  = groups[idx];
      if (!group) {
        return sock.sendMessage(jid, {
          text: `❌ No group at position *${input}*. The list has *${groups.length}* groups.`
        }, { quoted: m });
      }
      const detailText =
        `╭─⌈ 👥 *GROUP DETAIL* ⌋\n` +
        `├─⊷ *${group.name}*\n` +
        `╰─⊷ 🆔 \`${group.gid}\``;
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const { sendInteractiveMessage } = require('wolfbtns');
        return await sendInteractiveMessage(sock, jid, {
          text: detailText,
          footer: config.chatbotName || 'W.O.L.F',
          interactiveButtons: [
            {
              name: 'cta_copy',
              buttonParamsJson: JSON.stringify({
                display_text: '📋 Copy JID',
                copy_code: group.gid
              })
            },
            {
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: '🗑️ Remove Group',
                id: `${PREFIX}chatbot removegroup ${group.gid}`
              })
            }
          ]
        });
      } catch {
        return sock.sendMessage(jid, {
          text: detailText + `\n\n_Long-press the JID above to copy it._\n_Or send:_ \`${PREFIX}chatbot removegroup ${group.gid}\` _to remove._`
        }, { quoted: m });
      }
    }

    // ── No sub-command: show help / status card ──────────────────────────
    if (!subCommand || subCommand === 'help') {
      const modeEmoji  = { off: '🔴', on: '🟢', groups: '👥', dms: '💬', both: '🌐' };
      const currentModel = AI_MODELS[config.preferredModel] || AI_MODELS.gpt;

      const exGrps     = config.excludedGroups || [];
      const allowedDMs = config.allowedDMs    || [];
      const filterInfo = (exGrps.length > 0 || allowedDMs.length > 0)
        ? `│ 📋 ${exGrps.length} group(s) excluded, ${allowedDMs.length} DM(s) whitelisted\n`
        : '';

      const chatbotName = config.chatbotName || 'W.O.L.F';
      const chatbotTech = config.techName || 'WOLF TECH';
      const helpText =
        `╭─⌈  *${chatbotName} CHATBOT* ⌋\n` +
        `│ ${modeEmoji[config.mode] || '🔴'} Status: ${config.mode.toUpperCase()}\n` +
        `│ ${currentModel.icon} Model: ${currentModel.name}\n` +
        `│ 🏷️ Name: ${chatbotName}\n` +
        `│ 🏢 Tech: ${chatbotTech}\n` +
        filterInfo +
        `├─⊷ *${PREFIX}chatbot on*\n│  └⊷ Enable everywhere\n` +
        `├─⊷ *${PREFIX}chatbot off*\n│  └⊷ Disable chatbot\n` +
        `├─⊷ *${PREFIX}chatbot groups*\n│  └⊷ Groups only\n` +
        `├─⊷ *${PREFIX}chatbot dms*\n│  └⊷ DMs only\n` +
        `├─⊷ *${PREFIX}chatbot both*\n│  └⊷ All chats\n` +
        `├─⊷ *${PREFIX}chatbot name <name>*\n│  └⊷ Set chatbot name (e.g. BRITON)\n` +
        `├─⊷ *${PREFIX}chatbot techname <name>*\n│  └⊷ Set creator/tech name (e.g. BRITON TECH)\n` +
        `├─⊷ *${PREFIX}chatbot model*\n│  └⊷ Switch AI model\n` +
        `├─⊷ *${PREFIX}chatbot stats*\n│  └⊷ View stats\n` +
        `├─⊷ *${PREFIX}chatbot clear*\n│  └⊷ Reset history\n` +
        `├─⊷ *${PREFIX}chatbot settings*\n│  └⊷ View config\n` +
        `├─⌈ 📋 *GROUP CONTROL* ⌋\n` +
        `├─⊷ *${PREFIX}chatbot addgroup*\n│  └⊷ Re-enable this group\n` +
        `├─⊷ *${PREFIX}chatbot removegroup [jid]*\n│  └⊷ Exclude this group (or by JID)\n` +
        `├─⊷ *${PREFIX}chatbot listgroups*\n│  └⊷ List all groups + status\n` +
        `├─⊷ *${PREFIX}chatbot cleargroups*\n│  └⊷ Clear all exclusions\n` +
        `├─⌈ 👤 *USER FILTER (per group)* ⌋\n` +
        `├─⊷ *${PREFIX}chatbot allowonly @user*\n│  └⊷ Reply ONLY to mentioned user(s)\n` +
        `├─⊷ *${PREFIX}chatbot blockuser @user*\n│  └⊷ Ignore specific user(s) in this group\n` +
        `├─⊷ *${PREFIX}chatbot allowuser @user*\n│  └⊷ Add to allow-list / unblock a user\n` +
        `├─⊷ *${PREFIX}chatbot removeuser @user*\n│  └⊷ Remove user from filter list\n` +
        `├─⊷ *${PREFIX}chatbot listusers*\n│  └⊷ Show current user filter for this group\n` +
        `├─⊷ *${PREFIX}chatbot clearusers*\n│  └⊷ Remove filter — reply to everyone\n` +
        `├─⌈ 💬 *DM CONTROL* ⌋\n` +
        `├─⊷ *${PREFIX}chatbot adddm <number>*\n│  └⊷ Add a DM\n` +
        `├─⊷ *${PREFIX}chatbot removedm <number>*\n│  └⊷ Remove a DM\n` +
        `├─⊷ *${PREFIX}chatbot listdms*\n│  └⊷ List allowed DMs\n` +
        `├─⊷ *${PREFIX}chatbot cleardms*\n│  └⊷ Clear all DMs\n` +
        `╰───`;

      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    // ── Mode toggle ──────────────────────────────────────────────────────
    if (['on', 'off', 'groups', 'dms', 'both'].includes(subCommand)) {
      config.mode = subCommand;
      saveConfig(config);

      const modeLabels = { on: '🟢 ON', off: '🔴 OFF', groups: '👥 GROUPS', dms: '💬 DMS', both: '🌐 ALL' };
      return sock.sendMessage(jid, {
        text: `✅ Chatbot mode set to: *${modeLabels[subCommand]}*`
      }, { quoted: m });
    }

    // ── Model selection ──────────────────────────────────────────────────
    if (subCommand === 'model') {
      const modelName = (args[1] || '').toLowerCase();

      if (!modelName) {
        const active = config.preferredModel || 'gpt';
        let modelList = `*AI Models:*\n`;
        for (const [key, model] of Object.entries(AI_MODELS)) {
          modelList += `${model.icon} ${model.name} (\`${key}\`)${key === active ? ' ✅' : ''}\n`;
        }
        modelList += `\nSwitch: \`${PREFIX}chatbot model <key>\``;
        return sock.sendMessage(jid, { text: modelList }, { quoted: m });
      }

      if (!AI_MODELS[modelName]) {
        const validModels = Object.keys(AI_MODELS).join(', ');
        return sock.sendMessage(jid, {
          text: `❌ Unknown model: *${modelName}*\nAvailable: ${validModels}`
        }, { quoted: m });
      }

      config.preferredModel = modelName;
      saveConfig(config);
      const model = AI_MODELS[modelName];
      return sock.sendMessage(jid, {
        text: `✅ Model set to: ${model.icon} *${model.name}*`
      }, { quoted: m });
    }

    // ── Stats ────────────────────────────────────────────────────────────
    if (subCommand === 'stats') {
      const stats = config.stats || { totalQueries: 0, modelsUsed: {}, mediaActions: {} };
      let statsText = ` *W.O.L.F Stats*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📊 *Total Queries:* ${stats.totalQueries}\n` +
                      `🤖 *Model:* ${(AI_MODELS[config.preferredModel] || AI_MODELS.gpt).name}\n` +
                      `📡 *Mode:* ${config.mode.toUpperCase()}\n\n`;

      if (Object.keys(stats.modelsUsed || {}).length > 0) {
        statsText += `🔄 *AI Usage:*\n`;
        const sorted = Object.entries(stats.modelsUsed).sort((a, b) => b[1] - a[1]);
        for (const [modelKey, count] of sorted) {
          const model = AI_MODELS[modelKey];
          if (model) statsText += `  ${model.icon} ${model.name}: ${count}\n`;
        }
        statsText += `\n`;
      }

      if (Object.keys(stats.mediaActions || {}).length > 0) {
        const mediaEmojis  = { image: '🎨', playAudio: '🎵', playVideo: '🎬', song: '🎶' };
        const mediaLabels  = { image: 'Images', playAudio: 'Music', playVideo: 'Videos', song: 'Songs' };
        statsText += `🎯 *Media Actions:*\n`;
        for (const [key, count] of Object.entries(stats.mediaActions)) {
          statsText += `  ${mediaEmojis[key] || '📦'} ${mediaLabels[key] || key}: ${count}\n`;
        }
      }

      statsText += `\n⚡ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      return sock.sendMessage(jid, { text: statsText }, { quoted: m });
    }

    // ── Clear conversation history ────────────────────────────────────────
    if (subCommand === 'clear') {
      const senderJid = m.key.participant || jid;
      clearConversation(senderJid);
      clearPendingAction(senderJid, jid);
      return sock.sendMessage(jid, {
        text: `✅ Conversation history cleared`
      }, { quoted: m });
    }

    // ── Settings overview ─────────────────────────────────────────────────
    if (subCommand === 'settings') {
      const model     = AI_MODELS[config.preferredModel] || AI_MODELS.gpt;
      const modeEmoji = { off: '🔴', on: '🟢', groups: '👥', dms: '💬', both: '🌐' };

      const exGroups = config.excludedGroups || [];
      const aDMs     = config.allowedDMs    || [];
      let filterSection = '';
      if (exGroups.length > 0 || aDMs.length > 0) {
        filterSection = `\n📋 *Filters:*\n`;
        if (exGroups.length > 0) filterSection += `  🚫 ${exGroups.length} group(s) excluded\n`;
        if (aDMs.length     > 0) filterSection += `  💬 ${aDMs.length} DM(s) whitelisted\n`;
      }

      const cbName = config.chatbotName || 'W.O.L.F';
      const cbTech = config.techName || 'WOLF TECH';
      const settingsText =
        ` *${cbName} Settings*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🏷️ *Name:* ${cbName}\n` +
        `🏢 *Tech:* ${cbTech}\n` +
        `${modeEmoji[config.mode] || '🔴'} *Mode:* ${config.mode.toUpperCase()}\n` +
        `${model.icon} *Model:* ${model.name}\n` +
        `🔄 *Auto-Fallback:* Enabled\n` +
        `💾 *Memory:* 20 msgs (1hr timeout)\n` +
        `🎯 *Interactive:* Images, Music, Videos\n` +
        `📊 *Queries:* ${config.stats?.totalQueries || 0}\n` +
        filterSection + `\n` +
        `🤖 *Models (${Object.keys(AI_MODELS).length}):*\n` +
        Object.entries(AI_MODELS).map(([k, v]) => `  ${v.icon} ${v.name} (\`${k}\`)`).join('\n') +
        `\n\n⚡ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      return sock.sendMessage(jid, { text: settingsText }, { quoted: m });
    }

    // ── Group whitelist management ────────────────────────────────────────

    if (subCommand === 'addgroup') {
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, { text: `❌ Run this command inside a group.` }, { quoted: m });
      }
      if (!config.excludedGroups) config.excludedGroups = [];
      let groupName = jid.split('@')[0];
      const cachedG = globalThis.groupMetadataCache?.get(jid);
      if (cachedG?.data?.subject) groupName = cachedG.data.subject;

      const wasOffG = config.mode === 'off';
      if (wasOffG) config.mode = 'groups';

      const exIdx = config.excludedGroups.indexOf(jid);
      if (exIdx !== -1) {
        // Group was excluded — re-include it
        config.excludedGroups.splice(exIdx, 1);
        saveConfig(config);
        return sock.sendMessage(jid, {
          text: `✅ *${groupName}* re-enabled — chatbot will respond here again.`
        }, { quoted: m });
      }

      // Already active
      saveConfig(config);
      const autoNoteG = wasOffG ? `\n⚠️ Mode auto-set to GROUPS (was OFF)` : '';
      return sock.sendMessage(jid, {
        text: `✅ *${groupName}* is already active${autoNoteG}`
      }, { quoted: m });
    }

    if (subCommand === 'removegroup') {
      if (!config.excludedGroups) config.excludedGroups = [];

      // Resolve target JID — from argument or current group
      let targetJid = null;
      if (args[1]) {
        targetJid = args[1].includes('@') ? args[1].trim() : `${args[1].trim()}@g.us`;
      } else if (jid.endsWith('@g.us')) {
        targetJid = jid;
      } else {
        return sock.sendMessage(jid, {
          text: `❌ Provide a group JID: *${PREFIX}chatbot removegroup <jid>*\n_Run ${PREFIX}chatbot listgroups to see all groups._`
        }, { quoted: m });
      }

      if (config.excludedGroups.includes(targetJid)) {
        return sock.sendMessage(jid, {
          text: `⚠️ That group is already excluded.\n_Use ${PREFIX}chatbot addgroup inside it to re-enable._`
        }, { quoted: m });
      }

      let removedName = targetJid.split('@')[0];
      const cachedMeta = globalThis.groupMetadataCache?.get(targetJid);
      if (cachedMeta?.data?.subject) removedName = cachedMeta.data.subject;

      config.excludedGroups.push(targetJid);
      saveConfig(config);
      return sock.sendMessage(jid, {
        text: `🚫 *${removedName}* excluded — chatbot won't respond there.\n_Use ${PREFIX}chatbot addgroup inside it to re-enable._`
      }, { quoted: m });
    }

    if (subCommand === 'listgroups') {
      const excluded = config.excludedGroups || [];

      // Fetch the live group list — same method used by ?mygroups
      let allGroupEntries = [];
      try {
        const fetched = await sock.groupFetchAllParticipating();
        allGroupEntries = Object.values(fetched || {});
      } catch (fetchErr) {
        return sock.sendMessage(jid, {
          text: `❌ Failed to fetch groups: ${fetchErr.message}`
        }, { quoted: m });
      }

      if (allGroupEntries.length === 0) {
        return sock.sendMessage(jid, {
          text: `📋 Bot is not in any groups yet.`
        }, { quoted: m });
      }

      // Resolve names (subject from fetch → metaCache fallback)
      const metaCache = globalThis.groupMetadataCache;
      const knownGroups = allGroupEntries.map(g => {
        let name = (g.subject || '').trim();
        if (!name && metaCache) {
          const cached = metaCache.get(g.id);
          if (cached?.data?.subject) name = cached.data.subject.trim();
        }
        return { gid: g.id, name: name || g.id.split('@')[0] };
      });

      knownGroups.sort((a, b) => a.name.localeCompare(b.name));

      const activeCount = knownGroups.filter(g => !excluded.includes(g.gid)).length;
      let listText = `📋 *Groups (${knownGroups.length} total, ${activeCount} active):*\n\n`;
      for (let i = 0; i < knownGroups.length; i++) {
        const { gid, name } = knownGroups[i];
        const isExcluded = excluded.includes(gid);
        listText += isExcluded
          ? `${i + 1}. 🚫 *${name}*\n`
          : `${i + 1}. ✅ *${name}*\n`;
      }
      listText += `\n_✅ active  •  🚫 excluded_\n_Reply with a number to copy its JID_`;

      const sent   = await sock.sendMessage(jid, { text: listText }, { quoted: m });
      const sentId = sent?.key?.id;
      if (sentId) {
        _lgCache.set(sentId, knownGroups);
        if (_lgCache.size > _LG_MAX) _lgCache.delete(_lgCache.keys().next().value);
      }
      return;
    }

    if (subCommand === 'cleargroups') {
      config.excludedGroups = [];
      saveConfig(config);
      return sock.sendMessage(jid, {
        text: `✅ All exclusions cleared — chatbot will respond in all groups again.`
      }, { quoted: m });
    }

    // ── DM whitelist management ───────────────────────────────────────────

    if (subCommand === 'adddm') {
      const number = (args[1] || '').replace(/[^0-9]/g, '');
      if (!number || number.length < 7) {
        return sock.sendMessage(jid, {
          text: `❌ Provide a valid number.\nUsage: \`${PREFIX}chatbot adddm 2547xxxxxxxx\``
        }, { quoted: m });
      }
      if (!config.allowedDMs) config.allowedDMs = [];
      const dmJid  = `${number}@s.whatsapp.net`;
      const exists = config.allowedDMs.some(dm => {
        const normDM = dm.split('@')[0].split(':')[0];
        return normDM === number;
      });
      if (exists) {
        return sock.sendMessage(jid, { text: `⚠️ ${number} is already added.` }, { quoted: m });
      }
      config.allowedDMs.push(dmJid);
      const wasOff = config.mode === 'off';
      if (wasOff) config.mode = 'dms';
      saveConfig(config);
      const autoNote = wasOff ? `\n⚠️ Mode auto-set to DMS (was OFF)` : '';
      return sock.sendMessage(jid, {
        text: `✅ ${number} successfully added${autoNote}`
      }, { quoted: m });
    }

    if (subCommand === 'removedm') {
      const number = (args[1] || '').replace(/[^0-9]/g, '');
      if (!number || number.length < 7) {
        return sock.sendMessage(jid, {
          text: `❌ Provide a valid number.\nUsage: \`${PREFIX}chatbot removedm 2547xxxxxxxx\``
        }, { quoted: m });
      }
      if (!config.allowedDMs) config.allowedDMs = [];
      const idx = config.allowedDMs.findIndex(dm => {
        const normDM = dm.split('@')[0].split(':')[0];
        return normDM === number;
      });
      if (idx === -1) {
        return sock.sendMessage(jid, { text: `⚠️ ${number} is not in the list.` }, { quoted: m });
      }
      config.allowedDMs.splice(idx, 1);
      saveConfig(config);
      return sock.sendMessage(jid, {
        text: `✅ ${number} successfully removed`
      }, { quoted: m });
    }

    if (subCommand === 'listdms') {
      const dms = config.allowedDMs || [];
      if (dms.length === 0) {
        return sock.sendMessage(jid, {
          text: `📋 No DMs in whitelist.`
        }, { quoted: m });
      }
      let listText = `📋 *Whitelisted DMs (${dms.length}):*\n`;
      for (let i = 0; i < dms.length; i++) {
        const num = dms[i].split('@')[0].split(':')[0];
        listText += `${i + 1}. +${num}\n`;
      }
      return sock.sendMessage(jid, { text: listText }, { quoted: m });
    }

    if (subCommand === 'cleardms') {
      config.allowedDMs = [];
      saveConfig(config);
      return sock.sendMessage(jid, {
        text: `✅ All DMs cleared`
      }, { quoted: m });
    }

    // ── Rename the chatbot ────────────────────────────────────────────────
    if (subCommand === 'name') {
      const newName = args.slice(1).join(' ').trim();
      if (!newName) {
        const currentName = config.chatbotName || 'W.O.L.F';
        return sock.sendMessage(jid, {
          text: `Name: *${currentName}*\nChange: \`${PREFIX}chatbot name <new name>\``
        }, { quoted: m });
      }
      if (newName.length > 30) {
        return sock.sendMessage(jid, { text: `❌ Name too long (max 30 characters).` }, { quoted: m });
      }
      config.chatbotName = newName;
      saveConfig(config);
      return sock.sendMessage(jid, {
        text: `✅ Chatbot name set to: *${newName}*`
      }, { quoted: m });
    }

    // ── Rename the tech/creator name ──────────────────────────────────────
    if (subCommand === 'techname') {
      const newTech = args.slice(1).join(' ').trim();
      if (!newTech) {
        const current = config.techName || 'WOLF TECH';
        return sock.sendMessage(jid, {
          text: `Tech name: *${current}*\nChange: \`${PREFIX}chatbot techname <new name>\``
        }, { quoted: m });
      }
      if (newTech.length > 40) {
        return sock.sendMessage(jid, { text: `❌ Tech name too long (max 40 characters).` }, { quoted: m });
      }
      config.techName = newTech;
      saveConfig(config);
      return sock.sendMessage(jid, {
        text: `✅ Tech/creator name set to: *${newTech}*\nThe chatbot will now say it was created by *${newTech}*.`
      }, { quoted: m });
    }

    // ── Per-group user filter management ─────────────────────────────────
    // allowonly  — respond ONLY to listed users in this group
    // blockuser  — respond to ALL except listed users
    // allowuser  — add a user to allow-list OR remove from block-list
    // removeuser — remove a user from the current filter list
    // listusers  — show the current filter for this group
    // clearusers — remove the filter entirely (respond to everyone)
    // Users can be specified via @mention or plain phone number.

    if (['allowonly', 'blockuser', 'allowuser', 'removeuser', 'listusers', 'clearusers'].includes(subCommand)) {
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, {
          text: `❌ User filters are per-group. Run this command inside a group.`
        }, { quoted: m });
      }

      if (!config.groupUserFilters) config.groupUserFilters = {};

      // ── listusers ────────────────────────────────────────────────────
      if (subCommand === 'listusers') {
        const filter = config.groupUserFilters[jid];
        if (!filter || !filter.users || filter.users.length === 0) {
          return sock.sendMessage(jid, {
            text: `ℹ️ *No user filter set for this group.*\nChatbot replies to *everyone*.\n\nUse:\n• \`${PREFIX}chatbot allowonly @user\` — only reply to specific people\n• \`${PREFIX}chatbot blockuser @user\` — block specific people`
          }, { quoted: m });
        }
        const modeLabel = filter.mode === 'allow'
          ? '✅ *ALLOW ONLY* — replies only to listed users'
          : '🚫 *BLOCK LIST* — replies to everyone except listed users';
        let text = `╭─⌈ 👤 *USER FILTER* ⌋\n│\n│ ${modeLabel}\n│\n`;
        filter.users.forEach((u, i) => {
          const num = u.split('@')[0].split(':')[0];
          text += `│ ${i + 1}. +${num}\n`;
        });
        text += `│\n╰⊷ ${getFooter(m.key.participant || jid)}`;
        return sock.sendMessage(jid, { text }, { quoted: m });
      }

      // ── clearusers ───────────────────────────────────────────────────
      if (subCommand === 'clearusers') {
        delete config.groupUserFilters[jid];
        saveConfig(config);
        return sock.sendMessage(jid, {
          text: `✅ User filter cleared — chatbot will reply to *everyone* in this group.`
        }, { quoted: m });
      }

      // ── allowonly / blockuser / allowuser / removeuser ───────────────
      const targets = await _extractTargetUsers(sock, m, args);
      if (targets.length === 0) {
        const hint = subCommand === 'allowonly'
          ? `\`${PREFIX}chatbot allowonly @user\``
          : subCommand === 'blockuser'
            ? `\`${PREFIX}chatbot blockuser @user\``
            : subCommand === 'allowuser'
              ? `\`${PREFIX}chatbot allowuser @user\``
              : `\`${PREFIX}chatbot removeuser @user\``;
        return sock.sendMessage(jid, {
          text: `❌ @Mention someone or provide a number.\nExample: ${hint}`
        }, { quoted: m });
      }

      // Helper: build "@phonenumber" mention text + mentions array
      const _mentionLine = (list) => ({
        text: list.map(u => `@${u.split('@')[0].split(':')[0].replace(/\D/g, '')}`).join(', '),
        mentions: list
      });

      const filter = config.groupUserFilters[jid] || { mode: 'block', users: [] };

      if (subCommand === 'allowonly') {
        filter.mode = 'allow';
        for (const u of targets) {
          const uNum = u.split('@')[0].replace(/\D/g, '');
          const exists = filter.users.some(x => x.split('@')[0].replace(/\D/g, '') === uNum);
          if (!exists) filter.users.push(u);
        }
        config.groupUserFilters[jid] = filter;
        saveConfig(config);
        const { text: nameStr, mentions } = _mentionLine(targets);
        return sock.sendMessage(jid, {
          text: `✅ *Allow-only mode* set.\nChatbot will reply *only* to: ${nameStr}\n_Add more anytime with \`${PREFIX}chatbot allowonly @user\`_`,
          mentions
        }, { quoted: m });
      }

      if (subCommand === 'blockuser') {
        filter.mode = 'block';
        const added = [];
        for (const u of targets) {
          const uNum = u.split('@')[0].replace(/\D/g, '');
          const exists = filter.users.some(x => x.split('@')[0].replace(/\D/g, '') === uNum);
          if (!exists) { filter.users.push(u); added.push(u); }
        }
        config.groupUserFilters[jid] = filter;
        saveConfig(config);
        if (added.length === 0) {
          return sock.sendMessage(jid, { text: `⚠️ Those users are already blocked.` }, { quoted: m });
        }
        const { text: nameStr, mentions } = _mentionLine(added);
        return sock.sendMessage(jid, {
          text: `🚫 *Blocked:* ${nameStr}\nChatbot will ignore them in this group.\n_Use \`${PREFIX}chatbot allowuser @user\` to unblock._`,
          mentions
        }, { quoted: m });
      }

      if (subCommand === 'allowuser') {
        for (const u of targets) {
          const uNum = u.split('@')[0].replace(/\D/g, '');
          if (filter.mode === 'block') {
            const idx = filter.users.findIndex(x => x.split('@')[0].replace(/\D/g, '') === uNum);
            if (idx !== -1) filter.users.splice(idx, 1);
          } else if (filter.mode === 'allow') {
            const exists = filter.users.some(x => x.split('@')[0].replace(/\D/g, '') === uNum);
            if (!exists) filter.users.push(u);
          }
        }
        if (filter.users.length === 0) delete config.groupUserFilters[jid];
        else config.groupUserFilters[jid] = filter;
        saveConfig(config);
        const { text: nameStr, mentions } = _mentionLine(targets);
        const action = filter.mode === 'allow' ? 'Added to allow list' : 'Unblocked';
        return sock.sendMessage(jid, {
          text: `✅ *${action}:* ${nameStr}`,
          mentions
        }, { quoted: m });
      }

      if (subCommand === 'removeuser') {
        const removed = [];
        for (const u of targets) {
          const uNum = u.split('@')[0].replace(/\D/g, '');
          const idx = filter.users.findIndex(x => x.split('@')[0].replace(/\D/g, '') === uNum);
          if (idx !== -1) { removed.push(filter.users[idx]); filter.users.splice(idx, 1); }
        }
        if (removed.length === 0) {
          return sock.sendMessage(jid, { text: `⚠️ None of those users were in the filter list.` }, { quoted: m });
        }
        if (filter.users.length === 0) delete config.groupUserFilters[jid];
        else config.groupUserFilters[jid] = filter;
        saveConfig(config);
        const { text: nameStr, mentions } = _mentionLine(removed);
        return sock.sendMessage(jid, {
          text: `✅ *Removed from filter:* ${nameStr}\n${filter.users?.length ? `_${filter.users.length} user(s) still in list._` : '_Filter cleared — chatbot replies to everyone._'}`,
          mentions
        }, { quoted: m });
      }
    }

    // Unknown sub-command fallback
    return sock.sendMessage(jid, {
      text: `❌ Unknown option: *${subCommand}*\nUse \`${PREFIX}chatbot\` to see all commands.`
    }, { quoted: m });
  }
};
