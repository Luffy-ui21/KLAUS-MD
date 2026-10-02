// ====== lib/commandButtons.js ======
// Defines the interactive button menus that appear after each bot command
// when Button Mode is active (see lib/buttonMode.js).
//
// HOW IT WORKS:
//   When a user runs e.g. ?play Drake, the bot sends the audio and then
//   attaches quick-reply buttons like "🎵 Download Audio", "🎬 Download Video",
//   and "🏠 Menu".  Tapping one of these buttons sends the corresponding
//   command string as if the user typed it.  This makes the bot more
//   interactive without requiring the user to know every command name.
//
// COMMAND_BUTTONS object:
//   Keys  — command names (e.g. "play", "song", "sticker").
//   Values — one of:
//     { buttons: [...] }   — static button list for this command
//     { aliasOf: "name" }  — borrows the button config of another command
//     { dynamicButtons: fn } — function that returns buttons based on context
//
//   Each button entry has:
//     type: "reply"  — quick-reply (sends a message string when tapped)
//     type: "url"    — opens a URL in the browser
//     type: "copy"   — copies text to the clipboard
//     text: string   — the button label the user sees
//     id:   string   — the command string sent when tapped
//                      (supports {prefix} and {args} placeholders)
//
// ACTIVE COMMAND TRACKING:
//   When a command runs, setActiveCommand() stores which command is "active"
//   for a given chat.  This lets the follow-up button presses know which
//   context to build buttons for.

import { isButtonModeEnabled } from './buttonMode.js';
import { STAR_URL, FORK_URL } from './repoConfig.js';

// Map of chat/sender keys → currently active command info.
// Key format: "chatJid:senderJid" (or just "chatJid" for fallback).
const _activeCommands = new Map();

// Record the command that just ran in a chat so button callbacks have context.
// `senderJid` makes the key more specific when multiple senders share a chat.
export function setActiveCommand(jid, commandName, args, senderJid) {
    const key = senderJid ? `${jid}:${senderJid}` : jid;
    _activeCommands.set(key, { command: commandName, args: args || [], jid });
    _activeCommands.set(jid, { command: commandName, args: args || [], jid });
}

// Remove the active command record for a chat (after buttons are consumed).
export function clearActiveCommand(jid, senderJid) {
    if (senderJid) _activeCommands.delete(`${jid}:${senderJid}`);
    _activeCommands.delete(jid);
}

// Retrieve the currently active command for a chat, or null if none.
export function getActiveCommand(jid) {
    return _activeCommands.get(jid) || null;
}

// ── COMMAND_BUTTONS — the master button registry ────────────────────────────
// Each top-level key is a command name (must match what commands export as
// `name`).  Aliases point to the primary command's config with `aliasOf`.
const COMMAND_BUTTONS = {
    play: {
        buttons: [
            { type: 'reply', text: '🎵 Download Audio', id: '{prefix}song {args}' },
            { type: 'reply', text: '🎬 Download Video', id: '{prefix}video {args}' },
            { type: 'reply', text: '🔀 Next Result', id: '{prefix}play {args}' }
        ]
    },
    song: {
        buttons: [
            { type: 'reply', text: '🎵 Download Again', id: '{prefix}song {args}' },
            { type: 'reply', text: '🎬 Get Video', id: '{prefix}video {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    mp3: { aliasOf: 'song' },
    ytmp3: { aliasOf: 'song' },
    video: {
        buttons: [
            { type: 'reply', text: '🎬 Download Again', id: '{prefix}video {args}' },
            { type: 'reply', text: '🎵 Get Audio', id: '{prefix}song {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    vid: { aliasOf: 'video' },
    ytmp4: { aliasOf: 'video' },
    instagram: {
        buttons: [
            { type: 'reply', text: '📥 Download Again', id: '{prefix}instagram {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    ig: { aliasOf: 'instagram' },
    facebook: {
        buttons: [
            { type: 'reply', text: '📥 Download Again', id: '{prefix}facebook {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    fb: { aliasOf: 'facebook' },
    twitter: {
        buttons: [
            { type: 'reply', text: '📥 Download Again', id: '{prefix}twitter {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    snapchat: {
        buttons: [
            { type: 'reply', text: '📥 Download Again', id: '{prefix}snapchat {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    apk: {
        buttons: [
            { type: 'reply', text: '📥 Download Again', id: '{prefix}apk {args}' },
            { type: 'reply', text: '🔍 Search Another', id: '{prefix}apk' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    mediafire: {
        buttons: [
            { type: 'reply', text: '📥 Download Again', id: '{prefix}mediafire {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    chatgpt: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}chatgpt' },
            { type: 'reply', text: '🧠 Try GPT-5', id: '{prefix}gpt {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    gpt: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}gpt' },
            { type: 'reply', text: '💎 Try Gemini', id: '{prefix}gemini {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    gemini: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}gemini' },
            { type: 'reply', text: '🧠 Try GPT-5', id: '{prefix}gpt {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    copilot: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}copilot' },
            { type: 'reply', text: '💎 Try Gemini', id: '{prefix}gemini {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    bard: { aliasOf: 'gemini' },
    bing: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}bing' },
            { type: 'reply', text: '🧠 Try GPT', id: '{prefix}gpt {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    deepseek: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}deepseek' },
            { type: 'reply', text: '🧠 Try GPT-5', id: '{prefix}gpt {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    'deepseek+': { aliasOf: 'deepseek' },
    blackbox: {
        buttons: [
            { type: 'reply', text: '🔄 Ask Again', id: '{prefix}blackbox' },
            { type: 'reply', text: '💎 Try Gemini', id: '{prefix}gemini {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    grok: { aliasOf: 'blackbox' },
    mistral: { aliasOf: 'deepseek' },
    perplexity: { aliasOf: 'deepseek' },
    cohere: { aliasOf: 'deepseek' },
    claudeai: { aliasOf: 'deepseek' },
    metai: { aliasOf: 'deepseek' },
    qwenai: { aliasOf: 'deepseek' },
    venice: { aliasOf: 'deepseek' },
    ilama: { aliasOf: 'deepseek' },
    wormgpt: { aliasOf: 'deepseek' },
    flux: {
        buttons: [
            { type: 'reply', text: '🎨 Generate Again', id: '{prefix}flux {args}' },
            { type: 'reply', text: '🖼️ Try Logo AI', id: '{prefix}logoai {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    removebg: {
        buttons: [
            { type: 'reply', text: '🔄 Remove Again', id: '{prefix}removebg' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    vision: {
        buttons: [
            { type: 'reply', text: '👁️ Analyze Again', id: '{prefix}vision' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    analyze: { aliasOf: 'vision' },
    summarize: {
        buttons: [
            { type: 'reply', text: '📝 Summarize Again', id: '{prefix}summarize' },
            { type: 'reply', text: '🔄 Translate', id: '{prefix}translate {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    humanizer: {
        buttons: [
            { type: 'reply', text: '✍️ Humanize Again', id: '{prefix}humanizer' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    speechwriter: {
        buttons: [
            { type: 'reply', text: '📝 Write Again', id: '{prefix}speechwriter' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    totext: {
        buttons: [
            { type: 'reply', text: '📋 Convert Again', id: '{prefix}totext' },
            { type: 'reply', text: '🔄 Translate', id: '{prefix}translate' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    suno: {
        buttons: [
            { type: 'reply', text: '🎵 Generate Again', id: '{prefix}suno {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    translate: {
        buttons: [
            { type: 'reply', text: '🔄 Translate Again', id: '{prefix}translate' },
            { type: 'reply', text: '📝 Summarize', id: '{prefix}summarize {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    weather: {
        buttons: [
            { type: 'reply', text: '🔄 Refresh', id: '{prefix}weather {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    wiki: {
        buttons: [
            { type: 'reply', text: '🔍 Search Again', id: '{prefix}wiki' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    news: {
        buttons: [
            { type: 'reply', text: '📰 Refresh News', id: '{prefix}news' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    screenshot: {
        buttons: [
            { type: 'reply', text: '📸 Screenshot Again', id: '{prefix}screenshot {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    ss: { aliasOf: 'screenshot' },
    shorturl: {
        buttons: [
            { type: 'reply', text: '🔗 Shorten Another', id: '{prefix}shorturl' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    videocall: {
        buttons: [
            { type: 'reply', text: '📹 New Video Link', id: '{prefix}videocall' },
            { type: 'reply', text: '📞 Voice Call Link', id: '{prefix}voicecall' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true
    },
    vcall: { aliasOf: 'videocall' },
    videolink: { aliasOf: 'videocall' },
    callvideo: { aliasOf: 'videocall' },
    voicecall: {
        buttons: [
            { type: 'reply', text: '📞 New Voice Link', id: '{prefix}voicecall' },
            { type: 'reply', text: '📹 Video Call Link', id: '{prefix}videocall' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true
    },
    vcalllink: { aliasOf: 'voicecall' },
    calllink:  { aliasOf: 'voicecall' },
    audiolink: { aliasOf: 'voicecall' },
    callvoice: { aliasOf: 'voicecall' },
    ping: {
        buttons: [
            { type: 'reply', text: '🏓 Ping Again', id: '{prefix}ping' },
            { type: 'reply', text: '⏱️ Uptime', id: '{prefix}uptime' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    uptime: {
        buttons: [
            { type: 'reply', text: '⏱️ Refresh', id: '{prefix}uptime' },
            { type: 'reply', text: '🏓 Ping', id: '{prefix}ping' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    speed: {
        buttons: [
            { type: 'reply', text: '⚡ Test Again', id: '{prefix}speed' },
            { type: 'reply', text: '🏓 Ping', id: '{prefix}ping' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    iplookup: {
        buttons: [
            { type: 'reply', text: '🔍 Lookup Again', id: '{prefix}iplookup' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    reverseimage: {
        buttons: [
            { type: 'reply', text: '🔍 Search Again', id: '{prefix}reverseimage' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    qrencode: {
        buttons: [
            { type: 'reply', text: '📱 Generate QR', id: '{prefix}qrencode' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    qrdecode: {
        buttons: [
            { type: 'reply', text: '📷 Decode Another', id: '{prefix}qrdecode' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    tts: {
        buttons: [
            { type: 'reply', text: '🔊 Speak Again', id: '{prefix}tts' },
            { type: 'reply', text: '🔄 Translate', id: '{prefix}translate' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    repo: {
        buttons: [
            { type: 'url', text: '⭐ Star Repo', url: STAR_URL },
            { type: 'url', text: '🍴 Fork Repo', url: FORK_URL },
            { type: 'reply', text: '👤 Owner', id: '{prefix}owner' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    gitclone: {
        buttons: [
            { type: 'reply', text: '📥 Clone Another', id: '{prefix}gitclone' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    gitstalk: {
        buttons: [
            { type: 'reply', text: '🔍 Stalk Again', id: '{prefix}gitstalk' },
            { type: 'reply', text: '📦 Clone Repo', id: '{prefix}gitclone' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true
    },
    igstalk: {
        buttons: [
            { type: 'reply', text: '🔍 Stalk Again', id: '{prefix}igstalk' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true
    },
    twitterstalk: { aliasOf: 'igstalk' },
    npmstalk: { aliasOf: 'igstalk' },
    ipstalk: { aliasOf: 'iplookup' },

    grouplink: {
        buttons: [
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true,
        copyButtons: true
    },
    kick: {
        buttons: [
            { type: 'reply', text: '✅ Confirm Kick', id: '{prefix}kickconfirm' },
            { type: 'reply', text: '❌ Cancel', id: '{prefix}kickcancel' }
        ]
    },
    promote: {
        buttons: [
            { type: 'reply', text: '⬇️ Demote', id: '{prefix}demote' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    demote: {
        buttons: [
            { type: 'reply', text: '🆙 Promote', id: '{prefix}promote' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    mute: {
        buttons: [
            { type: 'reply', text: '🔊 Unmute', id: '{prefix}unmute' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    unmute: {
        buttons: [
            { type: 'reply', text: '🔇 Mute', id: '{prefix}mute' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    ban: {
        buttons: [
            { type: 'reply', text: '🔓 Unban', id: '{prefix}unban' },
            { type: 'reply', text: '📋 Ban List', id: '{prefix}banlist' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    unban: {
        buttons: [
            { type: 'reply', text: '🚫 Ban', id: '{prefix}ban' },
            { type: 'reply', text: '📋 Ban List', id: '{prefix}banlist' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    warn: {
        buttons: [
            { type: 'reply', text: '📊 Warnings', id: '{prefix}warnings' },
            { type: 'reply', text: '🔄 Reset Warn', id: '{prefix}resetwarn' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    warnings: {
        buttons: [
            { type: 'reply', text: '⚠️ Warn User', id: '{prefix}warn' },
            { type: 'reply', text: '🔄 Reset Warn', id: '{prefix}resetwarn' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    resetwarn: {
        buttons: [
            { type: 'reply', text: '📊 Check Warnings', id: '{prefix}warnings' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    antilink: {
        buttons: [
            { type: 'reply', text: '🛡️ Anti-Bug', id: '{prefix}antibug' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    antibug: {
        buttons: [
            { type: 'reply', text: '🔗 Anti-Link', id: '{prefix}antilink' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    tagall: {
        buttons: [
            { type: 'reply', text: '👻 Hidetag', id: '{prefix}hidetag' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    hidetag: {
        buttons: [
            { type: 'reply', text: '📢 Tag All', id: '{prefix}tagall' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    welcome: {
        buttons: [
            { type: 'reply', text: '👋 Goodbye Settings', id: '{prefix}goodbye' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    goodbye: {
        buttons: [
            { type: 'reply', text: '🎉 Welcome Settings', id: '{prefix}welcome' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    group: {
        buttons: [
            { type: 'reply', text: '🔗 Group Link', id: '{prefix}grouplink' },
            { type: 'reply', text: '📢 Tag All', id: '{prefix}tagall' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    owner: {
        buttons: [
            { type: 'reply', text: '📦 Repo', id: '{prefix}repo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    setbotname: {
        buttons: [
            { type: 'reply', text: '🤖 Bot Info', id: '{prefix}ping' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    setprefix: {
        buttons: [
            { type: 'reply', text: '📌 Prefix Info', id: '{prefix}prefixinfo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    block: {
        buttons: [
            { type: 'reply', text: '🔓 Unblock', id: '{prefix}unblock' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    unblock: {
        buttons: [
            { type: 'reply', text: '🔒 Block', id: '{prefix}block' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    mode: {
        buttons: [
            { type: 'reply', text: '🌍 Public Mode', id: '{prefix}mode public' },
            { type: 'reply', text: '👥 Groups Mode', id: '{prefix}mode groups' },
            { type: 'reply', text: '🔘 Button Mode', id: '{prefix}mode buttons' }
        ]
    },

    ttt: {
        buttons: [
            { type: 'reply', text: '🎮 New Game', id: '{prefix}ttt' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    rps: {
        buttons: [
            { type: 'reply', text: '🪨 Rock', id: '{prefix}rps rock' },
            { type: 'reply', text: '📄 Paper', id: '{prefix}rps paper' },
            { type: 'reply', text: '✂️ Scissors', id: '{prefix}rps scissors' }
        ]
    },
    coinflip: {
        buttons: [
            { type: 'reply', text: '🪙 Flip Again', id: '{prefix}coinflip' },
            { type: 'reply', text: '🎲 Roll Dice', id: '{prefix}dice' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    dice: {
        buttons: [
            { type: 'reply', text: '🎲 Roll Again', id: '{prefix}dice' },
            { type: 'reply', text: '🪙 Coin Flip', id: '{prefix}coinflip' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    quiz: {
        buttons: [
            { type: 'reply', text: '❓ Next Question', id: '{prefix}quiz' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    snake: {
        buttons: [
            { type: 'reply', text: '🐍 New Game', id: '{prefix}snake' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    tetris: {
        buttons: [
            { type: 'reply', text: '🧱 New Game', id: '{prefix}tetris' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    sudoku: {
        buttons: [
            { type: 'reply', text: '🔢 New Puzzle', id: '{prefix}sudoku' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    sticker: {
        buttons: [
            { type: 'reply', text: '🖼️ To Image', id: '{prefix}toimage' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    tosticker: { aliasOf: 'sticker' },
    s: { aliasOf: 'sticker' },
    toimage: {
        buttons: [
            { type: 'reply', text: '🎨 To Sticker', id: '{prefix}sticker' },
            { type: 'reply', text: '🔗 To URL', id: '{prefix}url' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    toimg: { aliasOf: 'toimage' },
    url: {
        buttons: [
            { type: 'reply', text: '🔗 Upload Another', id: '{prefix}url' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true,
        copyButtons: true
    },
    tourl: { aliasOf: 'url' },

    alive: {
        buttons: [
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' },
            { type: 'reply', text: '🏓 Ping', id: '{prefix}ping' },
            { type: 'reply', text: '⏱️ Uptime', id: '{prefix}uptime' }
        ]
    },

    pair: {
        buttons: [
            { type: 'reply', text: '🔗 Pair Again', id: '{prefix}pair' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        copyButtons: true
    },

    chatbot: {
        buttons: [
            { type: 'reply', text: '💬 Chatbot On', id: '{prefix}chatbot on' },
            { type: 'reply', text: '🔇 Chatbot Off', id: '{prefix}chatbot off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    wolf: {
        buttons: [
            { type: 'reply', text: ' Wolf On', id: '{prefix}wolf on' },
            { type: 'reply', text: '🔇 Wolf Off', id: '{prefix}wolf off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    autoreact: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}autoreact on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}autoreact off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    autoread: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}autoread on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}autoread off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    autotyping: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}autotyping on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}autotyping off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    autorecording: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}autorecording on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}autorecording off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    autoviewstatus: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}autoviewstatus on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}autoviewstatus off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    getpp: {
        buttons: [
            { type: 'reply', text: '🖼️ Get Group PP', id: '{prefix}getgpp' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    getgpp: {
        buttons: [
            { type: 'reply', text: '🖼️ Get Profile Pic', id: '{prefix}getpp' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    vcf: {
        buttons: [
            { type: 'reply', text: '📇 View VCF', id: '{prefix}viewvcf' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    viewvcf: {
        buttons: [
            { type: 'reply', text: '📇 Create VCF', id: '{prefix}vcf' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    vv: {
        buttons: [
            { type: 'reply', text: '👁️ View Once Again', id: '{prefix}vv' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    vv2: { aliasOf: 'vv' },

    take: {
        buttons: [
            { type: 'reply', text: '🎨 Make Sticker', id: '{prefix}sticker' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    save: {
        buttons: [
            { type: 'reply', text: '💾 Save Another', id: '{prefix}save' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    quoted: {
        buttons: [
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    time: {
        buttons: [
            { type: 'reply', text: '🕐 Check Again', id: '{prefix}time {args}' },
            { type: 'reply', text: '🌤️ Weather', id: '{prefix}weather {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    js: {
        buttons: [
            { type: 'reply', text: '💻 Run Again', id: '{prefix}js' },
            { type: 'reply', text: '🐍 Python', id: '{prefix}py' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    py: {
        buttons: [
            { type: 'reply', text: '🐍 Run Again', id: '{prefix}py' },
            { type: 'reply', text: '💻 JavaScript', id: '{prefix}js' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    fetch: {
        buttons: [
            { type: 'reply', text: '🔄 Fetch Again', id: '{prefix}fetch {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        urlButtons: true
    },
    inspect: {
        buttons: [
            { type: 'reply', text: '🔍 Inspect Again', id: '{prefix}inspect' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    prefixinfo: {
        buttons: [
            { type: 'reply', text: '🔧 Set Prefix', id: '{prefix}setprefix' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    platform: {
        buttons: [
            { type: 'reply', text: '🏓 Ping', id: '{prefix}ping' },
            { type: 'reply', text: '⏱️ Uptime', id: '{prefix}uptime' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    tovideo: {
        buttons: [
            { type: 'reply', text: '🎬 Generate Again', id: '{prefix}tovideo {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    videogen: { aliasOf: 'tovideo' },
    introvideo: { aliasOf: 'tovideo' },
    lovevideo: { aliasOf: 'tovideo' },
    lightningpubg: { aliasOf: 'tovideo' },

    logoai: {
        buttons: [
            { type: 'reply', text: '🎨 Generate Again', id: '{prefix}logoai {args}' },
            { type: 'reply', text: '🖼️ Try Flux', id: '{prefix}flux {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    brandlogo: { aliasOf: 'logoai' },
    companylogo: { aliasOf: 'logoai' },

    stealth: {
        buttons: [
            { type: 'reply', text: '👻 Toggle Stealth', id: '{prefix}stealth' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    antiviewonce: {
        buttons: [
            { type: 'reply', text: '🔐 Toggle AV', id: '{prefix}antiviewonce' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    av: { aliasOf: 'antiviewonce' },

    addsudo: {
        buttons: [
            { type: 'reply', text: '📋 Sudo List', id: '{prefix}listsudo' },
            { type: 'reply', text: '❌ Remove Sudo', id: '{prefix}delsudo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    delsudo: {
        buttons: [
            { type: 'reply', text: '📋 Sudo List', id: '{prefix}listsudo' },
            { type: 'reply', text: '➕ Add Sudo', id: '{prefix}addsudo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    listsudo: {
        buttons: [
            { type: 'reply', text: '➕ Add Sudo', id: '{prefix}addsudo' },
            { type: 'reply', text: '❌ Remove Sudo', id: '{prefix}delsudo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    setwarn: {
        buttons: [
            { type: 'reply', text: '📊 Check Warnings', id: '{prefix}warnings' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    '8d': {
        buttons: [
            { type: 'reply', text: '🔊 Bass Boost', id: '{prefix}bassboost' },
            { type: 'reply', text: '🎵 Reverb', id: '{prefix}reverb' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    bassboost: {
        buttons: [
            { type: 'reply', text: '🎧 8D Audio', id: '{prefix}8d' },
            { type: 'reply', text: '🔊 Deep Bass', id: '{prefix}deepbass' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    bass: { aliasOf: 'bassboost' },
    deepbass: { aliasOf: 'bassboost' },
    superboost: { aliasOf: 'bassboost' },
    boost: { aliasOf: 'bassboost' },
    reverb: {
        buttons: [
            { type: 'reply', text: '🎧 8D Audio', id: '{prefix}8d' },
            { type: 'reply', text: '🔊 Echo', id: '{prefix}echo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    echo: { aliasOf: 'reverb' },
    nightcore: {
        buttons: [
            { type: 'reply', text: '🐌 Slow', id: '{prefix}slow' },
            { type: 'reply', text: '🎧 8D Audio', id: '{prefix}8d' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    fast: { aliasOf: 'nightcore' },
    slow: {
        buttons: [
            { type: 'reply', text: '⚡ Fast', id: '{prefix}fast' },
            { type: 'reply', text: '🎧 Nightcore', id: '{prefix}nightcore' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    robot: {
        buttons: [
            { type: 'reply', text: '👹 Demon', id: '{prefix}demon' },
            { type: 'reply', text: '🤖 Jarvis', id: '{prefix}jarvis' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    demon: { aliasOf: 'robot' },
    jarvis: { aliasOf: 'robot' },
    monster: { aliasOf: 'robot' },
    baby: {
        buttons: [
            { type: 'reply', text: '🤖 Robot', id: '{prefix}robot' },
            { type: 'reply', text: '📻 Radio', id: '{prefix}radio' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    radio: { aliasOf: 'baby' },
    telephone: { aliasOf: 'baby' },
    underwater: { aliasOf: 'baby' },
    karaoke: {
        buttons: [
            { type: 'reply', text: '🎤 Vocal Boost', id: '{prefix}vocalboost' },
            { type: 'reply', text: '🎧 8D Audio', id: '{prefix}8d' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    vocalboost: { aliasOf: 'karaoke' },
    treble: {
        buttons: [
            { type: 'reply', text: '🔊 Bass Boost', id: '{prefix}bassboost' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    trebleboost: { aliasOf: 'treble' },
    pitchup: {
        buttons: [
            { type: 'reply', text: '⬇️ Pitch Down', id: '{prefix}pitchdown' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    pitchdown: {
        buttons: [
            { type: 'reply', text: '⬆️ Pitch Up', id: '{prefix}pitchup' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    reverse: {
        buttons: [
            { type: 'reply', text: '🔄 Reverse Again', id: '{prefix}reverse' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    toaudio: {
        buttons: [
            { type: 'reply', text: '🎤 To Voice', id: '{prefix}tovoice' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    tovoice: {
        buttons: [
            { type: 'reply', text: '🎵 To Audio', id: '{prefix}toaudio' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    togif: {
        buttons: [
            { type: 'reply', text: '🎨 To Sticker', id: '{prefix}sticker' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    stickertext: {
        buttons: [
            { type: 'reply', text: '🎨 Make Sticker', id: '{prefix}sticker' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    lyrics: {
        buttons: [
            { type: 'reply', text: '🎵 Play Song', id: '{prefix}play {args}' },
            { type: 'reply', text: '🔍 Search Again', id: '{prefix}lyrics' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    shazam: {
        buttons: [
            { type: 'reply', text: '🎵 Play Song', id: '{prefix}play {args}' },
            { type: 'reply', text: '📝 Get Lyrics', id: '{prefix}lyrics {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    spotify: {
        buttons: [
            { type: 'reply', text: '🎵 Download', id: '{prefix}song {args}' },
            { type: 'reply', text: '📝 Lyrics', id: '{prefix}lyrics {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    videodoc: {
        buttons: [
            { type: 'reply', text: '🎬 Video', id: '{prefix}video {args}' },
            { type: 'reply', text: '🎵 Audio', id: '{prefix}song {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    football: {
        buttons: [
            { type: 'reply', text: '📰 Sports News', id: '{prefix}sportsnews' },
            { type: 'reply', text: '📊 Match Stats', id: '{prefix}matchstats' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    basketball: { aliasOf: 'football' },
    cricket: { aliasOf: 'football' },
    baseball: { aliasOf: 'football' },
    tennis: { aliasOf: 'football' },
    f1: { aliasOf: 'football' },
    golf: { aliasOf: 'football' },
    mma: { aliasOf: 'football' },
    nfl: { aliasOf: 'football' },
    sportsnews: {
        buttons: [
            { type: 'reply', text: '⚽ Football', id: '{prefix}football' },
            { type: 'reply', text: '🏀 Basketball', id: '{prefix}basketball' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    matchstats: {
        buttons: [
            { type: 'reply', text: '📰 Sports News', id: '{prefix}sportsnews' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    teamnews: { aliasOf: 'matchstats' },

    image: {
        buttons: [
            { type: 'reply', text: '🔍 Search Again', id: '{prefix}image {args}' },
            { type: 'reply', text: '🎨 To Sticker', id: '{prefix}sticker' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    imagine: {
        buttons: [
            { type: 'reply', text: '🎨 Generate Again', id: '{prefix}imagine {args}' },
            { type: 'reply', text: '🖼️ Try Flux', id: '{prefix}flux {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    imagegen: { aliasOf: 'imagine' },
    art: { aliasOf: 'imagine' },
    real: { aliasOf: 'imagine' },
    remini: {
        buttons: [
            { type: 'reply', text: '✨ Enhance Again', id: '{prefix}remini' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    define: {
        buttons: [
            { type: 'reply', text: '🔍 Define Another', id: '{prefix}define' },
            { type: 'reply', text: '🔄 Translate', id: '{prefix}translate' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    covid: {
        buttons: [
            { type: 'reply', text: '🔄 Refresh', id: '{prefix}covid {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    movie: {
        buttons: [
            { type: 'reply', text: '🎬 Watch Trailer', id: '{prefix}trailer {args}' },
            { type: 'reply', text: '🔍 Search Again', id: '{prefix}movie' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    trailer: {
        buttons: [
            { type: 'reply', text: '🎬 Movie Info', id: '{prefix}movie {args}' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    about: {
        buttons: [
            { type: 'reply', text: '👤 Owner', id: '{prefix}owner' },
            { type: 'reply', text: '📦 Repo', id: '{prefix}repo' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    restart: {
        buttons: [
            { type: 'reply', text: '🏓 Ping', id: '{prefix}ping' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    disk: {
        buttons: [
            { type: 'reply', text: '🗑️ Clear Cache', id: '{prefix}clearcache' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    clearcache: {
        buttons: [
            { type: 'reply', text: '💾 Disk Info', id: '{prefix}disk' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    privacy: {
        buttons: [
            { type: 'reply', text: '🔒 Block', id: '{prefix}block' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    waifu: {
        buttons: [
            { type: 'reply', text: '🎀 Another Waifu', id: '{prefix}waifu' },
            { type: 'reply', text: '😺 Neko', id: '{prefix}neko' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    neko: {
        buttons: [
            { type: 'reply', text: '😺 Another Neko', id: '{prefix}neko' },
            { type: 'reply', text: '🎀 Waifu', id: '{prefix}waifu' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    hug: {
        buttons: [
            { type: 'reply', text: '🤗 Hug Again', id: '{prefix}hug' },
            { type: 'reply', text: '💋 Kiss', id: '{prefix}kiss' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    kiss: {
        buttons: [
            { type: 'reply', text: '💋 Kiss Again', id: '{prefix}kiss' },
            { type: 'reply', text: '🤗 Hug', id: '{prefix}hug' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    pat: {
        buttons: [
            { type: 'reply', text: '👋 Pat Again', id: '{prefix}pat' },
            { type: 'reply', text: '🤗 Hug', id: '{prefix}hug' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    cuddle: { aliasOf: 'hug' },
    highfive: { aliasOf: 'pat' },
    dance: {
        buttons: [
            { type: 'reply', text: '💃 Dance Again', id: '{prefix}dance' },
            { type: 'reply', text: '😉 Wink', id: '{prefix}wink' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    wink: { aliasOf: 'dance' },
    cry: {
        buttons: [
            { type: 'reply', text: '😢 Cry Again', id: '{prefix}cry' },
            { type: 'reply', text: '🤗 Hug', id: '{prefix}hug' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    kill: {
        buttons: [
            { type: 'reply', text: '💀 Kill Again', id: '{prefix}kill' },
            { type: 'reply', text: '👢 Kick', id: '{prefix}kick' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    yeet: { aliasOf: 'kill' },
    bully: { aliasOf: 'kill' },
    lick: { aliasOf: 'kiss' },
    nom: { aliasOf: 'pat' },
    glomp: { aliasOf: 'hug' },
    cringe: { aliasOf: 'dance' },
    awoo: { aliasOf: 'waifu' },
    shinobu: { aliasOf: 'waifu' },
    megumin: { aliasOf: 'waifu' },
    trap: { aliasOf: 'waifu' },
    trap2: { aliasOf: 'waifu' },

    goodmorning: {
        buttons: [
            { type: 'reply', text: '🌙 Good Night', id: '{prefix}goodnight' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    goodnight: {
        buttons: [
            { type: 'reply', text: '☀️ Good Morning', id: '{prefix}goodmorning' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    approveall: {
        buttons: [
            { type: 'reply', text: '❌ Reject All', id: '{prefix}rejectall' },
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    rejectall: {
        buttons: [
            { type: 'reply', text: '✅ Approve All', id: '{prefix}approveall' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    kickall: {
        buttons: [
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    demoteall: { aliasOf: 'kickall' },
    promoteall: { aliasOf: 'kickall' },
    creategroup: { aliasOf: 'kickall' },
    leave: { aliasOf: 'kickall' },
    revoke: {
        buttons: [
            { type: 'reply', text: '🔗 New Link', id: '{prefix}grouplink' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    setdesc: {
        buttons: [
            { type: 'reply', text: '👥 Group Info', id: '{prefix}group' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    autobio: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}autobio on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}autobio off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    anticall: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}anticall on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}anticall off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    antidelete: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}antidelete on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}antidelete off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    antiedit: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}antiedit on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}antiedit off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    blockdetect: {
        buttons: [
            { type: 'reply', text: '✅ Enable', id: '{prefix}blockdetect on' },
            { type: 'reply', text: '❌ Disable', id: '{prefix}blockdetect off' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    join: {
        buttons: [
            { type: 'reply', text: '🔗 Group Link', id: '{prefix}grouplink' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    getjid: {
        buttons: [
            { type: 'reply', text: '📋 Copy', id: '{prefix}getjid' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ],
        copyButtons: true
    },

    asnlookup: {
        buttons: [
            { type: 'reply', text: '🔍 IP Lookup', id: '{prefix}iplookup' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },
    bandwidthtest: { aliasOf: 'speed' },

    latestupdates: {
        buttons: [
            { type: 'reply', text: '📦 Repo', id: '{prefix}repo' },
            { type: 'reply', text: '🔄 Update', id: '{prefix}update' },
            { type: 'reply', text: '🏠 Menu', id: '{prefix}menu' }
        ]
    },

    mygroups: {
        dynamicButtons: (prefix, args, msgText) => {
            if (args.length > 0 && /^\d+$/.test(args[0])) {
                const jidMatch = msgText?.match(/(\d[\d-]+@g\.us)/);
                const buttons = [];
                if (jidMatch) {
                    buttons.push({ type: 'copy', text: '📋 Copy JID', copy_code: jidMatch[1] });
                }
                buttons.push({ text: '🚪 Leave Group', id: `${prefix}mygroupleave` });
                return buttons;
            }
            return null;
        }
    }
};

// ── Exported helper functions ───────────────────────────────────────────────

// Look up the button configuration for a command.
// Follows the aliasOf chain so alias commands return the same config as their
// primary.  Returns null if the command has no button config.
export function getCommandButtonConfig(commandName) {
    if (!commandName) return null;
    const cmd = commandName.toLowerCase();
    let config = COMMAND_BUTTONS[cmd];
    if (!config) return null;
    if (config.aliasOf) {
        config = COMMAND_BUTTONS[config.aliasOf];
    }
    return config || null;
}

// Build the actual WhatsApp interactive button payload for a command response.
// Returns an array ready to pass to wolfbtns's sendInteractiveMessage(),
// or null if Button Mode is off or this command has no button config.
//
// `commandName` — the command that just ran (e.g. "play")
// `prefix`      — current command prefix (e.g. "?")
// `args`        — the arguments used with the command (string or string[])
// `msgText`     — the full response text (needed for URL and copy-code extraction)
//
// Processing order:
//   1. dynamicButtons function — if defined, runs it and returns the result.
//   2. Static buttons[]        — replaces {prefix} and {args} placeholders.
//   3. urlButtons extra        — scans msgText for URLs and adds "Open Link" buttons.
//   4. copyButtons extra       — scans msgText for codes/tokens and adds "Copy" button.
export function buildCommandButtons(commandName, prefix, args, msgText) {
    if (!isButtonModeEnabled()) return null;
    
    const config = getCommandButtonConfig(commandName);
    if (!config) return null;
    
    // Handle dynamic button configs (e.g. mygroups varies based on args)
    if (typeof config.dynamicButtons === 'function') {
        const dynamic = config.dynamicButtons(prefix, Array.isArray(args) ? args : (args ? [args] : []), msgText);
        if (dynamic === null) return null;
        if (Array.isArray(dynamic)) {
            return dynamic.map(btn => {
                if (btn.url) {
                    return {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({ display_text: btn.text, url: btn.url })
                    };
                }
                if (btn.type === 'copy' && btn.copy_code) {
                    return {
                        name: 'cta_copy',
                        buttonParamsJson: JSON.stringify({ display_text: btn.text, copy_code: btn.copy_code })
                    };
                }
                return {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id })
                };
            }).filter(b => {
                try { const p = JSON.parse(b.buttonParamsJson); return p.id || p.url || p.copy_code; }
                catch { return false; }
            });
        }
    }
    
    // Flatten args to a string so {args} placeholders can be replaced
    const argsStr = Array.isArray(args) ? args.join(' ') : (args || '');
    const interactiveButtons = [];
    
    // Build buttons from the static config, formatting placeholder strings
    if (config.buttons) {
        for (const btn of config.buttons) {
            if (btn.type === 'url' && btn.url) {
                // URL button — opens a link in the browser when tapped
                interactiveButtons.push({
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: btn.text,
                        url: btn.url
                    })
                });
            } else if (btn.type === 'copy' && btn.copy_code) {
                // Copy button — puts a static string on the clipboard
                interactiveButtons.push({
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: btn.text,
                        copy_code: btn.copy_code
                    })
                });
            } else {
                // Quick-reply button — sends a command string to the chat
                const btnId = (btn.id || btn.text)
                    .replace(/\{prefix\}/g, prefix)
                    .replace(/\{args\}/g, argsStr)
                    .trim();
                interactiveButtons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: btn.text,
                        id: btnId
                    })
                });
            }
        }
    }
    
    // urlButtons: auto-detect URLs in the response text and add Open Link buttons
    // (used by commands like ?fetch that output a URL in their response)
    if (config.urlButtons && msgText) {
        const urlMatches = [...msgText.matchAll(/https?:\/\/[^\s\n\r<>"{}|\\^`\[\]]+/g)];
        const seenUrls = new Set();
        urlMatches.slice(0, 2).forEach(um => {
            const url = um[0].replace(/[).,;:!?]+$/, '');
            if (!seenUrls.has(url)) {
                seenUrls.add(url);
                interactiveButtons.push({
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🔗 Open Link',
                        url: url
                    })
                });
            }
        });
    }
    
    // copyButtons: auto-detect codes or tokens in the response text so the user
    // can copy them with one tap (used by ?getjid and similar)
    if (config.copyButtons && msgText) {
        const copyMatch = msgText.match(/(?:https?:\/\/[^\s]+|code|token|key|id|session|pair|link)[\s:]*[`*]?([A-Za-z0-9\-_+=/.:%?&#]{6,})[`*]?/i);
        if (copyMatch) {
            interactiveButtons.push({
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: '📋 Copy',
                    copy_code: copyMatch[1]
                })
            });
        }
    }
    
    return interactiveButtons.length > 0 ? interactiveButtons : null;
}

// Re-export COMMAND_BUTTONS under a shorter alias for convenience
export const BUTTON_COMMANDS = COMMAND_BUTTONS;

// Return a flat list of all commands that have button configs, with their
// alias lists and button labels.  Used by diagnostic and info commands to
// show which commands have interactive buttons available.
export function getButtonCommandList() {
    const commands = [];
    for (const [name, config] of Object.entries(COMMAND_BUTTONS)) {
        if (config.aliasOf) continue; // skip aliases — they share a primary's config
        const aliases = [];
        // Collect every key that points to this command via aliasOf
        for (const [aName, aConfig] of Object.entries(COMMAND_BUTTONS)) {
            if (aConfig.aliasOf === name) aliases.push(aName);
        }
        const btnCount = config.buttons?.length || 0;
        const btnLabels = (config.buttons || []).map(b => b.text).join(', ');
        commands.push({ name, aliases, btnCount, btnLabels, config });
    }
    return commands;
}
