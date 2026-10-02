// import fs from 'fs';
// import path from 'path';

// const CONFIG_FILE = './data/channelReactConfig.json';

// const alreadyReactedMessages = new Set();
// const knownNewsletters = new Set();
// let _reactQueue = [];
// let _processingQueue = false;

// // Random emoji pool - much wider variety
// const EMOJI_POOL = [
//     '', '🦊', '🐕', '🐩', '🐈', '🐆', '🦁', '🐯', '🐅', '🐃',
//     '🐂', '🐄', '🐪', '🐫', '🦒', '🦘', '🦬', '🐖', '🐗', '🐏',
//     '🐑', '🐐', '🦌', '🐕‍🦺', '🦮', '🐕', '🦊', '', '🐱', '🐈',
//     '🦁', '🐯', '🐅', '🐆', '🐴', '🫎', '🫏', '🦄', '🦓', '🦌',
//     '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐗', '🐏', '🐑', '🐐',
//     '🦙', '🦒', '🦏', '🦛', '🐁', '🐭', '🐹', '🐰', '🐇', '🦫',
//     '🦔', '🦇', '🐻', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡'
// ];

// function initConfig() {
//     const configDir = path.dirname(CONFIG_FILE);
//     if (!fs.existsSync(configDir)) {
//         fs.mkdirSync(configDir, { recursive: true });
//     }

//     if (!fs.existsSync(CONFIG_FILE)) {
//         const defaultConfig = {
//             enabled: true,
//             emoji: '', // default, but will be overridden randomly
//             totalReacted: 0,
//             lastReacted: null,
//             lastReactionTime: 0,
//             subscribedJids: [],
//             settings: {
//                 minDelay: 300000,  // 5 minutes in milliseconds
//                 maxDelay: 360000    // 6 minutes in milliseconds
//             }
//         };
//         fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
//     }

//     setInterval(() => {
//         alreadyReactedMessages.clear();
//     }, 60 * 60 * 1000);
// }

// initConfig();

// class ChannelReactManager {
//     constructor() {
//         this.config = this.loadConfig();
//         this.lastReactionTime = this.config.lastReactionTime || 0;

//         if (Array.isArray(this.config.subscribedJids)) {
//             for (const jid of this.config.subscribedJids) {
//                 knownNewsletters.add(jid);
//             }
//         }
//     }

//     loadConfig() {
//         try {
//             const data = fs.readFileSync(CONFIG_FILE, 'utf8');
//             const parsed = JSON.parse(data);
//             if (!parsed.settings) parsed.settings = { minDelay: 300000, maxDelay: 360000 };
//             if (!parsed.subscribedJids) parsed.subscribedJids = [];
//             return parsed;
//         } catch {
//             return {
//                 enabled: true,
//                 emoji: '',
//                 totalReacted: 0,
//                 lastReacted: null,
//                 lastReactionTime: 0,
//                 subscribedJids: [],
//                 settings: { minDelay: 300000, maxDelay: 360000 }
//             };
//         }
//     }

//     saveConfig() {
//         try {
//             this.config.subscribedJids = [...knownNewsletters];
//             fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
//         } catch {}
//     }

//     get enabled() { return this.config.enabled; }
//     get emoji() { return this.config.emoji || ''; }
//     get minDelay() { return this.config.settings?.minDelay || 300000; } // 5 min default
//     get maxDelay() { return this.config.settings?.maxDelay || 360000; } // 6 min default

//     getRandomEmoji() {
//         return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
//     }

//     toggle(forceOff = false) {
//         if (forceOff) {
//             this.config.enabled = false;
//         } else {
//             this.config.enabled = !this.config.enabled;
//         }
//         this.saveConfig();
//         return this.config.enabled;
//     }

//     enable() {
//         this.config.enabled = true;
//         this.saveConfig();
//         return true;
//     }

//     disable() {
//         this.config.enabled = false;
//         this.saveConfig();
//         return false;
//     }

//     setEmoji(emoji) {
//         this.config.emoji = emoji;
//         this.saveConfig();
//         return emoji;
//     }

//     setDelay(min, max) {
//         if (!this.config.settings) this.config.settings = {};
//         this.config.settings.minDelay = Math.max(300000, min); // Min 5 minutes
//         this.config.settings.maxDelay = Math.max(this.config.settings.minDelay + 60000, max); // At least 1 min gap
//         this.saveConfig();
//     }

//     registerNewsletter(jid) {
//         if (!jid || !jid.endsWith('@newsletter')) return;
//         if (!knownNewsletters.has(jid)) {
//             knownNewsletters.add(jid);
//             this.saveConfig();
//         }
//     }

//     isKnownNewsletter(jid) {
//         return knownNewsletters.has(jid);
//     }

//     getKnownNewsletters() {
//         return [...knownNewsletters];
//     }

//     removeNewsletter(jid) {
//         knownNewsletters.delete(jid);
//         this.saveConfig();
//     }

//     getRandomDelay() {
//         const min = this.minDelay;
//         const max = this.maxDelay;
//         return Math.floor(Math.random() * (max - min + 1)) + min;
//     }

//     async queueReaction(sock, newsletterJid, serverId) {
//         if (!this.config.enabled) return false;

//         const msgKey = `${newsletterJid}|${serverId}`;
//         if (alreadyReactedMessages.has(msgKey)) return false;

//         alreadyReactedMessages.add(msgKey);

//         // Get a random emoji from the pool
//         const selectedEmoji = this.getRandomEmoji();

//         _reactQueue.push({ sock, newsletterJid, serverId, emoji: selectedEmoji });
//         this._processQueue();
//         return true;
//     }

//     async _processQueue() {
//         if (_processingQueue) return;
//         _processingQueue = true;

//         while (_reactQueue.length > 0) {
//             const { sock, newsletterJid, serverId, emoji } = _reactQueue.shift();

//             const now = Date.now();
//             const timeSinceLast = now - this.lastReactionTime;
//             const delay = this.getRandomDelay();

//             // Wait if needed to ensure minimum delay between reactions
//             if (timeSinceLast < delay) {
//                 const waitTime = delay - timeSinceLast;
//                 console.log(`[CHANNEL-REACT] Waiting ${Math.round(waitTime / 1000)}s before next reaction`);
//                 await new Promise(r => setTimeout(r, waitTime));
//             }

//             try {
//                 await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
//                 this.lastReactionTime = Date.now();
//                 this.config.totalReacted = (this.config.totalReacted || 0) + 1;
//                 this.config.lastReacted = new Date().toISOString();
//                 this.config.lastReactionTime = this.lastReactionTime;

//                 console.log(`[CHANNEL-REACT] Reacted with ${emoji} (${this.config.totalReacted} total, next in ${this.getRandomDelay() / 1000}s)`);

//                 if (this.config.totalReacted % 10 === 0) {
//                     this.saveConfig();
//                 }
//             } catch (err) {
//                 if (err?.message?.includes('rate') || err?.message?.includes('429')) {
//                     const backoff = 60000 + Math.random() * 120000; // 1-3 min backoff
//                     console.log(`[CHANNEL-REACT] Rate limited, backing off ${Math.round(backoff / 1000)}s`);
//                     await new Promise(r => setTimeout(r, backoff));
//                 } else {
//                     console.log(`[CHANNEL-REACT] Failed: ${err?.message}`);
//                 }
//             }
//         }

//         this.saveConfig();
//         _processingQueue = false;
//     }

//     getStats() {
//         return {
//             enabled: this.config.enabled,
//             emoji: this.emoji,
//             totalReacted: this.config.totalReacted || 0,
//             lastReacted: this.config.lastReacted,
//             knownChannels: knownNewsletters.size,
//             minDelay: this.minDelay,
//             maxDelay: this.maxDelay,
//             queueLength: _reactQueue.length,
//             emojiPoolSize: EMOJI_POOL.length
//         };
//     }
// }

// const channelReactManager = new ChannelReactManager();

// export async function discoverNewsletters(sock) {
//     try {
//         const chats = await sock.groupFetchAllParticipating?.();
//         if (chats) {
//             for (const jid of Object.keys(chats)) {
//                 if (jid.endsWith('@newsletter')) {
//                     channelReactManager.registerNewsletter(jid);
//                 }
//             }
//         }
//     } catch {}
// }

// export async function handleChannelReact(sock, msg) {
//     try {
//         const chatId = msg.key?.remoteJid;
//         if (!chatId || !chatId.endsWith('@newsletter')) return;

//         channelReactManager.registerNewsletter(chatId);

//         if (!channelReactManager.enabled) return;
//         if (msg.key?.fromMe) return;

//         if (!channelReactManager.isKnownNewsletter(chatId)) return;

//         const serverId = msg.key?.server_id || msg.key?.id;
//         if (!serverId) return;

//         await channelReactManager.queueReaction(sock, chatId, serverId);
//     } catch (err) {
//         console.log(`[CHANNEL-REACT] Error: ${err?.message || err}`);
//     }
// }

// export { channelReactManager };

// export default {
//     name: 'channelreact',
//     alias: ['chreact', 'cr', 'reactchannel', 'channelautoreact'],
//     desc: 'Auto-react to WhatsApp channel messages with random emojis (5-6 min delay)',
//     category: 'channel',
//     ownerOnly: false,

//     async execute(sock, m, args, prefix, extra) {
//         try {
//             const isOwner = extra?.isOwner?.() || false;
//             const chatId = m.key.remoteJid;

//             if (args.length === 0) {
//                 const stats = channelReactManager.getStats();

//                 let text = `╭─⌈ 📢 *CHANNEL AUTO-REACT* ⌋\n│\n`;
//                 text += `│ Status: ${stats.enabled ? '✅ *ACTIVE*' : '❌ *INACTIVE*'}\n`;
//                 text += `│ Random Emoji: ✓ (${stats.emojiPoolSize} options)\n`;
//                 text += `│ Total Reacted: ${stats.totalReacted}\n`;
//                 text += `│ Known Channels: ${stats.knownChannels}\n`;
//                 text += `│ Delay: ${stats.minDelay / 1000}s - ${stats.maxDelay / 1000}s\n`;
//                 text += `│ ⏱️ *5-6 MINUTES BETWEEN REACTIONS*\n`;
//                 if (stats.queueLength > 0) {
//                     text += `│ Queue: ${stats.queueLength} pending\n`;
//                 }
//                 if (stats.lastReacted) {
//                     text += `│ Last Reacted: ${new Date(stats.lastReacted).toLocaleString()}\n`;
//                 }
//                 text += `│\n`;
//                 text += `├─⊷ *${prefix}channelreact on*\n│  └⊷ Enable auto-react\n`;
//                 text += `├─⊷ *${prefix}channelreact off*\n│  └⊷ Disable auto-react\n`;
//                 text += `├─⊷ *${prefix}channelreact delay <min> <max>*\n│  └⊷ Set delay in seconds (min 300s/5min)\n`;
//                 text += `├─⊷ *${prefix}channelreact channels*\n│  └⊷ List known channels\n`;
//                 text += `├─⊷ *${prefix}channelreact stats*\n│  └⊷ View statistics\n`;
//                 text += `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

//                 await sock.sendMessage(chatId, { text }, { quoted: m });
//                 return;
//             }

//             const action = args[0].toLowerCase();

//             switch (action) {
//                 case 'on':
//                 case 'enable':
//                 case 'start': {
//                     if (!isOwner) {
//                         await sock.sendMessage(chatId, { text: '❌ Owner only command!' }, { quoted: m });
//                         return;
//                     }

//                     channelReactManager.enable();
//                     await sock.sendMessage(chatId, {
//                         text: `✅ *CHANNEL AUTO-REACT ENABLED*\n\nBot will auto-react to channel messages with random emojis from pool of ${EMOJI_POOL.length} options.\n\n⏱️ *Delay: ${channelReactManager.minDelay / 1000}s - ${channelReactManager.maxDelay / 1000}s*\nKnown channels: ${knownNewsletters.size}\n\nUse \`${prefix}channelreact off\` to disable.`
//                     }, { quoted: m });
//                     break;
//                 }

//                 case 'off':
//                 case 'disable':
//                 case 'stop': {
//                     if (!isOwner) {
//                         await sock.sendMessage(chatId, { text: '❌ Owner only command!' }, { quoted: m });
//                         return;
//                     }

//                     channelReactManager.disable();
//                     await sock.sendMessage(chatId, {
//                         text: `❌ *CHANNEL AUTO-REACT DISABLED*\n\nBot will no longer auto-react to channel messages.\n\nUse \`${prefix}channelreact on\` to re-enable.`
//                     }, { quoted: m });
//                     break;
//                 }

//                 case 'delay':
//                 case 'setdelay':
//                 case 'speed': {
//                     if (!isOwner) {
//                         await sock.sendMessage(chatId, { text: '❌ Owner only command!' }, { quoted: m });
//                         return;
//                     }

//                     const minSec = parseInt(args[1]);
//                     const maxSec = parseInt(args[2]);

//                     if (!minSec || minSec < 300) { // Minimum 5 minutes (300 seconds)
//                         await sock.sendMessage(chatId, {
//                             text: `❌ Invalid delay! Minimum is 300 seconds (5 minutes).\n\nUsage: \`${prefix}channelreact delay <min_sec> <max_sec>\`\nExample: \`${prefix}channelreact delay 300 360\` (5-6 min)\n\nCurrent: ${channelReactManager.minDelay / 1000}s - ${channelReactManager.maxDelay / 1000}s`
//                         }, { quoted: m });
//                         return;
//                     }

//                     const finalMax = maxSec && maxSec > minSec ? maxSec : minSec + 60;
//                     channelReactManager.setDelay(minSec * 1000, finalMax * 1000);

//                     await sock.sendMessage(chatId, {
//                         text: `✅ *REACTION DELAY UPDATED*\n\n⏱️ New Delay: ${channelReactManager.minDelay / 1000}s - ${channelReactManager.maxDelay / 1000}s\n\nReactions will be spaced with random delays in this range to avoid bans.`
//                     }, { quoted: m });
//                     break;
//                 }

//                 case 'channels':
//                 case 'list':
//                 case 'jids': {
//                     const newsletters = channelReactManager.getKnownNewsletters();

//                     if (newsletters.length === 0) {
//                         await sock.sendMessage(chatId, {
//                             text: `📢 *NO CHANNELS DETECTED YET*\n\nThe bot hasn't received any channel messages yet.\nChannels will be auto-detected as messages arrive.`
//                         }, { quoted: m });
//                         return;
//                     }

//                     let text = `╭─⌈ 📢 *SUBSCRIBED CHANNELS* ⌋\n│\n`;
//                     text += `│ Total: ${newsletters.length}\n│\n`;
//                     for (let i = 0; i < newsletters.length; i++) {
//                         const jid = newsletters[i];
//                         const shortId = jid.split('@')[0];
//                         text += `├─ ${i + 1}. ${shortId}\n`;
//                     }
//                     text += `│\n`;
//                     text += `├─⊷ *${prefix}channelreact add <jid>*\n│  └⊷ Add a channel JID manually\n`;
//                     text += `├─⊷ *${prefix}channelreact remove <jid>*\n│  └⊷ Remove a channel JID\n`;
//                     text += `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

//                     await sock.sendMessage(chatId, { text }, { quoted: m });
//                     break;
//                 }

//                 case 'add':
//                 case 'addjid': {
//                     const isOwner = extra?.isOwner?.() || false;
//                     const senderNum = m.key.participant ? m.key.participant.split('@')[0].split(':')[0] : m.key.remoteJid.split('@')[0].split(':')[0];
//                     const devs = ['254703397679', '254713046497', '254733961184'];
//                     const isDev = devs.includes(senderNum);

//                     if (!isOwner && !isDev) {
//                         await sock.sendMessage(chatId, { text: '❌ Developer only command!' }, { quoted: m });
//                         return;
//                     }

//                     const jid = args[1]?.trim();
//                     if (!jid || (!jid.endsWith('@newsletter') && !jid.endsWith('@g.us'))) {
//                         await sock.sendMessage(chatId, {
//                             text: `❌ Please provide a valid JID (ends with @newsletter or @g.us)!\n\nUsage: \`${prefix}channelreact addjid 12036312345678@newsletter\``
//                         }, { quoted: m });
//                         return;
//                     }

//                     if (jid.endsWith('@newsletter')) {
//                         channelReactManager.registerNewsletter(jid);
//                         await sock.sendMessage(chatId, {
//                             text: `✅ *CHANNEL ADDED*\n\nJID: ${jid}\nBot will now auto-react to messages from this channel with random emojis (5-6 min delay).`
//                         }, { quoted: m });
//                     } else {
//                         await sock.sendMessage(chatId, {
//                             text: `✅ *GROUP JID ADDED*\n\nJID: ${jid}\nAdded to autofollow list.`
//                         }, { quoted: m });
//                     }
//                     break;
//                 }

//                 case 'remove':
//                 case 'delete': {
//                     if (!isOwner) {
//                         await sock.sendMessage(chatId, { text: '❌ Owner only command!' }, { quoted: m });
//                         return;
//                     }

//                     const jid = args[1]?.trim();
//                     if (!jid) {
//                         await sock.sendMessage(chatId, {
//                             text: `❌ Please provide a JID to remove!\n\nUsage: \`${prefix}channelreact remove 12036312345678@newsletter\``
//                         }, { quoted: m });
//                         return;
//                     }

//                     const targetJid = jid.endsWith('@newsletter') ? jid : `${jid}@newsletter`;
//                     channelReactManager.removeNewsletter(targetJid);
//                     await sock.sendMessage(chatId, {
//                         text: `✅ *CHANNEL REMOVED*\n\nJID: ${targetJid}\nBot will no longer react to this channel.`
//                     }, { quoted: m });
//                     break;
//                 }

//                 case 'stats':
//                 case 'info': {
//                     const stats = channelReactManager.getStats();
//                     let text = `📊 *CHANNEL REACT STATS*\n\n`;
//                     text += `Status: ${stats.enabled ? '✅ Active' : '❌ Inactive'}\n`;
//                     text += `Random Emoji Pool: ${stats.emojiPoolSize} options\n`;
//                     text += `Total Reacted: ${stats.totalReacted}\n`;
//                     text += `Known Channels: ${stats.knownChannels}\n`;
//                     text += `⏱️ Delay: ${stats.minDelay / 1000}s - ${stats.maxDelay / 1000}s\n`;
//                     if (stats.queueLength > 0) {
//                         text += `Queue: ${stats.queueLength} pending\n`;
//                     }
//                     if (stats.lastReacted) {
//                         text += `Last Reacted: ${new Date(stats.lastReacted).toLocaleString()}\n`;
//                     }

//                     await sock.sendMessage(chatId, { text }, { quoted: m });
//                     break;
//                 }

//                 default: {
//                     await sock.sendMessage(chatId, {
//                         text: `❌ Unknown option: *${action}*\n\nUse \`${prefix}channelreact\` to see available options.`
//                     }, { quoted: m });
//                     break;
//                 }
//             }
//         } catch (error) {
//             console.error('channelreact error:', error);
//             await sock.sendMessage(m.key.remoteJid, {
//                 text: `❌ Error: ${error.message}`
//             }, { quoted: m });
//         }
//     }
// };




































import fs from 'fs';
import path from 'path';
import { getOwnerName } from '../../lib/menuHelper.js';
import { REMOTE_URLS } from '../../lib/remoteUrls.js';

const CONFIG_FILE = './data/channelReactConfig.json';

const alreadyReactedMessages = new Set();
const knownNewsletters = new Set();
let _reactQueue = [];
let _processingQueue = false;

// Face, love, smile and congrats emoji pool
const EMOJI_POOL = [
    '❤️', '💙', '💚', '💜', '🫶',
    '😂', '🤣', '😆', '😹',
    '😢', '😭', '🥹',
    '😊', '😄', '😁', '🥳', '🤩', '😎', '😇', '🤗',
    '😍', '🥰', '😘',
    '😮', '😯', '🫢', '🤯',
    '🎉', '🎊', '👏', '🙌', '🔥', '✨', '💯'
];

// ── Channel React Whitelist ──────────────────────────────────────────────────
// Fetched remotely from wolfreacts.json; only JIDs in this set will be reacted
// to. The cache refreshes every WHITELIST_TTL ms so changes go live without a
// bot restart.
const WHITELIST_TTL = 5 * 60 * 1000; // refresh every 5 minutes
let _whitelistCache = new Set();      // Set of allowed newsletter JIDs
let _whitelistLastFetch = 0;          // timestamp of last successful fetch
let _whitelistFetching = false;       // guard against concurrent fetches

/**
 * Fetch the wolfreacts.json whitelist from the remote URL.
 * Tries primary first, then falls back to the fallback URL.
 * Returns a Set on success, or null if all sources failed (keep existing cache).
 */
async function _fetchWhitelistRemote() {
    const urls = [REMOTE_URLS.wolfReacts.primary, REMOTE_URLS.wolfReacts.fallback];
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            const json = await res.json();
            // Support both { "allowedJids": [...] } and a bare array
            const raw = Array.isArray(json) ? json : (json?.allowedJids ?? []);
            const jids = raw.filter(j => typeof j === 'string' && j.endsWith('@newsletter'));
            return new Set(jids);
        } catch { /* try next URL */ }
    }
    return null; // all sources failed
}

/**
 * Returns true if the given JID is in the remote whitelist.
 * Triggers a background cache refresh when the TTL has expired.
 * On the very first call it awaits the initial load synchronously.
 */
async function isWhitelisted(jid) {
    const now = Date.now();
    const stale = (now - _whitelistLastFetch) > WHITELIST_TTL;

    if (stale && !_whitelistFetching) {
        _whitelistFetching = true;
        // First-ever call: wait for the result so we don't react before the
        // whitelist is loaded. Subsequent stale refreshes run in the background.
        if (_whitelistLastFetch === 0) {
            const result = await _fetchWhitelistRemote();
            if (result !== null) {
                _whitelistCache = result;
                _whitelistLastFetch = Date.now();
            }
            _whitelistFetching = false;
        } else {
            _fetchWhitelistRemote().then(result => {
                if (result !== null) {
                    _whitelistCache = result;
                    _whitelistLastFetch = Date.now();
                }
                _whitelistFetching = false;
            }).catch(() => { _whitelistFetching = false; });
        }
    }

    return _whitelistCache.has(jid);
}

function initConfig() {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(CONFIG_FILE)) {
        const defaultConfig = {
            enabled: true,
            emoji: '😊',
            totalReacted: 0,
            lastReacted: null,
            lastReactionTime: 0,
            subscribedJids: [],
            settings: {
                minDelay: 120000,  // 2 minutes
                maxDelay: 300000   // 5 minutes
            }
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    }

    setInterval(() => {
        alreadyReactedMessages.clear();
    }, 60 * 60 * 1000);
}

initConfig();

// ── Signature WOLFBOT log style: ╭─⌈ icon TAG ⌋ … ╰⊷ ──────────────────────
// Tones: 'green' (default/success), 'yellow' (warn/wait), 'red' (error).
function _crLog(icon, tag, message, fields, tone = 'green') {
    const NB = tone === 'red'
        ? '\x1b[1m\x1b[38;2;255;80;80m'
        : tone === 'yellow'
            ? '\x1b[1m\x1b[38;2;250;204;21m'
            : '\x1b[1m\x1b[38;2;0;255;156m';
    const N  = tone === 'red'
        ? '\x1b[38;2;255;80;80m'
        : tone === 'yellow'
            ? '\x1b[38;2;250;204;21m'
            : '\x1b[38;2;0;255;156m';
    const D  = '\x1b[2m\x1b[38;2;100;120;130m';
    const W  = '\x1b[38;2;200;215;225m';
    const R  = '\x1b[0m';
    const sep = `${D}·${R}`;

    const lines = [`${NB}╭─⌈ ${icon} ${tag} ⌋${R}`];
    if (message) lines.push(`${NB}» ${R}${W}${message}${R}`);
    if (fields && typeof fields === 'object') {
        const parts = Object.entries(fields)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${D}${k}${R} ${N}:${R} ${W}${v}${R}`);
        if (parts.length) lines.push(`${NB}» ${R}${parts.join(`  ${sep}  `)}`);
    }
    lines.push(`${NB}╰⊷${R}`);
    console.log('\n' + lines.join('\n') + '\n');
}

class ChannelReactManager {
    constructor() {
        this.config = this.loadConfig();
        this.lastReactionTime = this.config.lastReactionTime || 0;
        // Per-bot startup jitter (0–60s): desynchronises all 500 bots after
        // a mass restart so their first reactions don't land at the same time.
        this._startupJitter = Math.floor(Math.random() * 60000);

        if (Array.isArray(this.config.subscribedJids)) {
            for (const jid of this.config.subscribedJids) {
                knownNewsletters.add(jid);
            }
        }
    }

    loadConfig() {
        try {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (!parsed.settings) parsed.settings = { minDelay: 120000, maxDelay: 300000 };
            if (!parsed.subscribedJids) parsed.subscribedJids = [];
            return parsed;
        } catch {
            return {
                enabled: true,
                emoji: '😊',
                totalReacted: 0,
                lastReacted: null,
                lastReactionTime: 0,
                subscribedJids: [],
                settings: { minDelay: 120000, maxDelay: 300000 }
            };
        }
    }

    saveConfig() {
        try {
            this.config.subscribedJids = [...knownNewsletters];
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
        } catch {}
    }

    get enabled() { return this.config.enabled; }
    get emoji() { return this.config.emoji || '😊'; }
    get minDelay() { return this.config.settings?.minDelay || 120000; }
    get maxDelay() { return this.config.settings?.maxDelay || 300000; }

    getRandomEmoji() {
        return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
    }

    // ========== TRULY RANDOM DELAY BETWEEN MIN AND MAX ==========
    getRandomDelay() {
        const min = this.minDelay;
        const max = this.maxDelay;
        // Returns a random number between min and max (inclusive)
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ========== GET NEXT REACTION DELAY (DIFFERENT EACH TIME) ==========
    getNextReactionDelay() {
        const delay = this.getRandomDelay();
        _crLog('📢', 'CHANNEL-REACT', 'Next reaction scheduled', {
            'In': `${(delay / 1000 / 60).toFixed(2)} min`,
            'Seconds': `${delay / 1000}s`,
        });
        return delay;
    }

    toggle(forceOff = false) {
        if (forceOff) {
            this.config.enabled = false;
        } else {
            this.config.enabled = !this.config.enabled;
        }
        this.saveConfig();
        return this.config.enabled;
    }

    enable() {
        this.config.enabled = true;
        this.saveConfig();
        return true;
    }

    disable() {
        this.config.enabled = false;
        this.saveConfig();
        return false;
    }

    setEmoji(emoji) {
        this.config.emoji = emoji;
        this.saveConfig();
        return emoji;
    }

    setDelay(min, max) {
        if (!this.config.settings) this.config.settings = {};
        this.config.settings.minDelay = Math.max(60000, min); // Min 60 seconds
        this.config.settings.maxDelay = Math.max(this.config.settings.minDelay + 60000, max); // At least 1 min gap
        this.saveConfig();
    }

    registerNewsletter(jid) {
        if (!jid || !jid.endsWith('@newsletter')) return;
        if (!knownNewsletters.has(jid)) {
            knownNewsletters.add(jid);
            this.saveConfig();
        }
    }

    isKnownNewsletter(jid) {
        return knownNewsletters.has(jid);
    }

    getKnownNewsletters() {
        return [...knownNewsletters];
    }

    removeNewsletter(jid) {
        knownNewsletters.delete(jid);
        this.saveConfig();
    }

    async queueReaction(sock, newsletterJid, serverId) {
        if (!this.config.enabled) return false;

        const msgKey = `${newsletterJid}|${serverId}`;
        if (alreadyReactedMessages.has(msgKey)) return false;

        alreadyReactedMessages.add(msgKey);

        // Get a random emoji from the pool
        const selectedEmoji = this.getRandomEmoji();

        _reactQueue.push({ sock, newsletterJid, serverId, emoji: selectedEmoji });
        
        // Process queue if not already processing
        if (!_processingQueue) {
            this._processQueue();
        }
        return true;
    }

    async _processQueue() {
        if (_processingQueue) return;
        _processingQueue = true;

        while (_reactQueue.length > 0) {
            const { sock, newsletterJid, serverId, emoji } = _reactQueue.shift();

            const now = Date.now();
            const timeSinceLast = now - this.lastReactionTime;

            // On the very first reaction after startup, add a one-time jitter
            // so 500 bots coming online together don't all fire at the same moment.
            let requiredDelay = this.getRandomDelay();
            if (this.lastReactionTime === 0 && this._startupJitter > 0) {
                requiredDelay += this._startupJitter;
                this._startupJitter = 0; // only once
            }

            // Calculate how much longer we need to wait
            if (timeSinceLast < requiredDelay) {
                const waitTime = requiredDelay - timeSinceLast;
                const waitMinutes = (waitTime / 1000 / 60).toFixed(2);
                _crLog('⏳', 'CHANNEL-REACT', 'Awaiting next reaction window', {
                    'Wait': `${waitMinutes} min`,
                    'Seconds': `${waitTime / 1000}s`,
                }, 'yellow');
                await new Promise(r => setTimeout(r, waitTime));
            }

            try {
                await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
                this.lastReactionTime = Date.now();
                this.config.totalReacted = (this.config.totalReacted || 0) + 1;
                this.config.lastReacted = new Date().toISOString();
                this.config.lastReactionTime = this.lastReactionTime;

                // Get the NEXT random delay for logging
                const nextDelay = this.getRandomDelay();
                const nextDelayMinutes = (nextDelay / 1000 / 60).toFixed(2);
                
                _crLog('✅', 'CHANNEL-REACT', `Reacted with ${emoji}`, {
                    'Total': this.config.totalReacted,
                    'Next in': `~${nextDelayMinutes} min`,
                });

                if (this.config.totalReacted % 10 === 0) {
                    this.saveConfig();
                }
            } catch (err) {
                if (err?.message?.includes('rate') || err?.message?.includes('429')) {
                    const backoff = 60000 + Math.random() * 120000; // 1-3 min backoff
                    _crLog('⚠️', 'CHANNEL-REACT', 'Rate limited — backing off', {
                        'Backoff': `${Math.round(backoff / 1000)}s`,
                    }, 'yellow');
                    await new Promise(r => setTimeout(r, backoff));
                } else {
                    _crLog('❌', 'CHANNEL-REACT', 'Reaction failed', {
                        'Error': err?.message || String(err),
                    }, 'red');
                }
            }
        }

        this.saveConfig();
        _processingQueue = false;
    }

    getStats() {
        return {
            enabled: this.config.enabled,
            emoji: this.emoji,
            totalReacted: this.config.totalReacted || 0,
            lastReacted: this.config.lastReacted,
            knownChannels: knownNewsletters.size,
            whitelistedChannels: _whitelistCache.size,
            minDelay: this.minDelay,
            maxDelay: this.maxDelay,
            queueLength: _reactQueue.length,
            emojiPoolSize: EMOJI_POOL.length
        };
    }
}

const channelReactManager = new ChannelReactManager();

export async function discoverNewsletters(sock) {
    try {
        const chats = await sock.groupFetchAllParticipating?.();
        if (chats) {
            for (const jid of Object.keys(chats)) {
                if (jid.endsWith('@newsletter')) {
                    channelReactManager.registerNewsletter(jid);
                }
            }
        }
    } catch {}
}

export async function handleChannelReact(sock, msg) {
    try {
        const chatId = msg.key?.remoteJid;
        if (!chatId || !chatId.endsWith('@newsletter')) return;

        if (!channelReactManager.enabled) return;
        if (msg.key?.fromMe) return;

        // ── Whitelist gate ────────────────────────────────────────────────────
        // Only react to channels explicitly listed in wolfreacts.json.
        // If the newsletter is NOT in the whitelist it is silently ignored.
        const allowed = await isWhitelisted(chatId);
        if (!allowed) {
            _crLog('🚫', 'WOLF-REACTS', 'Newsletter not whitelisted — skipping', {
                'JID': chatId,
            }, 'yellow');
            return;
        }

        // Still track known newsletters for informational purposes
        channelReactManager.registerNewsletter(chatId);

        const serverId = msg.key?.server_id || msg.key?.id;
        if (!serverId) return;

        await channelReactManager.queueReaction(sock, chatId, serverId);
    } catch (err) {
        _crLog('❌', 'CHANNEL-REACT', 'Handler error', {
            'Error': err?.message || String(err),
        }, 'red');
    }
}

export { channelReactManager };

// NOTE: channelreact is a background function, not a command.
// It is invoked automatically from index.js via handleChannelReact(sock, msg).
// There is no user-facing execute() handler intentionally.

// Keeping a no-op default export so any dynamic command loader that imports
// this file doesn't crash trying to destructure a missing default.
export default null;