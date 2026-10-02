//INNER-PEACE - KLAUS MD

// ── Silence Node.js process warnings before ANY imports run ──────────────────
// NODE_NO_WARNINGS is the env-var equivalent of --no-warnings. Setting it here
// guarantees it is in effect even for warnings triggered during ESM resolution.
process.env.NODE_NO_WARNINGS = '1';

// Register a warning listener that silently discards warning types that would
// expose internal file paths (e.g. MODULE_TYPELESS_PACKAGE_JSON). This listener
// runs BEFORE Node.js's default handler, which would write the raw path to stderr.
// The handler intentionally does nothing — the warning is consumed and dropped.
process.on('warning', (warning) => {
    const name = (warning?.name || '').toUpperCase();
    const code = (warning?.code || '').toUpperCase();
    const msg  = (warning?.message || '').toLowerCase();
    // Drop module-type warnings and any warning that mentions a /tmp/ path
    if (
        code === 'MODULE_TYPELESS_PACKAGE_JSON' ||
        code.includes('MODULE_') ||
        name === 'MODULE_TYPELESS_PACKAGE_JSON' ||
        msg.includes('/tmp/') ||
        msg.includes('module type of file') ||
        msg.includes('does not parse as commonjs') ||
        msg.includes('add "type": "module"')
    ) return; // swallow silently
    // All other warnings fall through to Node.js's default stderr output
});

// ====== KLAUS MD - ULTIMATE CLEAN EDITION (SPEED OPTIMIZED) ======
// This is the main entry point for the entire bot.
// All WhatsApp communication flows through here via the Baileys library.
//
// High-level flow:
//   main() → startBot() → Baileys socket created → event listeners registered
//   → messages.upsert fires → handleIncomingMessage() routes each message
//   → command found in `commands` Map → cmd.execute() runs the actual feature
//
// Key library files this file talks to:
//   lib/wolfai.js       — Wolf AI DM assistant (natural language command execution)
//   lib/botname.js      — reads/writes the bot's display name
//   lib/commandButtons.js — wraps outgoing messages with interactive buttons
//   lib/supabase.js     — database (stores config, session, media, etc.)
//   commands/**/*.js    — every user-facing command (.ping, .song, .tts, etc.)
//
// Features: Real-time prefix changes, UltimateFix, Status Detection, Auto-Connect
// SUPER CLEAN TERMINAL - Zero spam, Zero session noise, Rate limit protection
// Version: 1.1.5 | Modes: public / silent / groups / dms / buttons / channel

// ====== PERFORMANCE OPTIMIZATIONS APPLIED ======
// 1. Reduced mandatory delays from 1000ms to 100ms
// 2. Optimized console filtering overhead
// 3. Parallel processing for non-critical tasks
// 4. Faster command parsing
// 5. All original features preserved 100%

// ====== SECTION 1: CONSOLE INTERCEPTOR ======
// Baileys (the WhatsApp library) prints a lot of low-level debug noise.
// We capture console.log/warn/error BEFORE Baileys loads so we can filter
// or prettify every line.  The raw originals are kept in `originalConsoleMethods`
// so UltraCleanLogger can still write to the terminal without going through
// the filter again (which would cause infinite recursion).
//KLAUS MD

const originalConsoleMethods = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    trace: console.trace,
    dir: console.dir,
    dirxml: console.dirxml,
    table: console.table,
};
globalThis.originalConsoleMethods = originalConsoleMethods;
const _keepRef = {
    time: console.time,
    timeEnd: console.timeEnd,
    timeLog: console.timeLog,
    group: console.group,
    groupEnd: console.groupEnd,
    groupCollapsed: console.groupCollapsed,
    clear: console.clear,
    count: console.count,
    countReset: console.countReset,
    assert: console.assert,
    profile: console.profile,
    profileEnd: console.profileEnd,
    timeStamp: console.timeStamp,
    context: console.context
};

const _noisyTokens = [
    'closing session','sessionentry','registrationid','currentratchet',
    'indexinfo','pendingprekey','ephemeralkeypair','lastremoteephemeralkey',
    'rootkey','basekey','signalkey','signalprotocol','_chains','chains',
    'chainkey','ratchet','cipher','decrypt','encrypt','prekey','signedkey',
    'identitykey','sessionstate','keystore','senderkey','groupcipher',
    'signalgroup','signalstore','signalrepository','signalprotocolstore',
    'sessioncipher','sessionbuilder','senderkeystore','senderkeydistribution',
    'keyexchange','<buffer','05 ','0x','pubkey','privkey',
    'connection.update','creds.update','presence.update','chat.update',
    'message.receipt.update','message.update',
    'failed to decrypt','received error','sessionerror','bad mac',
    'stream errored',
    '[asm-debug]',
    'interactive send:','native_flow','tag: \'biz\'',
    'app state resync','syncing critical app state',
    '[dotenv',
    '[chatbot-check]','[chatbot-trace]'
];

const _importantTokens = [
    'command','┌','│','└','╔','║','╚',
    '✅','❌','👥','👤','📊','🔧','','🚀','⚠️',
    '📱','🗑️','📤','👑','🎯','🛡️','🎵','🎬','📘',
    '📷','💾','🔒','🔍','💬'
];
const shouldShowLog = (args) => {
    if (args.length === 0) return true;
    const firstArg = args[0];
    let lowerMsg;
    if (typeof firstArg === 'string') {
        lowerMsg = firstArg.toLowerCase();
    } else if (firstArg && typeof firstArg === 'object') {
        try { lowerMsg = JSON.stringify(firstArg).toLowerCase(); } catch { return true; }
    } else {
        return true;
    }
    for (let i = 0; i < _importantTokens.length; i++) {
        if (lowerMsg.includes(_importantTokens[i])) return true;
    }
    for (let i = 0; i < _noisyTokens.length; i++) {
        if (lowerMsg.includes(_noisyTokens[i])) return false;
    }
    return true;
};

for (const method of Object.keys(originalConsoleMethods)) {
    if (typeof console[method] === 'function') {
        console[method] = function(...args) {
            if (shouldShowLog(args)) {
                originalConsoleMethods[method].apply(console, args);
            }
        };
    }
}

// Process-level filtering
function setupProcessFilter() {
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    
    const _stdoutNoisy = [
        'closing session','sessionentry','registrationid','currentratchet',
        'indexinfo','pendingprekey','_chains','ephemeralkeypair',
        'lastremoteephemeralkey','rootkey','basekey','signalprotocol',
        'ratchet','chainkey','senderkey','groupcipher','sessioncipher',
        'sessionbuilder',
        'interactive send','native_flow','tag: \'biz\'',
        'app state resync','syncing critical app state',
        '[dotenv',
        // Block module-type warnings that would expose internal /tmp/ file paths
        'module_typeless_package_json','module type of file',
        'does not parse as commonjs','add "type": "module"'
    ];
    
    const filterOutput = (chunk) => {
        if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) return true;
        const lowerChunk = (typeof chunk === 'string' ? chunk : chunk.toString()).toLowerCase();
        if (lowerChunk.length < 5) return true;
        for (let i = 0; i < _stdoutNoisy.length; i++) {
            if (lowerChunk.includes(_stdoutNoisy[i])) return false;
        }
        return true;
    };
    
    process.stdout.write = function(chunk, encoding, callback) {
        if (filterOutput(chunk)) {
            return originalStdoutWrite.call(this, chunk, encoding, callback);
        }
        if (callback) callback();
        return true;
    };
    
    process.stderr.write = function(chunk, encoding, callback) {
        if (filterOutput(chunk)) {
            return originalStderrWrite.call(this, chunk, encoding, callback);
        }
        if (callback) callback();
        return true;
    };
}

// ====== SECTION 2: ENVIRONMENT SETUP ======
// Silence every verbose logging library before any WhatsApp code loads.
// Without this, Baileys + pino would flood the terminal with encryption
// handshake details, session entries, and signal protocol messages.
process.env.DEBUG = '';
process.env.NODE_ENV = 'production';
process.env.BAILEYS_LOG_LEVEL = 'fatal';
process.env.PINO_LOG_LEVEL = 'fatal';
process.env.BAILEYS_DISABLE_LOG = 'true';
process.env.DISABLE_BAILEYS_LOG = 'true';
process.env.PINO_DISABLE = 'true';

// ====== SECTION 3: IMPORTS ======
// Node.js built-ins first, then npm packages, then our own lib files.
//
// Key lib files explained:
//   sudo-store.js     — manages the sudo (trusted helper) phone number list
//   database.js       — Supabase/SQLite DB wrapper; stores all persistent config
//   authState.js      — reads/writes WhatsApp session credentials from DB
//   botname.js        — returns the current bot display name (e.g. "KLAUS-MD")
//   wolfai.js         — Wolf AI assistant: handles natural-language DM commands
//   buttonMode.js     — toggle that wraps every bot reply with interactive buttons
//   channelMode.js    — makes the bot appear to forward from a WA channel/newsletter
//   musicMode.js      — Music Mode: auto-sends music clips in enabled groups
//   commandButtons.js — tracks which command is active per chat; builds button lists
//   fontTransformer.js — converts reply text to fancy Unicode fonts
//   platformDetect.js — detects Heroku / Railway / Replit / local
import './lib/ffmpegPath.js'; // patches process.env.PATH so ffmpeg is always found
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';
import readline from 'readline';
import { exec, execSync } from 'child_process';
import axios from "axios";
import { normalizeMessageContent, downloadContentFromMessage, downloadMediaMessage, jidNormalizedUser, generateWAMessageFromContent, proto } from 'wolfsocket';
import NodeCache from 'node-cache';
import { isSudoNumber, isSudoJid, getSudoMode, addSudoJid, mapLidToPhone, isSudoByLid, getPhoneFromLid, getSudoList, hasUnmappedSudos } from './lib/sudo-store.js';
import supabaseDb, { setConfigBotId, isUsingWasm, forceBackup, restoreFromPg } from './lib/database.js';
import mySettings from './lib/mySettings.js';

import { useSQLiteAuthState, getSessionStats, exportSessionIdString } from './lib/authState.js';
import { getBotName as _getBotName, clearBotNameCache } from './lib/botname.js';
import { markConnectionOpen, isReplayMessage, getDrainStats, isDrainActive } from './lib/quickConnect.js';
import { isButtonModeEnabled } from './lib/buttonMode.js';
import { isChannelModeEnabled, getChannelInfo } from './lib/channelMode.js';
import { isMusicModeEnabled, sendMusicClip } from './lib/musicMode.js';
import { setActiveCommand, clearActiveCommand, getActiveCommand, buildCommandButtons } from './lib/commandButtons.js';
import { startScheduler, updateSchedulerSock } from './lib/scheduler.js';
import { startReminderScheduler, updateReminderSock } from './commands/utility/remind.js';
import { resumeQueueIfPending } from './commands/group/creategroup.js';
import { resumeExportQueueIfPending } from './commands/group/export.js';
import { migrateSudoToSupabase, initSudo, setBotId } from './lib/sudo-store.js';
import { migrateWarningsToSupabase, addWarning, getWarnLimit, resetWarnings } from './lib/warnings-store.js';
import { detectPlatform } from './lib/platformDetect.js';
import { applyFont as _applyFont } from './lib/fontTransformer.js';
import { initStorageManager, onENOSPC } from './lib/storageManager.js';
import { sendMigrationNotice } from './lib/migrationNotice.js';
import { sendComebackNotice } from './lib/comebackNotice.js';
import { OWNER, PROFILE_URL, REPO_URL, AVATAR_URL } from './lib/repoConfig.js';

const msgRetryCounterCache = new NodeCache({ stdTTL: 600 });
globalThis.msgRetryCounterCache_ref = msgRetryCounterCache;

// ====== SECTION 4: LID / PHONE NUMBER RESOLUTION SYSTEM ======
// WhatsApp now issues "LID" (Linked Device ID) identifiers for some accounts.
// A LID looks like  12345@lid  instead of the usual  44779000000@s.whatsapp.net.
// Many features (sudo checks, kick, block) need the real phone number, not the LID.
//
// How this works:
//   1. lidPhoneCache/phoneLidCache — in-memory maps that store LID ↔ phone pairs
//   2. cacheLidPhone()   — adds a new mapping to both caches
//   3. resolvePhoneFromLid() — given a LID JID, returns the phone number (or null)
//   4. resolveSenderFromGroup() — fetches group metadata to find the phone for a LID
//   5. autoScanGroupsForSudo() — called once at startup; scans all groups to build
//      LID↔phone mappings for every sudo user (so sudo commands work from any device)
//
// All JID helpers (cleanJid, normalizeJid, etc.) live in the JidManager class below.
let currentSock = null;

const lidPhoneCache = new Map();
const phoneLidCache = new Map();

function cacheLidPhone(lidNum, phoneNum) {
    if (!lidNum || !phoneNum || lidNum === phoneNum) return;
    lidPhoneCache.set(lidNum, phoneNum);
    phoneLidCache.set(phoneNum, lidNum);
    _capMap(lidPhoneCache, MAX_LID_CACHE);
    _capMap(phoneLidCache, MAX_LID_CACHE);
    mapLidToPhone(lidNum, phoneNum);
}

function resolvePhoneFromLid(jid) {
    if (!jid) return null;
    const lidNum = jid.split('@')[0].split(':')[0];

    const cached = lidPhoneCache.get(lidNum);
    if (cached) return cached;
    const stored = getPhoneFromLid(lidNum);
    if (stored) {
        lidPhoneCache.set(lidNum, stored);
        return stored;
    }

    if (!currentSock) return null;
    try {
        if (currentSock.signalRepository?.lidMapping?.getPNForLID) {
            const pn = currentSock.signalRepository.lidMapping.getPNForLID(jid);
            if (pn) {
                const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                if (num.length >= 7 && num !== lidNum) {
                    cacheLidPhone(lidNum, num);
                    return num;
                }
            }
        }
    } catch {}

    try {
        const fullLid = jid.includes('@') ? jid : `${jid}@lid`;
        if (currentSock.signalRepository?.lidMapping?.getPNForLID) {
            const formats = [fullLid, `${lidNum}:0@lid`, `${lidNum}@lid`];
            for (const fmt of formats) {
                try {
                    const pn = currentSock.signalRepository.lidMapping.getPNForLID(fmt);
                    if (pn) {
                        const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                        if (num.length >= 7 && num.length <= 15 && num !== lidNum) {
                            cacheLidPhone(lidNum, num);
                            return num;
                        }
                    }
                } catch {}
            }
        }
    } catch {}

    return null;
}
// Expose globally so other modules (chatbot.js, etc.) can resolve LID → phone
globalThis.resolvePhoneFromLid = resolvePhoneFromLid;

// Async version — properly awaits Baileys' signalRepository.lidMapping.getPNForLID
// Use this anywhere you can await (sendMessage override, handleIncomingMessage, etc.)
async function resolvePhoneFromLidAsync(jid) {
    if (!jid) return null;
    const lidNum = jid.split('@')[0].split(':')[0];

    // 1. Fast path — in-memory cache
    const cached = lidPhoneCache.get(lidNum);
    if (cached) return cached;

    // 2. SQLite store
    const stored = getPhoneFromLid(lidNum);
    if (stored) {
        lidPhoneCache.set(lidNum, stored);
        return stored;
    }

    // 3. Baileys async lidMapping (properly awaited)
    if (!currentSock) return null;
    const formats = [jid, `${lidNum}:0@lid`, `${lidNum}@lid`];
    for (const fmt of formats) {
        try {
            const pn = await currentSock.signalRepository?.lidMapping?.getPNForLID?.(fmt);
            if (pn && typeof pn === 'string') {
                const num = pn.split('@')[0].replace(/[^0-9]/g, '');
                if (num.length >= 7 && num !== lidNum) {
                    cacheLidPhone(lidNum, num);
                    return num;
                }
            }
        } catch {}
    }
    return null;
}
globalThis.resolvePhoneFromLidAsync = resolvePhoneFromLidAsync;
globalThis.pg = pg;

async function resolvePhoneFromGroup(senderJid, chatId, sock) {
    return resolveSenderFromGroup(senderJid, chatId, sock);
}

function getDisplayNumber(senderJid) {
    if (!senderJid) return 'unknown';
    const raw = senderJid.split('@')[0].split(':')[0];
    const full = senderJid.split('@')[0];
    if (senderJid.includes('@lid')) {
        let phone = lidPhoneCache.get(raw) || lidPhoneCache.get(full) || getPhoneFromLid(raw) || getPhoneFromLid(full) || resolvePhoneFromLid(senderJid);
        if (!phone) {
            const isOwnerLid = OWNER_LID && (senderJid === OWNER_LID || raw === OWNER_LID.split('@')[0]?.split(':')[0]);
            if (isOwnerLid && currentSock?.user?.id && !currentSock.user.id.includes('@lid')) {
                phone = currentSock.user.id.split('@')[0]?.split(':')[0];
                if (phone) cacheLidPhone(raw, phone);
            }
            if (!phone && isOwnerLid && currentSock?.user?.lid) {
                const lidPhone = currentSock.user.lid.split('@')[0]?.split(':')[0];
                if (lidPhone && lidPhone !== raw && lidPhone.length >= 7) {
                    phone = lidPhone;
                    cacheLidPhone(raw, phone);
                }
            }
        }
        return phone ? `+${phone}` : `LID:${raw.substring(0, 8)}...`;
    }
    return `+${raw}`;
}

const groupMetadataCache = new Map();
globalThis.groupMetadataCache = groupMetadataCache;
globalThis.lidPhoneCache = lidPhoneCache;
globalThis.phoneLidCache = phoneLidCache;
globalThis.msgRetryCounterCache_ref = null;
const GROUP_CACHE_TTL = 10 * 60 * 1000;
const MAX_LID_CACHE = 500;
const MAX_GROUP_META_CACHE = 50;
const MAX_GROUP_DIAG = 200;
const groupDiagDone = new Set();
const _pendingGroupFetches = new Map();

function _capMap(map, max) {
    if (map.size <= max) return;
    const excess = map.size - Math.floor(max * 0.6);
    let i = 0;
    for (const k of map.keys()) {
        if (i++ >= excess) break;
        map.delete(k);
    }
}
function _capSet(set, max) {
    if (set.size <= max) return;
    const arr = [...set];
    set.clear();
    for (let i = arr.length - Math.floor(max * 0.6); i < arr.length; i++) set.add(arr[i]);
}

async function getCachedGroupMetadata(chatId, sock) {
    const cached = groupMetadataCache.get(chatId);
    if (cached && Date.now() - cached.ts < GROUP_CACHE_TTL) {
        return cached.data;
    }
    const pending = _pendingGroupFetches.get(chatId);
    if (pending) return pending;
    const fetchPromise = (async () => {
        try {
            const metadata = await Promise.race([
                sock.groupMetadata(chatId),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
            ]);
            groupMetadataCache.set(chatId, { data: metadata, ts: Date.now() });
            _capMap(groupMetadataCache, MAX_GROUP_META_CACHE);
            return metadata;
        } catch (err) {
            if (cached) return cached.data;
            return null;
        } finally {
            _pendingGroupFetches.delete(chatId);
        }
    })();
    _pendingGroupFetches.set(chatId, fetchPromise);
    return fetchPromise;
}

async function resolveDisplayNumber(jid, chatId, sock) {
    if (!jid) return 'unknown';
    const raw = jid.split('@')[0].split(':')[0];
    const full = jid.split('@')[0];
    
    if (!jid.includes('@lid')) return `+${raw}`;
    
    const cached = lidPhoneCache.get(raw) || lidPhoneCache.get(full) || getPhoneFromLid(raw) || getPhoneFromLid(full);
    if (cached) return `+${cached}`;
    
    const fromSignal = resolvePhoneFromLid(jid);
    if (fromSignal) return `+${fromSignal}`;
    
    if (chatId?.includes('@g.us') && sock) {
        try {
            const resolved = await resolveSenderFromGroup(jid, chatId, sock);
            if (resolved) return `+${resolved}`;
        } catch {}
    }
    
    return `LID:${raw.substring(0, 8)}...`;
}

async function generateRetrievalCaption(senderJid, retrieverJid, chatId, groupName, sock) {
    const isGroup = chatId?.includes('@g.us');
    
    let resolvedGroupName = groupName;
    if (isGroup && !resolvedGroupName && sock) {
        try {
            const metadata = await getCachedGroupMetadata(chatId, sock);
            if (metadata?.subject) resolvedGroupName = metadata.subject;
        } catch {}
    }
    
    const senderNumber = await resolveDisplayNumber(senderJid, chatId, sock);
    const isAutoDetect = retrieverJid === 'auto-detect';
    const retrieverDisplay = isAutoDetect ? `${getCurrentBotName()} (Auto)` : await resolveDisplayNumber(retrieverJid, chatId, sock);
    const chatName = resolvedGroupName || (isGroup ? chatId.split('@')[0] : 'Private Chat');
    const timeStr = new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    let caption = `╭⌈ 🔐 *VIEW-ONCE RETRIEVED* ⌋\n`;
    caption += `├⊷ 📤 *Sent by:* ${senderNumber}\n`;
    caption += `├⊷ 📥 *Retrieved by:* ${retrieverDisplay}\n`;
    caption += `├⊷ 🕐 *Time:* ${timeStr}\n`;
    caption += `╰⊷ 💬 *${isGroup ? 'Group' : 'Chat'}:* ${chatName}\n`;
    caption += `> Retrieved by ${getCurrentBotName()}`;
    return caption;
}

async function buildLidMapFromGroup(chatId, sock) {
    const metadata = await getCachedGroupMetadata(chatId, sock);
    if (!metadata) return 0;
    const participants = metadata.participants || [];
    let mapped = 0;

    if (!groupDiagDone.has(chatId) && participants.length > 0) {
        groupDiagDone.add(chatId);
        _capSet(groupDiagDone, MAX_GROUP_DIAG);
        const sample = participants.slice(0, 3).map(p => ({
            id: p.id || 'none',
            lid: p.lid || 'none',
            phoneNumber: p.phoneNumber || 'none',
            admin: p.admin || 'none',
            keys: Object.keys(p).filter(k => !['id','lid','admin','phoneNumber'].includes(k)).join(',')
        }));
        // participant structure debug log suppressed
    }
    
    for (const p of participants) {
        const { phoneNum, lidNum } = extractParticipantInfo(p, sock);

        if (phoneNum && lidNum && phoneNum !== lidNum) {
            cacheLidPhone(lidNum, phoneNum);
            mapLidToPhone(lidNum, phoneNum);
            mapped++;
        }
    }
    return mapped;
}

const _lidResolveAttempts = new Map();
const LID_RESOLVE_COOLDOWN = 5 * 60 * 1000;
let _activeGroupFetches = 0;
const MAX_CONCURRENT_GROUP_FETCHES = 2;

async function resolveSenderFromGroup(senderJid, chatId, sock) {
    if (!senderJid || !chatId || !sock) return null;
    const senderLidNum = senderJid.split('@')[0].split(':')[0];
    const senderFull = senderJid.split('@')[0];

    let resolved = lidPhoneCache.get(senderLidNum) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderLidNum) || getPhoneFromLid(senderFull);
    if (resolved) return resolved;

    const attemptKey = `${senderLidNum}:${chatId}`;
    const lastAttempt = _lidResolveAttempts.get(attemptKey);
    if (lastAttempt && Date.now() - lastAttempt < LID_RESOLVE_COOLDOWN) return null;
    _lidResolveAttempts.set(attemptKey, Date.now());

    if (_lidResolveAttempts.size > 500) {
        const cutoff = Date.now() - LID_RESOLVE_COOLDOWN;
        for (const [k, ts] of _lidResolveAttempts) {
            if (ts < cutoff) _lidResolveAttempts.delete(k);
        }
    }

    if (_activeGroupFetches >= MAX_CONCURRENT_GROUP_FETCHES) return null;
    _activeGroupFetches++;
    try {
        await buildLidMapFromGroup(chatId, sock);
    } finally {
        _activeGroupFetches--;
    }

    resolved = lidPhoneCache.get(senderLidNum) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderLidNum) || getPhoneFromLid(senderFull);
    if (resolved) {
        UltraCleanLogger.info(`🔗 LID resolved: ${senderLidNum.substring(0, 8)}... → +${resolved}`);
    }
    return resolved;
}

function extractParticipantInfo(p, sock) {
    const pid = p.id || '';
    const plid = p.lid || '';
    let phoneNum = null;
    let lidNum = null;

    if (p.phoneNumber) {
        const num = String(p.phoneNumber).replace(/[^0-9]/g, '');
        if (num.length >= 7 && num.length <= 15) phoneNum = num;
    }

    if (!phoneNum && pid && !pid.includes('@lid')) {
        const num = pid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (num.length >= 7 && num.length <= 15) phoneNum = num;
    }

    if (!phoneNum && plid && !plid.includes('@lid')) {
        const num = plid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (num.length >= 7 && num.length <= 15) phoneNum = num;
    }

    if (pid.includes('@lid')) {
        lidNum = pid.split('@')[0].split(':')[0];
    }
    if (!lidNum && plid && plid.includes('@lid')) {
        lidNum = plid.split('@')[0].split(':')[0];
    }
    if (!lidNum && plid) {
        lidNum = plid.split('@')[0].split(':')[0];
    }

    if (!phoneNum && lidNum) {
        try {
            const theLid = pid.includes('@lid') ? pid : (plid || pid);
            if (sock?.signalRepository?.lidMapping?.getPNForLID) {
                const pn = sock.signalRepository.lidMapping.getPNForLID(theLid);
                if (pn) {
                    const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                    if (num.length >= 7 && num.length <= 15) phoneNum = num;
                }
            }
        } catch {}
    }

    return { phoneNum, lidNum };
}

async function autoScanGroupsForSudo(sock) {
    try {
        const { sudoers } = getSudoList();
        if (sudoers.length === 0) return;

        const allSudosMapped = sudoers.every(num => {
            for (const [, phone] of lidPhoneCache) {
                if (phone === num) return true;
            }
            const stored = getPhoneFromLid(num);
            if (stored) return true;
            return false;
        });
        if (allSudosMapped) {
            UltraCleanLogger.info(`🔑 All ${sudoers.length} sudo(s) already have LID mappings`);
            return;
        }

        UltraCleanLogger.info(`🔑 Scanning groups to link ${sudoers.length} sudo user(s)...`);
        const groups = await Promise.race([
            sock.groupFetchAllParticipating(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('scan_timeout')), 15000))
        ]);
        if (!groups) return;
        let linked = 0;
        let totalParticipants = 0;
        let diagLogged = false;

        const groupEntries = Object.entries(groups);
        for (let gi = 0; gi < groupEntries.length; gi++) {
            const [groupId, metadata] = groupEntries[gi];
            const participants = metadata.participants || [];
            totalParticipants += participants.length;

            if (!diagLogged && participants.length > 0) {
                diagLogged = true;
                const sample = participants.slice(0, 2).map(p => ({
                    id: p.id || 'none', lid: p.lid || 'none',
                    phoneNumber: p.phoneNumber || 'none',
                    keys: Object.keys(p).filter(k => !['id','lid','admin','phoneNumber'].includes(k)).join(',')
                }));
                // scan participant structure debug log suppressed
            }

            for (const p of participants) {
                const { phoneNum, lidNum } = extractParticipantInfo(p, sock);

                if (phoneNum && lidNum && phoneNum !== lidNum) {
                    cacheLidPhone(lidNum, phoneNum);
                    mapLidToPhone(lidNum, phoneNum);
                    if (sudoers.includes(phoneNum)) linked++;
                }

                const pid = p.id || '';
                const plid = p.lid || '';
                if (pid && !pid.includes('@lid')) {
                    const phoneN = pid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    if (phoneN && sudoers.includes(phoneN)) {
                        const lidJid = plid || pid;
                        if (lidJid.includes('@lid')) {
                            const lNum = lidJid.split('@')[0].split(':')[0];
                            cacheLidPhone(lNum, phoneN);
                            linked++;
                        }
                    }
                }
            }
            if (gi % 10 === 9) await new Promise(r => setTimeout(r, 0));
        }

        UltraCleanLogger.info(`🔑 Scanned ${Object.keys(groups).length} groups, ${totalParticipants} participants`);
        if (linked > 0) {
            UltraCleanLogger.success(`🔑 Auto-linked ${linked} sudo user(s) from group scan`);
        } else {
            UltraCleanLogger.info(`🔑 No sudo users found via group scan. Use =linksudo in a group with your sudo user.`);
        }
    } catch (err) {
        UltraCleanLogger.warning(`Sudo auto-scan: ${err.message}`);
    }
}

// ====== SECTION 5: AUTOMATION & GROUP HANDLER IMPORTS ======
// These are imported at the top level (not lazily) so the first event that
// fires doesn't stall waiting for a dynamic import() to resolve from disk.
// Each module is a feature that plugs directly into the messages.upsert handler:
//   autoreactstatus   — auto-reacts to WhatsApp statuses with a chosen emoji
//   channelreact      — reacts to posts in WA channels/newsletters
//   reactowner        — reacts to owner messages (custom emoji)
//   reactdev          — reacts to dev messages
//   autoviewstatus    — silently marks statuses as viewed
//   autodownloadstatus— saves every status to the owner's DM
//   antidemote        — kicks admins who demote the bot
//   antibug/antilink/antispam/antibot — group protection systems
//   antidelete        — re-sends deleted messages to the owner
//   antideletestatus  — same thing but for deleted WA statuses
//   welcome/goodbye   — sends a message when members join/leave a group
//   joinapproval      — posts a note when the bot approves a join request
import { handleAutoReact, handleAutoReactGsmView } from './commands/automation/autoreactstatus.js';
import { handleChannelReact, discoverNewsletters, channelReactManager } from './commands/channel/channelreact.js';
import { handleReactOwner } from './commands/automation/reactowner.js';
import { handleReactDev } from './commands/automation/reactdev.js';
import { handleAutoView, autoViewManager } from './commands/automation/autoviewstatus.js';
import { handleAutoDownloadStatus, cacheStatusMessage, triggerSaveFromOwnerReply, isStatusCached } from './commands/automation/autodownloadstatus.js';
import { initializeAutoJoin } from './commands/group/add.js';
import antidemote from './commands/group/antidemote.js';
import { isBugMessage as antibugCheck, isEnabled as antibugEnabled, getAction as antibugGetAction } from './commands/group/antibug.js';
import { checkMessageForLinks as antilinkCheck, isEnabled as antilinkEnabled, getMode as antilinkGetMode, getGroupConfig as antilinkGetConfig, isLinkExempt as antilinkIsExempt, isExcludedType as antilinkIsExcludedType, getCustomMessage as antilinkGetCustomMessage, formatCustomMessage as antilinkFormatCustomMessage } from './commands/group/antilink.js';
import { checkMessageForBadWord, isGroupEnabled as isBadWordEnabled, getGroupAction as getBadWordAction } from './lib/badwords-store.js';
import { isEnabled as antispamEnabled, getAction as antispamGetAction, checkSpam as antispamCheck } from './commands/group/antispam.js';
import { isBotMessage as antibotCheck, isEnabled as antibotEnabled, getMode as antibotGetMode } from './commands/group/antibot.js';
import { recordActivity as recordGroupActivity } from './lib/groupActivity.js';
import persistentConfig from './lib/persistentConfig.js';
import banCommand from './commands/group/ban.js';
import { setupWebServer, updateWebStatus } from './lib/webServer.js';
import pg from './lib/pgAdapter.js';

// Pre-imported group event modules (avoids dynamic import disk I/O in hot event handlers)
import { handleGroupParticipantUpdate as antidemoteHandler } from './commands/group/antidemote.js';
import { isWelcomeEnabled, getWelcomeMessage, sendWelcomeMessage } from './commands/group/welcome.js';
import { isGoodbyeEnabled, getGoodbyeMessage, sendGoodbyeMessage } from './commands/group/goodbye.js';
import { isJoinApprovalEnabled } from './commands/group/joinapproval.js';
import { handleStatusMention as statusMentionHandler } from './commands/group/antistatusmention.js';
import { handleAntiForward as antiforwardHandler, isAntiForwardEnabled } from './commands/group/antiforward.js';
import { handleAntiChat as antichatHandler, isAntiChatEnabled } from './commands/group/antichat.js';
import { setupAntiGroupStatusListener } from './commands/group/antigroupstatus.js';

// Import antidelete system (listeners registered in index.js, always active)
import { initAntidelete, antideleteStoreMessage, antideleteHandleUpdate, updateAntideleteSock } from './commands/owner/antidelete.js';
import { initAntiedit, updateAntieditSock } from './commands/owner/antiedit.js';

// Import status antidelete system (always on, handles status messages exclusively)
import { initStatusAntidelete, statusAntideleteStoreMessage, statusAntideleteHandleUpdate, updateStatusAntideleteSock } from './commands/owner/antideletestatus.js';
import { initStatusReplyListener } from './lib/statusReplyListener.js';

// Import W.O.L.F chatbot system
// chatbot.js handles group chatbot mode (responds to all messages in a group, any user)
// This is separate from Wolf AI, which is the owner-only DM assistant in wolfai.js
import { isChatbotActiveForChat, handleChatbotMessage } from './commands/ai/chatbot.js';

// ====== SECTION 6: ENVIRONMENT & GLOBAL CONSTANTS ======
// Loads .env file so variables like SESSION_ID and BOT_PREFIX are available via process.env.
// Also sets __filename / __dirname (not available natively in ES module files).
// Try multiple possible .env locations so panels (Pterodactyl, Koyeb, etc.) that run the
// process from a different working directory still pick up the file.
(function _loadDotenv() {
    const _tryPaths = [
        './.env',
        process.env.ENV_FILE || '',           // allow explicit override via ENV_FILE
        new URL('.env', import.meta.url).pathname, // same dir as index.js
        '/home/container/.env',               // Pterodactyl default container root
        '/app/.env',                          // Railway / Koyeb common path
    ].filter(Boolean);
    let _loaded = false;
    for (const _p of _tryPaths) {
        try {
            const _r = dotenv.config({ path: _p });
            if (!_r.error) { _loaded = true; break; }
        } catch {}
    }
    if (!_loaded) dotenv.config(); // last-resort: let dotenv search default locations
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Seed Pterodactyl & Paystack configs from ENV (optional) ─────────────────
import { seedConfigsFromEnv, getKeyStatus } from './lib/envConfig.js';
import { isTranslationEnabled, translateText, getBotLanguage } from './lib/translator.js';
import * as autoLeave from './lib/autoLeave.js';
seedConfigsFromEnv();


// ====== CONFIGURATION ======
// ====== SECTION 7: BOT IDENTITY & FILE PATH CONSTANTS ======
// These are the single source of truth for the bot's name, version, and all
// the JSON files it reads/writes for persistent config.
//
// BOT_NAME:       display name shown in menus, connection messages, etc.
//                 Read from lib/botname.js; changed with the .setbotname command.
// DEFAULT_PREFIX: the command trigger character (default: ".").
//                 Read from BOT_PREFIX or PREFIX env var, then from the DB cache.
//                 Changed at runtime with .setprefix; stored in prefix_config.json / DB.
// SESSION_DIR:    folder that holds WhatsApp session credentials (creds.json, keys, etc.)
// *_FILE paths:   legacy JSON file locations; bot now mirrors these into the Supabase DB
//                 via the config cache system below (runDataMigrations()).
const SESSION_DIR = './session';
try {
    const _bnFile = path.join(__dirname, 'bot_name.json');
    if (fs.existsSync(_bnFile)) {
        const _bnData = JSON.parse(fs.readFileSync(_bnFile, 'utf8'));
        if (_bnData.botName && _bnData.botName.trim()) {
            global.BOT_NAME = _bnData.botName.trim();
        }
    }
} catch {}
let BOT_NAME = _getBotName();
global.BOT_NAME = BOT_NAME;
function getCurrentBotName() { return _getBotName(); }
const VERSION = '1.1.5';
global.VERSION = VERSION;
const _rawEnvPrefix = process.env.BOT_PREFIX || process.env.PREFIX || '';
const DEFAULT_PREFIX = (_rawEnvPrefix && _rawEnvPrefix.length <= 5) ? _rawEnvPrefix : '.';
const OWNER_FILE = './owner.json';
const PREFIX_CONFIG_FILE = './prefix_config.json';
const BOT_SETTINGS_FILE = './bot_settings.json';
const BOT_MODE_FILE = './bot_mode.json';
const WHITELIST_FILE = './whitelist.json';
const BLOCKED_USERS_FILE = './blocked_users.json';
const WELCOME_DATA_FILE = './data/welcome_data.json';

let _cache_owner_data = null;
let _cache_prefix_config = null;
let _cache_bot_settings = null;
let _cache_bot_mode = null;
let _cache_whitelist = null;
let _cache_blocked_users = null;
let _cache_welcome_data = null;
let _cache_status_logs = null;
let _cache_member_detection = null;

// ====== SECTION 8: CONFIG CACHE SYSTEM ======
// Every piece of persistent state (owner number, prefix, bot mode, whitelist, etc.)
// is kept in Supabase/SQLite via lib/database.js.  Reading from DB on every message
// would be too slow, so we keep an in-memory cache of each config value.
//
//   _cache_*        — the in-memory snapshot of each DB key
//   _loadConfigCache(key) — fetches from DB once; used at startup and after reconnect
//   _saveConfigCache(key) — writes to DB without blocking (fire-and-forget)
//   reloadConfigCaches()  — re-fetches ALL caches after reconnect or bot_id change
//   updateBotModeCache()  — called by commands/owner/mode.js when .mode is changed;
//                           updates both the in-memory variable AND the DB in one step
//
// Why this matters for commands:
//   Commands don't touch the DB directly — they call global helpers like
//   `global.updateBotModeCache()` or `globalThis._saveAntilinkConfig()` which
//   write through the cache to the DB automatically.
async function _loadConfigCache(key, defaultValue) {
    try {
        const val = await supabaseDb.getConfig(key, defaultValue);
        return val;
    } catch {
        return defaultValue;
    }
}

function _saveConfigCache(key, value) {
    supabaseDb.setConfig(key, value).catch(err => {
        UltraCleanLogger.warning(`DB save error for ${key}: ${err.message}`);
    });
}
globalThis._saveConfigCache = _saveConfigCache;

// Update the module-level BOT_NAME variable (and global) in one call.
// setbotname.js calls this so the change is visible immediately within the
// current process without needing a restart.
globalThis._updateBotName = function(name) {
    if (!name || !String(name).trim()) return;
    BOT_NAME = String(name).trim();
    global.BOT_NAME = BOT_NAME;
};

globalThis.updateBotModeCache = function(newMode) {
    const _modePayload = { mode: newMode, setAt: new Date().toISOString() };
    _cache_bot_mode = _modePayload;
    BOT_MODE = newMode;
    _saveConfigCache('bot_mode', _modePayload);
    updateWebStatus({ botMode: newMode });
    // JSON fallback — survives DB wipe
    try { fs.writeFileSync('./bot_mode.json', JSON.stringify({ mode: newMode, setAt: new Date().toISOString() }, null, 2)); } catch {}
    // .env write-through — survives Pterodactyl egg reinstalls (git pull never touches .env)
    updateEnvFile('BOT_MODE', newMode);
};
globalThis._fontConfig = { font: 'default' };
globalThis._antibotConfig = null;
globalThis._saveAntibotConfig = function(data) {
    _saveConfigCache('antibot_config', data);
};
_loadConfigCache('antibot_config', {}).then(config => {
    globalThis._antibotConfig = config || {};
}).catch(() => { globalThis._antibotConfig = {}; });

globalThis._antidispConfig = { enabled: false };
globalThis._saveAntidispConfig = function(data) {
    _saveConfigCache('antidisp_config', data);
};
_loadConfigCache('antidisp_config', { enabled: false }).then(config => {
    globalThis._antidispConfig = (config && typeof config === 'object') ? config : { enabled: false };
}).catch(() => { globalThis._antidispConfig = { enabled: false }; });

// ── Persistent settings safety net ──────────────────────────────────────────
// hydrateAll() is intentionally deferred until AFTER the DB is initialised.
// Running it at module-load time (before initTables()) caused it to fail
// silently, then push stale default file values to the DB on later calls.
// startMirror() is also started here so the 30-second push loop begins once
// the DB is ready. See lib/persistentConfig.js for the registry.
globalThis._antibugConfig = null;
globalThis._saveAntibugConfig = function(data) {
    _saveConfigCache('antibug_config', data);
};
_loadConfigCache('antibug_config', {}).then(config => {
    globalThis._antibugConfig = config || {};
}).catch(() => { globalThis._antibugConfig = {}; });
globalThis._antilinkConfig = null;
globalThis._saveAntilinkConfig = function(data) {
    _saveConfigCache('antilink_config', data);
};
_loadConfigCache('antilink_config', {}).then(config => {
    globalThis._antilinkConfig = config || {};
}).catch(() => { globalThis._antilinkConfig = {}; });
globalThis._antispamConfig = null;
globalThis._saveAntispamConfig = function(data) {
    _saveConfigCache('antispam_config', data);
};
_loadConfigCache('antispam_config', {}).then(config => {
    globalThis._antispamConfig = config || {};
}).catch(() => { globalThis._antispamConfig = {}; });
globalThis._antiforwardConfig = null;
const _ANTIFORWARD_JSON = './data/antiforward.json';
globalThis._saveAntiforwardConfig = function(data) {
    _saveConfigCache('antiforward_config', data);
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(_ANTIFORWARD_JSON, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
};
(function _loadAntiforwardEarly() {
    try {
        if (fs.existsSync(_ANTIFORWARD_JSON)) {
            const raw = fs.readFileSync(_ANTIFORWARD_JSON, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                globalThis._antiforwardConfig = parsed;
                return;
            }
        }
    } catch {}
    _loadConfigCache('antiforward_config', {}).then(config => {
        if (!globalThis._antiforwardConfig || Object.keys(globalThis._antiforwardConfig).length === 0) {
            globalThis._antiforwardConfig = config || {};
        }
    }).catch(() => { if (!globalThis._antiforwardConfig) globalThis._antiforwardConfig = {}; });
})();
// Bootstrap timezone from .env immediately so menus/messages use the right tz before
// reloadConfigCaches() runs after the WhatsApp connection is established.
if (process.env.BOT_TIMEZONE && !globalThis._timezone) {
    globalThis._timezone = process.env.BOT_TIMEZONE;
}

globalThis.reloadConfigCaches = reloadConfigCaches;
async function reloadConfigCaches() {
    try {
        // Re-run JSON-to-DB migrations now that the real phone-number bot_id is set.
        // migrateJSONToConfig is INSERT-OR-IGNORE, so existing entries are never overwritten.
        // This promotes any JSON-file settings that were only stored under 'default' into
        // the phone-number-scoped rows, so they persist correctly after this restart.
        const _migrationFiles = [
            { file: './bot_mode.json', key: 'bot_mode' },
            { file: './bot_settings.json', key: 'bot_settings' },
            { file: './prefix_config.json', key: 'prefix_config' },
            { file: './owner.json', key: 'owner_data' },
            { file: './whitelist.json', key: 'whitelist' },
            { file: './blocked_users.json', key: 'blocked_users' },
            { file: './data/welcome_data.json', key: 'welcome_data' },
            { file: './data/autoViewConfig.json', key: 'autoview_config' },
            { file: './data/autoReactConfig.json', key: 'autoreact_config' },
            { file: './data/channelReactConfig.json', key: 'channelreact_config' },
            { file: './data/autoDownloadStatusConfig.json', key: 'autodownload_status_config' },
            { file: './data/presence/config.json', key: 'presence_config' },
            { file: './data/autotyping/config.json', key: 'autotyping_config' },
            { file: './data/autorecording/config.json', key: 'autorecording_config' },
            { file: './data/member_detection.json', key: 'member_detection' },
            { file: './data/status_detection_logs.json', key: 'status_detection_logs' },
            { file: './data/anticall.json', key: 'anticall_config' },
            { file: './anticall.json', key: 'anticall_config_root' },
            { file: './autoread_settings.json', key: 'autoread_config' },
            { file: './disp_settings.json', key: 'disp_config' },
            { file: './data/footer.json', key: 'footer_config' },
        ];
        for (const { file, key } of _migrationFiles) {
            await supabaseDb.migrateJSONToConfig(file, key).catch(() => {});
        }

        _cache_owner_data = await _loadConfigCache('owner_data', {});
        _cache_prefix_config = await _loadConfigCache('prefix_config', { prefix: DEFAULT_PREFIX });
        // File-wins-if-newer: savePrefixToFile() writes the JSON synchronously BEFORE the
        // async DB write. A hard restart between the two leaves the DB one version behind.
        // Compare timestamps and promote the file value when it is equal or newer.
        try {
            const _filePfx = JSON.parse(fs.readFileSync(PREFIX_CONFIG_FILE, 'utf8'));
            const _dbMs   = new Date(_cache_prefix_config?.setAt || 0).getTime();
            const _fileMs = _filePfx?.timestamp || new Date(_filePfx?.setAt || 0).getTime();
            if (_filePfx && _filePfx.prefix !== undefined && _fileMs >= _dbMs) {
                _cache_prefix_config = _filePfx;
                supabaseDb.setConfig('prefix_config', _filePfx).catch(() => {});
            }
        } catch {}
        // Bot name — load from DB so it survives filesystem wipes (Heroku/Pterodactyl reinstalls).
        try {
            const _dbBn = await _loadConfigCache('bot_name', null);
            {
                const { readBotNameFile: _readBnFile, writeBotNameFile: _writeBnFile } = await import('./lib/botname.js').catch(() => ({}));
                const _fileBnName = typeof _readBnFile === 'function' ? _readBnFile() : null;
                if (_fileBnName) {
                    // File is the authoritative source — always sync global + module var from it.
                    BOT_NAME = _fileBnName;
                    global.BOT_NAME = _fileBnName;
                } else if (_dbBn && _dbBn.name) {
                    // No file — restore from DB (Pterodactyl/Heroku filesystem wipe recovery).
                    BOT_NAME = _dbBn.name;
                    global.BOT_NAME = _dbBn.name;
                    if (typeof _writeBnFile === 'function') _writeBnFile(_dbBn.name);
                }
            }
        } catch {}
        _cache_bot_settings = await _loadConfigCache('bot_settings', {});
        _cache_bot_mode = await _loadConfigCache('bot_mode', { mode: process.env.BOT_MODE || 'public' });
        // File-wins-if-newer for bot_mode (same race condition as prefix_config).
        try {
            const _fileBm = JSON.parse(fs.readFileSync('./bot_mode.json', 'utf8'));
            const _dbBmMs   = new Date(_cache_bot_mode?.setAt || 0).getTime();
            const _fileBmMs = new Date(_fileBm?.setAt || 0).getTime();
            if (_fileBm && _fileBm.mode && _fileBmMs >= _dbBmMs) {
                _cache_bot_mode = _fileBm;
                supabaseDb.setConfig('bot_mode', _fileBm).catch(() => {});
            }
        } catch {}
        _cache_whitelist = await _loadConfigCache('whitelist', { whitelist: [] });
        _cache_blocked_users = await _loadConfigCache('blocked_users', { blocked: [] });
        _cache_welcome_data = await _loadConfigCache('welcome_data', {});
        _cache_status_logs = await _loadConfigCache('status_detection_logs', {});
        _cache_member_detection = await _loadConfigCache('member_detection', {});

        // Defensive: treat empty/stale DB rows as if they don't exist — prefer .env over hardcoded fallback.
        if (_cache_bot_mode && !_cache_bot_mode.mode) _cache_bot_mode = { mode: process.env.BOT_MODE || 'public' };
        if (_cache_prefix_config && typeof _cache_prefix_config.prefix === 'undefined' && !_cache_prefix_config.isPrefixless) {
            _cache_prefix_config = { prefix: DEFAULT_PREFIX };
        }

        // Reload font, antilink & antibug configs with the correct bot ID (they were
        // initially loaded at module startup before login, so bot_id was 'default')
        const fontData = await _loadConfigCache('font_config', { font: 'default' });
        if (fontData && fontData.font) globalThis._fontConfig = fontData;

        const antibotData = await _loadConfigCache('antibot_config', {});
        globalThis._antibotConfig = (antibotData && Object.keys(antibotData).length > 0) ? antibotData : (globalThis._antibotConfig || {});

        const antidispData = await _loadConfigCache('antidisp_config', { enabled: false });
        globalThis._antidispConfig = (antidispData && typeof antidispData === 'object') ? antidispData : (globalThis._antidispConfig || { enabled: false });

        const antibugData = await _loadConfigCache('antibug_config', {});
        globalThis._antibugConfig = (antibugData && Object.keys(antibugData).length > 0) ? antibugData : (globalThis._antibugConfig || {});

        const antilinkData = await _loadConfigCache('antilink_config', {});
        globalThis._antilinkConfig = (antilinkData && Object.keys(antilinkData).length > 0) ? antilinkData : (globalThis._antilinkConfig || {});

        const antispamData = await _loadConfigCache('antispam_config', {});
        globalThis._antispamConfig = (antispamData && Object.keys(antispamData).length > 0) ? antispamData : (globalThis._antispamConfig || {});

        let antiforwardData = null;
        try {
            if (fs.existsSync(_ANTIFORWARD_JSON)) {
                const _afRaw = fs.readFileSync(_ANTIFORWARD_JSON, 'utf8');
                const _afParsed = JSON.parse(_afRaw);
                if (_afParsed && typeof _afParsed === 'object' && Object.keys(_afParsed).length > 0) antiforwardData = _afParsed;
            }
        } catch {}
        if (!antiforwardData) {
            const _afDb = await _loadConfigCache('antiforward_config', {});
            if (_afDb && Object.keys(_afDb).length > 0) antiforwardData = _afDb;
        }
        globalThis._antiforwardConfig = antiforwardData || globalThis._antiforwardConfig || {};

        const tzData = await _loadConfigCache('timezone_config', { timezone: process.env.BOT_TIMEZONE || 'UTC' });
        globalThis._timezone = tzData?.timezone || process.env.BOT_TIMEZONE || 'UTC';
        // Write-through so timezone survives filesystem wipes
        if (globalThis._timezone && globalThis._timezone !== 'UTC') {
            updateEnvFile('BOT_TIMEZONE', globalThis._timezone);
        }

        if (_cache_owner_data && Object.keys(_cache_owner_data).length === 0) _cache_owner_data = null;
        if (_cache_bot_settings && Object.keys(_cache_bot_settings).length === 0) _cache_bot_settings = null;
        if (_cache_welcome_data && Object.keys(_cache_welcome_data).length === 0) _cache_welcome_data = null;

        // Keep BOT_MODE in sync with the reloaded cache + flush to JSON
        if (_cache_bot_mode && _cache_bot_mode.mode) {
            BOT_MODE = _cache_bot_mode.mode;
            try { fs.writeFileSync('./bot_mode.json', JSON.stringify(_cache_bot_mode, null, 2)); } catch {}
        }

        // Re-apply prefix now that caches are loaded with the correct bot_id
        const _reloadedPrefix = loadPrefixFromFiles();
        if (_reloadedPrefix !== prefixCache || prefixCache === DEFAULT_PREFIX) {
            prefixCache = _reloadedPrefix;
            isPrefixless = prefixCache === '';
            global.prefix = prefixCache;
            global.CURRENT_PREFIX = prefixCache;
            process.env.PREFIX = prefixCache;
        }

        // Write-through: keep JSON files + .env fresh on every reconnect.
        // .env is the ultimate fallback for Pterodactyl servers that reinstall via git.
        try {
            if (_cache_prefix_config && _cache_prefix_config.prefix !== undefined) {
                fs.writeFileSync('./prefix_config.json', JSON.stringify(_cache_prefix_config, null, 2));
                const pxIsPrefixless = !!_cache_prefix_config.isPrefixless;
                updateEnvFile('BOT_PREFIX', pxIsPrefixless ? '' : (_cache_prefix_config.prefix || ''));
            }
        } catch {}
        try {
            if (_cache_bot_mode && _cache_bot_mode.mode) {
                fs.writeFileSync('./bot_mode.json', JSON.stringify(_cache_bot_mode, null, 2));
                updateEnvFile('BOT_MODE', _cache_bot_mode.mode);
            }
        } catch {}
        try {
            if (_cache_bot_settings && Object.keys(_cache_bot_settings || {}).length > 0) {
                fs.writeFileSync('./bot_settings.json', JSON.stringify(_cache_bot_settings, null, 2));
            }
        } catch {}
        try {
            if (_cache_owner_data && _cache_owner_data.OWNER_NUMBER) {
                fs.writeFileSync('./owner.json', JSON.stringify(_cache_owner_data, null, 2));
            }
        } catch {}
        try {
            const _bn = _getBotName();
            if (_bn) updateEnvFile('BOT_NAME', _bn);
        } catch {}

        // ── Footer write-back ─────────────────────────────────────────────
        // Restores data/footer.json from DB after a hard filesystem reset so
        // the setfooter command's custom text survives full container wipes.
        try {
            const _footerData = await _loadConfigCache('footer_config', null);
            if (_footerData && _footerData.footer) {
                if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
                fs.writeFileSync('./data/footer.json', JSON.stringify(_footerData, null, 2));
            }
        } catch {}

        // ── Chatbot config write-back ─────────────────────────────────────
        // Restores the per-bot chatbot JSON config from the chatbot_config
        // DB table before the chatbot module first calls loadConfig().
        // Without this, loadConfig() returns the default and the user's
        // chatbot settings (mode, allowed groups, model preference) are lost
        // until after the first command call triggers the background restore.
        try {
            const _cbBotId = supabaseDb.getConfigBotId ? supabaseDb.getConfigBotId() : null;
            if (_cbBotId && _cbBotId !== 'default') {
                const _cbRows = await supabaseDb.getAll('chatbot_config', { key: 'main', bot_id: _cbBotId });
                const _cbData = _cbRows?.[0]?.config;
                if (_cbData && typeof _cbData === 'object') {
                    const _cbDir = './data/chatbot';
                    if (!fs.existsSync(_cbDir)) fs.mkdirSync(_cbDir, { recursive: true });
                    fs.writeFileSync(`${_cbDir}/chatbot_config_${_cbBotId}.json`, JSON.stringify(_cbData, null, 2));
                }
            }
        } catch {}

    } catch (err) {
        UltraCleanLogger.warning(`⚠️ Config reload error: ${err.message}`);
    }
}

// ── Pre-exit settings save ────────────────────────────────────────────────────
// Called by the restart / update commands immediately before process.exit().
// Guarantees that all live in-memory settings are written to every storage layer
// that may outlast the current process:
//   1. critical_backup.json  — SQLite row snapshot; restored on next initTables()
//   2. JSON fallback files   — used by loadPrefixFromFiles() before WhatsApp connects
//   3. .env file             — survives git-based reinstalls on Pterodactyl / VPS
//   4. Heroku Config Vars    — the ONLY storage that survives an ephemeral-FS dyno
//                              restart; requires HEROKU_API_KEY + HEROKU_APP_NAME
globalThis.preExitSave = async function preExitSave() {
    try {
        const _savePrefix = isPrefixless ? '' : (prefixCache || DEFAULT_PREFIX);
        const _saveMode   = BOT_MODE || 'public';

        // 0. Force a full mysettings.json snapshot NOW — this is the primary
        //    restore source on next boot. Must run before any process.exit()
        //    or pm2 restart so every in-memory setting is captured.
        try { await mySettings.snapshotNow(); } catch {}

        // 1. Write the current live values directly into the SQLite DB so
        //    that forceBackup() picks up the very latest state.
        try { await supabaseDb.setConfig('prefix_config', { prefix: _savePrefix, isPrefixless, setAt: new Date().toISOString() }); } catch {}
        try { await supabaseDb.setConfig('bot_mode',      { mode: _saveMode }); } catch {}
        try { const _saveBn = global.BOT_NAME || BOT_NAME; if (_saveBn) await supabaseDb.setConfig('bot_name', { name: _saveBn, setAt: new Date().toISOString() }); } catch {}

        // 2. Force-flush the SQLite critical_backup.json to disk right now.
        try { forceBackup(); } catch {}

        // 3. Re-write JSON fallback files with the current live values.
        try {
            fs.writeFileSync('./prefix_config.json', JSON.stringify({
                prefix: _savePrefix,
                isPrefixless,
                setAt: new Date().toISOString()
            }, null, 2));
        } catch {}
        try {
            fs.writeFileSync('./bot_mode.json', JSON.stringify({ mode: _saveMode }, null, 2));
        } catch {}

        // 4. Sync the .env file with the live values
        try { updateEnvFile('BOT_PREFIX', _savePrefix); } catch {}
        try { updateEnvFile('BOT_MODE',   _saveMode);   } catch {}

        // 5. Push critical settings to Heroku Config Vars so they survive the
        //    ephemeral filesystem being wiped when the dyno restarts.
        //    Requires HEROKU_API_KEY (or HEROKU_API_TOKEN) + HEROKU_APP_NAME.
        const _hApiKey  = process.env.HEROKU_API_KEY || process.env.HEROKU_API_TOKEN;
        const _hAppName = process.env.HEROKU_APP_NAME;
        if (_hApiKey && _hAppName) {
            try {
                const { default: _https } = await import('https');
                const _vars = JSON.stringify({
                    BOT_PREFIX: isPrefixless ? '' : (prefixCache || DEFAULT_PREFIX),
                    BOT_MODE:   BOT_MODE   || 'public',
                    BOT_NAME:   (global.BOT_NAME || BOT_NAME || 'WOLFBOT')
                });
                await new Promise((resolve) => {
                    const _req = _https.request({
                        hostname: 'api.heroku.com',
                        path:     `/apps/${encodeURIComponent(_hAppName)}/config-vars`,
                        method:   'PATCH',
                        headers: {
                            'Authorization': `Bearer ${_hApiKey}`,
                            'Content-Type':  'application/json',
                            'Accept':        'application/vnd.heroku+json; version=3',
                            'Content-Length': Buffer.byteLength(_vars)
                        }
                    }, (res) => { res.resume(); resolve(); });
                    _req.on('error', resolve);
                    _req.write(_vars);
                    _req.end();
                });
                UltraCleanLogger.success('✅ Settings synced to Heroku Config Vars');
            } catch {}
        }
    } catch {}
};
// ─────────────────────────────────────────────────────────────────────────────

// ====== SECTION 9: SPEED & RATE-LIMIT CONSTANTS ======
// AUTO_CONNECT_ON_LINK  — if true, triggers the .connect flow whenever a new user
//   messages the bot for the first time (auto-links them as owner).
// AUTO_CONNECT_ON_START — triggers the same .connect flow when the bot first boots.
// RATE_LIMIT_ENABLED    — throttles duplicate commands to prevent WhatsApp bans.
//   MIN_COMMAND_DELAY   — minimum ms between two identical commands from the same user.
//   STICKER_DELAY       — extra wait between sticker sends to avoid rate-limiting.
// Auto-connect features
const AUTO_CONNECT_ON_LINK = true;
const AUTO_CONNECT_ON_START = true;

// SPEED OPTIMIZATION
const RATE_LIMIT_ENABLED = true;
const MIN_COMMAND_DELAY = 100;
const STICKER_DELAY = 400;

// // Auto-join group configuration
// const AUTO_JOIN_ENABLED = true;
// const AUTO_JOIN_DELAY = 5000;
// const SEND_WELCOME_MESSAGE = true;
// const GROUP_LINK = 'https://chat.whatsapp.com/G3RopQF1UcSD7AeoVsd6PG';
// const GROUP_INVITE_CODE = GROUP_LINK.split('/').pop();
// const GROUP_NAME = 'WolfBot Community';
// const AUTO_JOIN_LOG_FILE = './auto_join_log.json';

// ====== SILENCE BAILEYS ======
function silenceBaileysCompletely() {
    try {
        const pino = require('pino');
        pino({ level: 'silent', enabled: false });
    } catch {}
}
silenceBaileysCompletely();

// ====== SECTION 10: ULTRA CLEAN LOGGER ======
// This is the only logging system used throughout the entire bot.  It replaces
// Node's built-in console.log/warn/error so Baileys' internal debug spam never
// reaches the terminal.
//
// How it works:
//   silenceBaileysCompletely() — overrides pino's transport before Baileys loads
//   setupProcessFilter()       — intercepts process.stdout/stderr at the stream level
//   _logSuppressSet            — exact substrings that are dropped (WhatsApp crypto keys, etc.)
//   _systemPatterns            — regex list; matches are buffered and printed as a
//                                single aggregated summary every 25 seconds instead of
//                                flooding the terminal with hundreds of individual lines.
//
// UltraCleanLogger static methods:
//   .info()    — cyan info line
//   .success() — green success line
//   .warning() — yellow warning line
//   .error()   — red error line
//   .command() — shows when a command fires (e.g. "▶ music · .play")
//   .group()   — group-event line (magenta)
//   .member()  — join/leave line (cyan)
//
// All command files call UltraCleanLogger (imported via lib/logger.js alias) so
// their output blends cleanly into the same filtered stream.
console.clear();
setupProcessFilter();

// Ultra clean logger
const _logSuppressSet = new Set([
    'closing session','sessionentry','_chains','registrationid','currentratchet',
    'indexinfo','pendingprekey','ephemeralkeypair','lastremoteephemeralkey',
    'rootkey','basekey','signalprotocol','signalkey','signalgroup','signalstore',
    'signalrepository','sessioncipher','sessionbuilder','sessionstate',
    'senderkeystore','senderkeydistribution','keyexchange','groupcipher',
    'ratchet','chainkey','keypair','pubkey','privkey','keystore',
    '<buffer','05 ','0x','failed to decrypt','bad mac','stream errored',
    'sessionerror','received error','connection.update','creds.update',
    'messages.upsert','presence.update','chat.update','message.receipt.update',
    'message.update','[asm-debug]','autoreact','autoview'
]);
const _logSuppressArr = [..._logSuppressSet];
const _errSuppressArr = [
    'bad mac','failed to decrypt','decrypt','session error','sessioncipher',
    'sessionbuilder','session_cipher','signalprotocol','ratchet','closed session',
    'stream errored','verifymac','libsignal','hmac','pre-key','prekey',
    // Suppress Node.js module-type warnings that expose internal /tmp/ paths
    'module_typeless_package_json','module type of file','does not parse as commonjs',
    'add "type": "module"','/tmp/'
];
const _warnSuppressArr = [
    'decrypted message with closed session','failed to decrypt','bad mac',
    'closing session','closing open session','incoming prekey bundle',
    'stream errored','signalprotocol','ratchet',
    'sessioncipher','sessionbuilder','sessionentry','sessionstate','sessionerror',
    // Suppress Node.js module-type warnings that expose internal /tmp/ paths
    'module_typeless_package_json','module type of file','does not parse as commonjs',
    'add "type": "module"','/tmp/'
];
function _isLogSuppressed(msg) {
    for (let i = 0; i < _logSuppressArr.length; i++) {
        if (msg.includes(_logSuppressArr[i])) return true;
    }
    return false;
}

// ── Cyberpunk Wolf colour palette ──────────────────────────────────────────
const _G    = '\x1b[38;2;0;255;156m';       // #00FF9C  neon green (primary)
const _GB   = '\x1b[1m\x1b[38;2;0;255;156m';
const _GD   = '\x1b[2m\x1b[38;2;0;255;156m';
const _SG   = '\x1b[38;2;0;230;118m';       // #00E676  secondary green
const _Y    = '\x1b[38;2;250;204;21m';       // #FACC15  yellow highlight
const _YB   = '\x1b[1m\x1b[38;2;250;204;21m';
const _YD   = '\x1b[2m\x1b[38;2;250;204;21m';
const _BL   = '\x1b[38;2;34;193;255m';       // #22C1FF  blue accent
const _BLB  = '\x1b[1m\x1b[38;2;34;193;255m';
const _BLD  = '\x1b[2m\x1b[38;2;34;193;255m';
const _RED  = '\x1b[38;2;255;60;80m';        // neon red
const _REDB = '\x1b[1m\x1b[38;2;255;60;80m';
const _ORG  = '\x1b[38;2;255;110;0m';        // neon orange
const _ORGB = '\x1b[1m\x1b[38;2;255;110;0m';
const _MAG  = '\x1b[38;2;180;0;255m';        // neon violet
const _MAGB = '\x1b[1m\x1b[38;2;180;0;255m';
const _CYAN = '\x1b[38;2;0;240;255m';        // neon cyan
const _CYANB= '\x1b[1m\x1b[38;2;0;240;255m';
const _WHT  = '\x1b[38;2;200;215;225m';      // off-white body text
const _DIM  = '\x1b[2m\x1b[38;2;100;120;130m'; // dim grey
const _R    = '\x1b[0m';
// ───────────────────────────────────────────────────────────────────────────

const _systemBuffer = [];
const _FLUSH_INTERVAL = 25000;
let _lastFlush = Date.now();
let _flushTimer = null;

const _systemPatterns = [
    'disk cleanup', 'trimming caches', 'high memory',
    'media stored', 'saved sticker', 'saved media', 'trimmed to',
    'cleanup:', 'disk space', 'low disk', '[antidelete] media',
    'antiedit: saved', 'antiedit: stored', 'items removed',
    'cache trimmed', 'disk manager'
];

function _isSystemLog(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    for (let i = 0; i < _systemPatterns.length; i++) {
        if (lower.includes(_systemPatterns[i])) return true;
    }
    return false;
}

function _getTime() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// ── PG log detection ────────────────────────────────────────────────────────
function _isPGLog(text) {
    return typeof text === 'string' && text.startsWith('[PG]');
}

function _printPGLog(text) {
    const NB  = '\x1b[1m\x1b[38;2;0;230;118m';
    const LBL = '\x1b[1m\x1b[38;2;255;165;0m';
    const W   = '\x1b[38;2;200;215;225m';
    const D   = '\x1b[2m\x1b[38;2;120;140;155m';
    const OK  = '\x1b[38;2;0;230;118m';
    const R   = '\x1b[0m';
    const row = (k, v) => `${D}»${R} ${LBL}${k}:${R} ${W}${v}${R}`;

    if (text.includes('Tables in DB:')) {
        const match  = text.match(/Tables in DB:\s*(.+)/i);
        const tables = match ? match[1].split(',').map(t => t.trim()).filter(Boolean) : [];
        const lines  = ['', `${NB}╭─⌈ 🗄️ DATABASE ⌋${R}`];
        for (const tbl of tables) lines.push(row(tbl, `${OK}✅ linked${R}`));
        lines.push(`${NB}╰⊷${R}`, '');
        process.stdout.write(lines.join('\n') + '\n');
    } else if (text.includes('✅') || text.toLowerCase().includes('connected')) {
        const lines = ['', `${NB}╭─⌈ 🗄️ DATABASE ⌋${R}`, row('Status', `${OK}✅ all systems synchronized${R}`), `${NB}╰⊷${R}`, ''];
        process.stdout.write(lines.join('\n') + '\n');
    } else {
        const msg   = text.replace('[PG]', '').trim();
        const lines = ['', `${NB}╭─⌈ 🗄️ DATABASE ⌋${R}`, row('Info', msg), `${NB}╰⊷${R}`, ''];
        process.stdout.write(lines.join('\n') + '\n');
    }
}
// ───────────────────────────────────────────────────────────────────────────

function _flushSystemBuffer() {
    if (_systemBuffer.length === 0) return;
    const items = _systemBuffer.splice(0);
    _lastFlush = Date.now();

    const counts = {};
    const details = [];
    for (const item of items) {
        const text = item.text;
        if (/disk cleanup.*removed (\d+)/i.test(text)) {
            const m = text.match(/removed (\d+)/i);
            counts.diskCleanup = (counts.diskCleanup || 0) + parseInt(m[1]);
        } else if (/high memory.*?(\d+)MB/i.test(text)) {
            const m = text.match(/(\d+)MB/i);
            counts.highMemory = parseInt(m[1]);
        } else if (/media stored/i.test(text)) {
            counts.mediaStored = (counts.mediaStored || 0) + 1;
        } else if (/saved sticker/i.test(text)) {
            counts.stickersStored = (counts.stickersStored || 0) + 1;
        } else if (/trimmed to/i.test(text)) {
            counts.cacheTrimmed = (counts.cacheTrimmed || 0) + 1;
        } else if (/trimming caches/i.test(text)) {
            counts.cacheTrimmed = (counts.cacheTrimmed || 0) + 1;
        } else {
            const short = text.length > 60 ? text.substring(0, 57) + '...' : text;
            details.push(short);
        }
    }

    const lines = [];
    if (counts.diskCleanup) lines.push(`🧹 Disk cleanup: ${counts.diskCleanup} items removed`);
    if (counts.highMemory) lines.push(`⚠️ Memory peak: ${counts.highMemory}MB`);
    if (counts.mediaStored) lines.push(`💾 Media stored: ${counts.mediaStored} file${counts.mediaStored > 1 ? 's' : ''}`);
    if (counts.stickersStored) lines.push(`🎨 Stickers saved: ${counts.stickersStored}`);
    if (counts.cacheTrimmed) lines.push(`📦 Cache trimmed: ${counts.cacheTrimmed}x`);
    for (const d of details.slice(0, 3)) lines.push(d);
    if (details.length > 3) lines.push(`... +${details.length - 3} more`);

    if (lines.length === 0) return;

    const NB  = '\x1b[1m\x1b[38;2;240;220;90m';
    const LBL = '\x1b[1m\x1b[38;2;255;165;0m';
    const W   = '\x1b[38;2;200;215;225m';
    const D   = '\x1b[2m\x1b[38;2;120;140;155m';
    const R   = '\x1b[0m';
    const out = ['', `${NB}╭─⌈ 🔧 SYSTEM ⌋${R}`];
    for (const line of lines) out.push(`${D}»${R} ${LBL}Info:${R} ${W}${line}${R}`);
    out.push(`${NB}╰⊷${R}`, '');
    process.stdout.write(out.join('\n') + '\n');
}

function _bufferSystemLog(text) {
    _systemBuffer.push({ text, time: Date.now() });
    if (!_flushTimer) {
        _flushTimer = setTimeout(() => {
            _flushTimer = null;
            _flushSystemBuffer();
        }, _FLUSH_INTERVAL);
    }
}

// ── Shared box constants & helpers ──────────────────────────────────────────
const _BOX_INNER = 30;
function _boxDash(n) { return '─'.repeat(Math.max(0, n)); }
function _boxTop(NB, R, icon, label) {
    const title   = `〔 ${icon} ${label} 〕`;
    const tVisLen = title.length + 2;   // +2 for fullwidth 〔 〕
    const rpad    = Math.max(2, _BOX_INNER - 2 - tVisLen + 2);
    return `${NB}┌──${title}${_boxDash(rpad)}┐${R}`;
}
function _boxBot(NB, R) { return `${NB}└${_boxDash(_BOX_INNER + 2)}┘${R}`; }
function _boxRow(DOT, D, N, W, R, lbl, val) {
    const pad = ' '.repeat(Math.max(0, 9 - lbl.length));
    return `  ${DOT}  ${D}${lbl}${pad}${R}${N}:${R} ${W}${val}${R}`;
}

// ── Wolf Command Box (signature ╭─⌈ ⌋ ╰⊷ style) ──────────────────────────
function _printCommandBox({ sender, command, location, role, ms }) {
    const NB = '\x1b[1m\x1b[38;2;0;255;156m';
    const N  = '\x1b[38;2;0;255;156m';
    const D  = '\x1b[2m\x1b[38;2;100;120;130m';
    const W  = '\x1b[38;2;200;215;225m';
    const OK = '\x1b[38;2;0;230;118m';
    const R  = '\x1b[0m';

    const icon  = role === 'owner' ? '👑' : role === 'sudo' ? '🔑' : '💬';
    const label = role === 'owner' ? 'OWNER CMD' : role === 'sudo' ? 'SUDO CMD' : 'USER CMD';

    const msTxt     = ms !== undefined ? `  ${D}(${ms}ms)${R}` : '';
    const senderFmt = sender && !sender.startsWith('+') ? `+${sender}` : (sender || '?');
    const sep       = `${D}·${R}`;

    originalConsoleMethods.log([
        '',
        `${NB}╭─⌈ ${icon} ${label} ⌋${R}`,
        `${NB}» ${R}${D}Sender${R} ${N}:${R} ${W}${senderFmt}${R}`,
        `${NB}» ${R}${D}Command${R} ${N}:${R} ${W}${command}${R}  ${sep}  ${D}Where${R} ${N}:${R} ${W}${location}${R}`,
        `${NB}» ${R}${OK}✔ done${R}${msTxt}`,
        `${NB}╰⊷${R}`,
        '',
    ].join('\n'));
}

// ── Wolf Reconnect Notice (signature ╭─⌈ ⌋ ╰⊷ style) ──────────────────────
function _printReconnectBox(number) {
    const NB  = '\x1b[1m\x1b[38;2;0;255;156m';
    const N   = '\x1b[38;2;0;255;156m';
    const D   = '\x1b[2m\x1b[38;2;100;120;130m';
    const W   = '\x1b[38;2;200;215;225m';
    const OK  = '\x1b[38;2;0;230;118m';
    const R   = '\x1b[0m';
    originalConsoleMethods.log([
        '',
        `${NB}╭─⌈ 🔁 RECONNECTED ⌋${R}`,
        `${NB}» ${R}${OK}✅ Silent${R}  ${D}·${R}  ${D}Owner${R} ${N}:${R} ${W}+${number}${R}`,
        `${NB}╰⊷${R}`,
        '',
    ].join('\n'));
}

// ── Wolf Incoming Message Box ───────────────────────────────────────────────
// chatType: 'GROUP' (cyan) | 'CHANNEL' (purple) | 'DM' (orange) | 'OWNER' (neon green)
// Detailed multi-row layout: Sent Time, Date, Message Type, Sender, Chat ID,
// Group/Channel + JID (if applicable), Message.
function _printMessageBox(opts) {
    const {
        phone, chatType, groupName, text,
        msgType, senderName, chatId, groupJid,
        channelName, channelJid,
    } = opts;

    const isGroup   = chatType === 'GROUP';
    const isOwner   = chatType === 'OWNER';
    const isChannel = chatType === 'CHANNEL';

    // Color theme — kept distinct from any rainbow scheme.
    // GROUP=cyan-blue, CHANNEL=purple, OWNER=neon green, DM=orange
    const NB = isGroup   ? '\x1b[1m\x1b[38;2;34;193;255m'
             : isChannel ? '\x1b[1m\x1b[38;2;180;120;255m'
             : isOwner   ? '\x1b[1m\x1b[38;2;0;255;156m'
             :             '\x1b[1m\x1b[38;2;255;110;0m';
    const N  = isGroup   ? '\x1b[38;2;34;193;255m'
             : isChannel ? '\x1b[38;2;180;120;255m'
             : isOwner   ? '\x1b[38;2;0;255;156m'
             :             '\x1b[38;2;255;110;0m';
    const LBL = '\x1b[1m\x1b[38;2;255;165;0m';   // labels: warm amber
    const VAL = '\x1b[38;2;220;230;240m';        // values: near-white
    const DIM = '\x1b[2m\x1b[38;2;120;140;155m'; // dim bullet
    const R   = '\x1b[0m';

    // Build pretty time + date in EAT (UTC+3) — matches the image style.
    const now    = new Date();
    const eatMs  = now.getTime() + (3 * 3600 * 1000) - (now.getTimezoneOffset() * 60 * 1000);
    const eat    = new Date(eatMs);
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const pad    = (n) => String(n).padStart(2, '0');
    const dayStr = days[eat.getUTCDay()];
    const hh     = pad(eat.getUTCHours());
    const mm     = pad(eat.getUTCMinutes());
    const ss     = pad(eat.getUTCSeconds());
    const dd     = pad(eat.getUTCDate());
    const mo     = pad(eat.getUTCMonth() + 1);
    const yy     = eat.getUTCFullYear();

    const sentTime = `${dayStr}, ${hh}:${mm}:${ss} EAT`;
    const dateStr  = `${dd}/${mo}/${yy}`;

    // Title — bot name in upper-case (no rainbow).
    const titleName = (typeof getCurrentBotName === 'function'
        ? getCurrentBotName()
        : (global.BOT_NAME || 'WOLFBOT'));

    // Title bar:  ╭─⌈  WOLFBOT ⌋
    const icon  = isGroup   ? '👥'
                : isChannel ? '📢'
                : isOwner   ? '👑'
                :             '💬';
    const top   = `${NB}╭─⌈${R} ${icon} ${NB}${titleName.toUpperCase()}${R} ${NB}⌋${R}`;
    const bot   = `${NB}╰⊷${R}`;
    const row   = (label, value) =>
        `${DIM}»${R} ${LBL}${label}:${R} ${VAL}${value}${R}`;

    // Derive missing fields
    const _msgType    = msgType    || 'unknown';
    const _senderName = senderName || (phone ? `+${phone}` : 'N/A');
    const _chatId     = chatId     || (phone || 'unknown');
    const _preview    = text && text.length > 120 ? text.substring(0, 120) + '…' : (text || '');

    const rows = ['', top];
    rows.push(row('Sent Time',    sentTime));
    rows.push(row('Date',         dateStr));
    rows.push(row('Message Type', _msgType));
    rows.push(row('Sender Name',  _senderName));
    rows.push(row('Chat ID',      _chatId));
    if (isGroup) {
        if (groupName) rows.push(row('Group',     groupName));
        if (groupJid)  rows.push(row('Group JID', groupJid));
    } else if (isChannel) {
        if (channelName) rows.push(row('Channel',     channelName));
        if (channelJid)  rows.push(row('Channel JID', channelJid));
    }
    rows.push(row('Message',      _preview));
    rows.push(bot, '');

    originalConsoleMethods.log(rows.join('\n'));
}

// ── Wolf New-Member Box ─────────────────────────────────────────────────────
// One unified, multi-row box per detected join — replaces the old trio of
// [KLAUS-MBR] + [KLAUS-GRP] + [KLAUS-INFO] single lines.
function _printMemberBox({ action, userName, userNumber, userJid, groupName, groupJid }) {
    const NB  = '\x1b[1m\x1b[38;2;0;200;120m';   // emerald header
    const LBL = '\x1b[1m\x1b[38;2;255;165;0m';   // amber label
    const VAL = '\x1b[38;2;220;230;240m';        // near-white value
    const DIM = '\x1b[2m\x1b[38;2;120;140;155m';
    const R   = '\x1b[0m';

    const verb  = (action || 'add').toUpperCase() === 'ADD' ? 'JOINED' : (action || 'EVENT').toUpperCase();
    const icon  = verb === 'JOINED' ? '➕' : '📨';
    const top   = `${NB}╭─⌈${R} ${icon} ${NB}NEW MEMBER ${verb}${R} ${NB}⌋${R}`;
    const bot   = `${NB}╰⊷${R}`;
    const row   = (l, v) => `${DIM}»${R} ${LBL}${l}:${R} ${VAL}${v}${R}`;

    const rows = ['', top];
    if (userName)   rows.push(row('Name',      userName));
    if (userNumber) rows.push(row('Number',    `+${userNumber}`));
    if (userJid)    rows.push(row('User JID',  userJid));
    if (groupName)  rows.push(row('Group',     groupName));
    if (groupJid)   rows.push(row('Group JID', groupJid));
    rows.push(bot, '');
    originalConsoleMethods.log(rows.join('\n'));
}

// ── Wolf Antidelete Debug Box ───────────────────────────────────────────────
// Compact, multi-row box for antidelete pipeline events. Caller passes a
// short event name + an arbitrary fields object. Routine no-op debug spam
// (every "fromMe=true" outbound) is filtered out at the call site.
function _printAntideleteBox({ event, fields = {} }) {
    const NB  = '\x1b[1m\x1b[38;2;255;80;180m';  // hot-pink header (distinct)
    const LBL = '\x1b[1m\x1b[38;2;255;165;0m';
    const VAL = '\x1b[38;2;220;230;240m';
    const DIM = '\x1b[2m\x1b[38;2;120;140;155m';
    const R   = '\x1b[0m';

    const top = `${NB}╭─⌈${R} 🗑️  ${NB}ANTIDELETE${R} ${NB}⌋${R}  ${VAL}${event || ''}${R}`;
    const bot = `${NB}╰⊷${R}`;
    const row = (l, v) => `${DIM}»${R} ${LBL}${l}:${R} ${VAL}${v}${R}`;

    const rows = ['', top];
    for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null || v === '') continue;
        rows.push(row(k, String(v)));
    }
    rows.push(bot, '');
    originalConsoleMethods.log(rows.join('\n'));
}
// Expose for module callers (antidelete.js etc.)
globalThis._printAntideleteBox = _printAntideleteBox;

// ── Wolf Generic System Box ─────────────────────────────────────────────────
// Drop-in replacement for raw bracketed `console.log('[TAG] ...')` lines so
// every system event renders with the same border style as the message /
// member / antidelete boxes — distinguished only by color + icon.
//
// Built-in palettes (`color` arg):
//   cyan    → QuickConnect / network drain
//   gold    → bot identity, JID resolution
//   yellow  → message edits
//   green   → success / ready
//   red     → fatal errors (non-suppressed)
//   purple  → generic / fallback
function _printSystemBox({ tag, color = 'purple', icon = '•', message = '', fields = {} }) {
    const palette = {
        cyan:   '\x1b[1m\x1b[38;2;0;200;230m',
        gold:   '\x1b[1m\x1b[38;2;255;200;60m',
        yellow: '\x1b[1m\x1b[38;2;240;220;90m',
        green:  '\x1b[1m\x1b[38;2;0;220;120m',
        red:    '\x1b[1m\x1b[38;2;255;90;90m',
        purple: '\x1b[1m\x1b[38;2;180;130;255m',
    };
    const NB  = palette[color] || palette.purple;
    const LBL = '\x1b[1m\x1b[38;2;255;165;0m';
    const VAL = '\x1b[38;2;220;230;240m';
    const DIM = '\x1b[2m\x1b[38;2;120;140;155m';
    const R   = '\x1b[0m';

    const top = `${NB}╭─⌈${R} ${icon} ${NB}${tag || 'SYSTEM'}${R} ${NB}⌋${R}` +
                (message ? `  ${VAL}${message}${R}` : '');
    const bot = `${NB}╰⊷${R}`;
    const row = (l, v) => `${DIM}»${R} ${LBL}${l}:${R} ${VAL}${v}${R}`;

    const rows = ['', top];
    for (const [k, v] of Object.entries(fields || {})) {
        if (v === undefined || v === null || v === '') continue;
        rows.push(row(k, String(v)));
    }
    rows.push(bot, '');
    originalConsoleMethods.log(rows.join('\n'));
}
globalThis._printSystemBox = _printSystemBox;

class UltraCleanLogger {
    static log(...args) {
        if (globalThis._wolfStartupPhase) return;
        const firstArg = args[0];
        if (typeof firstArg === 'string') {
            const lower = firstArg.toLowerCase();
            if (_isLogSuppressed(lower)) return;
            if (_isPGLog(firstArg)) { _printPGLog(args.join(' ')); return; }
            if (_isSystemLog(firstArg)) { _bufferSystemLog(args.join(' ')); return; }
        }
        const text = args.join(' ');
        _printSystemBox({ tag: 'SYS', color: 'cyan', icon: '•', message: text });
    }

    static error(...args) {
        const message = args.join(' ').toLowerCase();
        for (let i = 0; i < _errSuppressArr.length; i++) {
            if (message.includes(_errSuppressArr[i])) return;
        }
        const text = args.join(' ');
        _printSystemBox({ tag: 'ERR', color: 'red', icon: '❌', message: text });
    }

    static success(...args) {
        if (globalThis._wolfStartupPhase) return;
        const text = args.join(' ');
        if (_isSystemLog(text)) { _bufferSystemLog(text); return; }
        _printSystemBox({ tag: 'OK', color: 'green', icon: '✅', message: text });
    }

    static info(...args) {
        if (globalThis._wolfStartupPhase) return;
        const text = args.join(' ');
        if (!text || !text.trim()) return;
        if (_isSystemLog(text)) { _bufferSystemLog(text); return; }
        _printSystemBox({ tag: 'INFO', color: 'cyan', icon: 'ℹ️', message: text });
    }

    static warning(...args) {
        if (globalThis._wolfStartupPhase) return;
        const message = args.join(' ').toLowerCase();
        for (let i = 0; i < _warnSuppressArr.length; i++) {
            if (message.includes(_warnSuppressArr[i])) return;
        }
        const text = args.join(' ');
        if (!text || !text.trim()) return;
        if (_isSystemLog(text)) { _bufferSystemLog(text); return; }
        _printSystemBox({ tag: 'WARN', color: 'yellow', icon: '⚠️', message: text });
    }

    static event(...args) {
        _printSystemBox({ tag: 'EVENT', color: 'purple', icon: '🎭', message: args.join(' ') });
    }

    static command(msgOrOpts) {
        if (msgOrOpts && typeof msgOrOpts === 'object') {
            _printCommandBox({ role: 'user', ...msgOrOpts });
            return;
        }
        // Legacy plain-string path (e.g. auto-connect) — still printed
        const time = _getTime();
        originalConsoleMethods.log(`${_CYANB}[KLAUS-CMD]${_R} ${_DIM}⏱️  ${time}${_R}  ${_CYAN}▸ 💬 ${msgOrOpts}${_R}`);
    }

    static ownerCommand(msgOrOpts) {
        if (msgOrOpts && typeof msgOrOpts === 'object') {
            _printCommandBox({ role: 'owner', ...msgOrOpts });
        } else {
            const time = _getTime();
            originalConsoleMethods.log(`${_GB}[KLAUS-CMD]${_R} ${_GD}⏱️  ${time}${_R}  ${_G}▸ 👑 ${String(msgOrOpts)}${_R}`);
        }
    }

    static ownerMessage(...args) {
        const msg = args.join(' ');
        _printMessageBox({ phone: null, chatType: 'OWNER', groupName: null, text: msg });
    }

    static critical(...args) {
        const time = _getTime();
        const text = args.join(' ');
        originalConsoleMethods.error(`${_REDB}[KLAUS-CRIT]${_R} ${_DIM}⏱️  ${time}${_R}  ${_RED}▸ 🚨 ${text}${_R}`);
    }

    static group(...args) {
        const time = _getTime();
        originalConsoleMethods.log(`${_MAGB}[KLAUS-GRP]${_R} ${_DIM}⏱️  ${time}${_R}  ${_MAG}▸ 👥 ${args.join(' ')}${_R}`);
    }

    static member(...args) {
        const time = _getTime();
        originalConsoleMethods.log(`${_CYANB}[KLAUS-MBR]${_R} ${_DIM}⏱️  ${time}${_R}  ${_CYAN}▸ 👤 ${args.join(' ')}${_R}`);
    }


    static message(phone, chatType, groupName, text, _legacyTime, extra = {}) {
        // Backward-compatible: old 4/5-arg call sites still work.
        // New shape: pass `extra = { msgType, senderName, chatId, groupJid,
        //                            channelName, channelJid }`.
        _printMessageBox({
            phone, chatType, groupName, text,
            msgType:     extra.msgType,
            senderName:  extra.senderName,
            chatId:      extra.chatId,
            groupJid:    extra.groupJid,
            channelName: extra.channelName,
            channelJid:  extra.channelJid,
        });
    }

    static flushSystem() {
        _flushSystemBuffer();
    }
}

// Replace console methods
console.log = UltraCleanLogger.log;
console.error = UltraCleanLogger.error;
console.info = UltraCleanLogger.info;
console.warn = UltraCleanLogger.warning;
console.debug = () => {};

// ── Startup phase: suppress individual log entries until bot is fully connected ──
// Flip to false (and call printWolfStartupBlock) once connection is confirmed.
// Safety valve: release after 45s so interactive login / pairing mode still logs.
globalThis._wolfStartupPhase = true;
setTimeout(() => { globalThis._wolfStartupPhase = false; }, 45_000);

// Add custom methods
global.logSuccess = UltraCleanLogger.success;
global.logInfo = UltraCleanLogger.info;
global.logWarning = UltraCleanLogger.warning;
global.logEvent = UltraCleanLogger.event;
global.logCommand = UltraCleanLogger.command;
global.logGroup = UltraCleanLogger.group;
global.logMember = UltraCleanLogger.member;

// Ultra silent baileys logger
const ultraSilentLogger = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => ultraSilentLogger,
    log: () => {},
    success: () => {},
    warning: () => {},
    event: () => {},
    command: (...args) => {
        const timestamp = chalk.gray(`[${new Date().toLocaleTimeString()}]`);
        originalConsoleMethods.log(timestamp, chalk.cyan('⚡'), ...args);
    }
};

// Anti-viewonce configuration

// ====== SECTION 19a: DYNAMIC PREFIX SYSTEM ======
// The prefix is the trigger character that starts every command (default: ".").
// It can be changed live with .setprefix <char> or removed entirely for prefixless mode.
//
// How it works:
//   prefixCache    — the current prefix string (single char or empty string)
//   isPrefixless   — if true, every incoming message is treated as a potential command
//   prefixHistory  — last 10 changes (for debugging with .prefixinfo)
//
//   loadPrefixFromFiles()    — reads from prefix_config.json (or falls back to DEFAULT_PREFIX)
//   updatePrefixImmediately() — called by .setprefix; updates cache + saves to file + DB
//   global.prefix / global.CURRENT_PREFIX — kept in sync for commands that need it
//
// The prefix is also checked in handleIncomingMessage() (Section 22) before any
// command is dispatched — if isPrefixless=false and the message doesn't start with
// prefixCache, the message is skipped silently (unless chatbot/wolf AI handles it).
let prefixCache = DEFAULT_PREFIX;
let prefixHistory = [];
let isPrefixless = false;

function getCurrentPrefix() {
    return isPrefixless ? '' : prefixCache;
}

// ── .env write-through ───────────────────────────────────────────────────────
// Updates (or appends) a single key=value line in the .env file.
// This is the ONLY storage layer that survives Pterodactyl egg reinstalls,
// because .env is in .gitignore and never overwritten by git pull / fresh clone.
function updateEnvFile(key, value) {
    try {
        const envPath = './.env';
        let content = '';
        try { content = fs.readFileSync(envPath, 'utf8'); } catch {}

        const line = `${key}=${value}`;
        const regex = new RegExp(`^${key}=.*$`, 'm');

        if (regex.test(content)) {
            content = content.replace(regex, line);
        } else {
            // append after the last non-empty line
            content = content.trimEnd() + '\n' + line + '\n';
        }

        fs.writeFileSync(envPath, content, 'utf8');
        process.env[key] = String(value);
    } catch (err) {
        UltraCleanLogger.warning(`Could not update .env (${key}): ${err.message}`);
    }
}
// ─────────────────────────────────────────────────────────────────────────────

function savePrefixToFile(newPrefix) {
    try {
        const isNone = newPrefix === 'none' || newPrefix === '""' || newPrefix === "''" || newPrefix === '';
        
        const config = {
            prefix: isNone ? '' : newPrefix,
            isPrefixless: isNone,
            setAt: new Date().toISOString(),
            timestamp: Date.now(),
            version: VERSION,
            previousPrefix: prefixCache,
            previousIsPrefixless: isPrefixless
        };
        _cache_prefix_config = config;
        _saveConfigCache('prefix_config', config);
        updateWebStatus({ prefix: isNone ? 'none' : newPrefix });

        // Also write to JSON file — used as migration source if DB is wiped/lost.
        // This ensures the prefix survives even a full data/ directory wipe.
        try { fs.writeFileSync('./prefix_config.json', JSON.stringify(config, null, 2)); } catch {}
        // Write to .env — survives Pterodactyl egg reinstalls (git pull never touches .env).
        // BOT_PREFIX is already read from .env at startup (line 793), so this is the
        // ultimate fallback that works even when ALL other files are reset to defaults.
        updateEnvFile('BOT_PREFIX', isNone ? '' : (newPrefix || ''));
        
        const settings = {
            prefix: isNone ? '' : newPrefix,
            isPrefixless: isNone,
            prefixSetAt: new Date().toISOString(),
            prefixChangedAt: Date.now(),
            previousPrefix: prefixCache,
            previousIsPrefixless: isPrefixless,
            version: VERSION
        };
        _cache_bot_settings = settings;
        _saveConfigCache('bot_settings', settings);
        // Also write bot_settings.json as fallback
        try { fs.writeFileSync('./bot_settings.json', JSON.stringify(settings, null, 2)); } catch {}
        
        UltraCleanLogger.info(`Prefix settings saved: "${newPrefix}", prefixless: ${isNone}`);
        return true;
    } catch (error) {
        UltraCleanLogger.error(`Error saving prefix: ${error.message}`);
        return false;
    }
}

function loadPrefixFromFiles() {
    try {
        if (_cache_prefix_config) {
            const config = _cache_prefix_config;
            
            if (config.isPrefixless !== undefined) {
                isPrefixless = config.isPrefixless;
            }
            
            if (config.prefix !== undefined) {
                if (config.prefix.trim() === '' && config.isPrefixless) {
                    return '';
                } else if (config.prefix.trim() !== '') {
                    return config.prefix.trim();
                }
            }
        }
        
        if (_cache_bot_settings) {
            const settings = _cache_bot_settings;
            
            if (settings.isPrefixless !== undefined) {
                isPrefixless = settings.isPrefixless;
            }
            
            if (settings.prefix && settings.prefix.trim() !== '') {
                return settings.prefix.trim();
            }
        }

        // Last resort: read prefix_config.json directly from disk.
        // This ensures the correct prefix is shown in the boot banner even
        // before the DB finishes loading (e.g. WASM SQLite on slow hosts).
        try {
            const raw = fs.readFileSync(PREFIX_CONFIG_FILE, 'utf8');
            const cfg = JSON.parse(raw);
            if (cfg.isPrefixless !== undefined) isPrefixless = cfg.isPrefixless;
            if (cfg.isPrefixless && cfg.prefix === '') return '';
            if (cfg.prefix && cfg.prefix.trim() !== '') return cfg.prefix.trim();
        } catch {}
        
    } catch (error) {
        UltraCleanLogger.warning(`Error loading prefix: ${error.message}`);
    }
    
    return DEFAULT_PREFIX;
}

function updatePrefixImmediately(newPrefix) {
    const oldPrefix = prefixCache;
    const oldIsPrefixless = isPrefixless;
    
    const isNone = newPrefix === 'none' || newPrefix === '""' || newPrefix === "''" || newPrefix === '';
    
    if (isNone) {
        isPrefixless = true;
        prefixCache = '';
        
        UltraCleanLogger.success(`Prefixless mode enabled`);
    } else {
        if (!newPrefix || newPrefix.trim() === '') {
            UltraCleanLogger.error('Cannot set empty prefix');
            return { success: false, error: 'Empty prefix' };
        }
        
        if (newPrefix.length > 5) {
            UltraCleanLogger.error('Prefix too long (max 5 characters)');
            return { success: false, error: 'Prefix too long' };
        }
        
        const trimmedPrefix = newPrefix.trim();
        
        prefixCache = trimmedPrefix;
        isPrefixless = false;
        
        UltraCleanLogger.info(`Prefix changed to: "${trimmedPrefix}"`);
    }
    
    if (typeof global !== 'undefined') {
        global.prefix = getCurrentPrefix();
        global.CURRENT_PREFIX = getCurrentPrefix();
        global.isPrefixless = isPrefixless;
    }
    
    process.env.PREFIX = getCurrentPrefix();
    
    savePrefixToFile(newPrefix);
    
    prefixHistory.push({
        oldPrefix: oldIsPrefixless ? 'none' : oldPrefix,
        newPrefix: isPrefixless ? 'none' : prefixCache,
        isPrefixless: isPrefixless,
        oldIsPrefixless: oldIsPrefixless,
        timestamp: new Date().toISOString(),
        time: Date.now()
    });
    
    if (prefixHistory.length > 10) {
        prefixHistory = prefixHistory.slice(-10);
    }
    
    updateTerminalHeader();
    
    UltraCleanLogger.success(`Prefix updated: "${oldIsPrefixless ? 'none' : oldPrefix}" → "${isPrefixless ? 'none (prefixless)' : prefixCache}"`);
    
    return {
        success: true,
        oldPrefix: oldIsPrefixless ? 'none' : oldPrefix,
        newPrefix: isPrefixless ? 'none' : prefixCache,
        isPrefixless: isPrefixless,
        timestamp: new Date().toISOString()
    };
}

// ====== GLOBAL VARIABLES ======
let OWNER_NUMBER = null;
let OWNER_JID = null;
let OWNER_CLEAN_JID = null;
let OWNER_CLEAN_NUMBER = null;
let OWNER_LID = null;
let SOCKET_INSTANCE = null;
let isConnected = false;
let store = null;
let heartbeatInterval = null;
let lastActivityTime = Date.now();
let connectionAttempts = 0;
let connectionStableTimer = null;
let MAX_RETRY_ATTEMPTS = 10;
// BOT_MODE is written to .env on every mode change (updateBotModeCache).
// Reading it here means it survives Pterodactyl egg reinstalls that wipe all tracked files.
const _validModes = new Set(['public','groups','dms','silent','buttons','channel','default','private','group','solo','sudo','super']);
let BOT_MODE = (_validModes.has(process.env.BOT_MODE) ? process.env.BOT_MODE : null) || 'public';
let WHITELIST = new Set();
let AUTO_LINK_ENABLED = true;
let AUTO_CONNECT_COMMAND_ENABLED = true;
let AUTO_ULTIMATE_FIX_ENABLED = true;
let isWaitingForPairingCode = false;
let RESTART_AUTO_FIX_ENABLED = true;
let hasAutoConnectedOnStart = false;
let hasSentWelcomeMessage = false;
let _isAutoRestart = false;
let initialCommandsLoaded = false;
let commandsLoaded = false;
const _MSG_COOLDOWN_MS = 5 * 60 * 1000;
let _lastConnectionMsgTime = (() => {
    try {
        const _stampFile = './data/.last_conn_msg';
        if (fs.existsSync(_stampFile)) {
            const val = parseInt(fs.readFileSync(_stampFile, 'utf8'));
            if (!isNaN(val)) return val;
        }
    } catch {}
    return 0;
})();
let conflictCount = 0;
let isConflictRecovery = false;
let connectionOpenTime = 0;
let _allManagedIntervals = [];

let _lagCheckTs = Date.now();
setInterval(() => {
    const now = Date.now();
    const lag = now - _lagCheckTs - 5000;
    _lagCheckTs = now;
    if (lag > 1000) {
        UltraCleanLogger.warning(`⚠️ [EVENT-LOOP] Lag detected: ${lag}ms`);
    }
}, 5000);

// ====== SECTION 11: DISK MANAGER ======
// Replit's free tier has limited disk space.  DiskManager watches the available
// space and automatically cleans up temp files so the bot never crashes due to
// a full disk.
//
// WARNING_MB (200 MB) — logs a warning when free space falls below this.
// CRITICAL_MB (80 MB) — triggers an emergency cleanup of ./tmp, sticker caches,
//   old media downloads, and excess session files.
//
// Cleanup targets (runCleanupAsync):
//   ./tmp/*              — ffmpeg/yt-dlp temp files from music downloads
//   ./data/stickers/*    — sticker cache older than 24 hours
//   ./session/app-*.json — excess Baileys key files (keeps newest 30)
//   ./*.(mp3|mp4|…)      — stray media files in the root directory
//
// DiskManager.start() is called once in main() and sets two recurring timers:
//   CHECK_INTERVAL (3 min)   — checks free space, warns/cleans as needed
//   CLEANUP_INTERVAL (10 min) — proactive background cleanup regardless of space
const DiskManager = {
    WARNING_MB: 200,
    CRITICAL_MB: 80,
    CHECK_INTERVAL: 3 * 60 * 1000,
    CLEANUP_INTERVAL: 10 * 60 * 1000,
    lastWarning: 0,
    lastCritical: 0,
    lastCleanup: 0,
    isLow: false,

    _cachedDiskFree: null,
    _lastDiskCheck: 0,
    _diskCheckInFlight: false,
    getDiskFree() {
        return this._cachedDiskFree;
    },
    async getDiskFreeAsync() {
        const now = Date.now();
        if (now - this._lastDiskCheck < 60000 && this._cachedDiskFree !== null) {
            return this._cachedDiskFree;
        }
        if (this._diskCheckInFlight) return this._cachedDiskFree;
        this._diskCheckInFlight = true;
        try {
            const [workspaceResult, tmpResult] = await Promise.allSettled([
                new Promise((resolve, reject) => {
                    exec('df -BM --output=avail . 2>/dev/null || df -m . 2>/dev/null', { encoding: 'utf8', timeout: 3000 }, (err, stdout) => err ? reject(err) : resolve(stdout));
                }),
                new Promise((resolve, reject) => {
                    exec('df -BM --output=avail /tmp 2>/dev/null || df -m /tmp 2>/dev/null', { encoding: 'utf8', timeout: 3000 }, (err, stdout) => err ? reject(err) : resolve(stdout));
                })
            ]);
            const parseAvail = (r) => { if (r.status !== 'fulfilled') return null; const m = r.value.match(/(\d+)M?\s*$/m); return m ? parseInt(m[1]) : null; };
            const wsAvail = parseAvail(workspaceResult);
            const tmpAvail = parseAvail(tmpResult);
            const values = [wsAvail, tmpAvail].filter(v => v !== null);
            this._cachedDiskFree = values.length ? Math.min(...values) : null;
            this._lastDiskCheck = now;
        } catch {
            this._lastDiskCheck = now;
        } finally {
            this._diskCheckInFlight = false;
        }
        return this._cachedDiskFree;
    },

    getDirSize(dirPath) {
        let total = 0;
        try {
            if (!fs.existsSync(dirPath)) return 0;
            const entries = fs.readdirSync(dirPath);
            for (const entry of entries) {
                try {
                    const full = path.join(dirPath, entry);
                    const stat = fs.statSync(full);
                    if (stat.isFile()) total += stat.size;
                    else if (stat.isDirectory()) total += this.getDirSize(full);
                } catch {}
            }
        } catch {}
        return total;
    },

    getCleanupReport() {
        const sessionFiles = this._countSessionSignalFiles();
        const voMedia = 0;
        const adMedia = this.getDirSize('./data/antidelete/media');
        const statusMedia = this.getDirSize('./data/antidelete/status/media');
        const tempFiles = this.getDirSize('./temp') + this.getDirSize('./commands/temp');
        const backupFiles = this.getDirSize('./session_backup');
        const statusLogs = (() => { try { return _cache_status_logs ? JSON.stringify(_cache_status_logs).length : 0; } catch { return 0; } })();
        const freeMB = this.getDiskFree();
        return {
            freeMB,
            sessionSignalFiles: sessionFiles.count,
            sessionSignalMB: Math.round(sessionFiles.bytes / 1024 / 1024 * 10) / 10,
            antideleteMediaMB: Math.round(adMedia / 1024 / 1024 * 10) / 10,
            statusMediaMB: Math.round(statusMedia / 1024 / 1024 * 10) / 10,
            tempFilesMB: Math.round(tempFiles / 1024 / 1024 * 10) / 10,
            backupMB: Math.round(backupFiles / 1024 / 1024 * 10) / 10,
            statusLogsMB: Math.round(statusLogs / 1024 / 1024 * 10) / 10
        };
    },

    _countSessionSignalFiles() {
        let count = 0, bytes = 0;
        try {
            if (!fs.existsSync(SESSION_DIR)) return { count: 0, bytes: 0 };
            const files = fs.readdirSync(SESSION_DIR);
            for (const file of files) {
                if (file.startsWith('sender-key-') || file.startsWith('pre-key-') || file.startsWith('app-state-sync-version-')) {
                    count++;
                    try { bytes += fs.statSync(path.join(SESSION_DIR, file)).size; } catch {}
                }
            }
        } catch {}
        return { count, bytes };
    },

    async _yieldBatch(i, batchSize = 50) {
        if (i > 0 && i % batchSize === 0) await new Promise(r => setImmediate(r));
    },

    async cleanSessionSignalFilesAsync(aggressive = false) {
        let removed = 0;
        try {
            if (!fs.existsSync(SESSION_DIR)) return 0;
            const files = await fs.promises.readdir(SESSION_DIR);
            const senderKeys = files.filter(f => f.startsWith('sender-key-'));
            const preKeys = files.filter(f => f.startsWith('pre-key-'));
            const appSync = files.filter(f => f.startsWith('app-state-sync-version-'));

            const senderLimit = aggressive ? 10 : 40;
            const preKeyLimit = aggressive ? 10 : 40;
            const appSyncLimit = aggressive ? 3 : 10;

            const removeFiles = async (list, limit) => {
                if (list.length <= limit) return 0;
                const toRemove = list.slice(0, list.length - limit);
                let count = 0;
                for (let i = 0; i < toRemove.length; i++) {
                    try { await fs.promises.unlink(path.join(SESSION_DIR, toRemove[i])); count++; } catch {}
                    await this._yieldBatch(i);
                }
                return count;
            };
            removed += await removeFiles(senderKeys, senderLimit);
            removed += await removeFiles(preKeys, preKeyLimit);
            removed += await removeFiles(appSync, appSyncLimit);
        } catch {}
        return removed;
    },

    async cleanOldMediaAsync(dirPath, maxAgeDays = 3, aggressive = false) {
        let removed = 0;
        try {
            if (!fs.existsSync(dirPath)) return 0;
            const now = Date.now();
            const maxAge = aggressive ? 30 * 60 * 1000 : maxAgeDays * 24 * 60 * 60 * 1000;
            const files = await fs.promises.readdir(dirPath);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.endsWith('.json')) continue;
                try {
                    const full = path.join(dirPath, file);
                    const stat = await fs.promises.stat(full);
                    if (stat.isFile() && (now - stat.mtimeMs) > maxAge) {
                        await fs.promises.unlink(full);
                        removed++;
                    }
                } catch {}
                await this._yieldBatch(i);
            }
        } catch {}
        return removed;
    },

    async cleanTempFilesAsync(aggressive = false) {
        let removed = 0;
        const tempDirs = [
            './temp',
            './temp/ig',
            './temp/snapchat',
            './temp/compressed',
            './temp/apk',
            './commands/temp',
            './temp_stickers',
            './temp_url_uploads',
            './collected_stickers',
            './sticker_packs',
            './tmp'
        ];
        const now = Date.now();
        const maxAge = aggressive ? 2 * 60 * 1000 : 15 * 60 * 1000;
        for (const dir of tempDirs) {
            try {
                if (!fs.existsSync(dir)) continue;
                const files = await fs.promises.readdir(dir);
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const full = path.join(dir, file);
                        const stat = await fs.promises.stat(full);
                        if (stat.isFile() && (now - stat.mtimeMs) > maxAge) {
                            await fs.promises.unlink(full);
                            removed++;
                        }
                    } catch {}
                    await this._yieldBatch(i);
                }
            } catch {}
        }

        try {
            const { tmpdir: _osTmpdir } = await import('os');
            const sysTmp = _osTmpdir();
            const baileysPrefixes = ['image', 'video', 'audio', 'sticker', 'document', 'ptt'];
            // Wolf-bot temp file/dir prefixes written to /tmp by download commands,
            const wolfFilePrefixes = ['wolfbot_', 'wolf_'];
            const wolfDirPrefixes  = ['ytdlp-', 'wolf-dl-', 'wolf-vid-', 'wolf-tmp-'];
            const sysTmpEntries = await fs.promises.readdir(sysTmp, { withFileTypes: true });
            for (let i = 0; i < sysTmpEntries.length; i++) {
                const entry = sysTmpEntries[i];
                const file  = entry.name;
                const full  = path.join(sysTmp, file);
                try {
                    const isBaileysTmp = entry.isFile() && baileysPrefixes.some(p => file.startsWith(p)) && (file.endsWith('-enc') || file.endsWith('-original') || /^(image|video|audio|sticker|document|ptt)[A-Z0-9]{20,}/.test(file));
                    const isWolfFile   = entry.isFile()      && wolfFilePrefixes.some(p => file.startsWith(p));
                    const isWolfDir    = entry.isDirectory() && wolfDirPrefixes.some(p => file.startsWith(p));
                    if (!isBaileysTmp && !isWolfFile && !isWolfDir) { await this._yieldBatch(i); continue; }
                    const stat = await fs.promises.stat(full);
                    if ((now - stat.mtimeMs) > maxAge) {
                        if (isWolfDir) {
                            await fs.promises.rm(full, { recursive: true, force: true });
                        } else {
                            await fs.promises.unlink(full);
                        }
                        removed++;
                    }
                } catch {}
                await this._yieldBatch(i);
            }
        } catch {}

        return removed;
    },

    async cleanBackupsAsync() {
        let removed = 0;
        try {
            if (!fs.existsSync('./session_backup')) return 0;
            const files = await fs.promises.readdir('./session_backup');
            for (let i = 0; i < files.length; i++) {
                try { await fs.promises.unlink(path.join('./session_backup', files[i])); removed++; } catch {}
                await this._yieldBatch(i);
            }
            try { await fs.promises.rmdir('./session_backup'); } catch {}
        } catch {}
        return removed;
    },

    async truncateStatusLogsAsync() {
        try {
            const logFile = './data/status_detection_logs.json';
            if (!fs.existsSync(logFile)) return false;
            const raw = await fs.promises.readFile(logFile, 'utf8');
            const data = JSON.parse(raw);
            if (data.logs && data.logs.length > 50) {
                data.logs = data.logs.slice(-50);
                await fs.promises.writeFile(logFile, JSON.stringify(data));
                return true;
            }
        } catch {}
        return false;
    },

    async cleanStatusMediaAsync(aggressive = false) {
        let removed = 0;
        const statusMediaDir = './data/antidelete/status/media';
        try {
            if (!fs.existsSync(statusMediaDir)) return 0;
            const now = Date.now();
            const maxAge = (aggressive ? 15 * 60 * 1000 : 60 * 60 * 1000);
            const files = await fs.promises.readdir(statusMediaDir);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const full = path.join(statusMediaDir, file);
                    const stat = await fs.promises.stat(full);
                    if (stat.isFile() && (now - stat.mtimeMs) > maxAge) {
                        await fs.promises.unlink(full);
                        removed++;
                    }
                } catch {}
                await this._yieldBatch(i);
            }
        } catch {}
        return removed;
    },

    runCleanup(aggressive = false) {
        this.runCleanupAsync(aggressive).catch(() => {});
    },

    async cleanLogFilesAsync() {
        let removed = 0;
        try {
            const logDirs = ['.', './logs'];
            const now = Date.now();
            for (const dir of logDirs) {
                try {
                    if (!fs.existsSync(dir)) continue;
                    const files = await fs.promises.readdir(dir);
                    for (const file of files) {
                        if (!file.endsWith('.log')) continue;
                        try {
                            const full = path.join(dir, file);
                            const stat = await fs.promises.stat(full);
                            if (stat.isFile() && (stat.size > 5 * 1024 * 1024 || (now - stat.mtimeMs) > 24 * 60 * 60 * 1000)) {
                                await fs.promises.unlink(full);
                                removed++;
                            }
                        } catch {}
                    }
                } catch {}
            }
        } catch {}
        return removed;
    },

    async cleanNpmCacheAsync() {
        const { exec: execAsync } = await import('child_process');
        const { promisify } = await import('util');
        const execP = promisify(execAsync);
        let freed = 0;
        try {
            await execP('npm cache clean --force', { timeout: 30000 });
        } catch {}
        const cacheDirs = [
            path.join(process.env.HOME || '/root', '.npm'),
            '/home/container/.npm',
            '/root/.npm',
            '/tmp/bfx_npm_cache',
        ];
        for (const c of cacheDirs) {
            try {
                if (!fs.existsSync(c)) continue;
                const sizeBefore = this.getDirSize(c);
                fs.rmSync(c, { recursive: true, force: true });
                freed += sizeBefore;
            } catch {}
        }
        if (freed > 0) UltraCleanLogger.info(`🧹 npm cache cleared: freed ~${Math.round(freed / 1024 / 1024)}MB`);
        return freed;
    },

    async runCleanupAsync(aggressive = false) {
        const yieldToLoop = () => new Promise(r => setImmediate(r));
        const results = {};
        results.sessionFiles = await this.cleanSessionSignalFilesAsync(aggressive);
        await yieldToLoop();
        await yieldToLoop();
        results.antideleteMedia = await this.cleanOldMediaAsync('./data/antidelete/media', 1/48, aggressive);
        await yieldToLoop();
        results.statusMedia = await this.cleanStatusMediaAsync(aggressive);
        await yieldToLoop();
        results.tempFiles = await this.cleanTempFilesAsync(aggressive);
        await yieldToLoop();
        results.backups = aggressive ? await this.cleanBackupsAsync() : 0;
        if (aggressive) await this.cleanNpmCacheAsync().catch(() => {});
        await yieldToLoop();
        results.statusLogs = await this.truncateStatusLogsAsync() ? 1 : 0;
        results.logFiles = await this.cleanLogFilesAsync();
        const total = Object.values(results).reduce((a, b) => a + b, 0);
        if (total > 0) {
            UltraCleanLogger.info(`🧹 Disk cleanup: removed ${total} items (session: ${results.sessionFiles}, antidelete: ${results.antideleteMedia}, status-media: ${results.statusMedia}, temp: ${results.tempFiles}, backups: ${results.backups}, logs: ${results.logFiles})`);
        }
        this.lastCleanup = Date.now();
        return results;
    },

    async monitorAsync() {
        const freeMB = await this.getDiskFreeAsync();
        if (freeMB === null) return;

        if (freeMB < this.CRITICAL_MB) {
            this.isLow = true;
            if (Date.now() - this.lastCritical > 30 * 60 * 1000) {
                UltraCleanLogger.error(`🚨 CRITICAL: Only ${freeMB}MB disk space left! Running aggressive cleanup...`);
                this.lastCritical = Date.now();
            }
            await this.runCleanupAsync(true);
        } else if (freeMB < this.WARNING_MB) {
            this.isLow = true;
            if (Date.now() - this.lastWarning > 30 * 60 * 1000) {
                UltraCleanLogger.warning(`⚠️ Low disk space: ${freeMB}MB remaining. Running cleanup...`);
                this.lastWarning = Date.now();
            }
            await this.runCleanupAsync(false);
        } else {
            this.isLow = false;
        }
    },

    _intervals: [],
    _started: false,
    async start() {
        if (this._started) return;
        this._started = true;
        this.cleanNpmCacheAsync().catch(() => {});
        const freeMB = await this.getDiskFreeAsync();
        if (freeMB !== null && freeMB < this.WARNING_MB) {
            UltraCleanLogger.warning(`⚠️ Low disk on startup: ${freeMB}MB free. Running immediate cleanup...`);
            await this.runCleanupAsync(freeMB < this.CRITICAL_MB);
        } else {
            this.runCleanupAsync(false).catch(() => {});
        }
        this._intervals.push(setInterval(() => this.monitorAsync().catch(() => {}), this.CHECK_INTERVAL));
        this._intervals.push(setInterval(() => {
            if (!this.isLow) this.runCleanupAsync(false).catch(() => {});
        }, this.CLEANUP_INTERVAL));
        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
        globalThis._wolfSysStats.diskManager = true;
    }
};


function safeWriteFile(filePath, data) {
    const content = (typeof data === 'string' || Buffer.isBuffer(data)) ? data : JSON.stringify(data, null, 2);
    try {
        fs.writeFileSync(filePath, content);
        return true;
    } catch (err) {
        if (err.code === 'ENOSPC') {
            UltraCleanLogger.error(`💾 Disk full! Cannot write ${filePath}. Running emergency cleanup...`);
            DiskManager._lastDiskCheck = 0;
            DiskManager.runCleanup(true);
            try {
                fs.writeFileSync(filePath, content);
                return true;
            } catch {
                return false;
            }
        }
        throw err;
    }
}

async function safeWriteFileAsync(filePath, data) {
    const fsPromises = fs.promises;
    try {
        await fsPromises.writeFile(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        if (err.code === 'ENOSPC') {
            UltraCleanLogger.error(`💾 Disk full! Cannot write ${filePath}. Running emergency cleanup...`);
            DiskManager.runCleanup(true);
            try {
                await fsPromises.writeFile(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
                return true;
            } catch {
                return false;
            }
        }
        throw err;
    }
}

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ====== SECTION 12: JID MANAGER ======
// JidManager is a utility class that normalises every kind of WhatsApp JID
// into a consistent format so the rest of the bot never has to deal with edge cases.
//
// JID formats the bot encounters:
//   44779000000@s.whatsapp.net  — standard user JID
//   44779000000:5@s.whatsapp.net — multi-device sub-device (strip the ":5" part)
//   12345@lid                   — Linked Device ID (needs LID→phone resolution above)
//   1234567890-1234567@g.us     — group JID (never normalised as a phone)
//
// Key methods:
//   cleanJid(jid)    — strips device suffix, returns "44779…@s.whatsapp.net"
//   cleanNumber(jid) — returns the bare phone number string  "44779000000"
//   isGroup(jid)     — returns true if the JID ends in @g.us
//   isUser(jid)      — returns true if the JID ends in @s.whatsapp.net or @lid
//   toUserJid(num)   — converts "44779000000" → "44779000000@s.whatsapp.net"
//   isOwner(jid)     — compares jid against OWNER_JID / OWNER_NUMBER
//   isSudo(jid)      — checks the sudo list from lib/database.js
//   resolveNumber(jid) — handles LID→phone if needed, then returns clean number
//
// jidManager instance (bottom of this section) is used everywhere in index.js;
// commands that need isOwner/isSudo import the helper from lib/permissions.js.
class JidManager {
    constructor() {
        this.ownerJids = new Set();
        this.ownerLids = new Set();
        this.owner = null;
        this.loadOwnerData();
        this.loadWhitelist();
        
        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
        globalThis._wolfSysStats.jidManager = true;
    }
    
    loadOwnerData() {
        try {
            const data = _cache_owner_data;
            if (data) {
                const ownerJid = data.OWNER_JID;
                if (ownerJid) {
                    const cleaned = this.cleanJid(ownerJid);
                    
                    this.owner = {
                        rawJid: ownerJid,
                        cleanJid: cleaned.cleanJid,
                        cleanNumber: cleaned.cleanNumber,
                        isLid: cleaned.isLid,
                        linkedAt: data.linkedAt || new Date().toISOString()
                    };
                    
                    this.ownerJids.clear();
                    this.ownerLids.clear();
                    
                    this.ownerJids.add(cleaned.cleanJid);
                    this.ownerJids.add(ownerJid);
                    
                    if (cleaned.isLid) {
                        this.ownerLids.add(ownerJid);
                        const lidNumber = ownerJid.split('@')[0];
                        this.ownerLids.add(lidNumber);
                        OWNER_LID = ownerJid;
                    }
                    
                    OWNER_JID = ownerJid;
                    OWNER_NUMBER = cleaned.cleanNumber;
                    OWNER_CLEAN_JID = cleaned.cleanJid;
                    OWNER_CLEAN_NUMBER = cleaned.cleanNumber;
                    
                    UltraCleanLogger.success(`Loaded owner: ${cleaned.cleanJid}`);
                }
            }
        } catch {
            // Silent fail
        }
    }
    
    loadWhitelist() {
        try {
            const data = _cache_whitelist;
            if (data && data.whitelist && Array.isArray(data.whitelist)) {
                data.whitelist.forEach(item => {
                    WHITELIST.add(item);
                });
            }
        } catch {
            // Silent fail
        }
    }
    
    cleanJid(jid) {
        if (!jid) return { cleanJid: '', cleanNumber: '', raw: jid, isLid: false };
        
        const isLid = jid.includes('@lid');
        if (isLid) {
            const lidFull = jid.split('@')[0];
            const lidNumber = lidFull.split(':')[0];
            return {
                raw: jid,
                cleanJid: jid,
                cleanNumber: lidNumber,
                isLid: true
            };
        }
        
        const [numberPart] = jid.split('@')[0].split(':');
        const serverPart = jid.split('@')[1] || 's.whatsapp.net';
        
        const cleanNumber = numberPart.replace(/[^0-9]/g, '');
        const normalizedNumber = cleanNumber.startsWith('0') ? cleanNumber.substring(1) : cleanNumber;
        const cleanJid = `${normalizedNumber}@${serverPart}`;
        
        return {
            raw: jid,
            cleanJid: cleanJid,
            cleanNumber: normalizedNumber,
            isLid: false
        };
    }
    
    isOwner(msg) {
        if (!msg || !msg.key) return false;
        
        const chatJid = msg.key.remoteJid;
        const participant = msg.key.participant;
        const senderJid = participant || chatJid;
        const cleaned = this.cleanJid(senderJid);
        
        if (!this.owner || !this.owner.cleanNumber) {
            return false;
        }
        
        if (this.ownerJids.has(cleaned.cleanJid) || this.ownerJids.has(senderJid)) {
            return true;
        }
        
        if (cleaned.isLid) {
            const lidNumber = cleaned.cleanNumber;
            if (this.ownerLids.has(senderJid) || this.ownerLids.has(lidNumber)) {
                return true;
            }
            
            if (OWNER_LID && (senderJid === OWNER_LID || lidNumber === OWNER_LID.split('@')[0])) {
                return true;
            }
        }
        
        return false;
    }
    
    isSudo(msg) {
        if (!msg || !msg.key) return false;
        const chatJid = msg.key.remoteJid;
        const participant = msg.key.participant;
        const senderJid = participant || chatJid;
        
        if (isSudoJid(senderJid)) return true;
        
        const cleaned = this.cleanJid(senderJid);
        if (isSudoNumber(cleaned.cleanNumber)) return true;
        
        const rawNum = senderJid.split('@')[0].split(':')[0];
        if (rawNum !== cleaned.cleanNumber && isSudoNumber(rawNum)) return true;
        
        if (senderJid.includes('@lid')) {
            const phone = resolvePhoneFromLid(senderJid);
            if (phone && isSudoNumber(phone)) {
                mapLidToPhone(rawNum, phone);
                return true;
            }
        }
        
        if (isSudoByLid(rawNum)) return true;
        if (isSudoByLid(cleaned.cleanNumber)) return true;
        
        const lidNum = senderJid.split('@')[0].split(':')[0];
        const cachedPhone = lidPhoneCache.get(lidNum);
        if (cachedPhone && isSudoNumber(cachedPhone)) return true;

        if (rawNum.length > 15) {
            for (const [cachedLid, cachedPhoneVal] of lidPhoneCache) {
                if (cachedLid === rawNum && isSudoNumber(cachedPhoneVal)) return true;
            }
        }
        
        return false;
    }

    async isSudoAsync(msg, sock) {
        if (this.isSudo(msg)) return true;
        if (!msg || !msg.key) return false;
        
        const chatJid = msg.key.remoteJid;
        const participant = msg.key.participant;
        const senderJid = participant || chatJid;
        
        const { sudoers } = getSudoList();
        if (sudoers.length === 0) return false;

        const senderLidNum = senderJid.split('@')[0].split(':')[0];
        const senderFull = senderJid.split('@')[0];

        try {
            if (chatJid.includes('@g.us') && sock) {
                await buildLidMapFromGroup(chatJid, sock);
                
                const resolved = lidPhoneCache.get(senderLidNum) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderLidNum) || getPhoneFromLid(senderFull);
                if (resolved && isSudoNumber(resolved)) {
                    return true;
                }
                
                if (this.isSudo(msg)) return true;
            }
        } catch (err) {
            UltraCleanLogger.info(`⚠️ isSudoAsync group error: ${err.message}`);
        }

        try {
            if (!chatJid.includes('@g.us') && sock && senderJid.includes('@lid')) {
                const _alreadyResolved = lidPhoneCache.get(senderLidNum) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderLidNum) || getPhoneFromLid(senderFull);
                if (_alreadyResolved) {
                    if (isSudoNumber(_alreadyResolved)) {
                        UltraCleanLogger.info(`🔑 Sudo LID resolved from cache: +${_alreadyResolved}`);
                        return true;
                    }
                    return false;
                }

                if (!hasUnmappedSudos()) return false;

                const _now = Date.now();
                const _lastGlobalScan = isSudoAsync._lastGlobalScan || 0;
                const _scanning = isSudoAsync._scanning || false;
                if (!_scanning && _now - _lastGlobalScan > 10 * 60 * 1000) {
                    isSudoAsync._scanning = true;
                    isSudoAsync._lastGlobalScan = _now;
                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        if (groups) {
                            for (const [groupId, groupData] of Object.entries(groups)) {
                                const participants = groupData.participants || [];
                                for (const p of participants) {
                                    const { phoneNum, lidNum } = extractParticipantInfo(p, sock);
                                    if (phoneNum && lidNum && phoneNum !== lidNum) {
                                        cacheLidPhone(lidNum, phoneNum);
                                        mapLidToPhone(lidNum, phoneNum);
                                    }
                                }
                            }
                        }
                    } finally {
                        isSudoAsync._scanning = false;
                    }
                }

                const resolved = lidPhoneCache.get(senderLidNum) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderLidNum) || getPhoneFromLid(senderFull);
                if (resolved && isSudoNumber(resolved)) {
                    UltraCleanLogger.info(`🔑 Sudo LID resolved from group scan: +${resolved}`);
                    return true;
                }
            }
        } catch (err) {
            isSudoAsync._scanning = false;
            UltraCleanLogger.info(`⚠️ isSudoAsync DM scan error: ${err.message}`);
        }
        
        return false;
    }
    
    setNewOwner(newJid, isAutoLinked = false) {
        try {
            const cleaned = this.cleanJid(newJid);
            
            this.ownerJids.clear();
            this.ownerLids.clear();
            WHITELIST.clear();
            
            this.owner = {
                rawJid: newJid,
                cleanJid: cleaned.cleanJid,
                cleanNumber: cleaned.cleanNumber,
                isLid: cleaned.isLid,
                linkedAt: new Date().toISOString(),
                autoLinked: isAutoLinked
            };
            
            this.ownerJids.add(cleaned.cleanJid);
            this.ownerJids.add(newJid);
            
            if (cleaned.isLid) {
                this.ownerLids.add(newJid);
                const lidNumber = newJid.split('@')[0];
                this.ownerLids.add(lidNumber);
                OWNER_LID = newJid;
            } else {
                OWNER_LID = null;
            }
            
            OWNER_JID = newJid;
            OWNER_NUMBER = cleaned.cleanNumber;
            OWNER_CLEAN_JID = cleaned.cleanJid;
            OWNER_CLEAN_NUMBER = cleaned.cleanNumber;
            
            const ownerData = {
                OWNER_JID: newJid,
                OWNER_NUMBER: cleaned.cleanNumber,
                OWNER_CLEAN_JID: cleaned.cleanJid,
                OWNER_CLEAN_NUMBER: cleaned.cleanNumber,
                ownerLID: cleaned.isLid ? newJid : null,
                linkedAt: new Date().toISOString(),
                autoLinked: isAutoLinked,
                previousOwnerCleared: true,
                version: VERSION
            };
            
            _cache_owner_data = ownerData;
            _saveConfigCache('owner_data', ownerData);
            
            UltraCleanLogger.success(`New owner set: ${cleaned.cleanJid}`);
            
            return {
                success: true,
                owner: this.owner,
                isLid: cleaned.isLid
            };
            
        } catch {
            return { success: false, error: 'Failed to set new owner' };
        }
    }
    
    getOwnerInfo() {
        return {
            ownerJid: this.owner?.cleanJid || null,
            ownerNumber: this.owner?.cleanNumber || null,
            ownerLid: OWNER_LID || null,
            jidCount: this.ownerJids.size,
            lidCount: this.ownerLids.size,
            whitelistCount: WHITELIST.size,
            isLid: this.owner?.isLid || false,
            linkedAt: this.owner?.linkedAt || null
        };
    }
}

const jidManager = new JidManager();

// ====== SECTION 13: NEW MEMBER DETECTOR ======
// Watches group-participants.update events (add/remove/promote/demote) and
// is the trigger point for the welcome, goodbye, and anti-demote features.
//
// Flow when someone joins a group:
//   1. handleGroupUpdate() fires for action "add" or "invite"
//   2. Looks up cached group metadata to get the group name
//   3. Checks isWelcomeEnabled() → if yes, calls sendWelcomeMessage()
//   4. Calls isJoinApprovalEnabled() → if yes, posts an approval note
//   5. Caches the new member's JID so duplicate events are ignored
//
// Flow when someone leaves / is removed:
//   1. handleGroupUpdate() fires for action "remove"
//   2. Checks isGoodbyeEnabled() → if yes, calls sendGoodbyeMessage()
//
// Flow when an admin is demoted:
//   1. Fires for action "demote"
//   2. Delegates to antidemoteHandler() from commands/group/antidemote.js
class NewMemberDetector {
    constructor() {
        this.enabled = true;
        this.detectedMembers = new Map();
        this.groupMembersCache = new Map();
        this.loadDetectionData();
        
        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
        globalThis._wolfSysStats.memberDetector = true;
    }
    
    loadDetectionData() {
        try {
            if (_cache_member_detection && _cache_member_detection.detectedMembers) {
                for (const [groupId, members] of Object.entries(_cache_member_detection.detectedMembers)) {
                    this.detectedMembers.set(groupId, members);
                }
                globalThis._wolfSysStats = globalThis._wolfSysStats || {};
                globalThis._wolfSysStats.memberGroups = this.detectedMembers.size;
                return;
            }
            supabaseDb.getConfig('member_detection', {}).then(data => {
                try {
                    _cache_member_detection = data;
                    if (data && data.detectedMembers) {
                        for (const [groupId, members] of Object.entries(data.detectedMembers)) {
                            this.detectedMembers.set(groupId, members);
                        }
                        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
                        globalThis._wolfSysStats.memberGroups = this.detectedMembers.size;
                    }
                } catch {}
            }).catch(err => {
                UltraCleanLogger.warning(`Could not load member detection data: ${err.message}`);
            });
        } catch (error) {
            UltraCleanLogger.warning(`Could not load member detection data: ${error.message}`);
        }
    }
    
    saveDetectionData() {
        try {
            const data = {
                detectedMembers: {},
                updatedAt: new Date().toISOString(),
                totalGroups: this.detectedMembers.size
            };
            
            for (const [groupId, members] of this.detectedMembers.entries()) {
                data.detectedMembers[groupId] = members;
            }
            
            _cache_member_detection = data;
            supabaseDb.setConfig('member_detection', data).catch(err => {
                UltraCleanLogger.warning(`Could not save member detection data: ${err.message}`);
            });
        } catch (error) {
            UltraCleanLogger.warning(`Could not save member detection data: ${error.message}`);
        }
    }
    
    async detectNewMembers(sock, groupUpdate) {
        try {
            if (!this.enabled) return null;
            if (!sock?.ws?.isOpen) return null;
            
            const groupId = groupUpdate.id;
            const action = groupUpdate.action;
            
            if (action === 'add' || action === 'invite') {
                const participants = groupUpdate.participants || [];
                
                // Try cache first, then live fetch — so the box always shows
                // a real group name instead of "Unknown Group".
                let groupName = 'Unknown Group';
                try {
                    const _cachedMeta = groupMetadataCache.get(groupId);
                    groupName = _cachedMeta?.data?.subject || _cachedMeta?.subject || groupName;
                    if (groupName === 'Unknown Group' && sock?.ws?.isOpen) {
                        const live = await Promise.race([
                            sock.groupMetadata(groupId),
                            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000)),
                        ]);
                        if (live?.subject) {
                            groupName = live.subject;
                            groupMetadataCache.set(groupId, { data: live, ts: Date.now() });
                        }
                    }
                } catch {}
                
                let cachedMembers = this.groupMembersCache.get(groupId) || new Set();
                
                const newMembers = [];
                for (const participant of participants) {
                    let userJid;
                    if (typeof participant === 'string') {
                        userJid = participant.includes('@') ? participant : null;
                    } else if (participant && typeof participant === 'object') {
                        const jid = participant.jid || participant.id || participant.userJid || participant.participant || participant.user;
                        if (typeof jid === 'string' && jid.includes('@')) userJid = jid;
                        else if (typeof jid === 'string' && /^\d+$/.test(jid)) userJid = `${jid}@s.whatsapp.net`;
                        else userJid = null;
                    } else {
                        userJid = null;
                    }
                    if (!userJid) continue;
                    
                    if (!cachedMembers.has(userJid)) {
                        try {
                            if (!sock?.ws?.isOpen) return null;

                            // ── Resolve LID → real WhatsApp phone ────────────
                            // Baileys 7 puts the real phone on the participant
                            // object as `phoneNumber` when the JID is a @lid.
                            // Fall back to our LID/PN cache + signalRepository.
                            let realJid    = userJid;
                            let realNumber = userJid.split('@')[0].split(':')[0];

                            if (userJid.endsWith('@lid')) {
                                // 1) group-metadata path (most reliable)
                                try {
                                    const meta = await Promise.race([
                                        sock.groupMetadata(groupId),
                                        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000)),
                                    ]);
                                    const part = meta?.participants?.find(p =>
                                        p.id === userJid || p.lid === userJid || p.jid === userJid
                                    );
                                    const ph = part?.phoneNumber || part?.pn;
                                    if (ph) {
                                        const num = String(ph).split('@')[0].replace(/[^0-9]/g, '');
                                        if (num.length >= 7) {
                                            realNumber = num;
                                            realJid = `${num}@s.whatsapp.net`;
                                        }
                                    }
                                } catch {}

                                // 2) signalRepository / cached map fallback
                                if (realJid.endsWith('@lid') && typeof globalThis.resolvePhoneFromLid === 'function') {
                                    const ph = globalThis.resolvePhoneFromLid(userJid);
                                    if (ph) {
                                        realNumber = ph;
                                        realJid = `${ph}@s.whatsapp.net`;
                                    }
                                }
                            }

                            // ── Resolve display name ─────────────────────────
                            let userName = realNumber;
                            try {
                                const _timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
                                const userInfo = await Promise.race([sock.onWhatsApp(realJid), _timeout]);
                                userName = userInfo?.[0]?.name
                                        || userInfo?.[0]?.notify
                                        || userInfo?.[0]?.verifiedName
                                        || (global.contactNames?.get?.(realNumber))
                                        || realNumber;
                            } catch {}

                            newMembers.push({
                                jid: realJid,
                                lid: userJid.endsWith('@lid') ? userJid : null,
                                name: userName,
                                number: realNumber,
                                addedAt: new Date().toISOString(),
                                timestamp: Date.now(),
                                action: action,
                                addedBy: groupUpdate.actor || 'unknown'
                            });

                            cachedMembers.add(userJid);

                            this.showMemberNotification(groupName, userName, realNumber, action, {
                                userJid: realJid,
                                groupJid: groupId,
                            });

                        } catch (error) {
                            UltraCleanLogger.warning(`Could not get user info for ${userJid}: ${error.message}`);
                        }
                    }
                }
                
                this.groupMembersCache.set(groupId, cachedMembers);
                
                if (newMembers.length > 0) {
                    const groupEvents = this.detectedMembers.get(groupId) || [];
                    groupEvents.push(...newMembers);
                    this.detectedMembers.set(groupId, groupEvents.slice(-50));
                    
                    if (Math.random() < 0.2) {
                        this.saveDetectionData();
                    }
                    
                    return newMembers;
                }
            }
            
            return null;
            
        } catch (error) {
            UltraCleanLogger.error(`Member detection error: ${error.message}`);
            return null;
        }
    }
    
    showMemberNotification(groupName, userName, userNumber, action, extra = {}) {
        // One unified box replaces the old [KLAUS-MBR] + [KLAUS-GRP] pair.
        _printMemberBox({
            action,
            userName,
            userNumber,
            userJid:  extra.userJid  || null,
            groupName,
            groupJid: extra.groupJid || null,
        });
    }
    
    async checkWelcomeSystem(sock, groupId, newMembers) {
        try {
            const welcomeData = this.loadWelcomeData();
            const groupWelcome = welcomeData.groups?.[groupId];
            
            if (groupWelcome?.enabled) {
                for (const member of newMembers) {
                    await this.sendWelcomeMessage(sock, groupId, member.jid, groupWelcome.message);
                }
            }
        } catch (error) {
            UltraCleanLogger.warning(`Welcome system check failed: ${error.message}`);
        }
    }
    
    async sendWelcomeMessage(sock, groupId, userId, message) {
        try {
            const userInfo = await sock.onWhatsApp(userId);
            const userName = userInfo[0]?.name || userId.split('@')[0];
            
            const metadata = await sock.groupMetadata(groupId);
            const memberCount = metadata.participants.length;
            const groupName = metadata.subject || "Our Group";
            
            const welcomeText = this.replaceWelcomeVariables(message, {
                name: userName,
                group: groupName,
                members: memberCount,
                mention: `@${userId.split('@')[0]}`
            });
            
            let profilePic = null;
            try {
                profilePic = await sock.profilePictureUrl(userId, 'image');
            } catch {
                profilePic = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
            }
            
            await sock.sendMessage(groupId, {
                image: { url: profilePic },
                caption: welcomeText,
                mentions: [userId],
                contextInfo: {
                    mentionedJid: [userId]
                }
            });
            
            const welcomeData = this.loadWelcomeData();
            if (welcomeData.groups?.[groupId]) {
                welcomeData.groups[groupId].lastWelcome = Date.now();
                this.saveWelcomeData(welcomeData);
            }
            
            UltraCleanLogger.info(`✅ Welcome sent to ${userName} in ${groupName}`);
            
        } catch (error) {
            UltraCleanLogger.warning(`Could not send welcome message: ${error.message}`);
        }
    }
    
    replaceWelcomeVariables(message, variables) {
        return message
            .replace(/{name}/g, variables.name)
            .replace(/{group}/g, variables.group)
            .replace(/{members}/g, variables.members)
            .replace(/{mention}/g, variables.mention);
    }
    
    loadWelcomeData() {
        try {
            if (_cache_welcome_data) {
                return _cache_welcome_data;
            }
        } catch (error) {
            UltraCleanLogger.warning(`Error loading welcome data: ${error.message}`);
        }
        
        return {
            groups: {},
            version: '1.0',
            created: new Date().toISOString()
        };
    }
    
    saveWelcomeData(data) {
        try {
            data.updated = new Date().toISOString();
            _cache_welcome_data = data;
            _saveConfigCache('welcome_data', data);
            return true;
        } catch (error) {
            UltraCleanLogger.warning(`Error saving welcome data: ${error.message}`);
            return false;
        }
    }
    
    getStats() {
        let totalEvents = 0;
        for (const events of this.detectedMembers.values()) {
            totalEvents += events.length;
        }
        
        return {
            enabled: this.enabled,
            totalGroups: this.detectedMembers.size,
            totalEvents: totalEvents,
            cachedGroups: this.groupMembersCache.size
        };
    }
}

const memberDetector = new NewMemberDetector();
globalThis._memberDetector = memberDetector;

// ====== AUTO GROUP JOIN SYSTEM ======
// class AutoGroupJoinSystem {
//     constructor() {
//         this.initialized = false;
//         this.invitedUsers = new Set();
//         this.loadInvitedUsers();
//         UltraCleanLogger.success('Auto-Join System initialized');
//     }

//     loadInvitedUsers() {
//         try {
//             if (fs.existsSync(AUTO_JOIN_LOG_FILE)) {
//                 const data = JSON.parse(fs.readFileSync(AUTO_JOIN_LOG_FILE, 'utf8'));
//                 data.users.forEach(user => this.invitedUsers.add(user));
//                 UltraCleanLogger.info(`📊 Loaded ${this.invitedUsers.size} previously invited users`);
//             }
//         } catch (error) {
//             // Silent fail
//         }
//     }

//     saveInvitedUser(userJid) {
//         try {
//             this.invitedUsers.add(userJid);
            
//             let data = { 
//                 users: [], 
//                 lastUpdated: new Date().toISOString(),
//                 totalInvites: 0
//             };
            
//             if (fs.existsSync(AUTO_JOIN_LOG_FILE)) {
//                 data = JSON.parse(fs.readFileSync(AUTO_JOIN_LOG_FILE, 'utf8'));
//             }
            
//             if (!data.users.includes(userJid)) {
//                 data.users.push(userJid);
//                 data.totalInvites = data.users.length;
//                 data.lastUpdated = new Date().toISOString();
//                 fs.writeFileSync(AUTO_JOIN_LOG_FILE, JSON.stringify(data, null, 2));
//                 UltraCleanLogger.success(`✅ Saved invited user: ${userJid}`);
//             }
//         } catch (error) {
//             UltraCleanLogger.error(`❌ Error saving invited user: ${error.message}`);
//         }
//     }

//     isOwner(userJid, jidManager) {
//         if (!jidManager.owner || !jidManager.owner.cleanNumber) return false;
//         return userJid === jidManager.owner.cleanJid || 
//                userJid === jidManager.owner.rawJid ||
//                userJid.includes(jidManager.owner.cleanNumber);
//     }

//     async sendWelcomeMessage(sock, userJid) {
//         if (!SEND_WELCOME_MESSAGE) return;
        
//         try {
//             await sock.sendMessage(userJid, {
//                 text: `🎉 *WELCOME TO WOLFBOT!*\n\n` +
//                       `Thank you for connecting with WolfBot! 🤖\n\n` +
//                       `✨ *Features Available:*\n` +
//                       `• Multiple command categories\n` +
//                       `• Group management tools\n` +
//                       `• Media downloading\n` +
//                       `• And much more!\n\n` +
//                       `You're being automatically invited to join our official community group...\n` +
//                       `Please wait a moment... ⏳`
//             });
//         } catch (error) {
//             UltraCleanLogger.error(`❌ Could not send welcome message: ${error.message}`);
//         }
//     }

//     async sendGroupInvitation(sock, userJid, isOwner = false) {
//         try {
//             const message = isOwner 
//                 ? `👑 *OWNER AUTO-JOIN*\n\n` +
//                   `You are being automatically added to the group...\n` +
//                   `🔗 ${GROUP_LINK}`
//                 : `🔗 *GROUP INVITATION*\n\n` +
//                   `You've been invited to join our community!\n\n` +
//                   `*Group Name:* ${GROUP_NAME}\n` +
//                   `*Features:*\n` +
//                   `• Bot support & updates\n` +
//                   `• Community chat\n` +
//                   `• Exclusive features\n` +
//                   `Click to join: ${GROUP_LINK}`;
            
//             await sock.sendMessage(userJid, { text: message });
//             return true;
//         } catch (error) {
//             UltraCleanLogger.error(`❌ Could not send group invitation: ${error.message}`);
//             return false;
//         }
//     }

//     async attemptAutoAdd(sock, userJid, isOwner = false) {
//         try {
//             UltraCleanLogger.info(`🔄 Attempting to auto-add ${isOwner ? 'owner' : 'user'} ${userJid} to group...`);
            
//             let groupId;
//             try {
//                 groupId = await sock.groupAcceptInvite(GROUP_INVITE_CODE);
//                 UltraCleanLogger.success(`✅ Successfully accessed group: ${groupId}`);
//             } catch (inviteError) {
//                 UltraCleanLogger.warning(`⚠️ Could not accept invite, trying direct add: ${inviteError.message}`);
//                 throw new Error('Could not access group with invite code');
//             }
            
//             await sock.groupParticipantsUpdate(groupId, [userJid], 'add');
//             UltraCleanLogger.success(`✅ Successfully added ${userJid} to group`);
            
//             const successMessage = isOwner
//                 ? `✅ *SUCCESSFULLY JOINED!*\n\n` +
//                   `You have been automatically added to the group!\n` +
//                   `The bot is now fully operational there. 🎉`
//                 : `✅ *WELCOME TO THE GROUP!*\n\n` +
//                   `You have been successfully added to ${GROUP_NAME}!\n` +
//                   `Please introduce yourself when you join. 👋`;
            
//             await sock.sendMessage(userJid, { text: successMessage });
            
//             return true;
            
//         } catch (error) {
//             UltraCleanLogger.error(`❌ Auto-add failed for ${userJid}: ${error.message}`);
            
//             const manualMessage = isOwner
//                 ? `⚠️ *MANUAL JOIN REQUIRED*\n\n` +
//                   `Could not auto-add you to the group.\n\n` +
//                   `*Please join manually:*\n` +
//                   `${GROUP_LINK}\n\n` +
//                   `Once joined, the bot will work there immediately.`
//                 : `⚠️ *MANUAL JOIN REQUIRED*\n\n` +
//                   `Could not auto-add you to the group.\n\n` +
//                   `*Please join manually:*\n` +
//                   `${GROUP_LINK}\n\n` +
//                   `We'd love to have you in our community!`;
            
//             await sock.sendMessage(userJid, { text: manualMessage });
            
//             return false;
//         }
//     }

//     async autoJoinGroup(sock, userJid) {
//         if (!AUTO_JOIN_ENABLED) {
//             UltraCleanLogger.info('Auto-join is disabled in settings');
//             return false;
//         }
        
//         if (this.invitedUsers.has(userJid)) {
//             UltraCleanLogger.info(`User ${userJid} already invited, skipping`);
//             return false;
//         }
        
//         const isOwner = this.isOwner(userJid, jidManager);
//         UltraCleanLogger.info(`${isOwner ? '👑 Owner' : '👤 User'} ${userJid} connected, initiating auto-join...`);
        
//         await this.sendWelcomeMessage(sock, userJid);
        
//         await new Promise(resolve => setTimeout(resolve, AUTO_JOIN_DELAY));
        
//         await this.sendGroupInvitation(sock, userJid, isOwner);
        
//         await new Promise(resolve => setTimeout(resolve, 3000));
        
//         const success = await this.attemptAutoAdd(sock, userJid, isOwner);
        
//         this.saveInvitedUser(userJid);
        
//         return success;
//     }

//     async startupAutoJoin(sock) {
//         if (!AUTO_JOIN_ENABLED || !jidManager.owner) return;
        
//         try {
//             UltraCleanLogger.info('🚀 Running startup auto-join check...');
            
//             const ownerJid = jidManager.owner.cleanJid;
            
//             if (jidManager.owner.autoJoinedGroup) {
//                 UltraCleanLogger.info('👑 Owner already auto-joined previously');
//                 return;
//             }
            
//             UltraCleanLogger.info(`👑 Attempting to auto-join owner ${ownerJid} to group...`);
            
//             await new Promise(resolve => setTimeout(resolve, 10000));
            
//             const success = await this.autoJoinGroup(sock, ownerJid);
            
//             if (success) {
//                 UltraCleanLogger.success('✅ Startup auto-join completed successfully');
//                 if (jidManager.owner) {
//                     jidManager.owner.autoJoinedGroup = true;
//                     jidManager.owner.lastAutoJoin = new Date().toISOString();
//                 }
//             } else {
//                 UltraCleanLogger.warning('⚠️ Startup auto-join failed');
//             }
            
//         } catch (error) {
//             UltraCleanLogger.error(`Startup auto-join error: ${error.message}`);
//         }
//     }
// }

// const autoGroupJoinSystem = new AutoGroupJoinSystem();


// ====== SECTION 14: ULTIMATE FIX SYSTEM ======
// Watches for connection drops, stalls, and QR loops and automatically
// restarts the bot to maintain 24/7 uptime on Replit.
//
// How it works:
//   trackActivity()   — called on every incoming message to reset the watchdog timer
//   checkHealth()     — runs every 90 seconds; if no activity for > 5 minutes it
//                       calls triggerRestart() which does a clean sock.end() → reconnect
//   onConnected()     — called when Baileys fires "connection.update" with open=true;
//                       resets retry counters and marks the connection as stable
//   onDisconnected()  — called on close/logout events; decides whether to reconnect
//                       or give up (MAX_RETRY_ATTEMPTS = 10)
//
// Interaction with commands:
//   The .restart command (commands/owner/restart.js) calls triggerRestart() directly.
//   The .fix command routes through UltimateFixSystem.triggerRestart() as well.
class UltimateFixSystem {
    constructor() {
        this.fixedJids = new Set();
        this.fixApplied = false;
        this.restartFixAttempted = false;
    }
    
    async applyUltimateFix(sock, senderJid, cleaned, isFirstUser = false, isRestart = false) {
        try {
            const fixType = isRestart ? 'RESTART' : (isFirstUser ? 'FIRST' : 'NORMAL');
            
            const originalIsOwner = jidManager.isOwner;
            
            jidManager.isOwner = function(message) {
                try {
                    const isFromMe = message?.key?.fromMe;
                    if (isFromMe) return true;
                    
                    if (!this.owner || !this.owner.cleanNumber) {
                        this.loadOwnerDataFromFile();
                    }
                    
                    return originalIsOwner.call(this, message);
                } catch {
                    return message?.key?.fromMe || false;
                }
            };
            
            jidManager.loadOwnerDataFromFile = function() {
                try {
                    const data = _cache_owner_data;
                    if (data) {
                        let cleanNumber = data.OWNER_CLEAN_NUMBER || data.OWNER_NUMBER;
                        let cleanJid = data.OWNER_CLEAN_JID || data.OWNER_JID;
                        
                        if (cleanNumber && cleanNumber.includes(':')) {
                            cleanNumber = cleanNumber.split(':')[0];
                        }
                        
                        this.owner = {
                            cleanNumber: cleanNumber,
                            cleanJid: cleanJid,
                            rawJid: data.OWNER_JID,
                            isLid: cleanJid?.includes('@lid') || false
                        };
                        
                        return true;
                    }
                } catch {
                    // Silent fail
                }
                return false;
            };
            
            global.OWNER_NUMBER = cleaned.cleanNumber;
            global.OWNER_CLEAN_NUMBER = cleaned.cleanNumber;
            global.OWNER_JID = cleaned.cleanJid;
            global.OWNER_CLEAN_JID = cleaned.cleanJid;
            
            this.fixedJids.add(senderJid);
            this.fixApplied = true;
            
            
            return {
                success: true,
                jid: cleaned.cleanJid,
                number: cleaned.cleanNumber,
                isLid: cleaned.isLid,
                isRestart: isRestart
            };
            
        } catch (error) {
            UltraCleanLogger.error(`Ultimate Fix failed: ${error.message}`);
            return { success: false, error: 'Fix failed' };
        }
    }
    
    isFixNeeded(jid) {
        return !this.fixedJids.has(jid);
    }
    
    shouldRunRestartFix(ownerJid) {
        const hasOwnerData = !!_cache_owner_data;
        const isFixNeeded = this.isFixNeeded(ownerJid);
        const notAttempted = !this.restartFixAttempted;
        
        return hasOwnerData && isFixNeeded && notAttempted && RESTART_AUTO_FIX_ENABLED;
    }
    
    markRestartFixAttempted() {
        this.restartFixAttempted = true;
    }
}

const ultimateFixSystem = new UltimateFixSystem();

// ====== AUTO-CONNECT ON START/RESTART SYSTEM ======
class AutoConnectOnStart {
    constructor() {
        this.hasRun = false;
        this.isEnabled = AUTO_CONNECT_ON_START;
    }
    
    async trigger(sock) {
        try {
            if (!this.isEnabled || this.hasRun) {
                UltraCleanLogger.info(`Auto-connect on start ${this.hasRun ? 'already ran' : 'disabled'}`);
                return;
            }
            
            if (!sock || !sock.user?.id) {
                UltraCleanLogger.error('No socket or user ID for auto-connect');
                return;
            }
            
            const ownerJid = sock.user.id;
            const cleaned = jidManager.cleanJid(ownerJid);
            
            
            const mockMsg = {
                key: {
                    remoteJid: ownerJid,
                    fromMe: true,
                    id: 'auto-start-' + Date.now(),
                    participant: ownerJid
                },
                message: {
                    conversation: '.connect'
                }
            };
            
            await handleConnectCommand(sock, mockMsg, [], cleaned, { suppressLog: true });
            
            this.hasRun = true;
            hasAutoConnectedOnStart = true;
            
            
        } catch (error) {
            UltraCleanLogger.error(`Auto-connect on start failed: ${error.message}`);
        }
    }
    
    reset() {
        this.hasRun = false;
        hasAutoConnectedOnStart = false;
    }
}

const autoConnectOnStart = new AutoConnectOnStart();

// ====== AUTO-LINKING SYSTEM ======
class AutoLinkSystem {
    constructor() {
        this.linkAttempts = new Map();
        this.MAX_ATTEMPTS = 3;
        this.autoConnectEnabled = AUTO_CONNECT_ON_LINK;
    }
    
    async shouldAutoLink(sock, msg) {
        if (!AUTO_LINK_ENABLED) return false;
        
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const cleaned = jidManager.cleanJid(senderJid);
        
        if (!jidManager.owner || !jidManager.owner.cleanNumber) {
            UltraCleanLogger.info(`🔗 New owner detected: ${cleaned.cleanJid}`);
            const result = await this.autoLinkNewOwner(sock, senderJid, cleaned, true);
            if (result && this.autoConnectEnabled) {
                setTimeout(async () => {
                    await this.triggerAutoConnect(sock, msg, cleaned, true);
                }, 1500);
            }
            return result;
        }
        
        if (msg.key.fromMe) {
            return false;
        }
        
        if (jidManager.isOwner(msg)) {
            return false;
        }
        
        const currentOwnerNumber = jidManager.owner.cleanNumber;
        if (this.isSimilarNumber(cleaned.cleanNumber, currentOwnerNumber)) {
            const isDifferentDevice = !jidManager.ownerJids.has(cleaned.cleanJid);
            
            if (isDifferentDevice) {
                UltraCleanLogger.info(`📱 New device detected for owner: ${cleaned.cleanJid}`);
                jidManager.ownerJids.add(cleaned.cleanJid);
                jidManager.ownerJids.add(senderJid);
                
                if (AUTO_ULTIMATE_FIX_ENABLED && ultimateFixSystem.isFixNeeded(senderJid)) {
                    setTimeout(async () => {
                        await ultimateFixSystem.applyUltimateFix(sock, senderJid, cleaned, false);
                    }, 800);
                }
                
                await this.sendDeviceLinkedMessage(sock, senderJid, cleaned);
                
                if (this.autoConnectEnabled) {
                    setTimeout(async () => {
                        await this.triggerAutoConnect(sock, msg, cleaned, false);
                    }, 1500);
                }
                return true;
            }
        }
        
        return false;
    }
    
    isSimilarNumber(num1, num2) {
        if (!num1 || !num2) return false;
        if (num1 === num2) return true;
        if (num1.includes(num2) || num2.includes(num1)) return true;
        
        if (num1.length >= 6 && num2.length >= 6) {
            const last6Num1 = num1.slice(-6);
            const last6Num2 = num2.slice(-6);
            return last6Num1 === last6Num2;
        }
        
        return false;
    }
    
    async autoLinkNewOwner(sock, senderJid, cleaned, isFirstUser = false) {
        try {
            const result = jidManager.setNewOwner(senderJid, true);
            
            if (!result.success) {
                return false;
            }
            
            await this.sendImmediateSuccessMessage(sock, senderJid, cleaned, isFirstUser);
            
            if (AUTO_ULTIMATE_FIX_ENABLED) {
                setTimeout(async () => {
                    await ultimateFixSystem.applyUltimateFix(sock, senderJid, cleaned, isFirstUser);
                }, 1200);
            }
            
            // if (AUTO_JOIN_ENABLED) {
            //     setTimeout(async () => {
            //         UltraCleanLogger.info(`🚀 Auto-joining new owner ${cleaned.cleanJid} to group...`);
            //         try {
            //             await autoGroupJoinSystem.autoJoinGroup(sock, senderJid);
            //         } catch (error) {
            //             UltraCleanLogger.error(`❌ Auto-join for new owner failed: ${error.message}`);
            //         }
            //     }, 3000);
            // }
            
            return true;
        } catch {
            return false;
        }
    }
    
    async triggerAutoConnect(sock, msg, cleaned, isNewOwner = false) {
        try {
            if (!this.autoConnectEnabled) {
                UltraCleanLogger.info(`Auto-connect disabled, skipping for ${cleaned.cleanNumber}`);
                return;
            }
            
            UltraCleanLogger.info(`⚡ Auto-triggering connect command for ${cleaned.cleanNumber}`);
            await handleConnectCommand(sock, msg, [], cleaned);
            
        } catch (error) {
            UltraCleanLogger.error(`Auto-connect failed: ${error.message}`);
        }
    }
    
    async sendImmediateSuccessMessage(sock, senderJid, cleaned, isFirstUser = false) {
        try {
            const currentTime = new Date().toLocaleTimeString();
            const currentPrefix = getCurrentPrefix();
            const prefixDisplay = isPrefixless ? 'none (prefixless)' : `"${currentPrefix}"`;
            
            const _now = new Date();
            const _mo = _now.getMonth() + 1;
            const _d  = _now.getDate();
            let _seasonalGreeting = null;
            if (_mo === 12 && _d >= 1 && _d <= 25) {
                _seasonalGreeting = `🎄 *MERRY CHRISTMAS!* 🎄`;
            } else if (_mo === 12 && _d >= 26 && _d <= 30) {
                _seasonalGreeting = `🎄🎉 *MERRY CHRISTMAS AND HAPPY NEW YEAR!* 🎉🎄`;
            } else if (_mo === 1 && _d >= 1 && _d <= 5) {
                _seasonalGreeting = `🎉 *HAPPY NEW YEAR!* 🎉`;
            }

            let successMsg = _seasonalGreeting
                ? `${_seasonalGreeting}\n\n✅ *${BOT_NAME.toUpperCase()} v${VERSION} CONNECTED!*\n\n`
                : `✅ *${BOT_NAME.toUpperCase()} v${VERSION} CONNECTED!*\n\n`;
            
            if (isFirstUser) {
                successMsg += `🎉 *FIRST TIME SETUP COMPLETE!*\n\n`;
            } else {
                successMsg += `🔄 *NEW OWNER LINKED!*\n\n`;
            }
            
            successMsg += `📋 *YOUR INFORMATION:*\n`;
            successMsg += `├─ Your Number: +${cleaned.cleanNumber}\n`;
            successMsg += `├─ Device Type: ${cleaned.isLid ? 'Linked Device 🔗' : 'Regular Device 📱'}\n`;
            successMsg += `├─ JID: ${cleaned.cleanJid}\n`;
            successMsg += `├─ Prefix: ${prefixDisplay}\n`;
            successMsg += `├─ Mode: ${BOT_MODE}\n`;
            successMsg += `└─ Status: ✅ LINKED SUCCESSFULLY\n\n`;
            
            successMsg += `⚡ *Background Processes:*\n`;
            successMsg += `├─ Ultimate Fix: Initializing...\n`;
            successMsg += `├─ Auto-Join: ${AUTO_JOIN_ENABLED ? 'Initializing...' : 'Disabled'}\n`;
            successMsg += `├─ Member Detection: ✅ ACTIVE\n`;
            successMsg += `└─ All systems: ✅ ACTIVE\n\n`;
            
            if (!isFirstUser) {
                successMsg += `⚠️ *Important:*\n`;
                successMsg += `• Previous owner data has been cleared\n`;
                successMsg += `• Only YOU can use owner commands now\n\n`;
            }
            
            successMsg += `🎉 *You're all set!* Bot is now ready to use.`;

            const GITHUB_PROFILE = PROFILE_URL;

            await sock.sendMessage(senderJid, {
                text: successMsg,
                contextInfo: {
                    externalAdReply: {
                        title: `⭐ Follow on GitHub`,
                        body: `github.com/${OWNER}`,
                        mediaType: 1,
                        thumbnailUrl: AVATAR_URL,
                        sourceUrl: GITHUB_PROFILE,
                        mediaUrl: GITHUB_PROFILE,
                        renderLargerThumbnail: false
                    }
                }
            });

        } catch {
            // Silent fail
        }
    }
    
    async sendDeviceLinkedMessage(sock, senderJid, cleaned) {
        try {
            const message = `📱 *Device Linked Successfully!*\n\n` +
                          `✅ Your device has been added to owner devices.\n` +
                          `🔒 You can now use owner commands from this device.\n` +
                          `🔄 Ultimate Fix applied automatically in background.\n` +
                          `🎉 All systems are now active and ready!`;
            
            await sock.sendMessage(senderJid, { text: message });
            UltraCleanLogger.info(`📱 Device linked message sent to ${cleaned.cleanNumber}`);
        } catch {
            // Silent fail
        }
    }
}

const autoLinkSystem = new AutoLinkSystem();

// ====== LIGHTWEIGHT MEMORY MONITOR ======
const memoryMonitor = {
    _interval: null,
    _trimInterval: null,
    _emergencyInterval: null,
    start() {
        if (this._interval) return;
        this._lastMemWarn = 0;
        // Main check every 30 seconds — catch memory spikes before they cascade
        this._interval = setInterval(() => {
            try {
                const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
                if (memMB > 200) {
                    const now = Date.now();
                    if (now - this._lastMemWarn > 3 * 60 * 1000) {
                        UltraCleanLogger.warning(`High memory: ${memMB}MB - trimming caches`);
                        this._lastMemWarn = now;
                    }
                    setImmediate(() => this.trimCaches(memMB > 400));
                }
            } catch {}
        }, 30 * 1000);
        // Routine trim every 3 minutes regardless of memory level
        this._trimInterval = setInterval(() => {
            try { this.trimCaches(false); } catch {}
        }, 3 * 60 * 1000);
        // Emergency GC every 10 seconds when memory is high
        this._lastEmergencyGCLog = 0;
        this._emergencyInterval = setInterval(() => {
            try {
                const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
                if (memMB > 450) {
                    if (global.gc) { global.gc(); global.gc(); }
                    setImmediate(() => this.trimCaches(true));
                    if (memMB > 700) {
                        const now = Date.now();
                        if (now - this._lastEmergencyGCLog > 60 * 1000) {
                            UltraCleanLogger.warning(`Emergency GC: ${memMB}MB - forcing collection`);
                            this._lastEmergencyGCLog = now;
                        }
                    }
                }
            } catch {}
        }, 10 * 1000);
    },
    stop() {
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
        if (this._trimInterval) { clearInterval(this._trimInterval); this._trimInterval = null; }
        if (this._emergencyInterval) { clearInterval(this._emergencyInterval); this._emergencyInterval = null; }
    },
    trimCaches(aggressive = false) {
        try {
            const trimMap = (map, maxSize, keepCount, label) => {
                if (!map || map.size <= maxSize) return;
                const excess = map.size - keepCount;
                let removed = 0;
                for (const key of map.keys()) {
                    if (removed >= excess) break;
                    map.delete(key);
                    removed++;
                }
                if (label) UltraCleanLogger.info(`${label} trimmed to ${map.size} entries`);
            };
            const now = Date.now();
            for (const [k, v] of groupMetadataCache) {
                if (now - v.ts > GROUP_CACHE_TTL) groupMetadataCache.delete(k);
            }
            _capSet(groupDiagDone, MAX_GROUP_DIAG);
            const factor = aggressive ? 0.4 : 1;
            trimMap(lidPhoneCache, Math.floor(300 * factor), Math.floor(150 * factor), 'LID cache');
            trimMap(phoneLidCache, Math.floor(300 * factor), Math.floor(150 * factor), null);
            trimMap(groupMetadataCache, Math.floor(20 * factor), Math.floor(10 * factor), 'Group metadata cache');
            // contactNames stores up to 5 keys per contact — keep cap low
            trimMap(global.contactNames, Math.floor(500 * factor), Math.floor(200 * factor), null);
            if (store && store.messages) {
                trimMap(store.messages, Math.floor(100 * factor), Math.floor(50 * factor), 'Message store');
            }
            if (store && store.sentMessages) {
                trimMap(store.sentMessages, Math.floor(80 * factor), Math.floor(40 * factor), null);
            }
            trimMap(_lidResolveAttempts, 80, 40, null);
            trimMap(_pendingGroupFetches, 20, 10, null);
            // Clean stale antispam tracker entries (older than 5 minutes)
            if (globalThis._antispamTracker instanceof Map && globalThis._antispamTracker.size > 0) {
                const _antispamNow = Date.now();
                for (const [key, val] of globalThis._antispamTracker.entries()) {
                    const ts = val?.lastTime || 0;
                    if (_antispamNow - ts > 5 * 60 * 1000) globalThis._antispamTracker.delete(key);
                }
                trimMap(globalThis._antispamTracker, 1500, 750, null);
            }
            // groupMembersCache and detectedMembers in NewMemberDetector grow with group count
            if (globalThis._memberDetector) {
                const md = globalThis._memberDetector;
                if (md.groupMembersCache instanceof Map && md.groupMembersCache.size > 150) {
                    trimMap(md.groupMembersCache, Math.floor(150 * factor), Math.floor(75 * factor), null);
                }
                if (md.detectedMembers instanceof Map && md.detectedMembers.size > 100) {
                    trimMap(md.detectedMembers, Math.floor(100 * factor), Math.floor(50 * factor), null);
                }
            }
            if (global.gc) { global.gc(); }
            // Aggressive trim runs silently — no console spam
        } catch {}
    }
};

let antideleteInitDone = false;
let statusAntideleteInitDone = false;
let antieditInitDone = false;

// ====== SECTION 15: RATE LIMIT PROTECTION ======
// Prevents the bot from being banned by WhatsApp for sending too many messages
// too quickly.  Every command call passes through rateLimiter.check() before
// the command is executed.
//
// How it works:
//   check(jid, command) — returns true if the user+command combo is within limits.
//                         Returns false (and optionally warns the user) if they are
//                         firing commands too fast.
//   Limits tracked per user:
//     - global burst: max 10 commands/10 seconds from any single JID
//     - per-command: cooldown varies by category (e.g. sticker=3 s, music=5 s)
//   Media commands (music, sticker, download) get longer cooldowns because they
//   generate heavy traffic that WhatsApp's servers are sensitive to.
class RateLimitProtection {
    constructor() {
        this.commandTimestamps = new Map();
        this.userCooldowns = new Map();
        this.globalCooldown = Date.now();
        this.stickerSendTimes = new Map();
        this._cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
    
    canSendCommand(chatId, userId, command) {
        if (!RATE_LIMIT_ENABLED) return { allowed: true };
        
        const now = Date.now();
        const userKey = `${userId}_${command}`;
        const chatKey = `${chatId}_${command}`;
        
        if (this.userCooldowns.has(userKey)) {
            const lastTime = this.userCooldowns.get(userKey);
            const timeDiff = now - lastTime;
            
            if (timeDiff < MIN_COMMAND_DELAY) {
                const remaining = Math.ceil((MIN_COMMAND_DELAY - timeDiff) / 1000);
                return { 
                    allowed: false, 
                    reason: `Please wait ${remaining}s before using ${command} again.`
                };
            }
        }
        
        if (this.commandTimestamps.has(chatKey)) {
            const lastTime = this.commandTimestamps.get(chatKey);
            const timeDiff = now - lastTime;
            
            if (timeDiff < MIN_COMMAND_DELAY) {
                const remaining = Math.ceil((MIN_COMMAND_DELAY - timeDiff) / 1000);
                return { 
                    allowed: false, 
                    reason: `Command cooldown: ${remaining}s remaining.`
                };
            }
        }
        
        if (now - this.globalCooldown < 10) {
            return { 
                allowed: false, 
                reason: 'System is busy. Please try again in a moment.'
            };
        }
        
        this.userCooldowns.set(userKey, now);
        this.commandTimestamps.set(chatKey, now);
        this.globalCooldown = now;
        
        return { allowed: true };
    }
    
    async waitForSticker(chatId) {
        if (!RATE_LIMIT_ENABLED) {
            await this.delay(STICKER_DELAY);
            return;
        }
        
        const now = Date.now();
        const lastSticker = this.stickerSendTimes.get(chatId) || 0;
        const timeDiff = now - lastSticker;
        
        if (timeDiff < STICKER_DELAY) {
            const waitTime = STICKER_DELAY - timeDiff;
            await this.delay(waitTime);
        }
        
        this.stickerSendTimes.set(chatId, Date.now());
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    cleanup() {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        for (const [key, timestamp] of this.userCooldowns.entries()) {
            if (now - timestamp > fiveMinutes) {
                this.userCooldowns.delete(key);
            }
        }
        
        for (const [key, timestamp] of this.commandTimestamps.entries()) {
            if (now - timestamp > fiveMinutes) {
                this.commandTimestamps.delete(key);
            }
        }

        // stickerSendTimes has no TTL cleanup elsewhere — clean here too
        for (const [key, timestamp] of this.stickerSendTimes.entries()) {
            if (now - timestamp > fiveMinutes) {
                this.stickerSendTimes.delete(key);
            }
        }
    }
}

const rateLimiter = new RateLimitProtection();

// ====== SECTION 16: STATUS DETECTOR ======
// Detects incoming WhatsApp Status updates (Stories) posted by contacts and
// drives the auto-react, auto-view, and auto-download-status features.
//
// A Status message arrives as a regular message in the special JID "status@broadcast".
// StatusDetector.isStatus(msg) returns true for those, letting the main
// messages.upsert handler route them to the correct automation handlers instead of
// trying to run them through the normal command pipeline.
//
// autoView   → handleAutoView()   in commands/automation/autoviewstatus.js
// autoReact  → handleAutoReact()  in commands/automation/autoreactstatus.js
// autoSave   → handleAutoDownloadStatus() in commands/automation/autodownloadstatus.js
//
// All three features are toggled independently with their respective commands
// (.autoview on/off, .autoreact on/off, .autodownload on/off).
class StatusDetector {
    constructor() {
        this.detectionEnabled = true;
        this.statusLogs = [];
        this.lastDetection = null;
        this.setupDataDir();
        this.loadStatusLogs();
        
        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
        globalThis._wolfSysStats.statusDetector = true;
    }
    
    setupDataDir() {
        try {
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data', { recursive: true });
            }
        } catch (error) {
            UltraCleanLogger.error(`Error setting up data directory: ${error.message}`);
        }
    }
    
    loadStatusLogs() {
        try {
            if (_cache_status_logs) {
                const data = _cache_status_logs;
                if (Array.isArray(data.logs)) {
                    this.statusLogs = data.logs.slice(-100);
                }
                return;
            }
            supabaseDb.getConfig('status_detection_logs', {}).then(data => {
                try {
                    _cache_status_logs = data;
                    if (data && Array.isArray(data.logs)) {
                        this.statusLogs = data.logs.slice(-100);
                    }
                } catch {}
            }).catch(() => {});
        } catch (error) {
            // Silent fail
        }
    }
    
    saveStatusLogs() {
        try {
            const data = {
                logs: this.statusLogs.slice(-1000),
                updatedAt: new Date().toISOString(),
                count: this.statusLogs.length
            };
            _cache_status_logs = data;
            supabaseDb.setConfig('status_detection_logs', data).catch(() => {});
        } catch (error) {
            // Silent fail
        }
    }
    
    async detectStatusUpdate(msg) {
        try {
            if (!this.detectionEnabled) return null;
            
            const sender = msg.key.participant || 'unknown';
            const shortSender = sender.split('@')[0];
            const timestamp = msg.messageTimestamp || Date.now();
            const statusTime = new Date(timestamp * 1000).toLocaleTimeString();
            
            const statusInfo = this.extractStatusInfo(msg);
            this.showDetectionMessage(shortSender, statusTime, statusInfo);
            
            const logEntry = {
                sender: shortSender,
                fullSender: sender,
                type: statusInfo.type,
                caption: statusInfo.caption,
                fileInfo: statusInfo.fileInfo,
                postedAt: statusTime,
                detectedAt: new Date().toLocaleTimeString(),
                timestamp: Date.now()
            };
            
            this.statusLogs.push(logEntry);
            this.lastDetection = logEntry;
            
            if (this.statusLogs.length % 5 === 0) {
                this.saveStatusLogs();
            }
            
            return logEntry;
            
        } catch (error) {
            return null;
        }
    }
    
    extractStatusInfo(msg) {
        try {
            const message = msg.message;
            let type = 'unknown';
            let caption = '';
            let fileInfo = '';
            
            if (message.imageMessage) {
                type = 'image';
                caption = message.imageMessage.caption || '';
                const size = Math.round((message.imageMessage.fileLength || 0) / 1024);
                fileInfo = `🖼️ ${message.imageMessage.width}x${message.imageMessage.height} | ${size}KB`;
            } else if (message.videoMessage) {
                type = 'video';
                caption = message.videoMessage.caption || '';
                const size = Math.round((message.videoMessage.fileLength || 0) / 1024);
                const duration = message.videoMessage.seconds || 0;
                fileInfo = `🎬 ${duration}s | ${size}KB`;
            } else if (message.audioMessage) {
                type = 'audio';
                const size = Math.round((message.audioMessage.fileLength || 0) / 1024);
                const duration = message.audioMessage.seconds || 0;
                fileInfo = `🎵 ${duration}s | ${size}KB`;
            } else if (message.extendedTextMessage) {
                type = 'text';
                caption = message.extendedTextMessage.text || '';
            } else if (message.conversation) {
                type = 'text';
                caption = message.conversation;
            } else if (message.stickerMessage) {
                type = 'sticker';
                fileInfo = '🩹 Sticker';
            }
            
            return {
                type,
                caption: caption.substring(0, 100),
                fileInfo
            };
            
        } catch (error) {
            return { type: 'unknown', caption: '', fileInfo: '' };
        }
    }
    
    getStats() {
        return {
            totalDetected: this.statusLogs.length,
            lastDetection: this.lastDetection ? 
                `${this.lastDetection.sender} - ${this.getTimeAgo(this.lastDetection.timestamp)}` : 
                'None',
            detectionEnabled: this.detectionEnabled
        };
    }
    
    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
}

let statusDetector = null;

// ====== HELPER FUNCTIONS ======
function isUserBlocked(jid) {
    try {
        const list = _cache_blocked_users?.blocked;
        if (!Array.isArray(list) || list.length === 0) return false;
        const num = jid.split(':')[0].split('@')[0];
        return list.some(entry => {
            if (entry === jid) return true;
            const entryNum = entry.split(':')[0].split('@')[0];
            return entryNum === num;
        });
    } catch {
        return false;
    }
}

globalThis.addBlockedUser = function(jid) {
    const num = jid.split(':')[0].split('@')[0];
    const canonical = `${num}@s.whatsapp.net`;
    if (!_cache_blocked_users) _cache_blocked_users = { blocked: [] };
    if (!Array.isArray(_cache_blocked_users.blocked)) _cache_blocked_users.blocked = [];
    if (!_cache_blocked_users.blocked.includes(canonical)) {
        _cache_blocked_users.blocked.push(canonical);
        _saveConfigCache('blocked_users', _cache_blocked_users);
        try { fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify(_cache_blocked_users, null, 2)); } catch {}
    }
};

globalThis.removeBlockedUser = function(jid) {
    const num = jid.split(':')[0].split('@')[0];
    if (!_cache_blocked_users || !Array.isArray(_cache_blocked_users.blocked)) return;
    _cache_blocked_users.blocked = _cache_blocked_users.blocked.filter(entry => {
        const entryNum = entry.split(':')[0].split('@')[0];
        return entryNum !== num;
    });
    _saveConfigCache('blocked_users', _cache_blocked_users);
    try { fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify(_cache_blocked_users, null, 2)); } catch {}
};

globalThis.getBotBlocklist = function() {
    return (_cache_blocked_users?.blocked || []).map(j => j.split('@')[0]);
};

function checkBotMode(msg, commandName, isSudoOverride = false) {
    try {
        if (jidManager.isOwner(msg)) {
            return true;
        }

        // if (isSudoOverride || jidManager.isSudo(msg)) {
        //     return true;
        // }

        if (isSudoOverride) {
    return true;
}

if (jidManager.isSudo(msg)) {
    return true;
}
        
        if (_cache_bot_mode) {
            BOT_MODE = _cache_bot_mode.mode || 'public';
        } else {
            BOT_MODE = 'public';
        }
        
        const chatJid = msg.key.remoteJid;
        const isGroup = chatJid.includes('@g.us');
        
        switch(BOT_MODE) {
            case 'public':
                return true;
            case 'groups':
                if (getSudoMode()) return false;
                return isGroup;
            case 'dms':
                if (getSudoMode()) return false;
                return !isGroup;
            case 'silent':
                return false;
            default:
                return true;
        }
    } catch {
        return true;
    }
}

function isPresenceEnabled() {
    try {
        const cfg = JSON.parse(fs.readFileSync('./data/presence/config.json', 'utf8'));
        return cfg?.enabled === true;
    } catch {
        return false;
    }
}

function startHeartbeat(sock) {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(() => {
        if (isConnected && sock && isPresenceEnabled()) {
            const presenceTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
            Promise.race([sock.sendPresenceUpdate('available'), presenceTimeout])
                .then(() => { lastActivityTime = Date.now(); })
                .catch(() => {});
        }
    }, 60 * 1000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function ensureSessionDir() {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
}

function cleanSession(preserveExisting = false) {
    try {
        if (preserveExisting && fs.existsSync(SESSION_DIR)) {
            const backupDir = './session_backup';
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const files = fs.readdirSync(SESSION_DIR);
            for (const file of files) {
                const source = path.join(SESSION_DIR, file);
                const dest = path.join(backupDir, file);
                fs.copyFileSync(source, dest);
            }
            UltraCleanLogger.info('📁 Existing session backed up');
        }

        // ── Wipe file-based session ─────────────────────────────────────────
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }

        // ── Wipe SESSION_HASH so next boot force-applies SESSION_ID from env ─
        const hashFile = './.session_id_hash';
        if (fs.existsSync(hashFile)) {
            try { fs.unlinkSync(hashFile); } catch {}
        }

        // ── Wipe SQLite session tables (session_creds + session_keys) ────────
        try {
            const rawDb = supabaseDb.getClient();
            try { rawDb.prepare('DELETE FROM session_keys').run(); } catch {}
            try { rawDb.prepare('DELETE FROM session_creds').run(); } catch {}
            UltraCleanLogger.info('🗑️  DB session tables cleared');
        } catch (dbErr) {
            UltraCleanLogger.warning(`DB session clear warning: ${dbErr.message}`);
        }

        if (preserveExisting) {
            const backupDir = './session_backup';
            if (fs.existsSync(backupDir)) {
                if (!fs.existsSync(SESSION_DIR)) {
                    fs.mkdirSync(SESSION_DIR, { recursive: true });
                }
                const files = fs.readdirSync(backupDir);
                for (const file of files) {
                    const source = path.join(backupDir, file);
                    const dest = path.join(SESSION_DIR, file);
                    fs.copyFileSync(source, dest);
                }
                fs.rmSync(backupDir, { recursive: true, force: true });
                UltraCleanLogger.info('📁 Session restored from backup');
            }
        }

        return true;
    } catch (error) {
        UltraCleanLogger.error(`Session cleanup error: ${error.message}`);
        return false;
    }
}

// ====== SECTION 17: MESSAGE STORE ======
// A small in-memory store that keeps the last N messages per chat so that
// quoted-reply commands (e.g. .sticker, .delete, .antidelete) can find the
// original message object that Baileys no longer sends on its own.
//
// Why it's needed:
//   When a user replies to a message, Baileys only gives you a quoted stub, not
//   the full message.  MessageStore.get(chatId, msgId) reconstructs the full
//   object from our local cache.
//
// store.messages — Map<chatId, LRU-array of recent message objects>
// store.bind(ev) — hooks into the Baileys event emitter to capture every
//                  messages.upsert and messages.update event automatically.
// store.loadMessage(chatId, id) — public helper used by command handlers.
class MessageStore {
    constructor() {
        this.messages = new Map();
        this.maxMessages = 150;
        this.sentMessages = new Map();
        this.maxSentMessages = 100;
    }
    
    addMessage(jid, messageId, message) {
        try {
            const key = `${jid}|${messageId}`;
            this.messages.set(key, message);
            
            if (this.messages.size > this.maxMessages) {
                const oldestKey = this.messages.keys().next().value;
                this.messages.delete(oldestKey);
            }
        } catch {}
    }
    
    addSentMessage(jid, messageId, messageContent) {
        try {
            const key = `${jid}|${messageId}`;
            this.sentMessages.set(key, messageContent);
            
            if (this.sentMessages.size > this.maxSentMessages) {
                const oldestKey = this.sentMessages.keys().next().value;
                this.sentMessages.delete(oldestKey);
            }
        } catch {}
    }
    
    getMessage(jid, messageId) {
        try {
            const key = `${jid}|${messageId}`;
            const msg = this.messages.get(key);
            if (msg) return msg;
            const sent = this.sentMessages.get(key);
            if (sent) return { message: sent };
            return null;
        } catch {
            return null;
        }
    }
}

// ====== SECTION 18: COMMAND LOADER ======
// commands Map  — the single registry of every command the bot knows.
//   Key:   command name string (e.g. "play", "sticker", "kick")
//   Value: { execute(sock, msg, args, extra){…}, description, aliases, category, … }
//
// commandCategories Map — groups command names by folder name (music, owner, group, …)
//   Used by the .menu command (commands/utility/menu.js) to build the category list.
//
// loadCommandsFromFolder(folderPath, category):
//   - Reads every .js file in the given commands/ sub-folder
//   - Dynamic import() loads the module and calls registerCommands() if it exists,
//     or reads the default export directly for simpler single-command files
//   - Aliases are registered alongside the primary name
//   - Called for every sub-folder at startup (see the loadAllCommands() block below)
//
// After loading, global.commandsMap = commands so any lib file can look up commands.
// Wolf AI uses this to answer questions like "what does .play do?" (lookupCommand).
const commands = new Map();
const commandCategories = new Map();

async function loadCommandsFromFolder(folderPath, category = 'general') {
    const absolutePath = path.resolve(folderPath);
    
    if (!fs.existsSync(absolutePath)) {
        return;
    }
    
    try {
        const items = fs.readdirSync(absolutePath);
        let categoryCount = 0;
        
        for (const item of items) {
            const fullPath = path.join(absolutePath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                await loadCommandsFromFolder(fullPath, item);
            } else if (item.endsWith('.js')) {
                try {
                    if (item.includes('.test.') || item.includes('.disabled.')) continue;
                    
                    const commandModule = await import(`file://${fullPath}`);
                    const command = commandModule.default || commandModule;
                    
                    if (command && command.name) {
                        command.category = category;
                        commands.set(command.name.toLowerCase(), command);
                        
                        if (!commandCategories.has(category)) {
                            commandCategories.set(category, []);
                        }
                        commandCategories.get(category).push(command.name);
                        
                        categoryCount++;
                        
                        const aliasList = Array.isArray(command.alias) ? command.alias : Array.isArray(command.aliases) ? command.aliases : [];
                        aliasList.forEach(alias => {
                            commands.set(alias.toLowerCase(), command);
                        });
                    }
                } catch {
                    // Silent fail
                }
            }
        }
        
        if (categoryCount > 0) {
            // silent — total reported after full load
        }
    } catch {
        // Silent fail
    }
}
// Add this function near the other helper functions
function checkSessionValidity() {
    try {
        const sessionPath = path.join(SESSION_DIR, 'creds.json');
        
        if (!fs.existsSync(sessionPath)) {
            return { valid: false, reason: 'No session file' };
        }
        
        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        
        // Check for required Baileys session fields
        const requiredFields = ['noiseKey', 'signedIdentityKey', 'pairingEphemeralKeyPair'];
        for (const field of requiredFields) {
            if (!sessionData[field]) {
                return { valid: false, reason: `Missing field: ${field}` };
            }
        }
        
        // Check if session is expired (older than 90 days)
        const sessionAge = Date.now() - (sessionData.registrationId || 0);
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
        
        if (sessionAge > maxAge) {
            return { valid: false, reason: 'Session expired' };
        }
        
        return { valid: true, data: sessionData };
        
    } catch (error) {
        return { valid: false, reason: `Error: ${error.message}` };
    }
}

// ====== KLAUS MD SESSION EXPORT ======
// After a successful WhatsApp pairing, encode the local creds (SQLite first,
// creds.json fallback) into a portable session ID with the KLAUS MD: prefix
// and print it as a clearly-visible banner so the user can copy/paste it
// into .env or their hosting dashboard for redeploys.
//
// We also persist it to .env (quoted, since the prefix contains a space)
// so subsequent boots auto-connect without prompting for a pair code.
async function printKlasuSessionId() {
    try {
        const db = supabaseDb.getClient?.();
        const sessionId = await exportSessionIdString(db, SESSION_DIR);
        if (!sessionId) {
            UltraCleanLogger.warning('⚠️  No creds found — skipping SESSION_ID export.');
            return;
        }

        // Print a clearly-visible banner so the user can find it in deploy logs.
        const bar = '═'.repeat(72);
        process.stdout.write('\n');
        process.stdout.write(`${bar}\n`);
        process.stdout.write(`KLAUS MD — SESSION ID (copy this entire line):\n`);
        process.stdout.write(`${bar}\n`);
        process.stdout.write(`SESSION_ID=${sessionId}\n`);
        process.stdout.write(`${bar}\n\n`);

        // Persist to .env (quoted — the space in "KLAUS MD:" breaks bash
        // `source .env` and dotenv strict-mode parsing if unquoted).
        try {
            const envPath = path.join(process.cwd(), '.env');
            let envContent = '';
            try { envContent = fs.readFileSync(envPath, 'utf8'); } catch {}
            const line = `SESSION_ID="${sessionId}"`;
            const regex = /^SESSION_ID=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, line);
            } else {
                envContent = envContent.trimEnd() + '\n' + line + '\n';
            }
            fs.writeFileSync(envPath, envContent, 'utf8');
            process.env.SESSION_ID = sessionId;
            UltraCleanLogger.success('💾 SESSION_ID saved to .env (quoted for shell safety).');
        } catch (envErr) {
            UltraCleanLogger.warning(`⚠️  Could not write .env: ${envErr.message}`);
        }
    } catch (err) {
        UltraCleanLogger.error(`❌ Failed to export SESSION_ID: ${err.message}`);
    }
}

// ====== SESSION ID PARSER ======
function parseWolfBotSession(sessionString) {
    try {
        let cleanedSession = sessionString.trim();
        
        cleanedSession = cleanedSession.replace(/^["']|["']$/g, '');
        
        // Accept the KLAUS MD: prefix only (legacy prefix removed by user request).
        const SUPPORTED_PREFIXES = ['KLAUS MD:'];
        const matchedPrefix = SUPPORTED_PREFIXES.find(p => cleanedSession.startsWith(p));
        if (matchedPrefix) {
            UltraCleanLogger.info(`🔍 Detected ${matchedPrefix} prefix`);
            let base64Part = cleanedSession.substring(matchedPrefix.length).trim();
            
            base64Part = base64Part.replace(/^~+/, '');
            
            if (!base64Part) {
                throw new Error(`No data found after ${matchedPrefix}`);
            }
            
            try {
                const decodedString = Buffer.from(base64Part, 'base64').toString('utf8');
                return JSON.parse(decodedString);
            } catch (base64Error) {
                return JSON.parse(base64Part);
            }
        }
        
        try {
            const decodedString = Buffer.from(cleanedSession, 'base64').toString('utf8');
            return JSON.parse(decodedString);
        } catch (base64Error) {
            return JSON.parse(cleanedSession);
        }
    } catch (error) {
        UltraCleanLogger.error('❌ Failed to parse session:', error.message);
        return null;
    }
}


// ====== HEROKU SESSION HANDLING ======
function setupHerokuSession() {
    try {
        // Check if running on Heroku with SESSION_ID env var
        const herokuSessionId = process.env.SESSION_ID;
        
        if (herokuSessionId && herokuSessionId.trim() !== '') {
            UltraCleanLogger.success('🚀 Detected Heroku deployment with SESSION_ID');
            
            // Parse KLAUS MD session format
            const SESSION_PREFIXES = ['KLAUS MD:'];
            const matchedPrefix = SESSION_PREFIXES.find(p => herokuSessionId.startsWith(p));
            if (matchedPrefix) {
                UltraCleanLogger.info(`🔐 Processing ${matchedPrefix} session format...`);
                
                try {
                    // Remove the prefix and decode
                    const base64Part = herokuSessionId.substring(matchedPrefix.length).trim().replace(/^~+/, '');
                    const decodedSession = Buffer.from(base64Part, 'base64').toString('utf8');
                    const sessionData = JSON.parse(decodedSession);
                    
                    // Save to session directory
                    ensureSessionDir();
                    const sessionPath = path.join(SESSION_DIR, 'creds.json');
                    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
                    
                    UltraCleanLogger.success(`💾 Heroku session saved to: ${sessionPath}`);
                    
                    // Set flag to skip login prompts
                    process.env.HEROKU_DEPLOYMENT = 'true';
                    process.env.AUTO_START = 'true';
                    
                    return true;
                    
                } catch (error) {
                    UltraCleanLogger.error(`❌ Failed to parse Heroku session: ${error.message}`);
                    return false;
                }
            } else {
                UltraCleanLogger.info('🔐 Processing raw session string...');
                
                try {
                    // Try direct JSON parsing
                    const sessionData = JSON.parse(herokuSessionId);
                    
                    // Save to session directory
                    ensureSessionDir();
                    const sessionPath = path.join(SESSION_DIR, 'creds.json');
                    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
                    
                    UltraCleanLogger.success(`💾 Heroku session saved to: ${sessionPath}`);
                    
                    process.env.HEROKU_DEPLOYMENT = 'true';
                    process.env.AUTO_START = 'true';
                    
                    return true;
                    
                } catch (jsonError) {
                    UltraCleanLogger.warning(`JSON parse failed, trying base64: ${jsonError.message}`);
                    
                    try {
                        // Try base64 decoding
                        const decodedSession = Buffer.from(herokuSessionId, 'base64').toString('utf8');
                        const sessionData = JSON.parse(decodedSession);
                        
                        ensureSessionDir();
                        const sessionPath = path.join(SESSION_DIR, 'creds.json');
                        fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
                        
                        UltraCleanLogger.success(`💾 Heroku session saved (base64): ${sessionPath}`);
                        
                        process.env.HEROKU_DEPLOYMENT = 'true';
                        process.env.AUTO_START = 'true';
                        
                        return true;
                        
                    } catch (base64Error) {
                        UltraCleanLogger.error(`❌ All Heroku session parsing attempts failed`);
                        return false;
                    }
                }
            }
        }
        
        return false;
        
    } catch (error) {
        UltraCleanLogger.error(`Heroku setup error: ${error.message}`);
        return false;
    }
}


// ====== HEROKU HEALTH CHECK ======
function setupHerokuHealthCheck() {
    // Health check is fully handled by lib/webServer.js (PORT-aware, ESM-safe).
    // No duplicate server needed here.
    UltraCleanLogger.info('🌐 Health check endpoint served by webServer.js — no duplicate server needed');
}

// ====== HEROKU KEEP-ALIVE ======
function setupHerokuKeepAlive() {
    // process.env.DYNO is set automatically by Heroku; HEROKU must be added manually
    const onHeroku = !!(process.env.HEROKU || process.env.DYNO);
    if (onHeroku) {
        UltraCleanLogger.info('🔧 Setting up Heroku keep-alive system...');
        
        // Auto-restart prevention
        let restartCount = 0;
        const maxDailyRestarts = 5;
        
        // Periodic activity to prevent sleeping
        setInterval(() => {
            lastActivityTime = Date.now();
            const appUrl = process.env.HEROKU_URL || process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
            if (appUrl) {
                fetch(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`, { signal: AbortSignal.timeout(10000) })
                    .catch(() => {});
            }
        }, 20 * 60 * 1000); // Every 20 minutes
        
        // Memory monitoring for Heroku
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
            
            if (memoryMB > 300) {
                UltraCleanLogger.warning(`⚠️ High memory usage: ${memoryMB}MB`);
                memoryMonitor.trimCaches(memoryMB > 400);
                if (global.gc) {
                    setImmediate(() => {
                        try { global.gc({ type: 'minor' }); } catch { try { global.gc(); } catch {} }
                    });
                }
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }
}

async function authenticateWithSessionId(sessionId) {
    try {
        UltraCleanLogger.info('🔄 Processing Session ID...');
        
        const sessionData = parseWolfBotSession(sessionId);
        
        if (!sessionData) {
            throw new Error('Could not parse session data');
        }
        
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            UltraCleanLogger.info('📁 Created session directory');
        }
        
        const filePath = path.join(SESSION_DIR, 'creds.json');
        
        fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
        UltraCleanLogger.success('💾 Session saved to session/creds.json');
        
        try {
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                if (!envContent.includes('SESSION_ID=')) {
                    // Quote the value — the KLAUS MD: prefix contains a space,
                    // which would break bash `source .env` if left unquoted.
                    fs.appendFileSync(envPath, `\nSESSION_ID="${sessionId}"\n`);
                    UltraCleanLogger.info('📝 Added SESSION_ID to .env file');
                }
            }
        } catch (envError) {
            // Ignore .env errors
        }
        
        return true;
        
    } catch (error) {
        UltraCleanLogger.error('❌ Session authentication failed:', error.message);
        throw error;
    }
}

// ====== LOGIN MANAGER ======
class LoginManager {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    
    async selectMode() {
        globalThis._wolfStartupPhase = false; // release so login prompts show
        printWolfBootSequence();

        const N = '\x1b[38;2;0;255;156m';
        const B = '\x1b[38;2;34;193;255m';
        const Y = '\x1b[38;2;250;204;21m';
        const D = '\x1b[2m\x1b[38;2;100;120;130m';
        const W = '\x1b[38;2;200;215;225m';
        const R = '\x1b[0m';
        const t = _getTime();

        process.stdout.write(`\n${N}┌────────〔 🧠 SYSTEM LOG 〕────────┐${R}\n\n`);
        process.stdout.write(`${B}[KLAUS-AUTH]${R} ${D}⏱️  ${t}${R}\n`);
        process.stdout.write(`${N}◆ 01 ${D}→${R} ${W}Pairing Code Login     ${Y}⟪Recommended⟫${R}\n`);
        process.stdout.write(`${N}◆ 02 ${D}→${R} ${W}Clean Session Reset    ${Y}⟪Fresh Boot⟫${R}\n`);
        process.stdout.write(`${N}◆ 03 ${D}→${R} ${W}ENV Session Injection  ${Y}⟪Advanced⟫${R}\n\n`);
        process.stdout.write(`${Y}⚡ INPUT REQUIRED ▸ Select [1-3] ⟶ (default: 1): ${R}`);

        const choice = await this.ask('');
        
        switch (choice.trim()) {
            case '1':
                return await this.pairingCodeMode();
            case '2':
                return await this.cleanStartMode();
            case '3':
                return await this.sessionIdMode();
            default:
                return await this.pairingCodeMode();
        }
    }
    
    async sessionIdMode() {
        const N   = '\x1b[38;2;0;255;156m';
        const MAG = '\x1b[38;2;180;0;255m';
        const MB  = '\x1b[1m\x1b[38;2;180;0;255m';
        const Y   = '\x1b[38;2;250;204;21m';
        const RED = '\x1b[38;2;255;60;80m';
        const D   = '\x1b[2m\x1b[38;2;100;120;130m';
        const W   = '\x1b[38;2;200;215;225m';
        const R   = '\x1b[0m';
        const t   = () => _getTime();

        process.stdout.write(`\n${MB}════════〔 🔐 SESSION ID LOGIN 〕════════${R}\n\n`);
        process.stdout.write(`${MAG}[KLAUS-AUTH]${R} ${D}⏱️  ${t()}${R}\n`);

        let sessionId = process.env.SESSION_ID;

        if (!sessionId || sessionId.trim() === '') {
            process.stdout.write(`${Y}▸ ℹ️  No SESSION_ID found in environment${R}\n\n`);
            process.stdout.write(`${N}◆ 01 ${D}→${R} ${W}Paste Session ID now${R}\n`);
            process.stdout.write(`${N}◆ 02 ${D}→${R} ${W}Go back to main menu${R}\n\n`);
            process.stdout.write(`${Y}⚡ Choose [1-2] ⟶ ${R}`);

            const input = await this.ask('');

            if (input.trim() === '1') {
                process.stdout.write(`\n${MAG}[KLAUS-AUTH]${R} ${D}⏱️  ${t()}${R}\n`);
                process.stdout.write(`${Y}⚡ Paste Session ID ⟶ ${R}`);
                sessionId = await this.ask('');
                if (!sessionId || sessionId.trim() === '') {
                    process.stdout.write(`\n${RED}▸ ❌ No Session ID provided${R}\n\n`);
                    return await this.selectMode();
                }
                process.stdout.write(`\n${N}▸ ✅ Session ID received${R}\n\n`);
            } else {
                return await this.selectMode();
            }
        } else {
            process.stdout.write(`${N}▸ ✅ Found Session ID in environment${R}\n\n`);
            process.stdout.write(`${Y}⚡ Use existing Session ID? (y/n, default y) ⟶ ${R}`);
            const proceed = await this.ask('');
            if (proceed.toLowerCase() === 'n') {
                process.stdout.write(`${Y}⚡ Enter new Session ID ⟶ ${R}`);
                const newSessionId = await this.ask('');
                if (newSessionId && newSessionId.trim() !== '') {
                    sessionId = newSessionId;
                    process.stdout.write(`\n${N}▸ ✅ Session ID updated${R}\n\n`);
                }
            }
        }

        process.stdout.write(`\n${MAG}[KLAUS-AUTH]${R} ${D}⏱️  ${t()}${R}\n`);
        process.stdout.write(`${N}▸ 🔄 Processing session ID...${R}\n\n`);
        try {
            await authenticateWithSessionId(sessionId);
            return { mode: 'session', sessionId: sessionId.trim() };
        } catch (error) {
            process.stdout.write(`${RED}▸ ❌ Session authentication failed${R}\n`);
            process.stdout.write(`${Y}▸ 📡 Falling back to pairing code...${R}\n\n`);
            return await this.pairingCodeMode();
        }
    }
    
    async pairingCodeMode() {
        const N  = '\x1b[38;2;0;255;156m';
        const NB = '\x1b[1m\x1b[38;2;0;255;156m';
        const B  = '\x1b[38;2;34;193;255m';
        const BB = '\x1b[1m\x1b[38;2;34;193;255m';
        const Y  = '\x1b[38;2;250;204;21m';
        const D  = '\x1b[2m\x1b[38;2;100;120;130m';
        const W  = '\x1b[38;2;200;215;225m';
        const R  = '\x1b[0m';
        const t  = _getTime();

        process.stdout.write(`\n${BB}════════〔 📱 PAIRING CODE LOGIN 〕════════${R}\n\n`);
        process.stdout.write(`${B}[KLAUS-AUTH]${R} ${D}⏱️  ${t}${R}\n`);
        process.stdout.write(`${N}▸ ${W}Enter phone number with country code ${D}(without +)${R}\n`);
        process.stdout.write(`${N}▸ ${D}Example: ${W}254788710904${R}\n\n`);
        process.stdout.write(`${Y}⚡ Phone number ⟶ ${R}`);

        const phone = await this.ask('');
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        if (!cleanPhone || cleanPhone.length < 10) {
            process.stdout.write(`\n${'\x1b[38;2;255;60;80m'}▸ ❌ Invalid phone number — try again${R}\n\n`);
            return await this.selectMode();
        }

        return { mode: 'pair', phone: cleanPhone };
    }

    async cleanStartMode() {
        const N  = '\x1b[38;2;0;255;156m';
        const Y  = '\x1b[38;2;250;204;21m';
        const YB = '\x1b[1m\x1b[38;2;250;204;21m';
        const RED = '\x1b[38;2;255;60;80m';
        const D  = '\x1b[2m\x1b[38;2;100;120;130m';
        const W  = '\x1b[38;2;200;215;225m';
        const R  = '\x1b[0m';
        const t  = _getTime();

        process.stdout.write(`\n${YB}════════〔 ⚠️  CLEAN SESSION RESET 〕════════${R}\n\n`);
        process.stdout.write(`${YB}[KLAUS-AUTH]${R} ${D}⏱️  ${t}${R}\n`);
        process.stdout.write(`${RED}▸ ⚠️  This will delete ALL session data!${R}\n\n`);
        process.stdout.write(`${Y}⚡ Confirm reset? (y/n) ⟶ ${R}`);

        const confirm = await this.ask('');

        if (confirm.toLowerCase() === 'y') {
            cleanSession();
            process.stdout.write(`\n${N}▸ ✅ Session purged — initiating fresh boot...${R}\n\n`);
            return await this.pairingCodeMode();
        } else {
            return await this.pairingCodeMode();
        }
    }
    
    ask(question) {
        return new Promise((resolve) => {
            const prompt = question === '' ? '' : chalk.yellow(question);
            this.rl.question(prompt, (answer) => {
                resolve(answer);
            });
        });
    }
    
    close() {
        if (this.rl) this.rl.close();
    }
}

// ====== TERMINAL HEADER UPDATE ======
function updateTerminalHeader() {
    console.clear();
}

let _dbInitReady = false;

function printWolfBootSequence() {
    const N  = '\x1b[38;2;0;255;156m';
    const NB = '\x1b[1m\x1b[38;2;0;255;156m';
    const ND = '\x1b[2m\x1b[38;2;0;255;156m';
    const Y  = '\x1b[38;2;250;204;21m';
    const YB = '\x1b[1m\x1b[38;2;250;204;21m';
    const D  = '\x1b[2m\x1b[38;2;100;120;130m';
    const R  = '\x1b[0m';
    const filled = '█';
    const empty  = '░';
    const bar = (n, tot = 16) => `${N}${filled.repeat(n)}${D}${empty.repeat(tot - n)}${R}`;

    process.stdout.write(`\n${YB}▣ KLAUS MD BOOT SEQUENCE INITIATED...${R}\n`);
    process.stdout.write(`  ${bar(7)}  ${Y}45%${R}\n`);
    process.stdout.write(`  ${bar(13)} ${Y}85%${R}\n`);
    process.stdout.write(`  ${bar(16)} ${Y}100%${R}\n`);
    process.stdout.write(`  ${NB}▸ CORE ONLINE ✓${R}\n\n`);
}

function printStartupBox() {
    const prefixDisplay = isPrefixless ? 'none' : `"${getCurrentPrefix()}"`;
    const modeDisplay   = isPrefixless ? 'Prefixless' : 'Prefix';
    const dbEngine      = isUsingWasm() ? 'WASM' : 'native';
    const dbDisplay     = _dbInitReady  ? `ready (${dbEngine})` : 'unavailable';

    const vlen = (s) => {
        let n = 0;
        for (const ch of [...s]) {
            const cp = ch.codePointAt(0);
            n += (cp > 0xFFFF || (cp >= 0x1F000 && cp <= 0x1FFFF)) ? 2 : 1;
        }
        return n;
    };

    const palette = ['\x1b[96m', '\x1b[36m', '\x1b[32m', '\x1b[92m', '\x1b[96m', '\x1b[36m'];
    const R = '\x1b[0m';
    const B = '\x1b[1m';
    let ci = 0;
    const c = () => palette[ci++ % palette.length];

    const INNER = 36;
    const bar   = '─'.repeat(INNER + 2);
    const pad   = (s) => s + ' '.repeat(Math.max(0, INNER - vlen(s)));

    const row = (text, bold) => {
        const col = c();
        const content = bold ? `${B}${pad(text)}${R}` : pad(text);
        return `${col}│${R}  ${content}  ${col}│${R}`;
    };

    const lines = [
        `${c()}╭${bar}╮${R}`,
        row(` ${getCurrentBotName()} v${VERSION}`, true),
        `${c()}├${bar}┤${R}`,
        row(`Prefix : ${prefixDisplay}   Mode: ${modeDisplay}`),
        row(`SQLite : ${dbDisplay}`),
        row(`Status : all systems ready ✓`),
        `${c()}╰${bar}╯${R}`,
    ];
    process.stdout.write('\n' + lines.join('\n') + '\n\n');
}

function printConnectionBox(botName) {
    const R = '\x1b[0m';
    const W = '\x1b[1m\x1b[38;2;0;255;65m';
    const c = () => '\x1b[38;2;0;255;65m';

    const vlen = (s) => {
        let n = 0;
        for (const ch of [...s]) {
            const cp = ch.codePointAt(0);
            n += (cp > 0xFFFF || (cp >= 0x1F000 && cp <= 0x1FFFF)) ? 2 : 1;
        }
        return n;
    };
    const W_INNER = 26;
    const bar = '─'.repeat(W_INNER + 2);
    const pad = (s) => s + ' '.repeat(Math.max(0, W_INNER - vlen(s)));
    const G = '\x1b[38;2;0;255;65m';
    const row = (text, bold) => {
        const col = c();
        const inner = bold
            ? `${W} ${pad(text)} ${R}`
            : `${G} ${pad(text)} ${R}`;
        return `${col}│${R}${inner}${col}│${R}`;
    };

    const name = botName || 'WolfBot';
    const lines = [
        `${c()}╭${bar}╮${R}`,
        row(` ${name} — CONNECTED`, true),
        `${c()}├${bar}┤${R}`,
        row(`✅ WhatsApp connected`),
        row(`✅ Sudo initialized`),
        row(`✅ Auto-connect triggered`),
        row(`✅ Auto-fix dispatched`),
        row(`✅ Ultimate Fix applied`),
        row(`✅ Read receipts enabled`),
        row(`✅ Owner notified`),
        row(`✅ Memory monitor active`),
        row(`✅ Anti-delete ready`),
        `${c()}╰${bar}╯${R}`,
    ];
    process.stdout.write('\n' + lines.join('\n') + '\n\n');
}

// ── Wolf Startup Block ──────────────────────────────────────────────────────
// Prints ONE consolidated status block at connection time, replacing all the
// individual startup log entries. Called from handleConnectionOpen().
function printWolfStartupBlock({ botName, version, platform, prefix, mode,
    ownerNumber, commandCount, sqliteDriver, isReconnect }) {

    const NB  = '\x1b[1m\x1b[38;2;0;255;156m';
    const N   = '\x1b[38;2;0;255;156m';
    const Y   = '\x1b[38;2;250;204;21m';
    const B   = '\x1b[38;2;34;193;255m';
    const D   = '\x1b[2m\x1b[38;2;100;120;130m';
    const W   = '\x1b[38;2;200;215;225m';
    const OK  = '\x1b[38;2;0;230;118m';
    const OFF = '\x1b[38;2;255;80;80m';
    const R   = '\x1b[0m';

    const ks    = getKeyStatus();
    const dbOk  = ks.dbStatus.includes('✅');
    const ptOk  = ks.pteroStatus.includes('✅');
    const pyOk  = ks.paystackStatus.includes('✅');
    const pgOk  = !!(globalThis.pg?.isReady);
    const pgTbl = globalThis.pg?.tableCount || 0;
    const time  = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const status = isReconnect ? 'RECONNECTED' : 'ONLINE';

    const INNER = 38;
    const dashStr = (n) => '─'.repeat(Math.max(0, n));

    // Top border — centred title like KLAUS MD CONTROL CORE
    const title = `〔  ${botName} v${version} · ${status} 〕`;
    const tlen  = title.length; // JS length (close enough for centering)
    const lpad  = Math.floor((INNER - tlen) / 2);
    const rpad  = INNER - lpad - tlen + 2;
    const top   = `${NB}┌${dashStr(lpad)}${title}${dashStr(rpad)}┐${R}`;
    const bot   = `${NB}└${dashStr(INNER + 2)}┘${R}`;
    const div   = `  ${D}${dashStr(INNER + 2)}${R}`;

    // Label rows — same style as KLAUS MD CONTROL CORE
    const DOT = `${N}▣${R}`;
    const row = (label, val, col) => {
        const labelW = 14;
        const pad = ' '.repeat(Math.max(0, labelW - label.length));
        return `  ${DOT}  ${D}${label}${pad}${R}${N}:${R} ${col || W}${val}${R}`;
    };

    const flag = (on) => on ? `${OK}on${R}` : `${OFF}off${R}`;
    const avail = (ok, yes, no) => ok ? `${OK}${yes}${R}` : `${OFF}${no || 'not set'}${R}`;

    // Progress bar — full 100%
    const BAR = 20;
    const barFill = `${N}${'█'.repeat(BAR)}${R}`;
    const barLine = `  ${barFill}  ${Y}100%${R}  ${NB}▸  ALL SYSTEMS ONLINE ✓${R}`;

    const out = [
        '',
        top,
        row('Platform',  platform),
        row('Time',      time),
        row('Prefix',    prefix || 'none'),
        row('Mode',      mode),
        row('Owner',     '+' + ownerNumber),
        row('Commands',  commandCount),
        row('SQLite',    `ready (${sqliteDriver})`),
        div,
        row('Database',    avail(dbOk,  'set', 'not set'),   ''),
        row('PostgreSQL',  avail(pgOk,  pgTbl ? `connected · ${pgTbl} tables` : 'connected',
            process.env.DATABASE_URL
                ? `failed · ${(globalThis.pg?.lastError || 'unknown error').slice(0, 40)}`
                : 'not set'), ''),
        row('Pterodactyl', avail(ptOk,  'set', 'not set'),   ''),
        row('Paystack',    avail(pyOk,  'set', 'not set'),   ''),
        div,
        // ── Automation feature toggles (unified mini-table) ─────────────────
        ...(() => {
            // Read a boolean toggle — defaultVal used when key absent from DB
            const featBool = (key, defaultVal = false) => {
                try {
                    const v = getConfigSync(key, null);
                    if (v === null || v === undefined) return defaultVal;
                    if (typeof v === 'boolean') return v;
                    if (typeof v === 'object') return !!(v.enabled);
                    return v === true || v === 'true' || v === 1;
                } catch { return defaultVal; }
            };

            // Auto-View and Auto-React default ON — check live managers first
            const avOn = (() => {
                try { return !!autoViewManager?.getStats?.()?.enabled; } catch {}
                return featBool('autoview_config', true);
            })();
            const arOn = (() => {
                if (globalThis._autoReactManager)
                    return !!globalThis._autoReactManager.config?.enabled;
                return featBool('autoreact_config', true);
            })();

            const rdOn = featBool('autoread_config');
            const prOn = featBool('presence_config');
            const tyOn = featBool('autotyping_config');
            const rcOn = featBool('autorecording_config');
            const crOn = featBool('channelreact_config');
            const dlOn = featBool('autodownload_status_config');
            const mmOn = featBool('music_mode');
            let   bmOn = false;
            try { bmOn = isButtonModeEnabled(); } catch {}

            let adOn = true;
            try {
                const adEnabled = getConfigSync('antidelete_status_enabled', false);
                adOn = adEnabled === true || adEnabled === 'true' || adEnabled === 1;
            } catch {}

            const LW  = 11; // label column width
            const pip = (x) => x ? `${OK}●ON ${R}` : `${OFF}○OFF${R}`;

            // Mini-table with │ borders on all four sides
            const TW   = 40;
            const tTop = `  ${D}┌─── Toggles ${'─'.repeat(TW - 13)}┐${R}`;
            const tBot = `  ${D}└${'─'.repeat(TW)}┘${R}`;
            const tRow = (l1, v1, l2, v2) => {
                const p1 = ' '.repeat(Math.max(0, LW - l1.length));
                const p2 = ' '.repeat(Math.max(0, LW - l2.length));
                const c1 = `${D}${l1}${R}${D}${p1}${R} ${pip(v1)}`;
                const c2 = `${D}${l2}${R}${D}${p2}${R} ${pip(v2)}`;
                return `  ${D}│${R} ${c1} ${D}│${R} ${c2} ${D}│${R}`;
            };

            return [
                tTop,
                tRow('Auto-View',  avOn, 'Auto-React',  arOn),
                tRow('Auto-Read',  rdOn, 'Presence',    prOn),
                tRow('Auto-Type',  tyOn, 'Auto-Record', rcOn),
                tRow('Chan-React', crOn, 'Auto-Save',   dlOn),
                tRow('Music Mode', mmOn, 'Btn Mode',    bmOn),
                tRow('Antidel-St', adOn, 'Anti-Delete', true),
                tBot,
            ];
        })(),
        div,
        ...((() => {
            const s   = globalThis._wolfSysStats || {};
            const on  = (v) => v ? `${OK}✔ ready${R}` : `${OFF}✘ pending${R}`;
            const num = (n, unit) => `${W}${n ?? 0} ${unit}${R}`;
            const txt = (v, fallback) => v ? `${W}${v}${R}` : `${D}${fallback || 'pending'}${R}`;

            // antidelete status — read from SQLite for accuracy
            let adLabel;
            try {
                const adEnabled = getConfigSync('antidelete_status_enabled', false);
                const adMode    = getConfigSync('antidelete_status_mode', 'private');
                const adOn = adEnabled === true || adEnabled === 'true' || adEnabled === 1;
                adLabel = `${adOn ? OK : OFF}${adOn ? 'ON' : 'OFF'} (${String(adMode).toUpperCase()})${R}`;
            } catch { adLabel = `${D}pending${R}`; }

            // Auth State
            const auth = s.authState;
            const authLabel = auth
                ? `${auth.registered ? OK : Y}${auth.registered ? 'Registered' : 'Unregistered'}${R}  ${D}·${R}  ${W}${auth.keys}k${R}`
                : `${D}pending${R}`;

            // VV module
            const vv = s.vvModule;
            const vvLabel = vv
                ? `${OK}✔ ready${R}  ${D}·${R}  ${W}${vv.storage}${R}`
                : `${OFF}✘ not loaded${R}`;

            // VV2 module
            const vv2 = s.vv2Module;
            const vv2Label = vv2
                ? `${OK}✔ stealth${R}  ${D}·${R}  ${W}silent:${R} ${vv2.silent ? OK + 'ON' : OFF + 'OFF'}${R}`
                : `${OFF}✘ not loaded${R}`;

            // Menu media
            const mmLabel = s.menuMedia === undefined ? `${D}pending${R}`
                : s.menuMedia ? `${OK}✔ media${R}`
                : `${Y}text-only${R}`;

            return [
                // ── Connection & auth ─────────────────────
                row('Auth State',     authLabel),
                // ── Core modules ──────────────────────────
                row('JID Manager',    on(s.jidManager)),
                row('Status Reply',   on(s.statusReply)),
                row('QuickConnect',   txt(s.quickConnect, 'pending')),
                row('Disk Manager',   s.diskManager ? `${OK}✔ ACTIVE${R}` : `${OFF}✘ inactive${R}`),
                row('Scheduler',      txt(s.schedulerEAT, 'pending')),
                // ── Media modules ─────────────────────────
                row('Menu Media',     mmLabel),
                // ── Feature data ──────────────────────────
                row('Status Antidel', adLabel),
                row('Member Groups',  num(s.memberGroups ?? 0, 'groups tracked')),
                // ── Game engines ──────────────────────────
                row('Coinflip',       num(s.coinflipUsers ?? 0, 'users') + `  ${D}·${R}  ${num(s.coinflipBets ?? 0, 'bets')}`),
                row('RPS',            num(s.rpsPlayers    ?? 0, 'players')),
                row('Snake',          num(s.snakePlayers  ?? 0, 'players')),
                row('Tetris',         num(s.tetrisPlayers ?? 0, 'players')),
            ];
        })()),
        div,
        barLine,
        bot,
        '',
    ];

    process.stdout.write(out.join('\n') + '\n');
}

// Initialize with loaded prefix
prefixCache = loadPrefixFromFiles();
isPrefixless = prefixCache === '' ? true : false;
updateTerminalHeader();

// ====== DATABASE INIT ======
async function initDatabase() {
    await supabaseDb.initTables();
    _dbInitReady = true;

    // ── PostgreSQL → SQLite restore (Heroku ephemeral filesystem fix) ─────
    // On Heroku every dyno restart wipes data/bot.sqlite AND
    // data/critical_backup.json.  Wait up to 12 s for pg to connect, then
    // pull all persisted settings back into the fresh SQLite DB before any
    // other startup code reads from it.  Safe on all platforms — INSERT OR
    // IGNORE means existing rows are never clobbered.
    try {
        const pgReady = await pg.waitForReady(12000);
        if (pgReady) {
            // ── Auto-detect botId from pg on cold restarts ────────────────
            // On platforms with ephemeral filesystems (Heroku, Railway, etc.)
            // last_bot_id.json is wiped on every restart, leaving configBotId
            // as 'default'.  Without knowing the real phone-number botId we
            // cannot restore the correct rows.  We saved the phone under
            // bot_id='default', key='__bot_phone__' when the bot first
            // connected, so we can read it back here before restoring.
            if (supabaseDb.getConfigBotId() === 'default' && !process.env.OWNER_NUMBER) {
                try {
                    const _phoneRow = await pg.query(
                        `SELECT value FROM bot_configs WHERE bot_id = $1 AND key = $2 LIMIT 1`,
                        ['default', '__bot_phone__']
                    );
                    if (_phoneRow?.rows?.[0]?.value) {
                        const _detectedPhone = String(_phoneRow.rows[0].value).replace(/[^0-9]/g, '');
                        if (_detectedPhone.length >= 7) {
                            supabaseDb.setConfigBotId(_detectedPhone);
                            console.log(`[PG→SQLite] 🔍 Auto-detected botId from pg: ${_detectedPhone}`);
                        }
                    }
                } catch {}
            }
            const _pgR = await restoreFromPg();
            if (_pgR?.restored > 0) {
                console.log(`[PG→SQLite] ♻️  Restored ${_pgR.restored} rows from PostgreSQL`);
            }
        } else if (process.env.DATABASE_URL) {
            console.warn('[PG→SQLite] pg did not become ready within 12 s — skipping restore');
        }
    } catch (_pgErr) {
        console.warn(`[PG→SQLite] Restore skipped: ${_pgErr.message}`);
    }

    // ── MySettings restore ────────────────────────────────────────────────
    // DB is now ready. Restore every tracked setting (file + DB) from
    // ./mysettings.json BEFORE migrations and config-cache loads run, so
    // the rest of startup sees the operator's persisted values. On first
    // run (no file yet) this snapshots current state instead.
    try {
        const _ms = await mySettings.init({ db: supabaseDb, pg: globalThis.pg });
        if (_ms.restored > 0) {
            console.log(`[MySettings] Restored ${_ms.restored}/${_ms.total} settings from mysettings.json`);
        } else {
            console.log(`[MySettings] Initialised — snapshot file: ${_ms.file}`);
        }
    } catch (_err) {
        console.warn(`[MySettings] init failed: ${_err.message}`);
    }

    try {
        const { loadBotName } = await import('./lib/botname.js');
        const name = loadBotName();
        if (name) { BOT_NAME = name; global.BOT_NAME = name; }
    } catch {}
    await runDataMigrations();
    return true;
}

async function runDataMigrations() {
    try {
        await initSudo();
        await migrateSudoToSupabase();
        await migrateWarningsToSupabase();

        const configFiles = [
            { file: './bot_mode.json', key: 'bot_mode' },
            { file: './bot_settings.json', key: 'bot_settings' },
            { file: './prefix_config.json', key: 'prefix_config' },
            { file: './owner.json', key: 'owner_data' },
            { file: './whitelist.json', key: 'whitelist' },
            { file: './blocked_users.json', key: 'blocked_users' },
            { file: './data/welcome_data.json', key: 'welcome_data' },
            { file: './data/autoViewConfig.json', key: 'autoview_config' },
            { file: './data/autoReactConfig.json', key: 'autoreact_config' },
            { file: './data/channelReactConfig.json', key: 'channelreact_config' },
            { file: './data/autoDownloadStatusConfig.json', key: 'autodownload_status_config' },
            { file: './data/presence/config.json', key: 'presence_config' },
            { file: './data/autotyping/config.json', key: 'autotyping_config' },
            { file: './data/autorecording/config.json', key: 'autorecording_config' },
            { file: './data/member_detection.json', key: 'member_detection' },
            { file: './data/status_detection_logs.json', key: 'status_detection_logs' },
            { file: './data/anticall.json', key: 'anticall_config' },
            { file: './anticall.json', key: 'anticall_config_root' },
            { file: './autoread_settings.json', key: 'autoread_config' },
            { file: './disp_settings.json', key: 'disp_config' },
            { file: './data/footer.json', key: 'footer_config' },
        ];

        for (const { file, key } of configFiles) {
            await supabaseDb.migrateJSONToConfig(file, key);
        }

        _cache_owner_data = await _loadConfigCache('owner_data', {});
        _cache_prefix_config = await _loadConfigCache('prefix_config', { prefix: DEFAULT_PREFIX });
        try {
            const _filePfx2 = JSON.parse(fs.readFileSync(PREFIX_CONFIG_FILE, 'utf8'));
            const _dbMs2   = new Date(_cache_prefix_config?.setAt || 0).getTime();
            const _fileMs2 = _filePfx2?.timestamp || new Date(_filePfx2?.setAt || 0).getTime();
            if (_filePfx2 && _filePfx2.prefix !== undefined && _fileMs2 >= _dbMs2) {
                _cache_prefix_config = _filePfx2;
                supabaseDb.setConfig('prefix_config', _filePfx2).catch(() => {});
            }
        } catch {}
        _cache_bot_settings = await _loadConfigCache('bot_settings', {});
        _cache_bot_mode = await _loadConfigCache('bot_mode', { mode: process.env.BOT_MODE || 'public' });
        try {
            const _fileBm2 = JSON.parse(fs.readFileSync('./bot_mode.json', 'utf8'));
            const _dbBmMs2   = new Date(_cache_bot_mode?.setAt || 0).getTime();
            const _fileBmMs2 = new Date(_fileBm2?.setAt || 0).getTime();
            if (_fileBm2 && _fileBm2.mode && _fileBmMs2 >= _dbBmMs2) {
                _cache_bot_mode = _fileBm2;
                supabaseDb.setConfig('bot_mode', _fileBm2).catch(() => {});
            }
        } catch {}
        _cache_whitelist = await _loadConfigCache('whitelist', { whitelist: [] });
        _cache_blocked_users = await _loadConfigCache('blocked_users', { blocked: [] });
        _cache_welcome_data = await _loadConfigCache('welcome_data', {});
        _cache_status_logs = await _loadConfigCache('status_detection_logs', {});
        _cache_member_detection = await _loadConfigCache('member_detection', {});

        // If bot_mode came back as an empty object (stale DB row), prefer .env over hardcoded default.
        if (_cache_bot_mode && !_cache_bot_mode.mode) _cache_bot_mode = { mode: process.env.BOT_MODE || 'public' };
        BOT_MODE = _cache_bot_mode?.mode || process.env.BOT_MODE || 'public';

        // If prefix_config came back empty/invalid, reset to proper default.
        if (_cache_prefix_config && typeof _cache_prefix_config.prefix === 'undefined' && !_cache_prefix_config.isPrefixless) {
            _cache_prefix_config = { prefix: DEFAULT_PREFIX };
        }

        if (_cache_owner_data && Object.keys(_cache_owner_data).length === 0) _cache_owner_data = null;
        if (_cache_bot_settings && Object.keys(_cache_bot_settings).length === 0) _cache_bot_settings = null;
        if (_cache_welcome_data && Object.keys(_cache_welcome_data).length === 0) _cache_welcome_data = null;

        // ── Write-through: flush DB-loaded settings back to JSON files + .env ──
        // JSON files survive DB wipes. .env survives Pterodactyl egg reinstalls.
        try {
            if (_cache_prefix_config && _cache_prefix_config.prefix !== undefined) {
                fs.writeFileSync('./prefix_config.json', JSON.stringify(_cache_prefix_config, null, 2));
                // Populate BOT_PREFIX in .env so it survives git-based reinstalls
                const pxIsPrefixless = !!_cache_prefix_config.isPrefixless;
                updateEnvFile('BOT_PREFIX', pxIsPrefixless ? '' : (_cache_prefix_config.prefix || ''));
            }
        } catch {}
        try {
            if (_cache_bot_mode && _cache_bot_mode.mode) {
                fs.writeFileSync('./bot_mode.json', JSON.stringify(_cache_bot_mode, null, 2));
                // Populate BOT_MODE in .env so it survives git-based reinstalls
                updateEnvFile('BOT_MODE', _cache_bot_mode.mode);
            }
        } catch {}
        try {
            if (_cache_bot_settings && Object.keys(_cache_bot_settings || {}).length > 0) {
                fs.writeFileSync('./bot_settings.json', JSON.stringify(_cache_bot_settings, null, 2));
            }
        } catch {}
        try {
            if (_cache_owner_data && _cache_owner_data.OWNER_NUMBER) {
                fs.writeFileSync('./owner.json', JSON.stringify(_cache_owner_data, null, 2));
            }
        } catch {}
        try {
            // BOT_NAME: botname.js already reads process.env.BOT_NAME as fallback,
            // so writing it here means it survives even if bot_name.json is wiped.
            const _bn = _getBotName();
            if (_bn) updateEnvFile('BOT_NAME', _bn);
        } catch {}
        // ── Footer write-back ─────────────────────────────────────────────
        try {
            const _footerData = await _loadConfigCache('footer_config', null);
            if (_footerData && _footerData.footer) {
                if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
                fs.writeFileSync('./data/footer.json', JSON.stringify(_footerData, null, 2));
            }
        } catch {}
        // ────────────────────────────────────────────────────────────────────────

    } catch (err) {
        UltraCleanLogger.error(`💾 Database: Migration error - ${err.message}`);
    }
}

const _dbInitPromise = initDatabase().then(() => {
    // Pre-connection prefix load (uses default bot_id — final restore happens after socket connects in reloadConfigCaches)
    const savedPrefix = loadPrefixFromFiles();
    prefixCache = savedPrefix;
    isPrefixless = savedPrefix === '';
    global.prefix = prefixCache;
    global.CURRENT_PREFIX = prefixCache;
    process.env.PREFIX = prefixCache;

    // ── Persistent settings safety net (runs AFTER DB tables exist) ─────────
    // hydrateAll() restores missing JSON config files from DB.
    // startMirror() keeps DB in sync with any file changes every 30 s.
    persistentConfig.hydrateAll().catch(() => {}).finally(() => {
        persistentConfig.startMirror(30_000);
    });
}).catch((err) => {
    console.error(`\n❌ FATAL: SQLite failed to initialize — ${err.message}\n`);
    process.exit(1);
});

// ====== SECTION 19: startBot() — CORE CONNECTION FUNCTION ======
// This is where Baileys is initialised and the WhatsApp connection is made.
// It is called once at startup and again on every reconnect.
//
// High-level flow:
//   1. Close any existing socket cleanly (sock.ev.removeAllListeners, ws.close)
//   2. Load auth state from SQLite via useSQLiteAuthState() in lib/database.js
//   3. Call makeWASocket() with custom options:
//        - logger: ultraSilentLogger (no Baileys noise in the terminal)
//        - auth: the SQLite auth state
//        - browser: ['WolfBot', 'Safari', '1.0.0']
//        - msgRetryCounterCache: shared NodeCache
//   4. Override sock.sendMessage() to apply the current font style automatically
//      (see Section 20 below) and capture outgoing messages for MessageStore
//   5. Register all Baileys event handlers:
//        connection.update     → reconnect logic, UltimateFixSystem
//        creds.update          → save auth state to SQLite
//        messages.upsert       → main message handler (Section 21)
//        group-participants.update → NewMemberDetector (Section 13)
//        contacts.update       → update contactNames map (for display names)
//   6. Once connected (open), call reloadConfigCaches() then autoScanGroupsForSudo()
//
// loginMode options:
//   'auto'    — tries QR code, falls back to pairing code if QR fails
//   'qr'      — always shows QR code for scanning
//   'pairing' — sends pairing code to loginData.phone via WhatsApp
async function startBot(loginMode = 'auto', loginData = null) {
    try {
        if (connectionStableTimer) { clearTimeout(connectionStableTimer); connectionStableTimer = null; }
        if (SOCKET_INSTANCE) {
            try {
                stopHeartbeat();
                SOCKET_INSTANCE.ev.removeAllListeners();
                SOCKET_INSTANCE.ws.close();
            } catch (closeErr) {}
            SOCKET_INSTANCE = null;
            currentSock = null;
            await new Promise(r => setTimeout(r, 1000));
        }

        connectionOpenTime = 0;
        globalThis._botConnectionOpenTime = 0;

        // transient — captured in startup box
        
        // Handle different login modes
        if (loginMode === 'session' && loginData) {
            try {
                UltraCleanLogger.info('🔐 Processing Session ID...');
                await authenticateWithSessionId(loginData);
                UltraCleanLogger.success('✅ Session saved to session/creds.json');
            } catch (error) {
                UltraCleanLogger.error(`❌ Session processing failed: ${error.message}`);
            }
        }
        
        // For 'auto' mode, ensure session directory exists
        if (loginMode === 'auto') {
            ensureSessionDir();
        }
        
        // Rest of your existing startBot function remains the same...
        // ... (keep all the existing code from line 1861)
        
        let commandLoadPromise = Promise.resolve();
        if (!initialCommandsLoaded) {
            commands.clear();
            commandCategories.clear();
            commandLoadPromise = loadCommandsFromFolder('./commands');
            initialCommandsLoaded = true;
        }
        
        if (!store) store = new MessageStore();
        ensureSessionDir();
        
        if (!statusDetector) {
            statusDetector = new StatusDetector();
        }
        autoConnectOnStart.reset();
        
        const _baileys = await import('wolfsocket');
        const makeWASocket = (typeof _baileys.default === 'function' ? _baileys.default : null) ?? _baileys.makeWASocket;
        const { fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = _baileys;
        
        let state, saveCreds;
        
        try {
            const rawDb = supabaseDb.getClient();
            const authState = await useSQLiteAuthState(rawDb, SESSION_DIR);
            state = authState.state;
            saveCreds = authState.saveCreds;

            const stats = getSessionStats(rawDb);
            globalThis._wolfSysStats = globalThis._wolfSysStats || {};
            globalThis._wolfSysStats.authState = { registered: state.creds.registered, keys: stats.totalKeys };
            
        } catch (authError) {
            UltraCleanLogger.error(`❌ Auth state error: ${authError.message}`);
            
            try {
                const rawDb = supabaseDb.getClient();
                UltraCleanLogger.info('🔄 Creating fresh session in SQLite...');
                const freshAuth = await useSQLiteAuthState(rawDb, SESSION_DIR);
                state = freshAuth.state;
                saveCreds = freshAuth.saveCreds;
            } catch (freshError) {
                UltraCleanLogger.error(`❌ Fresh session creation failed: ${freshError.message}`);
                throw new Error('Cannot create auth state');
            }
        }
        
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            logger: ultraSilentLogger,
            browser: Browsers.ubuntu('Chrome'),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, ultraSilentLogger),
            },
            markOnlineOnConnect: !isConflictRecovery,
            generateHighQualityLinkPreview: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            emitOwnEvents: true,
            mobile: false,
            shouldSyncHistoryMessage: () => false,
            syncFullHistory: false,
            experimentalStore: true,
            fireInitQueries: !isConflictRecovery,
            msgRetryCounterCache,
            shouldIgnoreJid: (jid) => {
                if (!jid) return false;
                if (jid === 'status@broadcast') return false; // handled by autoviewstatus
                return false;
            },
            getMessage: async (key) => {
                // Return undefined when message is not cached — this is the correct
                // Baileys behavior: undefined = "I don't have it, skip retry".
                // Returning an empty proto object was triggering unnecessary retry logic.
                try {
                    if (store) {
                        const storeMsg = store.getMessage(key.remoteJid, key.id);
                        if (storeMsg?.message) return storeMsg.message;
                        if (storeMsg && typeof storeMsg === 'object' && !storeMsg.message) return storeMsg;
                    }
                } catch {}
                return undefined;
            },
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage ||
                    message.interactiveMessage
                );
                if (requiresPatch) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message,
                            },
                        },
                    };
                }
                return message;
            },
            cachedGroupMetadata: async (jid) => {
                const cached = groupMetadataCache.get(jid);
                if (cached && Date.now() - cached.ts < GROUP_CACHE_TTL) {
                    return cached.data;
                }
                return undefined;
            },
            defaultQueryTimeoutMs: 15000,
            retryRequestDelayMs: 250,
            maxRetries: 3,
        });
        
        // ====== SECTION 20: sock.sendMessage() OVERRIDE ======
        // Wraps Baileys' native sendMessage so every outgoing text automatically
        // has the currently selected font style applied (e.g. bold, italic, monospace).
        //
        // The override also:
        //   - Stores outgoing messages in MessageStore so the bot can reference its
        //     own previous messages (needed for things like .delete on bot replies)
        //   - Injects button payloads when BOT_MODE === 'buttons'
        //   - Falls back to plain text if font transformation fails (never crashes)
        //
        // Font is changed with .font <style> (commands/owner/font.js).
        // The current font config is stored in globalThis._fontConfig.
        const originalSendMessage = sock.sendMessage.bind(sock);
        
        let _giftedBtns = null;
        try {
            const { createRequire } = await import('module');
            const _require = createRequire(import.meta.url);
            _giftedBtns = _require('wolfbtns');
            globalThis._giftedBtns = _giftedBtns;   // exposed for cpanel & other commands
        } catch (e) {
            UltraCleanLogger.info('⚠️ wolfbtns not available for button mode');
        }
        
        let _skipButtonWrap = false;
        const _noWrapCommands = new Set([
            // menus — handle their own layout
            'menu', 'menu2', 'buttonmenu', 'aimenu', 'animemenu', 'automenu', 'downloadmenu',
            'ephotomenu', 'funmenu', 'gamemenu', 'gitmenu', 'groupmenu', 'imagemenu', 'logomenu',
            'mediamenu', 'musicmenu', 'ownermenu', 'photofunia', 'securitymenu', 'stalkermenu',
            'sportsmenu', 'toolsmenu', 'valentinemenu', 'videomenu', 'menustyle', 'menuslide',
            'slidemenu', 'cmds',
            // music / downloader commands — show their OWN buttons only after a search result
            'song', 'music', 'audio', 'mp3', 'ytmusic',
            'play', 'ytmp3doc', 'audiodoc', 'ytplay',
            'video', 'vid',
            'ytmp3',
            'ytmp4',
            'snext', 'nextsong', 'songnext', 'nextresult',
            'vnext', 'nextvid', 'vidnext', 'nextvideo',
            'songdl', 'dlsong', 'downloadsong',
            'viddl', 'dlvid', 'downloadvid',
            // tts — shows its own buttons after audio
            'tts', 'say', 'speak',
            // github — help text must not get button injection
            'gitclone', 'clone', 'githubdl',
            // site reader — plain help, no button wrap
            'readsite', 'webread', 'siteread', 'readweb',
            // downloaders — manage their own button cards; global wrap must not
            // inject "Download Again" buttons onto help text (no-arg calls)
            'instagram', 'ig', 'igdl', 'insta',
            'twitter', 'twdl', 'xdl', 'twdown',
            'tgsticker', 'tgs', 'telesticker', 'tgpack',
        ]);
        // ── Retry wrapper: handles WhatsApp rate-overlimit transparently ──────
        // When WA returns rate-overlimit we wait and retry up to 3 times with
        // exponential backoff (2 s → 5 s → 10 s). This silently fixes the
        // "command received but no reply" symptom after heavy reconnect bursts.
        const _sendWithRetry = async (j, c, o, ...r) => {
            const delays = [2000, 5000, 10000];
            let lastErr;
            for (let attempt = 0; attempt <= delays.length; attempt++) {
                try {
                    const _result = await originalSendMessage(j, c, o, ...r);
                    // DM debug: log every outgoing DM so we can trace delivery issues
                    if (j && !j.includes('@g.us') && j !== 'status@broadcast' && !j.endsWith('@newsletter')) {
                        const _preview = typeof c?.text === 'string' ? c.text.substring(0, 40) : (c?.caption?.substring(0, 40) || Object.keys(c||{}).join(','));
                       // UltraCleanLogger.info(`[DM-SEND] ✅ jid=${j.split('@')[0].slice(-6)}@${j.split('@')[1]} | ${_preview}`);
                    }
                    return _result;
                } catch (err) {
                    const msg = (err?.message || '').toLowerCase();
                    const isRateLimit = msg.includes('rate') || msg.includes('overlimit') ||
                                       msg.includes('429') || err?.output?.statusCode === 429;
                    if (isRateLimit && attempt < delays.length) {
                        const wait = delays[attempt];
                        UltraCleanLogger.warning(`⏳ rate-overlimit — retrying in ${wait / 1000}s (attempt ${attempt + 1}/3)`);
                        await new Promise(res => setTimeout(res, wait));
                        lastErr = err;
                        continue;
                    }
                    throw err;
                }
            }
            throw lastErr;
        };

        sock.sendMessage = async (jid, content, options, ...rest) => {
            // ─── Status broadcast bypass ─────────────────────────────────────
            // status@broadcast must go straight to Baileys — font transforms
            // change the message text and button-mode wrapping silently converts
            // it to an interactive message that never appears as a WA status.
            if (jid === 'status@broadcast') {
                return _sendWithRetry(jid, content, options, ...rest);
            }
            // ─── JID normalisation ────────────────────────────────────────────
            // fromMe=true echoes arrive with device-suffixed JIDs like
            // 254785471416:16@s.whatsapp.net — strip the device part so the
            // message goes to the whole account, not just one linked device.
            if (jid && jid.endsWith('@s.whatsapp.net') && jid.includes(':')) {
                jid = jidNormalizedUser(jid);
            }
            // PN → LID preference for DMs. If we know a @lid for this phone
            // (cached from group metadata, prior LID messages, etc.), prefer it.
            // Reason: many WhatsApp accounts are LID-migrated and silently drop
            // messages sent to phone@s.whatsapp.net. The "saved contact replies
            // never appear" bug stems from this — saved contacts often arrive
            // via PN but their canonical endpoint is LID. Groups (@g.us) and
            // status@broadcast are unaffected.
            if (jid && jid.endsWith('@s.whatsapp.net') && jid !== 'status@broadcast') {
                try {
                    const _phoneNum = jid.split('@')[0].split(':')[0];
                    // Only swap to @lid if we received this mapping via contacts.upsert
                    // (i.e. WhatsApp explicitly told us their LID). Never guess or derive
                    // it — a wrong swap silently drops the message with no error.
                    const _knownLid = phoneLidCache.get(_phoneNum);
                    const _isUpsertedLid = _knownLid && _knownLid !== _phoneNum
                        && !_knownLid.startsWith('+')       // not a phone number
                        && /^[0-9]+$/.test(_knownLid);      // pure numeric LID
                    if (_isUpsertedLid) {
                        UltraCleanLogger.info(`[DM-JID] swapped ${_phoneNum.slice(-6)}@s → ${_knownLid.slice(-6)}@lid`);
                        jid = `${_knownLid}@lid`;
                    } else {
                        UltraCleanLogger.info(`[DM-JID] no LID cached for ${_phoneNum.slice(-6)} — sending to @s.whatsapp.net`);
                    }
                    // No cache hit → send to phone@s.whatsapp.net as-is.
                    // Baileys v7 will route it correctly for non-LID accounts.
                    // For LID-only accounts, contacts.upsert will fire soon and
                    // populate the cache — subsequent replies will use @lid.
                } catch {}
            }
            // @lid JIDs — keep as-is for sending. Baileys v7 natively supports
            // delivering messages to @lid endpoints. Many newer WhatsApp accounts
            // are LID-migrated and their phone@s.whatsapp.net endpoint is dead,
            // so converting to PN would silently drop the message (the classic
            // "command runs in console but reply never appears in DM" bug).
            // We still cache the LID↔phone mapping for sudo/owner lookups.
            if (jid && jid.endsWith('@lid')) {
                try {
                    const _pn = await resolvePhoneFromLidAsync(jid);
                    if (_pn) {
                        if (!globalThis._lidDeviceHints) globalThis._lidDeviceHints = {};
                        const _pnUser = _pn.replace(/[^0-9]/g, '');
                        globalThis._lidDeviceHints[_pnUser] = jid;
                    }
                } catch {}
            }
            // ─── Font transformation ────────────────────────────────────────
            const _activeFont = (globalThis._fontConfig && globalThis._fontConfig.font) || 'default';
            if (_activeFont !== 'default' && content && typeof content === 'object'
                && !content.react && !content.delete && !content.sticker) {
                if (typeof content.text === 'string' && content.text.length > 0) {
                    content = { ...content, text: _applyFont(content.text, _activeFont) };
                }
                if (typeof content.caption === 'string' && content.caption.length > 0) {
                    content = { ...content, caption: _applyFont(content.caption, _activeFont) };
                }
            }
            // ─── Language translation ────────────────────────────────────────
            if (isTranslationEnabled() && content && typeof content === 'object'
                && !content.react && !content.delete && !content.sticker
                && !content.audio && !content.contacts && !content.poll) {
                try {
                    const _tLang = getBotLanguage().code;
                    if (typeof content.text === 'string' && content.text.length > 0) {
                        content = { ...content, text: await translateText(content.text, _tLang) };
                    }
                    if (typeof content.caption === 'string' && content.caption.length > 0) {
                        content = { ...content, caption: await translateText(content.caption, _tLang) };
                    }
                } catch {}
            }
            // ─── Channel mode: wrap all outgoing messages as forwarded ───────
            if (content && content._skipChannelMode) {
                const { _skipChannelMode: _sc, ...rest } = content;
                content = rest;
            } else if (isChannelModeEnabled() && content && typeof content === 'object'
                && !content.react && !content.delete && !content.sticker && !content.contacts
                && !content.poll) {
                const { jid: _chJid, name: _chName } = getChannelInfo();
                const _existingCtx = content.contextInfo || {};
                content = {
                    ...content,
                    contextInfo: {
                        ..._existingCtx,
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: _chJid,
                            newsletterName: _chName,
                            serverMessageId: Math.floor(Math.random() * 9000) + 1
                        }
                    }
                };
            }
            // ────────────────────────────────────────────────────────────────
            const _storeResult = async (r) => {
                try { if (r?.key?.id && store && jid !== 'status@broadcast' && !content?.react && !content?.delete) store.addMessage(jid, r.key.id, r); } catch {}
                return r;
            };
            if (_skipButtonWrap) {
                return _storeResult(await _sendWithRetry(jid, content, options, ...rest));
            }
            const _activeCmd = getActiveCommand(jid);
            if (_activeCmd && _noWrapCommands.has(_activeCmd.command)) {
                return _storeResult(await _sendWithRetry(jid, content, options, ...rest));
            }
            if (isButtonModeEnabled() && _giftedBtns && content) {
                if (!content.buttons && !content.templateButtons && !content.interactiveButtons && !content.contacts && !content.react) {
                    const msgText = content.text || content.caption || '';
                    const isTextOnly = typeof content.text === 'string' && content.text.length > 0;
                    const hasMedia = !!(content.image || content.video || content.audio || content.sticker || content.document);
                    
                    if (msgText.length > 0 && !content.sticker) {
                        try {
                            const currentPrefix = global.prefix || process.env.PREFIX || '.';
                            const activeCmd = getActiveCommand(jid);
                            let interactiveButtons = null;
                            
                            if (activeCmd) {
                                interactiveButtons = buildCommandButtons(
                                    activeCmd.command, 
                                    currentPrefix, 
                                    activeCmd.args, 
                                    msgText
                                );
                            }
                            
                            if (!interactiveButtons) {
                                interactiveButtons = [];
                                
                                const cmdMatches = [...msgText.matchAll(/[•├│└╰]\s*\*?\.?(\w{2,30})\*?/g)];
                                const foundCmds = [];
                                for (const cm of cmdMatches) {
                                    const cmd = cm[1].trim().toLowerCase();
                                    if (cmd.length >= 2 && cmd.length <= 25 && !foundCmds.includes(cmd) && !/^(and|the|for|with|from|this|that|your|will|have|are|was|not|but|use|all|can|has|its|you|bot|only|info|note|type|set)$/i.test(cmd)) {
                                        foundCmds.push(cmd);
                                    }
                                }
                                
                                if (foundCmds.length > 0) {
                                    foundCmds.slice(0, 5).forEach(cmd => {
                                        interactiveButtons.push({
                                            name: 'quick_reply',
                                            buttonParamsJson: JSON.stringify({
                                                display_text: `${currentPrefix}${cmd}`,
                                                id: `${currentPrefix}${cmd}`
                                            })
                                        });
                                    });
                                }
                                
                                const urlMatches = [...msgText.matchAll(/https?:\/\/[^\s\n\r<>"{}|\\^`\[\]]+/g)];
                                if (urlMatches.length > 0) {
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
                                
                                const copyMatches = msgText.match(/(?:code|token|key|id|session|pair|link)[\s:]*[`*]?([A-Za-z0-9\-_+=/.]{6,})[`*]?/i);
                                if (copyMatches) {
                                    interactiveButtons.push({
                                        name: 'cta_copy',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '📋 Copy',
                                            copy_code: copyMatches[1]
                                        })
                                    });
                                }
                                
                                if (interactiveButtons.length === 0) {
                                    interactiveButtons.push({
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🏠 Menu',
                                            id: `${currentPrefix}menu`
                                        })
                                    });
                                }
                            }
                            
                            if (interactiveButtons && interactiveButtons.length > 0) {
                                const botName = _getBotName();
                                const btnPayload = {
                                    text: msgText,
                                    footer: ` ${botName}`,
                                    interactiveButtons
                                };
                                if (content.contextInfo) btnPayload.contextInfo = content.contextInfo;
                                if (content.mentions) {
                                    btnPayload.contextInfo = btnPayload.contextInfo || {};
                                    btnPayload.contextInfo.mentionedJid = content.mentions;
                                }
                                if (hasMedia) {
                                }
                                
                                if (isTextOnly && !hasMedia) {
                                    // Only send interactive buttons in group chats.
                                    // In DMs, WhatsApp silently discards interactive/button messages
                                    // on modern clients — the bot logs "sent" but the user sees nothing.
                                    // For DMs we fall through to the plain _sendWithRetry below.
                                    const isGroupJid = jid.endsWith('@g.us');
                                    if (isGroupJid) {
                                        try {
                                            const sendResult = await _giftedBtns.sendInteractiveMessage(sock, jid, btnPayload);
                                            try {
                                                if (sendResult?.key?.id && store) store.addSentMessage(jid, sendResult.key.id, content);
                                            } catch {}
                                            return sendResult;
                                        } catch {
                                            return await _sendWithRetry(jid, content, options, ...rest);
                                        }
                                    }
                                    // DMs: fall through to plain text send
                                }
                            }
                        } catch (btnErr) {
                            UltraCleanLogger.info(`⚠️ Button mode send failed, falling back: ${btnErr.message}`);
                        }
                    }
                }
            }
            
            const result = await _sendWithRetry(jid, content, options, ...rest);
            try {
                if (result?.key?.id && store) {
                    store.addMessage(jid, result.key.id, result);
                }
            } catch {}
            return result;
        };
        
        SOCKET_INSTANCE = sock;
        currentSock = sock;
        isWaitingForPairingCode = false;

        // ─── USync diagnostic wrapper ─────────────────────────────────
        // Logs what WhatsApp's server actually returns for device queries.
        // This tells us whether the owner's primary phone is included in
        // meRecipients (which controls device-sent-message delivery).
        if (sock.executeUSyncQuery) {
            const _origUSyncQuery = sock.executeUSyncQuery.bind(sock);
            sock.executeUSyncQuery = async (query) => {
                const _result = await _origUSyncQuery(query);
                try {
                    if (_result?.list?.length) {
                        for (const entry of _result.list) {
                            const _uid = (entry.id || entry.lid || '?').split('@')[0].slice(-8);
                            const _devs = (entry.devices?.deviceList || []).map(d => `${d.id ?? 0}${d.keyIndex ? '(ki)' : ''}`).join(',');
                            const _hasLid = !!entry.lid;
                            UltraCleanLogger.info(`[USYNC] uid=...${_uid} devs=[${_devs || 'NONE'}] lid=${_hasLid}`);
                        }
                    } else {
                        UltraCleanLogger.info(`[USYNC] empty result from WA server`);
                    }
                } catch {}
                return _result;
            };
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // connection update is transient — captured in startup box
            
            if (connection === 'open') {
                isConnected = true;
                connectionOpenTime = Date.now();
                globalThis._botConnectionOpenTime = connectionOpenTime;
                markConnectionOpen(); // start the replay-drain window
                try { resumeQueueIfPending(sock); } catch {}
                try { resumeExportQueueIfPending(sock); } catch {}
                updateWebStatus({ connected: true, botName: getCurrentBotName(), version: VERSION, botMode: BOT_MODE, prefix: getCurrentPrefix(), owner: global.OWNER_NUMBER || 'Unknown' });
                if (connectionStableTimer) clearTimeout(connectionStableTimer);
                connectionStableTimer = setTimeout(() => {
                    connectionAttempts = 0;
                    conflictCount = 0;
                    isConflictRecovery = false;
                }, 300000);
                startHeartbeat(sock);
                // ── Export the SESSION_ID with KLAUS MD: prefix so the user can
                //    copy/paste it into .env or their hosting dashboard. We wait
                //    5s so creds.saveCreds() has flushed to SQLite first.
                setTimeout(() => {
                    printKlasuSessionId().catch((e) => {
                        UltraCleanLogger.warning(`⚠️  SESSION_ID export skipped: ${e.message}`);
                    });
                }, 5000);
                import('./commands/owner/online.js').then(m => m.initPresence?.(sock)).catch(() => {});
                setupAntiGroupStatusListener(sock);
                setTimeout(() => {
                    if (isConnected && !isConflictRecovery) handleSuccessfulConnection(sock, loginMode, loginData).catch(() => {});
                }, 2000);
                isWaitingForPairingCode = false;

                if (conflictCount === 0) {
                    setTimeout(() => {
                        if (!isConnected) return;
                        sock.resyncAppState(['critical_block', 'critical_unblock_to_single'], true)
                            .catch(() => {});
                    }, 15000);
                }
                
                setTimeout(() => {
                    if (isConnected) discoverNewsletters(sock).catch(() => {});
                }, 10000);

                // Sync LID↔phone cache 5s after connect, then every 30 min.
                // Fixes "bot replies to @lid but message never shows" caused by
                // stale or missing phoneLidCache entries after a restart.
                setTimeout(() => {
                    if (isConnected && typeof syncAllLids === 'function') {
                        syncAllLids().catch(() => {});
                    }
                }, 5000);
                setInterval(() => {
                    if (isConnected && typeof syncAllLids === 'function') {
                        syncAllLids().catch(() => {});
                    }
                }, 30 * 60 * 1000); // every 30 minutes

                if (sock.user?.id) {
                    setBotId(sock.user.id);
                    setConfigBotId(sock.user.id);
                    initSudo(sock.user.id).catch(() => {});
                    autoLeave.init(sock);
                    // Re-hydrate JSON configs under the now-correct bot_id scope
                    // (handles first-time pairing where bot_id was 'default' before)
                    persistentConfig.hydrateAll(undefined, { force: true }).catch(() => {});
                    reloadConfigCaches().then(() => {
                        if (typeof globalThis._autoTypingInit === 'function') {
                            try { globalThis._autoTypingInit(sock); } catch {}
                        }
                        if (typeof globalThis._autoRecordingInit === 'function') {
                            try { globalThis._autoRecordingInit(sock); } catch {}
                        }
                        if (typeof globalThis._autoReadInit === 'function') {
                            try { globalThis._autoReadInit(sock); } catch {}
                        }
                        if (typeof globalThis._autoRecordTypingInit === 'function') {
                            try { globalThis._autoRecordTypingInit(sock); } catch {}
                        }
                        if (typeof globalThis._autoReactReload === 'function') {
                            try { globalThis._autoReactReload(); } catch {}
                        }
                        if (typeof globalThis._autoViewReload === 'function') {
                            try { globalThis._autoViewReload(); } catch {}
                        }
                        if (typeof globalThis._autoDownloadReload === 'function') {
                            try { globalThis._autoDownloadReload(); } catch {}
                        }
                        if (typeof globalThis._anticallInit === 'function') {
                            try { globalThis._anticallInit(sock); } catch {}
                        }
                        if (typeof globalThis._autobioInit === 'function') {
                            try { globalThis._autobioInit(sock).catch(() => {}); } catch {}
                        }
                        if (typeof globalThis._receiptInit === 'function') {
                            try { globalThis._receiptInit(sock).catch(() => {}); } catch {}
                        }
                    }).catch(() => {});
                    try {
                        const uid = sock.user.id;
                        const ulid = sock.user.lid;
                        const uidNum = uid?.split('@')[0]?.split(':')[0];
                        const ulidNum = ulid?.split('@')[0]?.split(':')[0];
                        if (ulid && uidNum && ulidNum && !uid.includes('@lid')) {
                            cacheLidPhone(ulidNum, uidNum);
                        } else if (uid.includes('@lid') && ulid) {
                            const ph = ulid.split('@')[0]?.split(':')[0];
                            if (ph && ph !== uidNum) cacheLidPhone(uidNum, ph);
                        }
                    } catch {}
                }

                if (!antideleteInitDone) {
                    antideleteInitDone = true;
                    initAntidelete(sock).catch(err => {
                        console.error('❌ Antidelete init error:', err.message);
                        antideleteInitDone = false;
                    });
                } else {
                    updateAntideleteSock(sock);
                }
                
                if (!statusAntideleteInitDone) {
                    statusAntideleteInitDone = true;
                    initStatusAntidelete(sock).catch(err => {
                        console.error('❌ Status Antidelete init error:', err.message);
                        statusAntideleteInitDone = false;
                    });
                    initStatusReplyListener(sock, OWNER_CLEAN_JID);
                    startScheduler(sock);
                    startReminderScheduler(sock);
                } else {
                    updateStatusAntideleteSock(sock);
                    updateSchedulerSock(sock);
                    updateReminderSock(sock);
                }

                if (!antieditInitDone) {
                    antieditInitDone = true;
                    initAntiedit(sock, OWNER_CLEAN_JID).catch(err => {
                        console.error('❌ Antiedit init error:', err.message);
                        antieditInitDone = false;
                    });
                } else {
                    updateAntieditSock(sock);
                }
                
                


                setTimeout(() => {
                    if (isConnected) {
                        autoScanGroupsForSudo(sock).catch(() => {
                            setTimeout(() => {
                                if (isConnected) autoScanGroupsForSudo(sock).catch(() => {});
                            }, 10000);
                        });
                    }
                }, 5000);
                
                setTimeout(() => {
                    if (!isConnected || isConflictRecovery) return;
                    triggerRestartAutoFix(sock).catch(() => {});
                    if (AUTO_CONNECT_ON_START) {
                        autoConnectOnStart.trigger(sock).catch(() => {});
                    }
                }, 3000);

                setTimeout(async () => {
                    if (!isConnected) return;
                    try {
                        const rrPref = await _loadConfigCache('read_receipts_pref', null);
                        const rrMode = rrPref?.mode;
                        if (rrMode === 'all' || rrMode === 'none') {
                            await sock.updateReadReceiptsPrivacy(rrMode);
                            UltraCleanLogger.info(`Read receipts restored: ${rrMode}`);
                        }
                        await sock.fetchPrivacySettings(true);
                    } catch (e) {
                        UltraCleanLogger.info(`⚠️ Could not apply read receipts setting: ${e.message}`);
                    }
                }, 6000);

                // Poll every 2 s until the QuickConnect drain window is fully closed,
                // then run the auto-follow / auto-join block. Attempting groupAcceptInvite
                // while the drain is active causes "account_reachout_restricted" from WA.
                const _runAutoJoin = async () => {
                    if (isDrainActive()) {
                        setTimeout(_runAutoJoin, 2000);
                        return;
                    }
                    // Extra 3 s buffer so the WA session is fully settled after drain
                    await new Promise(r => setTimeout(r, 3000));
                    if (!isConnected) return;
                    _doAutoFollowJoin();
                };
                setTimeout(_runAutoJoin, 5000); // first check after 5 s

                async function _doAutoFollowJoin() {
                    // Only skip if genuinely not connected — conflict recovery is
                    // irrelevant here; the bot IS on WhatsApp and can join groups.
                    if (!isConnected) return;
                    try {
                        // ── Load channel / group URLs from central config (lib/remoteUrls.js) ──
                        const { REMOTE_URLS: _RU } = await import('./lib/remoteUrls.js');

                        async function _fetchJsonWithFallback(primary, fallback) {
                            const _tryUrl = async (url) => {
                                const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
                                return await r.json();
                            };
                            try { return await _tryUrl(primary); } catch {}
                            if (fallback && fallback !== primary) {
                                try { return await _tryUrl(fallback); } catch {}
                            }
                            return null;
                        }

                        // ─── TEST OVERRIDE (temporary) ────────────────────────────────
                        // When non-empty, this REPLACES the remote channel.json list so
                        // we can validate auto-follow against a single known JID. To
                        // resume normal behaviour, set this back to an empty array [].
                        const TEST_CHANNEL_OVERRIDE = [];
                        // ──────────────────────────────────────────────────────────────

                        let AUTO_CHANNELS = [];
                        if (TEST_CHANNEL_OVERRIDE.length > 0) {
                            AUTO_CHANNELS = TEST_CHANNEL_OVERRIDE.filter(j => typeof j === 'string' && j.endsWith('@newsletter'));
                            UltraCleanLogger.info(`🧪 [AUTO-FOLLOW] Test override active — using ${AUTO_CHANNELS.length} JID(s) instead of channel.json`);
                        } else {
                            try {
                                const remoteData = await _fetchJsonWithFallback(_RU.channels.primary, _RU.channels.fallback);
                                if (remoteData && Array.isArray(remoteData.subscribedJids)) {
                                    AUTO_CHANNELS = remoteData.subscribedJids.filter(j => typeof j === 'string' && j.endsWith('@newsletter'));
                                }
                            } catch (fetchErr) {
                                UltraCleanLogger.info(`⚠️ Could not fetch remote channels: ${fetchErr.message}`);
                            }
                        }
                        AUTO_CHANNELS = [...new Set(AUTO_CHANNELS)];

                        let AUTO_GROUP_INVITES = [];
                        try {
                            const groupData = await _fetchJsonWithFallback(_RU.groups.primary, _RU.groups.fallback);
                            if (groupData && Array.isArray(groupData.inviteCodes)) {
                                AUTO_GROUP_INVITES = groupData.inviteCodes.filter(c => typeof c === 'string' && c.length > 0);
                            }
                        } catch { /* silent */ }
                        AUTO_GROUP_INVITES = [...new Set(AUTO_GROUP_INVITES)];

                        let autoFollowState = await _loadConfigCache('auto_follow_state', { followedChannels: [], joinedGroups: [] });
                        if (!autoFollowState || typeof autoFollowState !== 'object') {
                            autoFollowState = { followedChannels: [], joinedGroups: [] };
                        }
                        if (!Array.isArray(autoFollowState.followedChannels)) autoFollowState.followedChannels = [];
                        if (!Array.isArray(autoFollowState.joinedGroups)) autoFollowState.joinedGroups = [];

                        let stateChanged = false;

                        // Helper: verify the bot is actually subscribed (role !== GUEST).
                        // WhatsApp silently ignores reactions from non-followers, so without
                        // this check the bot logs "✓ Reacted" but nothing appears in the channel.
                        const _verifyFollowed = async (jid) => {
                            try {
                                const meta = await sock.newsletterMetadata?.('jid', jid);
                                const role = meta?.viewer_metadata?.role || meta?.viewerMeta?.role || meta?.role || null;
                                // Roles: OWNER / ADMIN / SUBSCRIBER are good, GUEST = not following
                                if (role && role !== 'GUEST') return { ok: true, role };
                                return { ok: false, role: role || 'UNKNOWN' };
                            } catch (err) {
                                return { ok: false, role: 'ERR', error: err?.message };
                            }
                        };

                        for (const channelJid of AUTO_CHANNELS) {
                            try {
                                channelReactManager.registerNewsletter(channelJid);

                                // 1. ALWAYS pre-verify role first — if we're already a follower
                                //    (OWNER/ADMIN/SUBSCRIBER) we MUST skip newsletterFollow,
                                //    otherwise Baileys v7 throws "unexpected response structure"
                                //    on already-followed channels.
                                const pre = await _verifyFollowed(channelJid);
                                if (pre.ok) {
                                    if (!autoFollowState.followedChannels.includes(channelJid)) {
                                        autoFollowState.followedChannels.push(channelJid);
                                        stateChanged = true;
                                    }
                                    continue; // already following, silent skip
                                }

                                // 2. Not following yet → attempt follow, then verify silently.
                                //    "unexpected response structure" can also mean the follow
                                //    succeeded but the response shape varies — so verify after.
                                try {
                                    await sock.newsletterFollow(channelJid);
                                } catch { /* swallow — verification is the source of truth */ }

                                const post = await _verifyFollowed(channelJid);
                                if (post.ok) {
                                    if (!autoFollowState.followedChannels.includes(channelJid)) {
                                        autoFollowState.followedChannels.push(channelJid);
                                        stateChanged = true;
                                    }
                                }
                                // not followed → silently retry on next reconnect (no log)
                            } catch { /* never let auto-follow crash the connection */ }
                        }

                        // ── Smart group-join: skip full groups, cycle to next available ──
                        // WhatsApp max = 1025 members. We check capacity via groupGetInviteInfo
                        // before attempting to join. Full groups are NOT marked as joined so
                        // they are retried automatically on the next connection.
                        const WA_MAX_MEMBERS = 1025;
                        let _activeGroupInvite = null; // first group with space found this cycle

                        // Ensure the bot's privacy allows it to accept group invite links
                        try { await sock.updateGroupsAddPrivacy('all'); } catch { /* silent */ }

                        for (const inviteCode of AUTO_GROUP_INVITES) {
                            let groupInfo = null;
                            let memberCount = 0;
                            let groupName = inviteCode;

                            try {
                                groupInfo = await sock.groupGetInviteInfo(inviteCode);
                                memberCount = groupInfo?.participants?.length ?? groupInfo?.size ?? 0;
                                groupName = groupInfo?.subject || inviteCode;
                            } catch { /* silent */ }

                            if (memberCount >= WA_MAX_MEMBERS) continue;

                            if (!_activeGroupInvite) {
                                _activeGroupInvite = inviteCode;
                                globalThis._activeGroupInviteCode = inviteCode;
                                globalThis._activeGroupJid = groupInfo?.id || null;
                                globalThis._activeGroupName = groupName;
                                globalThis._activeGroupSize = memberCount;
                            }

                            let _timelocked = false;
                            try {
                                await sock.groupAcceptInvite(inviteCode);
                                if (!autoFollowState.joinedGroups.includes(inviteCode)) {
                                    autoFollowState.joinedGroups.push(inviteCode);
                                    stateChanged = true;
                                }
                            } catch (joinErr) {
                                const errMsg = (joinErr?.message || '').toLowerCase();
                                if (errMsg.includes('reachout_restricted') || errMsg.includes('reachout')) {
                                    _timelocked = true;
                                    let retryMs = 60_000;
                                    try {
                                        const lock = await sock.fetchAccountReachoutTimelock?.();
                                        if (lock?.isActive && lock?.timeEnforcementEnds) {
                                            const endsAt = new Date(lock.timeEnforcementEnds).getTime();
                                            retryMs = Math.max(endsAt - Date.now() + 5000, 10_000);
                                        }
                                    } catch { /* silent */ }
                                    setTimeout(() => { if (isConnected) _doAutoFollowJoin(); }, retryMs);
                                } else if (errMsg.includes('invalid') || errMsg.includes('revoked') || errMsg.includes('not found')) {
                                    if (!autoFollowState.joinedGroups.includes(inviteCode)) {
                                        autoFollowState.joinedGroups.push(inviteCode);
                                        stateChanged = true;
                                    }
                                }
                            }

                            if (_timelocked) break;
                        }

                        if (stateChanged) {
                            _saveConfigCache('auto_follow_state', autoFollowState);
                        }
                    } catch {
                        // silent — retry on next reconnect
                    }
                }
                
                setTimeout(() => {
                    memoryMonitor.start();
                }, 3000);

                // printConnectionBox removed — replaced by printWolfStartupBlock in handleConnectionOpen
                
                // ====== THE ONLY SUCCESS MESSAGE ======
                setTimeout(async () => {
                    const _wasAutoRestart = _isAutoRestart;
                    _isAutoRestart = false;
                    if (!isConnected || isConflictRecovery || _wasAutoRestart || Date.now() - _lastConnectionMsgTime < _MSG_COOLDOWN_MS) return;
                    try {
                        const ownerInfo = jidManager.getOwnerInfo();
                        const displayOwnerNumber = ownerInfo?.ownerNumber ? ownerInfo.ownerNumber.split(':')[0] : 'Not set';
                        
                        const _sNow = new Date();
                        const _sMo = _sNow.getMonth() + 1;
                        const _sDy = _sNow.getDate();
                        let _sGreeting = '';
                        if (_sMo === 12 && _sDy >= 1 && _sDy <= 25) {
                            _sGreeting = `🎄 *MERRY CHRISTMAS!* 🎄\n\n`;
                        } else if (_sMo === 12 && _sDy >= 26 && _sDy <= 30) {
                            _sGreeting = `🎄🎉 *MERRY CHRISTMAS AND HAPPY NEW YEAR!* 🎉🎄\n\n`;
                        } else if (_sMo === 1 && _sDy >= 1 && _sDy <= 5) {
                            _sGreeting = `🎉 *HAPPY NEW YEAR!* 🎉\n\n`;
                        }

                        const successMessage = `${_sGreeting}╭⊷『  ${getCurrentBotName()} 』\n│\n├⊷ *Name:* ${getCurrentBotName()}\n├⊷ *Prefix:* ${getCurrentPrefix() || 'none (prefixless)'}\n├⊷ *Owner:* (${displayOwnerNumber})\n├⊷ *Platform:* ${detectPlatform()}\n├⊷ *Mode:* ${BOT_MODE}\n└⊷ *Status:* ✅ Connected\n\n╰⊷ *${getCurrentBotName()} Online*\n\n─────────────────────\n⭐ Follow me on GitHub: ${PROFILE_URL}`;
                        
                        const targetJid = (ownerInfo && ownerInfo.ownerJid) ? ownerInfo.ownerJid : sock.user.id;
                        const _gb = globalThis._giftedBtns;
                        let sendPromise;
                        if (_gb && typeof _gb.sendInteractiveMessage === 'function') {
                            sendPromise = _gb.sendInteractiveMessage(sock, targetJid, {
                                text: successMessage,
                                footer: ` ${getCurrentBotName()}`,
                                interactiveButtons: [{
                                    name: 'cta_url',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: '🔗 Open GitHub',
                                        url:          PROFILE_URL,
                                        merchant_url: PROFILE_URL
                                    })
                                }]
                            });
                        } else {
                            sendPromise = originalSendMessage(targetJid, { text: successMessage });
                        }
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
                        await Promise.race([sendPromise, timeoutPromise]);
                        _lastConnectionMsgTime = Date.now();
                        try { fs.writeFileSync('./data/.last_conn_msg', String(_lastConnectionMsgTime)); } catch {}

                        // ── Migration notice — edit ENABLED in lib/migrationNotice.js to toggle ──
                        await sendMigrationNotice(sock, targetJid);

                        // ── Comeback notice — edit ENABLED in lib/comebackNotice.js to toggle ──
                        await sendComebackNotice(sock, targetJid);

                    } catch (sendError) {
                        console.log(chalk.red('❌ Could not send connection message:'), sendError.message);
                        _lastConnectionMsgTime = Date.now();
                        try { fs.writeFileSync('./data/.last_conn_msg', String(_lastConnectionMsgTime)); } catch {}
                    }
                }, 5000);
                
            }
            
            if (connection === 'close') {
                isConnected = false;
                updateWebStatus({ connected: false });
                if (connectionStableTimer) { clearTimeout(connectionStableTimer); connectionStableTimer = null; }
                stopHeartbeat();
                
                const closeCode = lastDisconnect?.error?.output?.statusCode || 'unknown';
                const closeMsg = lastDisconnect?.error?.message || '';
                UltraCleanLogger.info(`🔗 Close reason: ${closeCode} - ${closeMsg}`);
                
                memoryMonitor.stop();
                
                if (statusDetector) {
                    statusDetector.saveStatusLogs();
                }
                
                if (memberDetector) {
                    memberDetector.saveDetectionData();
                }
                
                try {
                    if (typeof autoGroupJoinSystem !== 'undefined' && autoGroupJoinSystem) {
                        // silent save
                    }
                } catch {
                    // silent
                }
                
                await handleConnectionCloseSilently(lastDisconnect, loginMode, loginData);
                isWaitingForPairingCode = false;
            }
            
            if (connection === 'connecting') {
                // transient — captured in startup box
            }
            
            if (loginMode === 'pair' && loginData && !state.creds.registered && (qr || connection === 'connecting')) {
                if (!isWaitingForPairingCode) {
                    isWaitingForPairingCode = true;
                    
                    _printSystemBox({
                        tag: 'PAIR',
                        color: 'yellow',
                        icon: '📱',
                        message: 'Requesting 8-digit pairing code…',
                        fields: { Phone: loginData },
                    });
                    
                    const requestPairingCode = async (attempt = 1) => {
                        try {
                            const code = await sock.requestPairingCode(loginData);
                            const cleanCode = code.replace(/\s+/g, '');
                            let formattedCode = cleanCode;
                            
                            if (cleanCode.length === 8) {
                                formattedCode = `${cleanCode.substring(0, 4)}-${cleanCode.substring(4, 8)}`;
                            }
                            
                            console.clear();
                            _printSystemBox({
                                tag: `PAIRING CODE — ${getCurrentBotName()}`,
                                color: 'green',
                                icon: '🔗',
                                fields: {
                                    Phone:             loginData,
                                    Code:              formattedCode,
                                    Length:            '8 characters',
                                    Expires:           '10 minutes',
                                    Bot:               getCurrentBotName(),
                                    'Member Detector': '✅ ENABLED',
                                },
                            });
                            _printSystemBox({
                                tag: 'INSTRUCTIONS',
                                color: 'cyan',
                                icon: '📱',
                                fields: {
                                    '1':  'Open WhatsApp on your phone',
                                    '2':  'Go to Settings → Linked Devices',
                                    '3':  'Tap "Link a Device"',
                                    '4':  `Enter this 8-digit code:  ${formattedCode}`,
                                },
                            });
                      
                            
                            let remainingTime = 600;
                            const timerInterval = setInterval(() => {
                                if (remainingTime <= 0 || isConnected) {
                                    clearInterval(timerInterval);
                                    return;
                                }
                                
                                const minutes = Math.floor(remainingTime / 60);
                                const seconds = remainingTime % 60;
                                process.stdout.write(`\r⏰ Code expires in: ${minutes}:${seconds.toString().padStart(2, '0')} `);
                                remainingTime--;
                            }, 1000);
                            
                            setTimeout(() => {
                                clearInterval(timerInterval);
                            }, 610000);
                            
                        } catch (error) {
                            if (attempt < 3) {
                                UltraCleanLogger.warning(`Pairing code attempt ${attempt} failed, retrying...`);
                                await delay(3000);
                                await requestPairingCode(attempt + 1);
                            } else {
                                console.log(chalk.red('\n❌ Max retries reached. Restarting bot...'));
                                UltraCleanLogger.error(`Pairing code error: ${error.message}`);
                                
                                setTimeout(async () => {
                                    _isAutoRestart = true;
                                    await startBot(loginMode, loginData);
                                }, 8000);
                            }
                        }
                    };
                    
                    const pairDelay = qr ? 500 : 3000;
                    setTimeout(() => {
                        requestPairingCode(1);
                    }, pairDelay);
                }
            }
        });
        
        let credsTimer = null;
        let credsPending = false;
        const debouncedSaveCreds = () => {
            credsPending = true;
            if (credsTimer) clearTimeout(credsTimer);
            credsTimer = setTimeout(() => {
                credsPending = false;
                try {
                    saveCreds();
                } catch (err) {
                    UltraCleanLogger.error(`💾 saveCreds error: ${err.message}`);
                }
            }, 500);
        };
        const flushCreds = () => {
            if (credsPending && credsTimer) {
                clearTimeout(credsTimer);
                credsPending = false;
                try { saveCreds(); } catch {}
            }
        };
        if (global._flushCredsExit) process.removeListener('exit', global._flushCredsExit);
        if (global._flushCredsTerm) process.removeListener('SIGTERM', global._flushCredsTerm);
        global._flushCredsExit = flushCreds;
        global._flushCredsTerm = flushCreds;
        process.on('exit', flushCreds);
        process.on('SIGTERM', flushCreds);
        sock.ev.on('creds.update', debouncedSaveCreds);


        // ── LID Sync Utility ─────────────────────────────────────────────────
        // Walks all cached contacts and populates BOTH directions of the LID
        // cache: lidPhoneCache (LID→phone) and phoneLidCache (phone→LID).
        // This ensures sendMessage can always find the right @lid endpoint for
        // any user who has ever messaged the bot, even after a restart.
        async function syncAllLids() {
            try {
                let synced = 0;
                // Source 1: signalRepository lidMapping — most complete source
                if (sock?.signalRepository?.lidMapping?.getPNForLID) {
                    try {
                        const _mapping = sock.signalRepository.lidMapping;
                        const _allLids = typeof _mapping.getAllLIDs === 'function'
                            ? await _mapping.getAllLIDs()
                            : (typeof _mapping.getAll === 'function' ? await _mapping.getAll() : null);
                        if (_allLids) {
                            for (const [lid, pn] of Object.entries(_allLids)) {
                                const lidNum = String(lid).split('@')[0].split(':')[0];
                                const phone  = String(pn).replace(/[^0-9]/g, '');
                                if (lidNum && phone && lidNum !== phone) {
                                    cacheLidPhone(lidNum, phone);
                                    phoneLidCache.set(phone, lidNum);
                                    synced++;
                                }
                            }
                        }
                    } catch {}
                }

                // Source 2: global.contactNames — has LID keys from contacts.upsert
                if (global.contactNames) {
                    for (const [key] of global.contactNames) {
                        if (key.endsWith('@lid') || /^[0-9]{10,}$/.test(key)) {
                            const lidNum = key.split('@')[0].split(':')[0];
                            try {
                                const resolved = await resolvePhoneFromLidAsync(lidNum + '@lid');
                                if (resolved) {
                                    const phone = resolved.replace(/[^0-9]/g, '');
                                    if (phone && lidNum !== phone) {
                                        cacheLidPhone(lidNum, phone);
                                        phoneLidCache.set(phone, lidNum);
                                        synced++;
                                    }
                                }
                            } catch {}
                        }
                    }
                }

                // Source 3: _lidDeviceHints — populated by sendMessage @lid echoes
                if (globalThis._lidDeviceHints) {
                    for (const [phone, lidJid] of Object.entries(globalThis._lidDeviceHints)) {
                        const lidNum = lidJid.split('@')[0].split(':')[0];
                        if (lidNum && phone && lidNum !== phone) {
                            cacheLidPhone(lidNum, phone);
                            phoneLidCache.set(phone, lidNum);
                            synced++;
                        }
                    }
                }

                if (synced > 0) UltraCleanLogger.info(`[LID-SYNC] Synced ${synced} LID↔phone mappings`);
            } catch (e) {
                UltraCleanLogger.info(`[LID-SYNC] Error: ${e.message}`);
            }
        }

        sock.ev.on('contacts.upsert', (contacts) => {
            try {
                global.contactNames = global.contactNames || new Map();
                for (const contact of contacts) {
                    if (contact.id && contact.lid) {
                        const idNum = contact.id.split('@')[0].split(':')[0];
                        const lidNum = contact.lid.split('@')[0].split(':')[0];
                        const idIsLid = contact.id.includes('@lid');
                        if (!idIsLid && idNum !== lidNum) {
                            cacheLidPhone(lidNum, idNum);           // LID → phone
                            phoneLidCache.set(idNum, lidNum);       // phone → LID (reverse map for sendMessage)
                        }
                        // Debug: log any LID contact with no phone mapping
                        if (idIsLid) {
                            UltraCleanLogger.info(`[CONTACT-LID-ONLY] lid=${lidNum.slice(-8)} id=${idNum.slice(-8)} — no PN mapping possible`);
                        }
                    }
                    const displayName = contact.notify || contact.name || contact.vname || contact.short || contact.pushName || contact.verifiedName;
                    if (displayName && contact.id) {
                        const jidKey = contact.id.split('@')[0];
                        global.contactNames.set(jidKey, displayName);
                        const cleanKey = jidKey.split(':')[0];
                        if (cleanKey !== jidKey) global.contactNames.set(cleanKey, displayName);
                        if (contact.id.includes('@lid')) {
                            global.contactNames.set(contact.id, displayName);
                        }
                        if (contact.lid) {
                            const lidKey = contact.lid.split('@')[0].split(':')[0];
                            global.contactNames.set(lidKey, displayName);
                            global.contactNames.set(contact.lid.split('@')[0], displayName);
                        }
                    }
                }
            } catch {}
        });

        sock.ev.on('contacts.update', (updates) => {
            try {
                global.contactNames = global.contactNames || new Map();
                for (const contact of updates) {
                    if (contact.id && contact.lid) {
                        const idNum = contact.id.split('@')[0].split(':')[0];
                        const lidNum = contact.lid.split('@')[0].split(':')[0];
                        const idIsLid = contact.id.includes('@lid');
                        if (!idIsLid && idNum !== lidNum) {
                            cacheLidPhone(lidNum, idNum);           // LID → phone
                            phoneLidCache.set(idNum, lidNum);       // phone → LID (reverse)
                        }
                    }
                    const displayName = contact.notify || contact.name || contact.vname || contact.short || contact.pushName || contact.verifiedName;
                    if (displayName && contact.id) {
                        const jidKey = contact.id.split('@')[0];
                        global.contactNames.set(jidKey, displayName);
                        const cleanKey = jidKey.split(':')[0];
                        if (cleanKey !== jidKey) global.contactNames.set(cleanKey, displayName);
                        if (contact.id.includes('@lid')) {
                            global.contactNames.set(contact.id, displayName);
                        }
                        if (contact.lid) {
                            const lidKey = contact.lid.split('@')[0].split(':')[0];
                            global.contactNames.set(lidKey, displayName);
                            global.contactNames.set(contact.lid.split('@')[0], displayName);
                        }
                    }
                }
            } catch {}
        });

        await commandLoadPromise;
        if (!commandsLoaded) {
            globalThis._loadedCommandCount = commands.size;
            globalThis._wolfSysStats = globalThis._wolfSysStats || {};
            globalThis._wolfSysStats.commandsLoaded = commands.size;
            commandsLoaded = true;
        }
        updateWebStatus({ commands: commands.size, botName: getCurrentBotName(), version: VERSION, botMode: BOT_MODE, prefix: getCurrentPrefix(), owner: global.OWNER_NUMBER || 'Unknown', antispam: !!(globalThis._antispamConfig?.enabled), antibug: !!(globalThis._antibugConfig?.enabled), antilink: !!(globalThis._antilinkConfig?.enabled), antidelete: true, autoread: false });

        sock.ev.on('group-participants.update', async (update) => {
            try {
                if (memberDetector && memberDetector.enabled && sock?.ws?.isOpen) {
                    // Per-member box already prints inside showMemberNotification —
                    // no need for an extra "Detected N new members" info line.
                    memberDetector.detectNewMembers(sock, update).catch(() => {});
                }
            } catch (error) {
                if (!error.message?.includes('Connection Closed')) {
                    UltraCleanLogger.warning(`Member detection error: ${error.message}`);
                }
            }
            
            try {
                const groupId = update.id;
                const rawParticipants = update.participants || [];
                const participants = rawParticipants.map(p => {
                    if (typeof p === 'string') return p.includes('@') ? p : null;
                    if (p && typeof p === 'object') {
                        const jid = p.jid || p.id || p.userJid || p.participant || p.user;
                        if (typeof jid === 'string' && jid.includes('@')) return jid;
                        if (typeof jid === 'string' && /^\d+$/.test(jid)) return `${jid}@s.whatsapp.net`;
                        const keys = Object.keys(p);
                        for (const key of keys) {
                            const val = p[key];
                            if (typeof val === 'string' && val.includes('@s.whatsapp.net')) return val;
                        }
                        UltraCleanLogger.warning(`Unknown participant shape: ${JSON.stringify(p).substring(0, 200)}`);
                        return null;
                    }
                    return null;
                }).filter(p => p && p.includes('@'));
                
                if (update.action === 'add' && participants.length > 0) {
                    (async () => {
                        try {
                            // Check both flags up front — one metadata fetch covers both
                            const welcomeOn = await isWelcomeEnabled(groupId);

                            // Approval mode: bot-side per-group flag (toggled via .joinapproval on/off)
                            const approvalOn = await isJoinApprovalEnabled(groupId);
                            let resolvedApproverJid = null;
                            let resolvedMembers = participants;

                            if (approvalOn && update.author) {
                                // Resolve approver JID (may be LID)
                                const authorRaw = String(update.author);
                                resolvedApproverJid = authorRaw.includes('@lid')
                                    ? (() => {
                                        const lidNum = authorRaw.split(':')[0].split('@')[0];
                                        const phone = lidPhoneCache.get(lidNum) || getPhoneFromLid(lidNum);
                                        return phone ? `${phone}@s.whatsapp.net` : authorRaw;
                                    })()
                                    : (authorRaw.includes('@') ? authorRaw : `${authorRaw}@s.whatsapp.net`);

                                // Resolve member JIDs (may be LIDs)
                                resolvedMembers = participants.map(p => {
                                    if (!p.includes('@lid')) return p;
                                    const lidNum = p.split(':')[0].split('@')[0];
                                    const phone = lidPhoneCache.get(lidNum) || getPhoneFromLid(lidNum);
                                    return phone ? `${phone}@s.whatsapp.net` : p;
                                });
                            }

                            if (approvalOn && welcomeOn) {
                                // COMBINED: one message with approval header + welcome body
                                const welcomeMsg = await getWelcomeMessage(groupId);
                                UltraCleanLogger.info(`✅ Approval + welcome for ${resolvedMembers.length} member(s) in ${groupId.split('@')[0]}`);
                                sendWelcomeMessage(sock, groupId, resolvedMembers, welcomeMsg, { approvedBy: resolvedApproverJid }).catch(() => {});

                            } else if (approvalOn) {
                                // Approval only (welcome is off)
                                const approverDisplay = resolvedApproverJid.split('@')[0].split(':')[0];
                                const memberTags = resolvedMembers.map(p => `@${p.split('@')[0].split(':')[0]}`).join(', ');
                                const verb = resolvedMembers.length === 1 ? 'was' : 'were';
                                await sock.sendMessage(groupId, {
                                    text: `╭─⌈ ✅ *JOIN APPROVED* ⌋\n├─⊷ ${memberTags} ${verb} approved\n├─⊷ Approved by: @${approverDisplay}\n╰⊷ Welcome to the group! 🎉`,
                                    mentions: [...resolvedMembers, resolvedApproverJid]
                                });

                            } else if (welcomeOn) {
                                // Welcome only (joinapproval is off — normal join via link or direct add)
                                const welcomeMsg = await getWelcomeMessage(groupId);
                                UltraCleanLogger.info(`🎉 Welcoming ${participants.length} new member(s) in ${groupId.split('@')[0]}`);
                                sendWelcomeMessage(sock, groupId, participants, welcomeMsg).catch(() => {});
                            }
                        } catch {}
                    })();
                }
                
                // Auto-leave: if the bot itself was just added to a blocked group, leave silently
                if (update.action === 'add' && participants.length > 0 && sock.user?.id) {
                    const _botNum = sock.user.id.split(':')[0].split('@')[0];
                    const _botWasAdded = participants.some(p => p.split(':')[0].split('@')[0] === _botNum);
                    if (_botWasAdded) {
                        autoLeave.handleGroupJoin(groupId).catch(() => {});
                    }
                }

                // Auto-rejoin: if the bot itself was removed or left a group, check if that
                // group is in the remote invite list and silently attempt to rejoin.
                if ((update.action === 'remove' || update.action === 'leave') && participants.length > 0 && sock.user?.id) {
                    const _botNum = sock.user.id.split(':')[0].split('@')[0];
                    const _botWasRemoved = participants.some(p => p.split(':')[0].split('@')[0] === _botNum);
                    if (_botWasRemoved) {
                        (async () => {
                            try {
                                const { REMOTE_URLS: _RU2 } = await import('./lib/remoteUrls.js');
                                const _tryFetch = async (url) => {
                                    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
                                    return await r.json();
                                };
                                let groupData = null;
                                try { groupData = await _tryFetch(_RU2.groups.primary); } catch {}
                                if (!groupData) try { groupData = await _tryFetch(_RU2.groups.fallback); } catch {}
                                if (groupData && Array.isArray(groupData.inviteCodes)) {
                                    for (const code of groupData.inviteCodes) {
                                        if (typeof code !== 'string' || !code.length) continue;
                                        try {
                                            // Small delay so WA doesn't rate-limit on rapid remove+rejoin
                                            await new Promise(r => setTimeout(r, 3000));
                                            await sock.groupAcceptInvite(code);
                                        } catch { /* silent */ }
                                    }
                                }
                            } catch { /* silent */ }
                        })();
                    }
                }

                if ((update.action === 'remove' || update.action === 'leave') && participants.length > 0) {
                    if (isGoodbyeEnabled(groupId)) {
                        const goodbyeMsg = getGoodbyeMessage(groupId);
                        UltraCleanLogger.info(`👋 Saying goodbye to ${participants.length} member(s) in ${groupId.split('@')[0]}`);
                        sendGoodbyeMessage(sock, groupId, participants, goodbyeMsg).catch(() => {});
                    }
                }

                if (update.action === 'demote' || update.action === 'promote') {
                    originalConsoleMethods.log(`🛡️ [EVENT] ${update.action} detected in ${groupId.split('@')[0]} | author: ${update.author || 'unknown'} | count: ${rawParticipants.length}`);
                    try {
                        antidemoteHandler(sock, update).catch(() => {});
                    } catch (adErr) {
                        originalConsoleMethods.log(`❌ [ANTIDEMOTE] Handler error: ${adErr.message}`);
                    }
                }
            } catch (error) {
                UltraCleanLogger.warning(`Welcome/Goodbye system error: ${error.message}`);
            }
        });

        // ====== SECTION 21: messages.upsert EVENT HANDLER ======
        // This is the hot path — it fires for every new message WhatsApp delivers.
        // "upsert" means either a brand-new message or a revision of an existing one.
        //
        // Routing logic (in order):
        //   1. Skip if type !== 'notify' (only process new delivered messages)
        //   2. Store the message in MessageStore for reply commands
        //   3. Pass to antideleteStoreMessage() so deletion can be detected later
        //   4. If chatId === 'status@broadcast' → Status pipeline (autoView/autoReact/autoSave)
        //   5. trackActivity() → resets the UltimateFixSystem watchdog timer
        //   7. Call handleIncomingMessage(sock, msg) for all real messages (Section 22)
        //
        // Everything after step 7 is a fast return — handleIncomingMessage owns the
        // full command dispatch pipeline.
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            // ── QuickConnect replay guard — MUST be first ──────────────────────
            // When reconnecting with an old session WhatsApp replays thousands of
            // missed messages in a burst.  Drop them here before anything else runs
            // so the event loop stays clear for new (live) messages.
            // isReplayMessage() is a no-op after the 45-second drain window.
            const _qcMsg = messages?.[0];
            if (_qcMsg && isReplayMessage(_qcMsg)) return;

            if (type !== 'notify') {
                // Also process 'append' fromMe messages that are button responses —
                // these arrive from the owner's secondary device (phone) as type='append'.
                // ALSO process 'append' newsletter messages — Baileys pushes channel
                // messages via upsertMessage(msg, 'append'), so without this branch the
                // channel auto-react handler never fires.
                if (type === 'append') {
                    const m0 = messages?.[0];
                    const _isNewsletterMsg = m0?.key?.remoteJid?.endsWith('@newsletter');
                    if (_isNewsletterMsg) {
                        // fall through — newsletter messages must reach handleChannelReact
                    } else if (m0?.key?.fromMe && m0?.message) {
                        const c0 = m0.message;
                        const normC0 = normalizeMessageContent(c0) || c0;
                        // Check both raw and normalised — some devices wrap responses in viewOnce/envelope
                        const hasBtn = !!(
                            c0?.interactiveResponseMessage || normC0?.interactiveResponseMessage ||
                            c0?.buttonsResponseMessage    || normC0?.buttonsResponseMessage    ||
                            c0?.listResponseMessage       || normC0?.listResponseMessage       ||
                            c0?.templateButtonReplyMessage|| normC0?.templateButtonReplyMessage
                        );
                        const hasReaction = !!(c0?.reactionMessage || normC0?.reactionMessage);
                        const hasEdit = !!(normC0?.protocolMessage?.type === 14 || normC0?.editedMessage);

                        // Allow owner text commands typed in someone else's DM.
                        // These arrive as fromMe=true + type='append'. Previously
                        // they were dropped here causing "command executes but no
                        // response ever shows" — the bot processed the echo from
                        // the owner's linked device but never sent a reply.
                        const _pfx = (typeof getCurrentPrefix === 'function' ? getCurrentPrefix() : null) || global.prefix || '.';
                        const _msgTxt = normC0?.conversation || normC0?.extendedTextMessage?.text || '';
                        const isCommand = _msgTxt.trim().startsWith(_pfx);

                        // Allow owner sticker replies and emoji-only replies through —
                        // these trigger the view-once download path in handleIncomingMessage.
                        const isSticker_ = !!(c0?.stickerMessage || normC0?.stickerMessage);
                        const _trimmed   = _msgTxt.trim();
                        const isEmojiReply_ = _trimmed.length > 0 && _trimmed.length <= 20
                            && /^[\p{Emoji_Presentation}\p{Emoji}\u200d\ufe0f\s]+$/u.test(_trimmed)
                            && !!(normC0?.extendedTextMessage?.contextInfo?.quotedMessage
                                || c0?.extendedTextMessage?.contextInfo?.quotedMessage);

                        if (!hasBtn && !hasReaction && !hasEdit && !isCommand && !isSticker_ && !isEmojiReply_) return;
                        // fall through — button responses, reactions, edits, and owner DM commands
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            }
            const msg = messages[0];
            if (!msg) return;
            
            const _upsertTs = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'object' ? msg.messageTimestamp.low || 0 : Number(msg.messageTimestamp)) * 1000 : 0;
            const _isOldMsg = _upsertTs > 0 && (Date.now() - _upsertTs > 60000 || (connectionOpenTime > 0 && _upsertTs < connectionOpenTime - 30000));

            // Never drop media/view-once messages as "old" — they can arrive slightly delayed
            // Also never drop view-once stubs (msg.message=null, msg.key.isViewOnce=true)
            const _isViewOnceStub = !msg.message && msg.key?.isViewOnce === true;
            const _msgHasMedia = _isViewOnceStub || !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage
                || msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension);
            if (_isOldMsg && !_msgHasMedia) {
                const _oldJid = msg.key?.remoteJid || '';
                if (!_oldJid.endsWith('@g.us') && _oldJid !== 'status@broadcast' && !msg.key?.fromMe) {
                    const _ageSec = _upsertTs > 0 ? Math.round((Date.now() - _upsertTs) / 1000) : '?';
                    UltraCleanLogger.info(`[DM-DROP] Old message ignored (${_ageSec}s old) from ${_oldJid.split('@')[0].slice(-6)} — was bot restarting?`);
                }
                return;
            }

            // Log every incoming message immediately — covers text AND media
            if (msg.message && msg.key?.remoteJid && !msg.key.fromMe) {
                const _iJid = msg.key.remoteJid;
                if (_iJid !== 'status@broadcast') {
                    const _iSenderJid = msg.key.participant || _iJid;
                    const _iRawSender = _iSenderJid.split('@')[0].split(':')[0];
                    const _iM = msg.message;
                    // Determine display text — fall back to media type label if no text
                    const _iText =
                        _iM?.conversation ||
                        _iM?.extendedTextMessage?.text ||
                        (_iM?.imageMessage   ? `[Image${_iM.imageMessage.caption   ? ': ' + _iM.imageMessage.caption   : ''}]` : null) ||
                        (_iM?.videoMessage   ? `[Video${_iM.videoMessage.caption   ? ': ' + _iM.videoMessage.caption   : ''}]` : null) ||
                        (_iM?.audioMessage   ? (_iM.audioMessage.ptt ? '[Voice Note]' : '[Audio]')                              : null) ||
                        (_iM?.stickerMessage ? '[Sticker]'                                                                      : null) ||
                        (_iM?.documentMessage ? `[Document: ${_iM.documentMessage.fileName || 'file'}]`                        : null) ||
                        (_iM?.viewOnceMessage || _iM?.viewOnceMessageV2 || _iM?.viewOnceMessageV2Extension ? '[View-Once Media]' : null) ||
                        (_iM?.locationMessage ? '[Location]'                                                                    : null) ||
                        (_iM?.contactMessage  ? `[Contact: ${_iM.contactMessage.displayName || '?'}]`                          : null) ||
                        null;
                    if (_iText) {
                        const _iIsGroup   = _iJid.endsWith('@g.us');
                        const _iIsChannel = _iJid.endsWith('@newsletter');
                        const _iResolved = resolvePhoneFromLid(_iSenderJid) || _iRawSender;

                        // ── Owner detection ──────────────────────────────
                        // Owner can sign in from another phone (so fromMe=false)
                        // but the JID may arrive as either the phone (@s.whatsapp.net)
                        // or the obfuscated LID (@lid).  Match against every form
                        // we know about so the box says "👑 OWNER" instead of "💬 DM"
                        // and the sender row never falls back to N/A.
                        const _ownerNum = OWNER_NUMBER || null;
                        const _iIsOwner = !!(
                            (_ownerNum && (_iResolved === _ownerNum || _iRawSender === _ownerNum)) ||
                            (OWNER_JID && _iSenderJid === OWNER_JID) ||
                            (OWNER_LID && _iSenderJid === OWNER_LID) ||
                            (OWNER_LID && _iSenderJid.split('@')[0].split(':')[0] === OWNER_LID.split('@')[0].split(':')[0])
                        );

                        // Resolve group name: cache hit → instant; cache miss → background fetch (non-blocking)
                        let _iGroupName = null;
                        if (_iIsGroup) {
                            const _gCached = groupMetadataCache.get(_iJid);
                            _iGroupName = _gCached?.data?.subject || _gCached?.subject || null;
                            if (!_iGroupName && sock?.ws?.isOpen) {
                                // Fire-and-forget — populate cache for the NEXT message, never delay the current one
                                sock.groupMetadata(_iJid).then(_live => {
                                    if (_live?.subject) groupMetadataCache.set(_iJid, { data: _live, ts: Date.now() });
                                }).catch(() => {});
                            }
                        }

                        // Resolve channel name (newsletter): cache hit → instant; cache miss → background fetch (non-blocking)
                        let _iChannelName = null;
                        if (_iIsChannel) {
                            globalThis._channelNameCache = globalThis._channelNameCache || new Map();
                            _iChannelName = globalThis._channelNameCache.get(_iJid) || null;
                            if (!_iChannelName && sock?.newsletterMetadata) {
                                // Fire-and-forget — populate cache for the NEXT message, never delay the current one
                                sock.newsletterMetadata('jid', _iJid).then(_live => {
                                    if (_live?.name) globalThis._channelNameCache.set(_iJid, _live.name);
                                }).catch(() => {});
                            }
                        }

                        // Pick the actual proto field name (extendedTextMessage,
                        // imageMessage, protocolMessage, etc.) — exactly what
                        // WhatsApp tags the payload as.
                        const _iMsgType = _iM ? (Object.keys(_iM)[0] || 'unknown') : 'unknown';

                        // Sender display name resolution chain:
                        //   channel name (for @newsletter) →
                        //   pushName → contactNames cache (multiple keys) →
                        //   owner alias → +<resolved phone>  (never "N/A")
                        const _iSenderName = _iIsChannel
                            ? (_iChannelName || msg.pushName || `Channel ${_iJid.split('@')[0]}`)
                            : (
                                msg.pushName ||
                                (global.contactNames?.get?.(_iRawSender)) ||
                                (global.contactNames?.get?.(_iSenderJid.split('@')[0])) ||
                                (global.contactNames?.get?.(_iResolved)) ||
                                (global.contactNames?.get?.(_iSenderJid)) ||
                                (_iIsOwner ? `Owner (${OWNER || 'KLAUS-MD'})` : null) ||
                                `+${_iResolved}`
                            );

                        // Chat ID = numeric part of remoteJid (the chat the msg
                        // arrived in — group JID for groups, channel JID for
                        // newsletters, sender JID for DMs). Always prefer the
                        // resolved phone over the raw LID so the row shows a
                        // real WhatsApp number.
                        const _iChatId = (_iIsGroup || _iIsChannel)
                            ? _iJid.split('@')[0]
                            : _iResolved;

                        // Group JID is just the numeric part of the @g.us chat
                        const _iGroupJid = _iIsGroup ? _iJid.split('@')[0] : null;

                        // Pick chatType: CHANNEL for newsletters (purple/📢),
                        // OWNER for owner-DM (neon-green/👑), GROUP for groups
                        // (cyan/👥), DM otherwise (orange/💬).
                        const _iChatType = _iIsChannel
                            ? 'CHANNEL'
                            : (_iIsGroup ? 'GROUP' : (_iIsOwner ? 'OWNER' : 'DM'));

                        UltraCleanLogger.message(
                            _iResolved,
                            _iChatType,
                            _iGroupName,
                            _iText,
                            _getTime(),
                            {
                                msgType:     _iMsgType,
                                senderName:  _iSenderName,
                                chatId:      _iChatId,
                                groupJid:    _iGroupJid,
                                channelName: _iChannelName,
                                channelJid:  _iIsChannel ? _iJid.split('@')[0] : null,
                            }
                        );
                    }
                }
            }

            if (msg.message && msg.key?.remoteJid && !msg.key.fromMe) {
                const chatJid = msg.key.remoteJid;
                if (chatJid !== 'status@broadcast' && antibugEnabled(chatJid)) {
                    const bugResult = antibugCheck(msg);
                    if (bugResult.isBug) {
                        const senderJid = msg.key.participant || chatJid;
                        const isGroup = chatJid.endsWith('@g.us');
                        const senderNum = senderJid.split('@')[0].split(':')[0];
                        const isOwnerSender = jidManager.isOwner(msg);

                        if (!isOwnerSender) {
                            UltraCleanLogger.warning(`🛡️ ANTIBUG: ${bugResult.label} from ${senderNum} in ${isGroup ? chatJid.split('@')[0] : 'DM'} [${bugResult.severity}]`);

                            try {
                                await sock.sendMessage(chatJid, { delete: msg.key });
                            } catch {}

                            const action = antibugGetAction(chatJid);

                            if (action === 'kick' && isGroup) {
                                try {
                                    await sock.groupParticipantsUpdate(chatJid, [senderJid], 'remove');
                                    await sock.sendMessage(chatJid, {
                                        text: `🛡️ *Anti-Bug:* @${senderNum} removed for sending a crash message.\n*Type:* ${bugResult.label}`,
                                        mentions: [senderJid]
                                    });
                                } catch {}
                            } else if (action === 'block') {
                                try {
                                    await sock.updateBlockStatus(senderJid, 'block');
                                    if (isGroup) {
                                        await sock.groupParticipantsUpdate(chatJid, [senderJid], 'remove');
                                    }
                                    await sock.sendMessage(chatJid, {
                                        text: `🛡️ *Anti-Bug:* @${senderNum} blocked for sending a crash message.\n*Type:* ${bugResult.label}`,
                                        mentions: [senderJid]
                                    });
                                } catch {}
                            } else if (action === 'warn') {
                                try {
                                    await sock.sendMessage(chatJid, {
                                        text: `🛡️ *Anti-Bug Warning:* @${senderNum} sent a potential crash message.\n*Type:* ${bugResult.label}\n\n⚠️ Next offense may result in removal.`,
                                        mentions: [senderJid]
                                    });
                                } catch {}
                            }

                            return;
                        }
                    }
                }
            }

            if (msg.message && msg.key?.remoteJid && !msg.key.fromMe) {
                const chatJid = msg.key.remoteJid;
                const _alRawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                const _alIsCmd = !isPrefixless && getCurrentPrefix() && _alRawText.trimStart().startsWith(getCurrentPrefix());
                if (!_alIsCmd && chatJid.endsWith('@g.us') && antilinkEnabled(chatJid)) {
                    const linkResult = antilinkCheck(msg);
                    if (linkResult.hasLink) {
                        const senderJid = msg.key.participant || chatJid;
                        const senderClean = senderJid.split(':')[0].split('@')[0];
                        const isOwnerSender = jidManager.isOwner(msg);

                        if (!isOwnerSender) {
                            const gc = antilinkGetConfig(chatJid);
                            const _alExcludedTypes = gc?.excludeTypes || [];
                            const _alIsExcludedType = _alExcludedTypes.length > 0 && antilinkIsExcludedType(linkResult.links, _alExcludedTypes);
                            // Skip if link is in allow list AND its type is NOT in the exclude list
                            if (gc?.exemptLinks && antilinkIsExempt(linkResult.links, gc.exemptLinks) && !_alIsExcludedType) {
                            } else {
                                let isSenderAdmin = false;
                                let gMeta = null;
                                let senderP = null;
                                try {
                                    gMeta = await sock.groupMetadata(chatJid);
                                    senderP = gMeta.participants.find(p => {
                                        const pClean = p.id.split(':')[0].split('@')[0];
                                        return pClean === senderClean;
                                    });
                                    if (gc?.exemptAdmins !== false) {
                                        isSenderAdmin = senderP?.admin === 'admin' || senderP?.admin === 'superadmin';
                                    }
                                } catch {}

                                if (!isSenderAdmin) {
                                    const mode = antilinkGetMode(chatJid);
                                    UltraCleanLogger.warning(`🔗 ANTILINK: Link from ${senderClean} in ${chatJid.split('@')[0]} [${mode}]`);

                                    // Custom message support (set via .antilink set <text>)
                                    const _alCustomMsg = antilinkGetCustomMessage(chatJid);
                                    const _alGroupName = gMeta?.subject || 'this group';
                                    const _alLinks = linkResult.links || [];

                                    if (mode === 'delete' || mode === 'kick') {
                                        try { await sock.sendMessage(chatJid, { delete: msg.key }); } catch {}
                                    }

                                    if (mode === 'warn') {
                                        // Delete the link message first
                                        try { await sock.sendMessage(chatJid, { delete: msg.key }); } catch {}

                                        // Use the shared warn system (respects setwarn limit)
                                        const warnCount = addWarning(chatJid, senderJid);
                                        const warnLimit = getWarnLimit(chatJid);

                                        if (warnCount >= warnLimit) {
                                            // Limit reached — resolve JID then kick
                                            let kickJid;
                                            if (senderJid.includes('@lid')) {
                                                const pn = senderP?.phoneNumber ? String(senderP.phoneNumber).replace(/[^0-9]/g, '') : null;
                                                if (pn) {
                                                    kickJid = `${pn}@s.whatsapp.net`;
                                                } else {
                                                    const cachedPhone = lidPhoneCache.get(senderClean) || getPhoneFromLid(senderClean);
                                                    kickJid = cachedPhone ? `${cachedPhone}@s.whatsapp.net` : null;
                                                }
                                            } else {
                                                kickJid = `${senderClean}@s.whatsapp.net`;
                                            }

                                            resetWarnings(chatJid, senderJid);

                                            if (!kickJid) {
                                                UltraCleanLogger.warning(`🔗 ANTILINK WARN: LID unresolvable for ${senderClean}, kick skipped`);
                                                try {
                                                    await sock.sendMessage(chatJid, {
                                                        text: `⚠️ @${senderClean} has reached the warning limit (${warnLimit}/${warnLimit}) for sharing links but could not be removed — user identity unresolved.`,
                                                        mentions: [senderJid]
                                                    });
                                                } catch {}
                                            } else {
                                                const kickDisplay = kickJid.split('@')[0];
                                                try {
                                                    await sock.groupParticipantsUpdate(chatJid, [kickJid], 'remove');
                                                    const _alLimitKickVars = { user: `@${kickDisplay}`, group: _alGroupName, warns: warnLimit, limit: warnLimit, mode, link: _alLinks[0] || '', links: _alLinks.join(', ') };
                                                    await sock.sendMessage(chatJid, {
                                                        text: _alCustomMsg
                                                            ? antilinkFormatCustomMessage(_alCustomMsg, _alLimitKickVars)
                                                            : `🚫 *@${kickDisplay} KICKED!*\n\n⚠️ Warnings: ${warnLimit}/${warnLimit} (LIMIT REACHED)\n📝 Reason: Sharing links (Antilink)\n\nUser has been removed from the group.`,
                                                        mentions: [kickJid]
                                                    });
                                                } catch (kickErr) {
                                                    UltraCleanLogger.warning(`🔗 ANTILINK WARN kick failed for ${kickJid}: ${kickErr.message}`);
                                                    try {
                                                        await sock.sendMessage(chatJid, {
                                                            text: `⚠️ @${kickDisplay} reached the warn limit but could not be kicked. Make sure I have admin permissions.`,
                                                            mentions: [kickJid]
                                                        });
                                                    } catch {}
                                                }
                                            }
                                        } else {
                                            // Still within limit — send warning with count
                                            try {
                                                const _alWarnVars = { user: `@${senderClean}`, group: _alGroupName, warns: warnCount, limit: warnLimit, mode, link: _alLinks[0] || '', links: _alLinks.join(', ') };
                                                await sock.sendMessage(chatJid, {
                                                    text: _alCustomMsg
                                                        ? antilinkFormatCustomMessage(_alCustomMsg, _alWarnVars)
                                                        : `⚠️ *Link Warning* @${senderClean}\n\nLinks are not allowed in this group!\n📊 Warnings: ${warnCount}/${warnLimit}\n💡 ${warnLimit - warnCount} warning(s) left before kick.`,
                                                    mentions: [senderJid]
                                                });
                                            } catch {}
                                        }
                                    } else if (mode === 'delete') {
                                        try {
                                            const _alDelVars = { user: `@${senderClean}`, group: _alGroupName, warns: 0, limit: 0, mode, link: _alLinks[0] || '', links: _alLinks.join(', ') };
                                            await sock.sendMessage(chatJid, {
                                                text: _alCustomMsg
                                                    ? antilinkFormatCustomMessage(_alCustomMsg, _alDelVars)
                                                    : `🚫 *Link Deleted* @${senderClean}\n\nLinks are not allowed in this group!`,
                                                mentions: [senderJid]
                                            });
                                        } catch {}
                                    } else if (mode === 'kick') {
                                        // Resolve actual phone JID — senderJid may be a LID which WhatsApp can't kick
                                        let kickJid;
                                        if (senderJid.includes('@lid')) {
                                            // 1. Try phoneNumber field on the group participant
                                            const pn = senderP?.phoneNumber ? String(senderP.phoneNumber).replace(/[^0-9]/g, '') : null;
                                            if (pn) {
                                                kickJid = `${pn}@s.whatsapp.net`;
                                            } else {
                                                // 2. Try LID → phone cache
                                                const cachedPhone = lidPhoneCache.get(senderClean) || getPhoneFromLid(senderClean);
                                                // If still unresolvable, set null — do NOT fall back to @lid (WhatsApp rejects it)
                                                kickJid = cachedPhone ? `${cachedPhone}@s.whatsapp.net` : null;
                                            }
                                        } else {
                                            kickJid = `${senderClean}@s.whatsapp.net`;
                                        }
                                        if (!kickJid) {
                                            // LID unresolvable — message was already deleted above; warn group
                                            UltraCleanLogger.warning(`🔗 ANTILINK: LID unresolvable for ${senderClean}, kick skipped`);
                                            await sock.sendMessage(chatJid, {
                                                text: `⚠️ Link detected and deleted. User identity not yet resolved — kick skipped. Try again after they send another message.`
                                            }).catch(() => {});
                                        } else {
                                            const kickDisplay = kickJid.split('@')[0];
                                            try {
                                                await sock.groupParticipantsUpdate(chatJid, [kickJid], 'remove');
                                                const _alKickVars = { user: `@${kickDisplay}`, group: _alGroupName, warns: 1, limit: 1, mode, link: _alLinks[0] || '', links: _alLinks.join(', ') };
                                                await sock.sendMessage(chatJid, {
                                                    text: _alCustomMsg
                                                        ? antilinkFormatCustomMessage(_alCustomMsg, _alKickVars)
                                                        : `🚫 @${kickDisplay} has been removed for sharing links.`,
                                                    mentions: [kickJid]
                                                });
                                            } catch (kickErr) {
                                                UltraCleanLogger.warning(`🔗 ANTILINK kick failed for ${kickJid}: ${kickErr.message}`);
                                                await sock.sendMessage(chatJid, {
                                                    text: `⚠️ Failed to remove @${kickDisplay}. Make sure I have admin permissions.`,
                                                    mentions: [kickJid]
                                                }).catch(() => {});
                                            }
                                        }
                                    }

                                    return;
                                }
                            }
                        }
                    }
                }
            }

            if (msg.message && !msg.key?.fromMe && msg.key?.remoteJid?.endsWith('@g.us') && isAntiForwardEnabled(msg.key.remoteJid)) {
                antiforwardHandler(sock, msg).catch(() => {});
            }

            if (msg.message && !msg.key?.fromMe && msg.key?.remoteJid?.endsWith('@g.us') && isAntiChatEnabled(msg.key.remoteJid)) {
                antichatHandler(sock, msg).catch(() => {});
            }

            if (msg.message && msg.key?.remoteJid && !msg.key.fromMe) {
                const _bwJid = msg.key.remoteJid;
                const _bwIsGroup = _bwJid.endsWith('@g.us');
                const _bwScope = _bwIsGroup ? _bwJid : 'global';
                const _bwRawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                const _bwIsCmd = !isPrefixless && getCurrentPrefix() && _bwRawText.trimStart().startsWith(getCurrentPrefix());
                if (!_bwIsCmd && isBadWordEnabled(_bwScope)) {
                    const _bwSenderJid = msg.key.participant || _bwJid;
                    const _bwIsOwner = _bwIsGroup && jidManager.isOwner(msg);
                    if (!_bwIsOwner) {
                        const _bwMsg = msg.message;
                        const _bwText = _bwMsg?.conversation || _bwMsg?.extendedTextMessage?.text || _bwMsg?.imageMessage?.caption || _bwMsg?.videoMessage?.caption || '';
                        const _bwFound = checkMessageForBadWord(_bwText, _bwScope);
                        if (_bwFound) {
                            const _bwAction = getBadWordAction(_bwScope);
                            const _bwSenderNum = _bwSenderJid.split('@')[0].split(':')[0];
                            try { await sock.sendMessage(_bwJid, { delete: msg.key }); } catch {}
                            if (_bwAction === 'kick' && _bwIsGroup) {
                                try {
                                    await sock.sendMessage(_bwJid, { text: `🚫 *Bad Word Filter:* @${_bwSenderNum} removed for using a banned word.`, mentions: [_bwSenderJid] });
                                    await sock.groupParticipantsUpdate(_bwJid, [_bwSenderJid], 'remove');
                                } catch {}
                            } else if (_bwAction === 'block') {
                                try {
                                    await sock.updateBlockStatus(_bwSenderJid, 'block');
                                    if (_bwIsGroup) await sock.groupParticipantsUpdate(_bwJid, [_bwSenderJid], 'remove');
                                    await sock.sendMessage(_bwJid, { text: `🚫 *Bad Word Filter:* @${_bwSenderNum} has been blocked for using a banned word.`, mentions: [_bwSenderJid] });
                                } catch {}
                            } else if (_bwAction === 'warn') {
                                try {
                                    await sock.sendMessage(_bwJid, { text: `⚠️ *Bad Word Warning:* @${_bwSenderNum} please avoid using banned words!\n\n🚫 Detected word removed.`, mentions: [_bwSenderJid] });
                                } catch {}
                            } else if (_bwAction === 'delete') {
                            }
                            return;
                        }
                    }
                }
            }

            if (msg.message && msg.key?.remoteJid && !msg.key.fromMe) {
                const _asJid = msg.key.remoteJid;
                const _asRawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                const _asIsCmd = !isPrefixless && getCurrentPrefix() && _asRawText.trimStart().startsWith(getCurrentPrefix());
                if (!_asIsCmd && antispamEnabled(_asJid)) {
                    const _asIsGroup = _asJid.endsWith('@g.us');
                    const _asSenderJid = _asIsGroup ? (msg.key.participant || _asJid) : _asJid;
                    const _asIsOwner = jidManager.isOwner(msg);
                    if (!_asIsOwner) {
                        const _asMsg = msg.message;
                        const _asText = _asMsg?.conversation || _asMsg?.extendedTextMessage?.text || _asMsg?.imageMessage?.caption || _asMsg?.videoMessage?.caption || _asMsg?.documentMessage?.caption || '';
                        if (_asText.trim().length > 0) {
                            const _asIsSpam = antispamCheck(_asJid, _asSenderJid, _asText.trim());
                            if (_asIsSpam) {
                                const _asAction = antispamGetAction(_asJid);
                                const _asSenderNum = _asSenderJid.split('@')[0].split(':')[0];
                                UltraCleanLogger.warning(`🚫 ANTISPAM: Repeated msg from ${_asSenderNum} in ${_asJid.split('@')[0]} [action: ${_asAction}]`);
                                try { await sock.sendMessage(_asJid, { delete: msg.key }); } catch {}
                                if (_asAction === 'block') {
                                    try {
                                        await sock.updateBlockStatus(_asSenderJid, 'block');
                                        if (_asIsGroup) {
                                            await sock.groupParticipantsUpdate(_asJid, [_asSenderJid], 'remove');
                                            await sock.sendMessage(_asJid, {
                                                text: `🚫 *Anti-Spam:* @${_asSenderNum} has been *blocked & removed* for spamming.`,
                                                mentions: [_asSenderJid]
                                            });
                                        }
                                    } catch {}
                                } else {
                                    try {
                                        await sock.sendMessage(_asJid, {
                                            text: `⚠️ *Anti-Spam Warning:* @${_asSenderNum}, stop sending the same message repeatedly!`,
                                            mentions: [_asIsGroup ? _asSenderJid : undefined].filter(Boolean)
                                        });
                                    } catch {}
                                }
                                return;
                            }
                        }
                    }
                }
            }

            // ─── ANTI-BOT enforcement ────────────────────────────────────────────
            if (msg.message && msg.key?.remoteJid && !msg.key.fromMe) {
                const _abJid = msg.key.remoteJid;
                if (_abJid.endsWith('@g.us') && antibotEnabled(_abJid)) {
                    const _abSenderJid   = msg.key.participant || _abJid;
                    const _abSenderClean = _abSenderJid.split(':')[0].split('@')[0];
                    const _abIsOwner     = jidManager.isOwner(msg);
                    // Skip if sender is the bot itself (echoed group message)
                    const _abBotNum      = (sock.user?.id || '').split(':')[0].split('@')[0];
                    if (_abBotNum && _abSenderClean === _abBotNum) return;

                    if (!_abIsOwner && antibotCheck(msg)) {
                        let _abIsAdmin = false;
                        try {
                            const _abMeta = await sock.groupMetadata(_abJid);
                            const _abP    = _abMeta.participants.find(
                                p => p.id.split(':')[0].split('@')[0] === _abSenderClean
                            );
                            _abIsAdmin = _abP?.admin === 'admin' || _abP?.admin === 'superadmin';
                        } catch {}

                        if (!_abIsAdmin) {
                            const _abMode = antibotGetMode(_abJid);
                            UltraCleanLogger.warning(`🤖 ANTIBOT: Bot msg from ${_abSenderClean} in ${_abJid.split('@')[0]} [${_abMode}]`);

                            // Always delete the message
                            try { await sock.sendMessage(_abJid, { delete: msg.key }); } catch {}

                            if (_abMode === 'warn') {
                                try {
                                    await sock.sendMessage(_abJid, {
                                        text: `⚠️ *Anti-Bot:* @${_abSenderClean}, bot messages are not allowed in this group!`,
                                        mentions: [_abSenderJid]
                                    });
                                } catch {}
                            } else if (_abMode === 'kick') {
                                // Resolve LID to real JID if needed
                                let _abKickJid = _abSenderJid;
                                if (_abSenderJid.includes('@lid')) {
                                    try {
                                        const _abMeta2 = await sock.groupMetadata(_abJid);
                                        const _abPMatch = _abMeta2.participants.find(
                                            p => p.id.split(':')[0].split('@')[0] === _abSenderClean
                                        );
                                        if (_abPMatch?.phoneNumber) {
                                            _abKickJid = `${_abPMatch.phoneNumber}@s.whatsapp.net`;
                                        } else if (_abPMatch?.id && !_abPMatch.id.includes('@lid')) {
                                            _abKickJid = _abPMatch.id;
                                        }
                                    } catch {}
                                }
                                try {
                                    await sock.groupParticipantsUpdate(_abJid, [_abKickJid], 'remove');
                                    await sock.sendMessage(_abJid, {
                                        text: `🤖 *Anti-Bot:* @${_abSenderClean} was kicked for using a bot in this group.`,
                                        mentions: [_abSenderJid]
                                    });
                                } catch {}
                            }
                            return;
                        }
                    }
                }
            }
            // ─── END ANTI-BOT ────────────────────────────────────────────────────

            if (store && msg?.key?.remoteJid && msg?.key?.id && msg?.message) {
                store.addMessage(msg.key.remoteJid, msg.key.id, msg);
            }

            // ─── Group activity tracking (for kickinactive) ──────────────────────
            try {
                if (msg.message && msg.key?.remoteJid?.endsWith('@g.us') && !msg.key.fromMe) {
                    const _gaSender = msg.key.participant;
                    if (_gaSender) {
                        const _gaTs = (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now());
                        recordGroupActivity(msg.key.remoteJid, _gaSender, _gaTs);
                    }
                }
            } catch {}

            if (!msg.message) {
                if (store && msg.key?.remoteJid && msg.key?.id) {
                    store.addMessage(msg.key.remoteJid, msg.key.id, msg);
                }

                if (msg.key?.remoteJid === 'status@broadcast' && msg.messageStubType) {
                    statusAntideleteHandleUpdate({
                        key: msg.key,
                        update: { message: null, messageStubType: msg.messageStubType }
                    }).catch(() => {});
                    return;
                }

                if (msg.messageStubType === 29 || msg.messageStubType === 30) {
                    const stubAction = msg.messageStubType === 29 ? 'promote' : 'demote';
                    const groupId = msg.key.remoteJid;
                    const author = msg.key.participant || msg.participant;
                    const affectedJids = msg.messageStubParameters || [];

                    if (groupId && groupId.endsWith('@g.us') && affectedJids.length > 0) {
                        originalConsoleMethods.log(`🛡️ [STUB] ${stubAction} detected in ${groupId.split('@')[0]} by ${author?.split('@')[0] || 'unknown'} | count: ${affectedJids.length}`);
                        antidemoteHandler(sock, {
                            id: groupId,
                            participants: affectedJids,
                            action: stubAction,
                            author: author
                        }).catch(err => {
                            originalConsoleMethods.log(`❌ [ANTIDEMOTE] Stub handler error: ${err.message}`);
                        });
                    }
                }
                return;
            }

            if (msg.messageStubType === 29 || msg.messageStubType === 30) {
                const stubAction = msg.messageStubType === 29 ? 'promote' : 'demote';
                const groupId = msg.key.remoteJid;
                const author = msg.key.participant || msg.participant;
                const affectedJids = msg.messageStubParameters || [];

                if (groupId && groupId.endsWith('@g.us') && affectedJids.length > 0) {
                    originalConsoleMethods.log(`🛡️ [STUB+MSG] ${stubAction} detected in ${groupId.split('@')[0]} by ${author?.split('@')[0] || 'unknown'} | count: ${affectedJids.length}`);
                    antidemoteHandler(sock, {
                        id: groupId,
                        participants: affectedJids,
                        action: stubAction,
                        author: author
                    }).catch(err => {
                        originalConsoleMethods.log(`❌ [ANTIDEMOTE] Stub+msg handler error: ${err.message}`);
                    });
                }
            }

            // ── ANTI-DISAPPEARING: group ephemeral toggle (stub type 31) ──
            // Group ephemeral changes arrive as a system stub message BEFORE
            // the early-return below filters all stub messages out, so we
            // intercept them here.
            if (msg.messageStubType === 31 && msg.key?.remoteJid?.endsWith('@g.us')) {
                try {
                    const newDuration = parseInt(msg.messageStubParameters?.[0] || '0', 10) || 0;
                    const changedBy = msg.participant || msg.key?.participant || '';
                    const fromMe = msg.key?.fromMe === true;
                    import('./commands/owner/antidisp.js').then(mod => {
                        mod.handleEphemeralChange(sock, msg.key.remoteJid, newDuration, changedBy, fromMe)
                           .catch(() => {});
                    }).catch(() => {});
                } catch {}
                // fall through to the existing stub-return below
            }

            if (msg.key?.remoteJid !== 'status@broadcast' && msg.messageStubType) return;

            const normalizedUpsertContent = normalizeMessageContent(msg.message) || msg.message;
            const upsertProtoMsg = normalizedUpsertContent?.protocolMessage;

            // Handle edited messages (WhatsApp protocol type 14)
            if (upsertProtoMsg && upsertProtoMsg.type === 14) {
                const editedContent = upsertProtoMsg.editedMessage?.message;
                if (!editedContent) return; // no content, ignore
                // Overwrite msg.message with the edited content and let it fall through
                // to the normal command pipeline as if it were a fresh message
                msg.message = editedContent;
                (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`[${o.tag}] ${o.message}`)))({
                    tag: 'EDIT', color: 'yellow', icon: '✏️',
                    message: 'Edited message — reprocessing as command',
                    fields: {
                        'Msg ID': msg.key?.id,
                        'Chat':   msg.key?.remoteJid,
                    },
                });
                // fall through — do NOT return
            }

            // ── ANTI-DISAPPEARING: DM ephemeral setting change (proto type 3) ──
            if (upsertProtoMsg && upsertProtoMsg.type === 3) {
                try {
                    const newDuration = upsertProtoMsg.ephemeralExpiration || 0;
                    const changedBy = msg.key?.participant || msg.key?.remoteJid || '';
                    const fromMe = msg.key?.fromMe === true;
                    import('./commands/owner/antidisp.js').then(mod => {
                        mod.handleEphemeralChange(sock, msg.key.remoteJid, newDuration, changedBy, fromMe)
                           .catch(() => {});
                    }).catch(() => {});
                } catch {}
                return; // protocol message — nothing else to do
            }

            if (upsertProtoMsg && (upsertProtoMsg.type === 0 || upsertProtoMsg.type === 4)) {
                const revokedMsgId = upsertProtoMsg.key?.id;
                if (revokedMsgId) {
                    const revokedChatJid = upsertProtoMsg.key?.remoteJid || msg.key?.remoteJid;
                    if (msg.key?.remoteJid === 'status@broadcast' || revokedChatJid === 'status@broadcast') {
                        (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`[${o.tag}] ${o.message}`)))({
                            tag: 'STATUS-AD', color: 'purple', icon: '📡',
                            message: 'Protocol revoke detected via upsert',
                            fields: { 'Msg ID': revokedMsgId },
                        });
                        statusAntideleteHandleUpdate({
                            key: { ...msg.key, id: revokedMsgId },
                            update: { message: null, messageStubType: 1 }
                        }).catch(err => {
                            (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`❌ [${o.tag}] ${o.message}`)))({
                                tag: 'STATUS-AD', color: 'red', icon: '❌',
                                message: 'Revoke handle error',
                                fields: { 'Error': err.message },
                            });
                        });
                    } else {
                        (globalThis._printAntideleteBox || ((o) => originalConsoleMethods.log(`[ANTIDELETE] ${o.event}`)))({
                            event: 'protocol-revoke (upsert)',
                            fields: {
                                'Msg ID': revokedMsgId,
                                'Chat':   revokedChatJid,
                            },
                        });
                        antideleteHandleUpdate({
                            key: { ...msg.key, id: revokedMsgId, remoteJid: revokedChatJid },
                            update: { message: null, messageStubType: 1 }
                        }).catch(err => {
                            (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`❌ [${o.tag}] ${o.message}`)))({
                                tag: 'ANTIDELETE', color: 'red', icon: '❌',
                                message: 'Revoke handle error',
                                fields: { 'Error': err.message },
                            });
                        });
                    }
                }
                return;
            }

            if (msg.pushName && msg.key) {
                const senderJid = msg.key.participant || msg.key.remoteJid;
                if (senderJid && !senderJid.includes('status') && !senderJid.includes('broadcast')) {
                    global.contactNames = global.contactNames || new Map();
                    if (global.contactNames.size > 800) {
                        const newMap = new Map();
                        let kept = 0;
                        for (const [k, v] of global.contactNames) {
                            if (++kept > global.contactNames.size - 400) newMap.set(k, v);
                        }
                        global.contactNames = newMap;
                    }
                    global.contactNames.set(senderJid.split(':')[0].split('@')[0], msg.pushName);
                    global.contactNames.set(senderJid.split('@')[0], msg.pushName);
                }
            }

            lastActivityTime = Date.now();
            
            handleIncomingMessage(sock, msg).catch(e => {
                if (e?.message && !e.message.includes('closed') && !e.message.includes('Stream') && !e.message.includes('timed out')) {
                    (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`❌ [${o.tag}] ${o.message}`)))({
                        tag: 'Handler', color: 'red', icon: '❌',
                        message: 'Incoming handler error',
                        fields: { 'Error': e.message },
                    });
                }
            });

            handleReactOwner(sock, msg).catch(() => {});

            handleReactDev(sock, msg).catch(() => {});


            if (msg.message?.groupStatusMentionMessage) {
                (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`⚠️ [${o.tag}] ${o.message}`)))({
                    tag: 'GSM', color: 'yellow', icon: '⚠️',
                    message: 'groupStatusMentionMessage received',
                    fields: {
                        'Chat': msg.key?.remoteJid,
                        'From': msg.key?.participant || 'unknown',
                    },
                });
                // Auto-mark the GSM as read so it shows as viewed in the group.
                // Both autoview and autoreact participate — gated by their own
                // enabled flags + exclusion lists. Wrapped so a failure in one
                // never blocks the other or the antimention handler.
                if (msg.key?.remoteJid?.endsWith('@g.us')) {
                    try { autoViewManager?.viewGroupStatusMention?.(sock, msg)?.catch?.(() => {}); } catch {}
                    try { handleAutoReactGsmView(sock, msg)?.catch?.(() => {}); } catch {}
                }
                try {
                    statusMentionHandler(sock, msg).catch(() => {});
                } catch {}
            }
            
            if (msg.key?.remoteJid === 'status@broadcast') {
                // ── Status spy dump ──────────────────────────────────────────
                // When #debugstatus is ON, dump EVERY status@broadcast event
                // (fromMe OR from contacts) so we can compare a phone-posted
                // status against what the bot sends.
                if (globalThis._debugStatusMode) {
                    try {
                        const safeJson = (v) => JSON.stringify(v, (k, val) => {
                            if (val instanceof Uint8Array || Buffer.isBuffer(val))
                                return `<Buffer ${val.length}B: ${Buffer.from(val).toString('hex').substring(0, 32)}...>`;
                            return val;
                        }, 2) || '{}';

                        const msgKeys   = msg.message ? Object.keys(msg.message).join(', ') : 'none';
                        const fullJson  = safeJson(msg.message);
                        const keyJson   = safeJson(msg.key);
                        const source    = msg.key?.fromMe ? '🟢 BOT-POSTED (fromMe=true)' : `🔵 PHONE-POSTED (fromMe=false, participant=${msg.key?.participant || 'none'})`;

                        import('fs').then(fs => {
                            const path = `/tmp/status_spy_${Date.now()}.json`;
                            fs.writeFileSync(path, JSON.stringify({
                                source,
                                key: msg.key,
                                messageTimestamp: msg.messageTimestamp,
                                messageStubType: msg.messageStubType,
                                messageKeys: msg.message ? Object.keys(msg.message) : [],
                                message: msg.message
                            }, null, 2));
                            originalConsoleMethods.log(`\n[STATUS-SPY] ${source} | file=${path} | keys=${msgKeys}\n`);
                        }).catch(() => {});

                        const ownerJid = globalThis.OWNER_JID
                            ? (globalThis.OWNER_JID.split('@')[0].split(':')[0] + '@s.whatsapp.net')
                            : null;
                        if (ownerJid) {
                            const lines = [
                                `*📡 STATUS SPY EVENT*`,
                                `${source}`,
                                ``,
                                `key: ${keyJson}`,
                                `timestamp: ${msg.messageTimestamp}`,
                                `stubType: ${msg.messageStubType ?? 'none'}`,
                                `msgKeys: ${msgKeys}`,
                                ``,
                                '*message:*',
                                '```',
                                fullJson.substring(0, 2800),
                                '```'
                            ];
                            originalSendMessage(ownerJid, { text: lines.join('\n') }).catch(() => {});
                        }
                    } catch (dbgErr) {
                        originalConsoleMethods.log('[STATUS-SPY] error:', dbgErr.message);
                    }
                }
                // ── end status spy ───────────────────────────────────────────

                // Unwrap ephemeral (disappearing) status messages to get the real content
                const resolvedMessage = msg.message?.ephemeralMessage?.message || msg.message;

                // Build the status key, resolving @lid → @s.whatsapp.net for the read receipt.
                // WhatsApp only counts a status view when the receipt uses the phone number JID.
                const rawParticipant = msg.key.participant || '';
                let resolvedParticipantPn = msg.key.remoteJidAlt || msg.key.participantAlt || msg.key.participantPn || null;
                if (!resolvedParticipantPn && rawParticipant.includes('@lid')) {
                    const lidNum = rawParticipant.split('@')[0].split(':')[0];
                    const phone = lidPhoneCache.get(lidNum) || lidPhoneCache.get(rawParticipant.split('@')[0]) || getPhoneFromLid(lidNum);
                    if (phone) resolvedParticipantPn = `${phone}@s.whatsapp.net`;
                }

                const statusKeyWithTs = {
                    ...msg.key,
                    messageTimestamp: msg.messageTimestamp,
                    ...(resolvedParticipantPn ? { participantPn: resolvedParticipantPn } : {})
                };

                // Age guard — skip backlog statuses delivered at startup (older than 5 min)
                const _statusTs = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === 'object' ? msg.messageTimestamp.low || 0 : Number(msg.messageTimestamp)) * 1000
                    : 0;
                const _statusIsBacklog = _statusTs > 0 && (Date.now() - _statusTs) > 5 * 60 * 1000;

                if (!_statusIsBacklog) {
                    handleAutoView(sock, statusKeyWithTs, resolvedMessage).catch(() => {});
                    // Only react/download if the status has real content (not a delete/revoke stub, not fromMe)
                    // Use same age-based guard as autoview — skip statuses older than 5 min at startup
                    if (!msg.messageStubType && resolvedMessage && !msg.key.fromMe) {
                        handleAutoReact(sock, statusKeyWithTs).catch(() => {});
                        // Cache every status so it can be saved on demand when owner replies
                        cacheStatusMessage(statusKeyWithTs.id, statusKeyWithTs, resolvedMessage);
                    }
                    if (statusDetector) {
                        statusDetector.detectStatusUpdate(msg).catch(() => {});
                    }
                    try {
                        statusMentionHandler(sock, msg).catch(() => {});
                    } catch {}
                }
                const normalizedContent = normalizeMessageContent(msg.message) || msg.message;
                const protoMsg = normalizedContent?.protocolMessage;
                if (protoMsg && (protoMsg.type === 0 || protoMsg.type === 4)) {
                    const revokedId = protoMsg.key?.id;
                    if (revokedId) {
                        statusAntideleteHandleUpdate({
                            key: { ...msg.key, id: revokedId },
                            update: { message: null, messageStubType: 1 }
                        }).catch(() => {});
                    }
                } else {
                    // Skip status antidelete writes during startup flood window (first 60s after connect)
                    const _sadStartupSkip = connectionOpenTime > 0 && (Date.now() - connectionOpenTime < 60000);
                    if (!_sadStartupSkip) {
                        statusAntideleteStoreMessage(msg).catch(() => {});
                    }
                }
                return;
            }
            
            if (msg.key?.remoteJid?.endsWith('@newsletter')) {
                handleChannelReact(sock, msg).catch(() => {});
                autoLeave.handleChannelMessage(msg.key.remoteJid).catch(() => {});
            }

            // Skip antidelete writes during startup flood window (first 60s after connect)
            // to avoid thousands of concurrent SQLite writes + setTimeout closures spiking heap
            const _adStartupSkip = connectionOpenTime > 0 && (Date.now() - connectionOpenTime < 60000);
            if (!_adStartupSkip) {
                antideleteStoreMessage(msg).catch(() => {});
            }
        });
        
        sock.ev.on('messages.update', (updates) => {
            for (const update of updates) {
                const updateChatJid = update.key?.remoteJid;
                if (updateChatJid === 'status@broadcast') {
                    // Status spy: log delivery/receipt updates when debug is on
                    if (globalThis._debugStatusMode) {
                        try {
                            const info = JSON.stringify({
                                id: update.key?.id,
                                fromMe: update.key?.fromMe,
                                participant: update.key?.participant,
                                updateKeys: update.update ? Object.keys(update.update) : [],
                                update: update.update
                            }, (k, v) => (v instanceof Uint8Array || Buffer.isBuffer(v) ? `<Buffer ${v.length}B>` : v), 2);
                            originalConsoleMethods.log(`[STATUS-SPY UPDATE] ${info.substring(0, 400)}`);
                            const ownerJid = globalThis.OWNER_JID
                                ? (globalThis.OWNER_JID.split('@')[0].split(':')[0] + '@s.whatsapp.net')
                                : null;
                            if (ownerJid) {
                                originalSendMessage(ownerJid, {
                                    text: `*📡 STATUS UPDATE EVENT*\n\`\`\`\n${info.substring(0, 2800)}\n\`\`\``
                                }).catch(() => {});
                            }
                        } catch (_) {}
                    }
                    statusAntideleteHandleUpdate(update).catch(() => {});
                } else {
                    antideleteHandleUpdate(update).catch(() => {});
                }

                try {
                    if (update.update?.message && !update.key?.fromMe) {
                        const updatedMsg = {
                            key: update.key,
                            message: update.update.message
                        };
                    }
                } catch {}

                // Handle edited messages — try all known Baileys edit structures
                try {
                    const updMsg = update.update?.message;
                    if (updMsg && updateChatJid !== 'status@broadcast') {
                        // Structure 1: editedMessage at top level of update.message
                        const editedWrapper = updMsg.editedMessage || updMsg.protocolMessage?.editedMessage;
                        // Structure 2: protocolMessage type 14 in update.message
                        const protoEdit = updMsg.protocolMessage?.type === 14 ? updMsg.protocolMessage : null;

                        const editedContent = editedWrapper?.message || protoEdit?.editedMessage?.message;

                        if (editedContent) {
                            const editedText =
                                editedContent.conversation ||
                                editedContent.extendedTextMessage?.text ||
                                editedContent.imageMessage?.caption ||
                                editedContent.videoMessage?.caption || '';

                            (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`[${o.tag}] ${o.message}`)))({
                                tag: 'EDIT', color: 'yellow', icon: '✏️',
                                message: 'Message edited — re-processing',
                                fields: {
                                    'Msg ID':  update.key?.id,
                                    'Chat':    update.key?.remoteJid,
                                    'Preview': editedText ? `"${editedText}"` : '(media)',
                                },
                            });
                            const syntheticMsg = {
                                key: update.key,
                                message: editedContent,
                                messageTimestamp: Math.floor(Date.now() / 1000),
                                pushName: update.pushName || ''
                            };
                            sock.ev.emit('messages.upsert', { messages: [syntheticMsg], type: 'notify' });
                        }
                    }
                } catch {}
            }
        });
        
        await commandLoadPromise;
        
        if (!commandsLoaded) {
            globalThis._loadedCommandCount = commands.size;
            globalThis._wolfSysStats = globalThis._wolfSysStats || {};
            globalThis._wolfSysStats.commandsLoaded = commands.size;
            commandsLoaded = true;
        }
        updateWebStatus({ commands: commands.size, botName: getCurrentBotName(), version: VERSION, botMode: BOT_MODE, prefix: getCurrentPrefix(), owner: global.OWNER_NUMBER || 'Unknown', antispam: !!(globalThis._antispamConfig?.enabled), antibug: !!(globalThis._antibugConfig?.enabled), antilink: !!(globalThis._antilinkConfig?.enabled), antidelete: true, autoread: false });

        setTimeout(() => {
            if (!isConnected) {
                UltraCleanLogger.warning('⚠️ Connection taking longer than expected...');
            }
        }, 10000);
        
        return sock;
        
    } catch (error) {
        UltraCleanLogger.error(`❌ Connection failed: ${error.message}`);
        
        if (error.message.includes('auth') || error.message.includes('session')) {
            UltraCleanLogger.warning('🔄 Session issue detected, cleaning session and retrying...');
            cleanSession();
        }
        
        setTimeout(async () => {
            UltraCleanLogger.info('🔄 Retrying connection...');
            _isAutoRestart = true;
            await startBot(loginMode, loginData);
        }, 8000);
    }
}

// ====== RESTART AUTO-FIX TRIGGER ======
async function triggerRestartAutoFix(sock) {
    try {
        if (sock.user?.id) {
            const ownerJid = sock.user.id;
            const cleaned = jidManager.cleanJid(ownerJid);
            
            
            if (ultimateFixSystem.shouldRunRestartFix(ownerJid)) {
                
                ultimateFixSystem.markRestartFixAttempted();
                
                const fixResult = await ultimateFixSystem.applyUltimateFix(sock, ownerJid, cleaned, false, true);
                
                if (fixResult.success) {
                }
            }

        }
    } catch (error) {
        UltraCleanLogger.warning(`⚠️ Restart auto-fix error: ${error.message}`);
    }
}

async function handleSuccessfulConnection(sock, loginMode, loginData) {
    const currentTime = new Date().toLocaleTimeString();
    
    OWNER_JID = sock.user.id;
    OWNER_NUMBER = OWNER_JID.split('@')[0];
    
    try {
        const userId = sock.user.id;
        const userLid = sock.user.lid;
        const userIdNum = userId?.split('@')[0]?.split(':')[0];
        const userLidNum = userLid?.split('@')[0]?.split(':')[0];
        (globalThis._printSystemBox || ((o) => originalConsoleMethods.log(`[${o.tag}] ${o.message}`)))({
            tag: 'BOT-JID', color: 'gold', icon: '🔑',
            message: 'sock.user resolved',
            fields: {
                'ID':  userId  || 'none',
                'LID': userLid || 'none',
            },
        });
        if (userLid && userIdNum && userLidNum && !userId.includes('@lid')) {
            cacheLidPhone(userLidNum, userIdNum);
            UltraCleanLogger.info(`📱 Cached owner LID→Phone: ${userLidNum} → ${userIdNum}`);
        } else if (userId.includes('@lid') && userLid) {
            const phoneNum = userLid.split('@')[0]?.split(':')[0];
            if (phoneNum && phoneNum !== userIdNum) {
                cacheLidPhone(userIdNum, phoneNum);
                UltraCleanLogger.info(`📱 Cached owner LID→Phone: ${userIdNum} → ${phoneNum}`);
            }
        } else if (userId.includes('@lid') && !userLid) {
            UltraCleanLogger.warning(`⚠️ Owner connected with LID (${userIdNum}) but no phone mapping available from sock.user`);
        }
    } catch {}
    
    const isAutoReconnect = loginMode === 'auto';
    
    const currentConnectedNumber = jidManager.cleanJid(OWNER_JID).cleanNumber;
    const existingOwnerNumber = jidManager.owner?.cleanNumber || null;
    
    if (!existingOwnerNumber || existingOwnerNumber !== currentConnectedNumber) {
        UltraCleanLogger.info(`🔄 Updating owner to connected account: ${currentConnectedNumber}`);
        jidManager.setNewOwner(OWNER_JID, false);
    } else {
        jidManager.loadOwnerData();
    }
    
    const ownerInfo = jidManager.getOwnerInfo();
    const currentPrefix = getCurrentPrefix();
    const prefixDisplay = isPrefixless ? 'none (prefixless)' : `"${currentPrefix}"`;
    const platform = detectPlatform();
    
    updateTerminalHeader();
    
    let connectionMethod = '';
    if (loginMode === 'auto') {
        connectionMethod = 'AUTO-RECONNECT';
    } else if (loginMode === 'session') {
        connectionMethod = 'SESSION ID';
    } else {
        connectionMethod = 'PAIR CODE';
    }
    
    // End startup phase — all subsequent logs flow normally
    globalThis._wolfStartupPhase = false;

    // Only print the big system-status banner on a real cold boot.
    // In-process WhatsApp WebSocket reconnects (which happen every ~40 min
    // because WhatsApp cycles long-lived sessions) reuse the same Node
    // process and the same in-memory state — printing the giant banner
    // there used to make users (and the owner reading logs) think the
    // whole bot had restarted, when in reality only the socket reopened.
    // The small `🔁 RECONNECTED` notice (printed by handleSuccessfulConnection
    // a couple seconds later) is enough on reconnects.
    printWolfStartupBlock({
        botName:      getCurrentBotName(),
        version:      VERSION,
        platform:     detectPlatform(),
        prefix:       prefixDisplay,
        mode:         BOT_MODE,
        ownerNumber:  ownerInfo.ownerNumber,
        commandCount: commands.size,
        sqliteDriver: isUsingWasm() ? 'wasm' : 'native',
        isReconnect:  isAutoReconnect,
    });
    
    // Only send welcome message if not auto-reconnecting
    if (!isAutoReconnect && isFirstConnection && !hasSentWelcomeMessage) {
        try {
            const start = Date.now();
            const cleaned = jidManager.cleanJid(OWNER_JID);
            
            const loadingMessage = await sock.sendMessage(OWNER_JID, {
                text: ` *${getCurrentBotName()}* is starting up... █▒▒▒▒▒▒▒▒▒`
            });

            const latency = Date.now() - start;
            
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeText = `${hours}h ${minutes}m ${seconds}s`;
            
            await sock.sendMessage(OWNER_JID, {
                text: `
╭━━🌕 *WELCOME TO ${BOT_NAME.toUpperCase()}* 🌕━━╮
┃  ⚡ *User:* ${cleaned.cleanNumber}
┃  🔴 *Prefix:* ${prefixDisplay}
┃  *Ultimatefix:* ✅ 
┃  🏗️ *Platform:* ${platform}
┃  ⏱️ *Latency:* ${latency}ms
┃  ⏰ *Uptime:* ${uptimeText}
┃  👥 *Member Detection:* ✅ ACTIVE
┃  🔗 *Status:* ✅ Connected
┃  🎯 *Mood:* Ready to Serve
┃  👑 *Owner:* ✅ Yes
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
_ The Moon Watches — Welcome New Owner_
`,
                edit: loadingMessage.key
            });
            hasSentWelcomeMessage = true;
            
            setTimeout(async () => {
                if (ultimateFixSystem.isFixNeeded(OWNER_JID)) {
                    await ultimateFixSystem.applyUltimateFix(sock, OWNER_JID, cleaned, true);
                }
            }, 500);
        } catch {
            // Silent fail
        }
    }
}

async function handleConnectionCloseSilently(lastDisconnect, loginMode, phoneNumber) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const { DisconnectReason } = await import('wolfsocket');
    
    connectionAttempts++;
    isConnected = false;

    // A restart/conflict can also return 401 with "conflict" in the message.
    // We must NOT treat that as a real logout — it just needs a reconnect.
    const _errMsg = (
        lastDisconnect?.error?.message ||
        lastDisconnect?.error?.output?.payload?.message || ''
    ).toLowerCase();
    const _isConflict401 = statusCode === DisconnectReason.loggedOut && _errMsg.includes('conflict');
    
    const loggedOut = statusCode === DisconnectReason.loggedOut && !_isConflict401;
    
    if (loggedOut) {
        // Always clean ALL session remnants (files + DB tables + hash) on any logout
        UltraCleanLogger.warning(`🧹 Session logged out (attempt ${connectionAttempts}). Clearing all session remnants...`);
        cleanSession();

        if (connectionAttempts >= 3) {
            UltraCleanLogger.error('❌ Session logged out permanently — all remnants cleared.');
            UltraCleanLogger.error('❌ Your SESSION_ID has expired or been revoked by WhatsApp.');
            UltraCleanLogger.info('💡 Update your SESSION_ID env var with a fresh one, then restart the bot.');
            // Write a revoked marker so main() won't re-apply this SESSION_ID on next boot
            try {
                const _revokedRaw = (process.env.SESSION_ID || '').trim();
                if (_revokedRaw) {
                    const _revokedFp = (await import('crypto'))
                        .createHash('sha256').update(_revokedRaw).digest('hex');
                    fs.writeFileSync('./.session_revoked', _revokedFp, 'utf8');
                }
            } catch {}
            // Do NOT loop — wait for operator to update SESSION_ID and restart
            return;
        }

        const logoutDelay = Math.min(15000 * Math.pow(2, Math.min(connectionAttempts, 3)), 120000);
        UltraCleanLogger.info(`🔄 Restarting in ${Math.round(logoutDelay/1000)}s with fresh session from SESSION_ID...`);
        setTimeout(async () => {
            await main();
        }, logoutDelay);
        return;
    }
    
    if (statusCode === 409 || statusCode === 440 || _isConflict401) {
        connectionAttempts = 0; // conflicts are not real logouts — don't burn retries
        conflictCount++;
        isConflictRecovery = true;
        if (conflictCount >= 10) {
            UltraCleanLogger.warning(`⚠️ Too many conflicts (${conflictCount}). Waiting 5 minutes before retry to let other sessions settle...`);
            conflictCount = 0;
            setTimeout(async () => {
                await main();
            }, 300000);
            return;
        }
        const conflictDelay = Math.min(8000 + (conflictCount * 5000), 120000);
        UltraCleanLogger.warning(`Device conflict detected (${statusCode}). Attempt ${conflictCount}. Reconnecting in ${Math.round(conflictDelay/1000)}s...`);
        if (conflictCount === 3) {
            UltraCleanLogger.warning(`Multiple conflicts - clearing stale encryption keys...`);
            try {
                const sessionFiles = fs.readdirSync(SESSION_DIR);
                let cleared = 0;
                for (const file of sessionFiles) {
                    if (file.startsWith('sender-key-') || file.startsWith('session-') || 
                        file.startsWith('pre-key-') || file.startsWith('app-state-sync')) {
                        fs.unlinkSync(path.join(SESSION_DIR, file));
                        cleared++;
                    }
                }
                if (cleared > 0) {
                    UltraCleanLogger.info(`🔑 Cleared ${cleared} stale signal keys to fix encryption`);
                }
            } catch (cleanErr) {
                UltraCleanLogger.warning(`Signal key cleanup error: ${cleanErr.message}`);
            }
        }
        if (conflictCount >= 5) {
            UltraCleanLogger.warning(`⚠️ Persistent conflict (attempt ${conflictCount}) - another WhatsApp Web/device session may be open. Close other sessions to fix.`);
        }
        setTimeout(async () => {
            _isAutoRestart = true;
            await startBot(loginMode, phoneNumber);
        }, conflictDelay);
        return;
    }
    
    if (statusCode === 403) {
        if (connectionAttempts >= 3) {
            UltraCleanLogger.error(`❌ Auth error (${statusCode}) persisted after ${connectionAttempts} attempts.`);
            UltraCleanLogger.error('❌ Your session is no longer valid. Please generate a new SESSION_ID.');
            UltraCleanLogger.info('💡 To fix: Get a new SESSION_ID → set it in your .env or environment → restart the bot.');
            return;
        }
        UltraCleanLogger.warning(`Auth error (${statusCode}) detected (attempt ${connectionAttempts}/3), cleaning session...`);
        cleanSession();
        const authDelay = Math.min(15000 * Math.pow(2, Math.min(connectionAttempts, 3)), 120000);
        UltraCleanLogger.info(`🔄 Restarting in ${Math.round(authDelay/1000)}s after auth error...`);
        setTimeout(async () => {
            await main();
        }, authDelay);
        return;
    }
    
    const errorMsg = lastDisconnect?.error?.message || '';
    const errorOutput = lastDisconnect?.error?.output?.payload?.message || '';
    const combinedError = `${errorMsg} ${errorOutput}`.toLowerCase();
    
    if (combinedError.includes('decrypt') || combinedError.includes('bad mac') || 
        combinedError.includes('hmac') || statusCode === 515) {
        UltraCleanLogger.warning(`Session decryption error detected (${statusCode}). Clearing signal keys and reconnecting...`);
        try {
            const sessionFiles = fs.readdirSync(SESSION_DIR);
            for (const file of sessionFiles) {
                if (file.startsWith('sender-key-') || file.startsWith('session-') || 
                    file.startsWith('pre-key-') || file.startsWith('app-state-sync')) {
                    fs.unlinkSync(path.join(SESSION_DIR, file));
                }
            }
            UltraCleanLogger.info('Signal keys cleared, keeping creds.json intact');
        } catch (cleanErr) {
            UltraCleanLogger.warning(`Signal key cleanup error: ${cleanErr.message}`);
        }
        setTimeout(async () => {
            _isAutoRestart = true;
            await startBot(loginMode, phoneNumber);
        }, 3000);
        return;
    }
    
    const baseDelay = 3000;
    const maxDelay = 30000;
    const delayTime = Math.min(baseDelay * Math.pow(1.5, connectionAttempts - 1), maxDelay);
    
    UltraCleanLogger.info(`🔄 Reconnecting in ${Math.round(delayTime/1000)}s (attempt ${connectionAttempts})...`);
    
    setTimeout(async () => {
        if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
            connectionAttempts = 0;
            UltraCleanLogger.critical('Max retry attempts reached. Restarting from scratch...');
            await main();
        } else {
            _isAutoRestart = true;
            await startBot(loginMode, phoneNumber);
        }
    }, delayTime);
}


// ====== CONNECT COMMAND HANDLER ======
async function handleConnectCommand(sock, msg, args, cleaned, opts = {}) {
    try {
        const chatJid = msg.key.remoteJid || cleaned.cleanJid;
        const start = Date.now();
        const currentPrefix = getCurrentPrefix();
        const prefixDisplay = isPrefixless ? 'none (prefixless)' : `"${currentPrefix}"`;
        const platform = detectPlatform();
        
        // const loadingMessage = await sock.sendMessage(chatJid, {
        //     text: ` *${getCurrentBotName()}* is checking connection... █▒▒▒▒▒▒▒▒▒`
        // }, { quoted: msg });

        const latency = Date.now() - start;
        
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeText = `${hours}h ${minutes}m ${seconds}s`;
        
        const isOwnerUser = jidManager.isOwner(msg);
        const ultimatefixStatus = isOwnerUser ? '✅' : '❌';
        
        const memberStats = memberDetector ? memberDetector.getStats() : null;
        
        let statusEmoji, statusText, mood;
        if (latency <= 100) {
            statusEmoji = "🟢";
            statusText = "Excellent";
            mood = "⚡Superb Connection";
        } else if (latency <= 300) {
            statusEmoji = "🟡";
            statusText = "Good";
            mood = "📡Stable Link";
        } else {
            statusEmoji = "🔴";
            statusText = "Slow";
            mood = "🌑Needs Optimization";
        }
        
//         await sock.sendMessage(chatJid, {
//             text: `
// ╭━━🌕 *CONNECTION STATUS* 🌕━━╮
// ┃  ⚡ *User:* ${cleaned.cleanNumber}
// ┃  🔴 *Prefix:* ${prefixDisplay}
// ┃  *Ultimatefix:* ${ultimatefixStatus}
// ┃  🏗️ *Platform:* ${platform}
// ┃  ⏱️ *Latency:* ${latency}ms ${statusEmoji}
// ┃  ⏰ *Uptime:* ${uptimeText}
// ┃  👥 *Members:* ${memberStats ? `${memberStats.totalEvents} events` : 'Not loaded'}
// ┃  🔐 *ViewOnce:* ${// ┃  🔗 *Status:* ${statusText}
// ┃  🎯 *Mood:* ${mood}
// ┃  👑 *Owner:* ${isOwnerUser ? '✅ Yes' : '❌ No'}
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
// _ The Moon Watches — ..._
// `,
//             edit: loadingMessage.key
//         }, { quoted: msg });
        
        if (!opts.suppressLog) {
            UltraCleanLogger.command(`Connect from ${cleaned.cleanNumber}`);
        }
        
        return true;
    } catch {
        return false;
    }
}

// ====== MESSAGE HANDLER ======

function extractTextFromMessage(messageObj) {
    const content = normalizeMessageContent(messageObj);
    if (!content) return '';
    
    if (content.interactiveResponseMessage) {
        const irm = content.interactiveResponseMessage;
        try {
            const nativeFlow = irm?.nativeFlowResponseMessage;
            if (nativeFlow?.paramsJson) {
                const params = JSON.parse(nativeFlow.paramsJson);
                if (params.id) {
                    console.log('[BtnClick] nativeFlow.id:', params.id);
                    return params.id;
                }
            }
        } catch {}
        try {
            if (irm?.nativeFlowResponseMessage?.name === 'quick_reply') {
                const params = JSON.parse(irm.nativeFlowResponseMessage.paramsJson || '{}');
                if (params.id) return params.id;
            }
        } catch {}
        const body = irm?.body?.text;
        if (body) {
            console.log('[BtnClick] body.text fallback:', body);
            return body;
        }
        console.log('[BtnClick] Raw interactiveResponseMessage keys:', JSON.stringify(Object.keys(irm || {})));
        try { console.log('[BtnClick] Full IRM:', JSON.stringify(irm).substring(0, 500)); } catch {}
    }
    
    if (content.buttonsResponseMessage) {
        const btnId = content.buttonsResponseMessage.selectedButtonId || 
               content.buttonsResponseMessage.selectedDisplayText || '';
        if (btnId) console.log('[BtnClick] buttonsResponse:', btnId);
        return btnId;
    }
    
    if (content.listResponseMessage) {
        return content.listResponseMessage.singleSelectReply?.selectedRowId || 
               content.listResponseMessage.title || '';
    }
    
    if (content.templateButtonReplyMessage) {
        return content.templateButtonReplyMessage.selectedId || 
               content.templateButtonReplyMessage.selectedDisplayText || '';
    }
    
    return content.conversation ||
           content.extendedTextMessage?.text ||
           content.imageMessage?.caption ||
           content.videoMessage?.caption ||
           content.documentMessage?.caption ||
           content.documentWithCaptionMessage?.message?.documentMessage?.caption || '';
}

// ====== SECTION 22: handleIncomingMessage() — COMMAND DISPATCH PIPELINE ======
// Called once per message from messages.upsert (Section 21).
// This is the brain of the bot — it decides what to do with every message.
//
// Pipeline steps (in order):
//   1.  Extract chatId, senderJid, and the clean message text (getMessageText)
//   2.  Resolve LID → phone if the sender has a @lid JID
//   3.  Determine isOwner, isSudo, isGroup, isFromMe
//   4.  Check BOT_MODE (public / silent / groups / dms / buttons):
//         silent → only owner/sudo commands work
//         groups → only respond in groups
//         dms    → only respond in DMs
//   5.  Check if sender is blocked (blocked_users list) → silently ignore
//   6.  Check whitelist (if enabled) → only respond to whitelisted chats
//   7.  Wolf AI DM check: if message is in owner/sudo DM AND wolf AI is enabled →
//         WolfAI.handle() (lib/wolfai.js) takes over; command execution may follow
//   8.  Group chatbot check: if isChatbotActiveForChat(chatId) → handleChatbotMessage
//   9.  Prefix detection:
//         isPrefixless=false → message must start with prefixCache (e.g. ".")
//         isPrefixless=true  → any message is a potential command
//  10.  Parse command name and args from the message text
//  11.  Look up command in the commands Map → call command.execute(sock, msg, args, extra)
//  12.  If command not found → handleDefaultCommand() for built-in fallbacks
//
// The "extra" object passed to every command contains:
//   sock, msg, chatId, senderJid, isOwner, isSudo, isGroup, args,
//   reply(text), react(emoji), download(url), prefix, botName, …
async function handleIncomingMessage(sock, msg) {
    const startTime = Date.now();
    
    try {
        // ── Normalise remoteJid early ─────────────────────────────────────────
        // fromMe=true echoes (owner typing in someone else's chat) arrive with:
        //   • Device-suffixed JIDs: 254785471416:16@s.whatsapp.net  → strip :16
        //   • @lid JIDs: 161031913480224@lid → resolve to phone@s.whatsapp.net
        // Normalising here means all downstream code (commands, fkontak, etc.)
        // automatically uses the correct destination JID.
        if (msg.key && msg.key.remoteJid) {
            const _rawJid = msg.key.remoteJid;
            if (_rawJid.endsWith('@s.whatsapp.net') && _rawJid.includes(':')) {
                msg.key.remoteJid = jidNormalizedUser(_rawJid);
            } else if (_rawJid.endsWith('@lid')) {
                // For LID-addressed DMs: KEEP the @lid JID as-is so replies are
                // delivered to the same endpoint that sent the message. Many
                // newer WhatsApp accounts are LID-only and their corresponding
                // phone@s.whatsapp.net endpoint silently drops messages. We
                // still cache the LID↔phone mapping for sudo/owner lookups.
                try {
                    const _phone = await resolvePhoneFromLidAsync(_rawJid);
                    if (_phone) {
                        if (!globalThis._lidDeviceHints) globalThis._lidDeviceHints = {};
                        const _pnUser = _phone.replace(/[^0-9]/g, '');
                        globalThis._lidDeviceHints[_pnUser] = _rawJid;
                    }
                } catch {}
                // remoteJid stays as @lid — Baileys v7 routes replies natively
            }
        }
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || chatId;
        
        const isGroup = chatId.includes('@g.us');
        
        if (isGroup && senderJid.includes('@lid')) {
            resolvePhoneFromLid(senderJid);
        }

        // ── DM LID pre-cache ─────────────────────────────────────────────────
        // When ANY DM arrives (whether @lid or @s.whatsapp.net), ensure
        // phoneLidCache has the mapping BEFORE the command runs.
        // When a DM arrives with remoteJid as @lid (LID-only / LID-migrated
        // accounts), eagerly resolve and cache the LID<>phone mapping NOW
        // before any command runs. This ensures the sendMessage wrapper can
        // find the @lid and route the reply correctly on the FIRST response,
        // instead of silently dropping it to a dead phone@s.whatsapp.net.
        // Without this, the bot logs sent but the user never sees the reply
        // until enough messages populate the cache naturally.
        if (!isGroup && chatId.endsWith('@lid')) {
            try {
                const _dmLidNum = chatId.split('@')[0].split(':')[0];
                const _alreadyCached = lidPhoneCache.get(_dmLidNum) || getPhoneFromLid(_dmLidNum);
                if (!_alreadyCached) {
                    resolvePhoneFromLidAsync(chatId).then(_phone => {
                        if (_phone) {
                            const _pn = _phone.replace(/[^0-9]/g, '');
                            cacheLidPhone(_dmLidNum, _pn);
                        }
                    }).catch(() => {});
                }
                // Ensure phoneLidCache has reverse mapping so sendMessage
                // can swap phone->lid for replies going to this user's number
                const _resolvedPhone = _alreadyCached || lidPhoneCache.get(_dmLidNum);
                if (_resolvedPhone) {
                    const _pn = String(_resolvedPhone).replace(/[^0-9]/g, '');
                    if (!phoneLidCache.has(_pn)) {
                        phoneLidCache.set(_pn, _dmLidNum);
                    }
                }
            } catch {}
        }
        
        if (isUserBlocked(senderJid)) {
            return;
        }

        
        try {
            autoLinkSystem.shouldAutoLink(sock, msg).then(linked => {
                if (linked) {
                    UltraCleanLogger.info(`✅ Auto-linking completed for ${senderJid.split('@')[0]}`);
                }
            }).catch(() => {});
        } catch {}
        
        
        try {
            const isOwnerMsg = jidManager.isOwner(msg) || msg.key.fromMe;
            
            const rawMsg = msg.message || {};
            const msgContent = normalizeMessageContent(rawMsg) || rawMsg;
            const isSticker = !!msgContent.stickerMessage;
            let rawText = msgContent.conversation || 
                           msgContent.extendedTextMessage?.text || 
                           msgContent.imageMessage?.caption || '';
            if (!rawText && msgContent.interactiveResponseMessage) {
                try {
                    const nf = msgContent.interactiveResponseMessage?.nativeFlowResponseMessage;
                    if (nf?.paramsJson) { const p = JSON.parse(nf.paramsJson); if (p.id) rawText = p.id; }
                } catch {}
                if (!rawText) rawText = msgContent.interactiveResponseMessage?.body?.text || '';
            }
            if (!rawText && msgContent.buttonsResponseMessage) rawText = msgContent.buttonsResponseMessage.selectedButtonId || '';
            if (!rawText && msgContent.listResponseMessage) rawText = msgContent.listResponseMessage.singleSelectReply?.selectedRowId || '';
            if (!rawText && msgContent.templateButtonReplyMessage) rawText = msgContent.templateButtonReplyMessage.selectedId || '';
            const trimmed = rawText.trim();
            const isEmojiOnly = trimmed.length > 0 && trimmed.length <= 10 && /^[\p{Emoji_Presentation}\p{Emoji}\u200d\ufe0f\s]+$/u.test(trimmed);
            
            // ── Owner replied to a status with text or sticker → save it to DM ──
            if (isOwnerMsg && msg.key.fromMe) {
                const _srCtx = msgContent.extendedTextMessage?.contextInfo
                             || msgContent.stickerMessage?.contextInfo;
                const _isTextReply    = !!(msgContent.extendedTextMessage?.text || msgContent.conversation);
                const _isStickerReply = !!msgContent.stickerMessage;
                // Guard: only fire if the stanzaId is actually in the real status cache.
                // Many commands (.ping, .alive, .menu, etc.) use fake quoted contact cards
                // with remoteJid:'status@broadcast' for visual styling. Without this check
                // those would trigger a false "STATUS NOT FOUND" DM to the owner.
                if ((_isTextReply || _isStickerReply) && _srCtx?.remoteJid === 'status@broadcast' && _srCtx?.stanzaId && isStatusCached(_srCtx.stanzaId)) {
                    triggerSaveFromOwnerReply(sock, _srCtx).catch(() => {});
                }
            }

            if ((isSticker || isEmojiOnly) && isOwnerMsg) {
                const replyCtx = msgContent.stickerMessage?.contextInfo || 
                                msgContent.extendedTextMessage?.contextInfo ||
                                msgContent.imageMessage?.contextInfo ||
                                msgContent.videoMessage?.contextInfo;
                
                if (replyCtx?.quotedMessage) {
                    // ── Owner sticker/emoji reply → view-once retrieval ──────────
                    // Silently download view-once media and send to owner's private DM.
                    try {
                        const _qm = replyCtx.quotedMessage;

                        // ── isViewOnceMessage (mirrors vv.js logic exactly) ──────
                        const _isVO = !!(
                            _qm.imageMessage?.viewOnce             ||
                            _qm.videoMessage?.viewOnce             ||
                            _qm.audioMessage?.viewOnce             ||
                            _qm.viewOnceMessageV2                  ||
                            _qm.viewOnceMessageV2Extension         ||
                            _qm.viewOnceMessage                    ||
                            _qm.ephemeralMessage?.message?.viewOnceMessage
                        );

                        if (_isVO) {
                            // ── extractViewOnceMedia (mirrors vv.js logic) ───────
                            let _mediaType = null;
                            let _mediaMsg  = null;

                            if (_qm.imageMessage?.viewOnce) {
                                _mediaType = 'image'; _mediaMsg = _qm.imageMessage;
                            } else if (_qm.videoMessage?.viewOnce) {
                                _mediaType = 'video'; _mediaMsg = _qm.videoMessage;
                            } else if (_qm.audioMessage?.viewOnce) {
                                _mediaType = 'audio'; _mediaMsg = _qm.audioMessage;
                            } else {
                                const _inner = _qm.viewOnceMessageV2?.message
                                    || _qm.viewOnceMessageV2Extension?.message
                                    || _qm.viewOnceMessage?.message
                                    || _qm.ephemeralMessage?.message?.viewOnceMessage?.message;
                                if (_inner?.imageMessage) { _mediaType = 'image'; _mediaMsg = _inner.imageMessage; }
                                else if (_inner?.videoMessage) { _mediaType = 'video'; _mediaMsg = _inner.videoMessage; }
                                else if (_inner?.audioMessage) { _mediaType = 'audio'; _mediaMsg = _inner.audioMessage; }
                            }

                            if (_mediaType) {
                                // Reconstruct WAMessage for downloader
                                const _syntheticMsg = {
                                    key: {
                                        remoteJid:   chatId,
                                        id:          replyCtx.stanzaId || '',
                                        participant: replyCtx.participant,
                                        fromMe:      replyCtx.fromMe || false,
                                    },
                                    message: _qm,
                                };

                                // reuploadRequest is CRITICAL — refreshes expired view-once URLs
                                const _buf = await downloadMediaMessage(
                                    _syntheticMsg, 'buffer', {},
                                    { logger: { level: 'silent' }, reuploadRequest: sock.updateMediaMessage }
                                );

                                if (!_buf || _buf.length === 0) throw new Error('empty buffer');

                                const _ownerInfo  = jidManager.getOwnerInfo();
                                const _ownerDmJid = _ownerInfo?.ownerJid
                                    || `${senderJid.split('@')[0].split(':')[0]}@s.whatsapp.net`;

                                const _caption = `*Retrieved by ${global.BOT_NAME || 'WOLFBOT'}* `;
                                const _mime    = _mediaMsg.mimetype
                                    || (_mediaType === 'video' ? 'video/mp4' : _mediaType === 'audio' ? 'audio/mpeg' : 'image/jpeg');

                                if (_mediaType === 'video') {
                                    await sock.sendMessage(_ownerDmJid, {
                                        video: _buf, caption: _caption, mimetype: _mime, _skipChannelMode: true
                                    });
                                } else if (_mediaType === 'audio') {
                                    await sock.sendMessage(_ownerDmJid, {
                                        audio: _buf, mimetype: _mime, _skipChannelMode: true
                                    });
                                } else {
                                    await sock.sendMessage(_ownerDmJid, {
                                        image: _buf, caption: _caption, mimetype: _mime, _skipChannelMode: true
                                    });
                                }
                            }
                        }
                    } catch {}
                    // Always silent — no reply, no reaction in the original chat
                }
            }
        } catch {}

        try {
            const isOwnerReaction = jidManager.isOwner(msg) || msg.key.fromMe;

            const rawMsg = msg.message || {};
            const msgContent2 = normalizeMessageContent(rawMsg) || rawMsg;
            const reactionMsg = msgContent2.reactionMessage;

            if (reactionMsg && reactionMsg.key && reactionMsg.text && isOwnerReaction) {
                const reactedKey    = reactionMsg.key;
                const reactedMsgId  = reactedKey.id;
                const reactedChatId = reactedKey.remoteJid || chatId;

                // ── Look up the reacted message from the local store ─────────
                const storedMsg = store.getMessage(reactedChatId, reactedMsgId);
                if (!storedMsg) return; // not cached — nothing we can do

                const _qm = storedMsg.message
                    ? (normalizeMessageContent(storedMsg.message) || storedMsg.message)
                    : storedMsg;

                // ── Is it a view-once? (same check as sticker path) ──────────
                const _isVO = !!(
                    _qm.imageMessage?.viewOnce             ||
                    _qm.videoMessage?.viewOnce             ||
                    _qm.audioMessage?.viewOnce             ||
                    _qm.viewOnceMessageV2                  ||
                    _qm.viewOnceMessageV2Extension         ||
                    _qm.viewOnceMessage                    ||
                    _qm.ephemeralMessage?.message?.viewOnceMessage
                );

                if (!_isVO) return; // reacted to a regular message — ignore

                // ── Extract media type + message object ──────────────────────
                let _mediaType = null;
                let _mediaMsg  = null;

                if (_qm.imageMessage?.viewOnce) {
                    _mediaType = 'image'; _mediaMsg = _qm.imageMessage;
                } else if (_qm.videoMessage?.viewOnce) {
                    _mediaType = 'video'; _mediaMsg = _qm.videoMessage;
                } else if (_qm.audioMessage?.viewOnce) {
                    _mediaType = 'audio'; _mediaMsg = _qm.audioMessage;
                } else {
                    const _inner = _qm.viewOnceMessageV2?.message
                        || _qm.viewOnceMessageV2Extension?.message
                        || _qm.viewOnceMessage?.message
                        || _qm.ephemeralMessage?.message?.viewOnceMessage?.message;
                    if (_inner?.imageMessage) { _mediaType = 'image'; _mediaMsg = _inner.imageMessage; }
                    else if (_inner?.videoMessage) { _mediaType = 'video'; _mediaMsg = _inner.videoMessage; }
                    else if (_inner?.audioMessage) { _mediaType = 'audio'; _mediaMsg = _inner.audioMessage; }
                }

                if (!_mediaType) return;

                // ── Reconstruct WAMessage for the downloader ─────────────────
                const _syntheticMsg = {
                    key: {
                        remoteJid:   reactedChatId,
                        id:          reactedMsgId,
                        participant: reactedKey.participant,
                        fromMe:      reactedKey.fromMe || false,
                    },
                    message: storedMsg.message || storedMsg,
                };

                // reuploadRequest refreshes expired view-once URLs
                const _buf = await downloadMediaMessage(
                    _syntheticMsg, 'buffer', {},
                    { logger: { level: 'silent' }, reuploadRequest: sock.updateMediaMessage }
                );

                if (!_buf || _buf.length === 0) return;

                const _ownerInfo  = jidManager.getOwnerInfo();
                const _ownerDmJid = _ownerInfo?.ownerJid
                    || `${senderJid.split('@')[0].split(':')[0]}@s.whatsapp.net`;

                const _caption = `*Retrieved by ${global.BOT_NAME || 'WOLFBOT'}* `;
                const _mime    = _mediaMsg.mimetype
                    || (_mediaType === 'video' ? 'video/mp4' : _mediaType === 'audio' ? 'audio/mpeg' : 'image/jpeg');

                if (_mediaType === 'video') {
                    await sock.sendMessage(_ownerDmJid, {
                        video: _buf, caption: _caption, mimetype: _mime, _skipChannelMode: true
                    });
                } else if (_mediaType === 'audio') {
                    await sock.sendMessage(_ownerDmJid, {
                        audio: _buf, mimetype: _mime, _skipChannelMode: true
                    });
                } else {
                    await sock.sendMessage(_ownerDmJid, {
                        image: _buf, caption: _caption, mimetype: _mime, _skipChannelMode: true
                    });
                }
            }
        } catch {}

        const textMsg = extractTextFromMessage(msg.message);
        
        if (!textMsg) {
            const _isChannelChat = typeof chatId === 'string' && chatId.endsWith('@newsletter');
            if (!isGroup && !_isChannelChat && !msg.key.fromMe && chatId !== 'status@broadcast') {
                const _knownMediaTypes = ['imageMessage','videoMessage','audioMessage','stickerMessage',
                    'documentMessage','contactMessage','locationMessage','liveLocationMessage',
                    'viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','reactionMessage'];
                const _foundType = _knownMediaTypes.find(k => msg.message?.[k]);
                if (!_foundType) {
                    const _msgKeys = Object.keys(msg.message || {}).join(',');
                    const _silentTypes = ['protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo'];
                    const _isSilent = _silentTypes.some(t => _msgKeys.includes(t));
                    if (!_isSilent) {
                        UltraCleanLogger.info(`[DM-DROP] Unrecognised message type in DM from ${chatId.split('@')[0].slice(-6)} — keys: ${_msgKeys}`);
                    }
                }
            }
            return;
        }

        
        const currentPrefix = getCurrentPrefix();
        
        let commandName = '';
        let args = [];
        
        if (!isPrefixless && textMsg.startsWith(currentPrefix)) {
            const spaceIndex = textMsg.indexOf(' ', currentPrefix.length);
            commandName = spaceIndex === -1 
                ? textMsg.slice(currentPrefix.length).toLowerCase().trim()
                : textMsg.slice(currentPrefix.length, spaceIndex).toLowerCase().trim();
            
            args = spaceIndex === -1 ? [] : textMsg.slice(spaceIndex).trim().split(/\s+/);
        } else if (isPrefixless) {
            const words = textMsg.trim().split(/\s+/);
            const firstWord = words[0].toLowerCase();
            
            if (commands.has(firstWord)) {
                commandName = firstWord;
                args = words.slice(1);
            } else {
                const defaultCommands = ['ping', 'help', 'uptime', 'statusstats', 
                                       'ultimatefix', 'prefixinfo',
                                       ];
                if (defaultCommands.includes(firstWord)) {
                    commandName = firstWord;
                    args = words.slice(1);
                }
            }
        }
        
        if (!commandName) {
            const prefixBypassNames = ['prefix', 'prefixinfo', 'myprefix', 'botprefix'];
            const stripped = textMsg.replace(/^[^a-zA-Z0-9]+/, '').toLowerCase().trim().split(/\s+/)[0];
            if (prefixBypassNames.includes(stripped)) {
                commandName = 'prefixinfo';
                args = [];
            }
        }
        
        // ── Internal button ID intercept ─────────────────────────────────────
        // Button quick_reply IDs that start with __ are internal bot actions.
        // They arrive without a prefix so we match them directly to commands.
        if (!commandName && textMsg.trim().startsWith('__') && textMsg.trim().endsWith('__')) {
            const _btnId = textMsg.trim().replace(/^__|__$/g, '').toLowerCase(); // e.g. repo_zip
            const _btnCmd = _btnId.replace(/_/g, '');                            // e.g. repozip
            if (commands.has(_btnId)) {
                commandName = _btnId;
                args = [];
            } else if (commands.has(_btnCmd)) {
                commandName = _btnCmd;
                args = [];
            } else {
                // Try aliases — walk all commands to find one whose aliases include this id
                for (const [, _cmd] of commands) {
                    if (Array.isArray(_cmd.aliases) && (_cmd.aliases.includes(_btnId) || _cmd.aliases.includes(_btnCmd) || _cmd.aliases.includes(textMsg.trim()))) {
                        commandName = _cmd.name;
                        args = [];
                        break;
                    }
                }
            }
        }

        // If the user replied to a mygroups list message with a plain number,
        // route it to the mygroups command even though it has no prefix
        if (!commandName && /^\d+$/.test(textMsg.trim())) {
            const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
            if (stanzaId && globalThis.groupListCache?.has(stanzaId)) {
                commandName = 'mygroups';
                args = [textMsg.trim()];
            }
            // If the user replied to a ?chatbot listgroups message with a plain number,
            // route it to the chatbot command so the JID copy button is shown.
            if (!commandName && stanzaId && globalThis._chatbotGroupListCache?.has(stanzaId)) {
                commandName = 'chatbot';
                args = [textMsg.trim()];
            }
        }

        // If the user replied "leave" / "yes" to a mygroups JID bubble,
        // route it to the mygroupleave command (no prefix needed).
        if (!commandName && /^(leave|yes|y|leave\s+group|confirm)$/i.test(textMsg.trim())) {
            const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
            if (stanzaId && globalThis._mygroupLeavePrompts?.has(stanzaId)) {
                const prompt = globalThis._mygroupLeavePrompts.get(stanzaId);
                // Refresh the action session so mygroupleave can find the target group
                try {
                    const { setActionSession } = await import('./lib/actionSession.js');
                    setActionSession(`mygroup:${prompt.senderJid?.split('@')[0]}`, {
                        id: prompt.groupId,
                        name: prompt.groupName
                    });
                } catch {}
                commandName = 'mygroupleave';
                args = [];
            }
        }

        if (!commandName) {
            if (jidManager.isOwner(msg) && textMsg && textMsg.trim().length > 0) {
                if (senderJid.includes('@lid')) resolvePhoneFromLid(senderJid);
                const ownerDisplay = getDisplayNumber(senderJid);
                const ownerLocTag = isGroup ? `[${chatId.split('@')[0].substring(0, 10)}]` : '[DM]';
                const preview = textMsg.length > 60 ? textMsg.substring(0, 60) + '…' : textMsg;
                UltraCleanLogger.ownerMessage(preview);
            }


            const _cbActive = isChatbotActiveForChat(chatId);
            if (_cbActive) {
                if (chatId !== 'status@broadcast' && !msg.key.fromMe) {
                    handleChatbotMessage(sock, msg, commands).catch((err) => {
                        UltraCleanLogger.error(`[CHATBOT-ERR] ${err?.message || err}`);
                    });
                }
            }
            return;
        }
        
        const rateLimitCheck = rateLimiter.canSendCommand(chatId, senderJid, commandName);
        if (!rateLimitCheck.allowed) {
            await sock.sendMessage(chatId, { 
                text: `⚠️ ${rateLimitCheck.reason}`
            });
            return;
        }
        
        if (senderJid.includes('@lid')) {
            resolvePhoneFromLid(senderJid);
            if (isGroup) {
                resolveSenderFromGroup(senderJid, chatId, sock).catch(() => {});
            }
        }

        const isOwnerUser = jidManager.isOwner(msg);
        let isSudoUser = jidManager.isSudo(msg);
        
        // if (!isSudoUser && !isOwnerUser && senderJid.includes('@lid')) {
        //     const senderRaw = senderJid.split('@')[0].split(':')[0];
        //     const senderFull = senderJid.split('@')[0];
        //     let resolvedPhone = lidPhoneCache.get(senderRaw) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderRaw) || getPhoneFromLid(senderFull);
            
        //     if (resolvedPhone && isSudoNumber(resolvedPhone)) {
        //         isSudoUser = true;
        //         UltraCleanLogger.info(`🔑 Sudo detected via LID cache: +${resolvedPhone}`);
        //     }
        // }


        if (!isSudoUser && !isOwnerUser && senderJid.includes('@lid')) {
    const senderRaw = senderJid.split('@')[0].split(':')[0];
    const senderFull = senderJid.split('@')[0];
    let resolvedPhone = lidPhoneCache.get(senderRaw) || lidPhoneCache.get(senderFull) || getPhoneFromLid(senderRaw) || getPhoneFromLid(senderFull);
    
    if (resolvedPhone && isSudoNumber(resolvedPhone)) {
        isSudoUser = true;
        UltraCleanLogger.info(`🔑 Sudo detected via LID cache: +${resolvedPhone}`);
    }

    // If still not resolved, try async scan (handles first message after restart)
    if (!isSudoUser) {
        try {
            const asyncTimeout = new Promise(resolve => setTimeout(() => resolve(false), 3000));
            const asyncResult = await Promise.race([jidManager.isSudoAsync(msg, sock), asyncTimeout]);
            if (asyncResult) {
                isSudoUser = true;
                UltraCleanLogger.info(`🔑 Sudo confirmed via async LID scan for mode check`);
            }
        } catch {}
    }
}
        const senderDisplay = getDisplayNumber(senderJid);
        const prefixDisplay = isPrefixless ? '' : currentPrefix;
        const locationTag   = isGroup ? chatId.split('@')[0].substring(0, 15) : 'DM';
        const _cmdPayload   = {
            sender:   senderDisplay,
            command:  `${prefixDisplay}${commandName}`,
            location: locationTag,
            ms:       Date.now() - startTime,
        };
        if (isOwnerUser) {
            UltraCleanLogger.ownerCommand(_cmdPayload);
        } else {
            UltraCleanLogger.command({ ..._cmdPayload, role: isSudoUser ? 'sudo' : 'user' });
        }

        // if (!checkBotMode(msg, commandName, isSudoUser)) {
        //     if (!isOwnerUser && !isSudoUser) {
        //         return;
        //     }
        // }

        // Last-resort sync check before mode gate — catches numbers added without JID mapping
if (!isSudoUser) {
    const _rawSenderNum = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (isSudoNumber(_rawSenderNum)) isSudoUser = true;
}

if (!checkBotMode(msg, commandName, isSudoUser)) {
    if (!isOwnerUser && !isSudoUser) {
        return;
    }
}
        
        if (commandName === 'connect' || commandName === 'link') {
            const cleaned = jidManager.cleanJid(senderJid);
            await handleConnectCommand(sock, msg, args, cleaned);
            return;
        }
        
        const command = commands.get(commandName);
        if (command) {
            try {
                if (command.ownerOnly && !isOwnerUser) {
                    const sudoAllowed = command.sudoAllowed !== false;
                    
                    // if (sudoAllowed && !isSudoUser && senderJid.includes('@lid')) 
                    if (sudoAllowed && !isSudoUser) {
                        try {
                            const sudoTimeout = new Promise((resolve) => setTimeout(() => resolve(false), 3000));
                            isSudoUser = await Promise.race([jidManager.isSudoAsync(msg, sock), sudoTimeout]);
                            if (isSudoUser) {
                                UltraCleanLogger.info(`🔑 Sudo confirmed at owner gate via async`);
                            }
                        } catch {}
                    }
                    
                    if (!sudoAllowed || !isSudoUser) {
                        try {
                            await sock.sendMessage(chatId, { 
                                text: '❌ *Owner Only Command*'
                            });
                        } catch {
                        }
                        return;
                    }
                }
                
                
                setActiveCommand(chatId, commandName, args, senderJid);
                try {
                    await command.execute(sock, msg, args, currentPrefix, {
                        OWNER_NUMBER: OWNER_CLEAN_NUMBER,
                        OWNER_JID: OWNER_CLEAN_JID,
                        OWNER_LID: OWNER_LID,
                        BOT_NAME: getCurrentBotName(),
                        VERSION,
                        isOwner: () => jidManager.isOwner(msg),
                        isSudo: () => isSudoUser || jidManager.isSudo(msg),
                        jidManager,
                        store,
                        statusDetector: statusDetector,
                        updatePrefix: updatePrefixImmediately,
                        getCurrentPrefix: getCurrentPrefix,
                        rateLimiter: rateLimiter,
                        memberDetector: memberDetector,
                        isPrefixless: isPrefixless,
                        DiskManager: DiskManager
                    });
                    // Music mode: skip for commands that already send audio/video to avoid clutter
                    const MUSIC_SKIP_CMDS = new Set([
                        'song','music','audio','mp3','ytmusic',
                        'play','ytmp3doc','audiodoc','ytplay',
                        'video','vid','viddl','dlvid','downloadvid',
                        'videodoc','vnext','nextvid','vidnext','nextvideo',
                        'snext','nextsong','songnext','nextresult',
                        'songdl','dlsong','downloadsong',
                        'spotify','spot','spdl','spotifydl','spotid',
                        'shazam','whatsong','findsong','identify','musicid',
                        'lyrics','lyric','ly',
                        'musicmenu','mmenu','musichelp','musiccmds',
                        'musicmode','mm','mmode','musicbot',
                        'dlmp3','dlmp4','mp4',
                    ]);
                    if (isMusicModeEnabled() && !MUSIC_SKIP_CMDS.has(commandName)) {
                        sendMusicClip(sock, chatId, msg).catch(() => {});
                    }
                } finally {
                    clearActiveCommand(chatId, senderJid);
                }
            } catch (error) {
                if (error?.code === 'ENOSPC') {
                    UltraCleanLogger.error(`💾 Disk full during command ${commandName}! Running emergency cleanup...`);
                    DiskManager.runCleanup(true);
                    onENOSPC().catch(() => {});
                } else {
                    UltraCleanLogger.error(`Command ${commandName} failed: ${error.message}`);
                }
            }
        } else {
            await handleDefaultCommands(commandName, sock, msg, args, currentPrefix);
        }
    } catch (error) {
        if (error?.code === 'ENOSPC') {
            UltraCleanLogger.error(`💾 Disk full in message handler! Running emergency cleanup...`);
            DiskManager.runCleanup(true);
            onENOSPC().catch(() => {});
        } else {
            UltraCleanLogger.error(`Message handler error: ${error.message}`);
        }
    }
}

// ====== DEFAULT COMMANDS ======
async function handleDefaultCommands(commandName, sock, msg, args, currentPrefix) {
    const chatId = msg.key.remoteJid;
    const isOwnerUser = jidManager.isOwner(msg);
    const ownerInfo = jidManager.getOwnerInfo();
    const prefixDisplay = isPrefixless ? '' : currentPrefix;
    
    try {
        switch (commandName) {
            case 'ping':
                const start = Date.now();
                const latency = Date.now() - start;
                
                let statusInfo = '';
                if (statusDetector) {
                    const stats = statusDetector.getStats();
                    statusInfo = `👁️ Status Detector: ✅ ACTIVE\n`;
                    statusInfo += `📊 Detected: ${stats.totalDetected} statuses\n`;
                }
                
                let memberInfo = '';
                if (memberDetector) {
                    const memberStats = memberDetector.getStats();
                    memberInfo = `👥 Member Detector: ✅ ACTIVE\n`;
                    memberInfo += `📊 Events: ${memberStats.totalEvents}\n`;
                }
                
                
                await sock.sendMessage(chatId, { 
                    text: `🏓 *Pong!*\nLatency: ${latency}ms\nPrefix: "${isPrefixless ? 'none (prefixless)' : currentPrefix}"\nMode: ${BOT_MODE}\nOwner: ${isOwnerUser ? 'Yes ✅' : 'No ❌'}\n${statusInfo}${memberInfo}Status: Connected ✅`
                }, { quoted: msg });
                break;
                
            case 'help':
                let helpText = ` *${getCurrentBotName()} HELP*\n\n`;
                helpText += `Prefix: "${isPrefixless ? 'none (prefixless)' : currentPrefix}"\n`;
                helpText += `Mode: ${BOT_MODE}\n`;
                helpText += `Commands: ${commands.size}\n\n`;
                
                helpText += `*PREFIX MANAGEMENT*\n`;
                helpText += `${prefixDisplay}setprefix <new_prefix> - Change prefix (persistent)\n`;
                helpText += `${prefixDisplay}setprefix none - Enable prefixless mode\n`;
                helpText += `${prefixDisplay}prefixinfo - Show prefix information\n\n`;
                
                helpText += `*MEMBER DETECTION*\n`;
                helpText += `${prefixDisplay}members - Show member detection stats\n`;
                helpText += `${prefixDisplay}welcomeset - Configure welcome messages\n\n`;
                
                helpText += `*ANTI-VIEWONCE*\n`;
                helpText += `${prefixDisplay}av settings - Check status\n\n`;
                
                helpText += `*STATUS DETECTOR*\n`;
                helpText += `${prefixDisplay}statusstats - Show status detection stats\n\n`;
                
                for (const [category, cmds] of commandCategories.entries()) {
                    helpText += `*${category.toUpperCase()}*\n`;
                    helpText += `${cmds.slice(0, 6).join(', ')}`;
                    if (cmds.length > 6) helpText += `... (+${cmds.length - 6} more)`;
                    helpText += '\n\n';
                }
                
                await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
                break;
                
           
            case 'uptime':
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                
                let statusDetectorInfo = '';
                if (statusDetector) {
                    const stats = statusDetector.getStats();
                    statusDetectorInfo = `👁️ Status Detector: ✅ ACTIVE\n`;
                    statusDetectorInfo += `📊 Detected: ${stats.totalDetected} statuses\n`;
                    statusDetectorInfo += `🕒 Last: ${stats.lastDetection}\n`;
                }
                
                let memberDetectorInfo = '';
                if (memberDetector) {
                    const memberStats = memberDetector.getStats();
                    memberDetectorInfo = `👥 Member Detector: ✅ ACTIVE\n`;
                    memberDetectorInfo += `📊 Events: ${memberStats.totalEvents}\n`;
                    memberDetectorInfo += `📈 Groups: ${memberStats.totalGroups}\n`;
                }
                
                
                await sock.sendMessage(chatId, {
                    text: `⏰ *UPTIME*\n\n${hours}h ${minutes}m ${seconds}s\n📊 Commands: ${commands.size}\n👑 Owner: +${ownerInfo.ownerNumber}\n💬 Prefix: "${isPrefixless ? 'none (prefixless)' : currentPrefix}"\n🎛️ Mode: ${BOT_MODE}\n${statusDetectorInfo}${memberDetectorInfo}`
                }, { quoted: msg });
                break;
                
            case 'statusstats':
                if (statusDetector) {
                    const stats = statusDetector.getStats();
                    const recent = statusDetector.statusLogs.slice(-3).reverse();
                    
                    let statsText = `📊 *STATUS DETECTION STATS*\n\n`;
                    statsText += `🔍 Status: ✅ ACTIVE\n`;
                    statsText += `📈 Total detected: ${stats.totalDetected}\n`;
                    statsText += `🕒 Last detection: ${stats.lastDetection}\n\n`;
                    
                    if (recent.length > 0) {
                        statsText += `📱 *Recent Statuses:*\n`;
                        recent.forEach((status, index) => {
                            statsText += `${index + 1}. ${status.sender}: ${status.type} (${new Date(status.timestamp).toLocaleTimeString()})\n`;
                        });
                    }
                    
                    await sock.sendMessage(chatId, { text: statsText }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Status detector not initialized.'
                    }, { quoted: msg });
                }
                break;
                
            case 'members':
            case 'memberstats':
                if (memberDetector) {
                    const stats = memberDetector.getStats();
                    
                    let membersText = `👥 *MEMBER DETECTION STATS*\n\n`;
                    membersText += `🔍 Status: ${stats.enabled ? '✅ ACTIVE' : '❌ DISABLED'}\n`;
                    membersText += `📈 Total events: ${stats.totalEvents}\n`;
                    membersText += `👥 Groups monitored: ${stats.totalGroups}\n`;
                    membersText += `📊 Groups cached: ${stats.cachedGroups}\n\n`;
                    
                    membersText += `🎯 *Features:*\n`;
                    membersText += `• Auto-detect new members\n`;
                    membersText += `• Terminal notifications\n`;
                    membersText += `• Welcome message system\n`;
                    membersText += `• Profile picture support\n`;
                    
                    await sock.sendMessage(chatId, { text: membersText }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Member detector not initialized.'
                    }, { quoted: msg });
                }
                break;
                
            case 'welcomeset':
            case 'welcomeconfig':
                const welcomeText = `🎉 *WELCOME SYSTEM CONFIGURATION*\n\n` +
                                  `The welcome system is automatically enabled!\n\n` +
                                  `*How it works:*\n` +
                                  `1. Bot detects new members in groups\n` +
                                  `2. Sends welcome message with profile picture\n` +
                                  `3. Mentions the new member\n` +
                                  `4. Shows terminal notification\n\n` +
                                  `*Default Welcome Message:*\n` +
                                  `"🎉 Welcome {name} to {group}! 🎊\n\n` +
                                  `We're now {members} members strong! 💪\n\n` +
                                  `Please read the group rules and enjoy your stay! 😊"\n\n` +
                                  `*Variables:*\n` +
                                  `{name} - Member's name\n` +
                                  `{group} - Group name\n` +
                                  `{members} - Total members\n` +
                                  `{mention} - Mention the member\n\n` +
                                  `*Note:* System runs automatically in background!`;
                
                await sock.sendMessage(chatId, { text: welcomeText }, { quoted: msg });
                break;
        
            case 'ultimatefix':
            case 'solveowner':
            case 'fixall':
                const fixSenderJid = msg.key.participant || chatId;
                const fixCleaned = jidManager.cleanJid(fixSenderJid);
                
                if (!jidManager.isOwner(msg) && !msg.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Owner Only Command*'
                    }, { quoted: msg });
                    return;
                }
                
                const fixResult = await ultimateFixSystem.applyUltimateFix(sock, fixSenderJid, fixCleaned, false);
                
                if (fixResult.success) {
                    await sock.sendMessage(chatId, {
                        text: `✅ *ULTIMATE FIX APPLIED*\n\nYou should now have full owner access!`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `❌ *Ultimate Fix Failed*`
                    }, { quoted: msg });
                }
                break;
                
            case 'prefixinfo':
                const prefixDbStatus = {
                    'bot_settings (DB)': !!_cache_bot_settings,
                    'prefix_config (DB)': !!_cache_prefix_config
                };
                
                let infoText = `⚡ *PREFIX INFORMATION*\n\n`;
                infoText += `📝 Current Prefix: *${isPrefixless ? 'none (prefixless)' : currentPrefix}*\n`;
                infoText += `⚙️ Default Prefix: ${DEFAULT_PREFIX}\n`;
                infoText += `🌐 Global Prefix: ${global.prefix || 'Not set'}\n`;
                infoText += `📁 ENV Prefix: ${process.env.PREFIX || 'Not set'}\n`;
                infoText += `🎯 Prefixless Mode: ${isPrefixless ? '✅ ENABLED' : '❌ DISABLED'}\n\n`;
                
                infoText += `📋 *Config Status:*\n`;
                for (const [cfgName, loaded] of Object.entries(prefixDbStatus)) {
                    infoText += `├─ ${cfgName}: ${loaded ? '✅' : '❌'}\n`;
                }
                
                infoText += `\n💡 *Changes are saved to database and persist after restart!*`;
                
                await sock.sendMessage(chatId, { text: infoText }, { quoted: msg });
                break;
                
            case 'forcerestart':
                if (!jidManager.isOwner(msg)) {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Owner Only Command*'
                    }, { quoted: msg });
                    return;
                }
                
                await sock.sendMessage(chatId, {
                    text: '🔄 *Initiating forced restart...*\n\nBot will restart in 5 seconds.'
                }, { quoted: msg });
                
                setTimeout(() => {
                    process.exit(1);
                }, 5000);
                break;
        }
    } catch (error) {
        UltraCleanLogger.error(`Default command error: ${error.message}`);
    }
}

// // ====== MAIN APPLICATION ======
// // ====== MAIN APPLICATION ======
// // ====== MAIN APPLICATION ======
// async function main() {
//     try {
//         UltraCleanLogger.success(`Bot starting — ${getCurrentBotName()} v${VERSION}`);
//         UltraCleanLogger.info(`Loaded prefix: "${isPrefixless ? 'none (prefixless)' : getCurrentPrefix()}"`);
//         UltraCleanLogger.info(`Prefixless mode: ${isPrefixless ? '✅ ENABLED' : '❌ DISABLED'}`);
//         UltraCleanLogger.info(`Auto-connect on link: ${AUTO_CONNECT_ON_LINK ? '✅' : '❌'}`);
//         UltraCleanLogger.info(`Auto-connect on start: ${AUTO_CONNECT_ON_START ? '✅' : '❌'}`);
//         UltraCleanLogger.info(`Rate limit protection: ${RATE_LIMIT_ENABLED ? '✅' : '❌'}`);
//         UltraCleanLogger.info(`Console filtering: ✅ ULTRA CLEAN ACTIVE`);
//         UltraCleanLogger.info(`⚡ Response speed: OPTIMIZED (Reduced delays by 50-70%)`);
//         UltraCleanLogger.info(`🔐 Session ID support: ✅ ENABLED (KLAUS MD: format)`);
//         UltraCleanLogger.info(`🎯 Member Detection: ✅ ENABLED (New members in groups)`);
//         UltraCleanLogger.info(`👥 Welcome System: ✅ ENABLED (Auto-welcome new members)`);
//         UltraCleanLogger.info(`🎯 Background processes: ✅ ENABLED`);

//         // ====== AGGRESSIVE AUTO-RECONNECT LOGIC ======
//         // 1. First try to load existing session directory
//         const sessionDirExists = fs.existsSync(SESSION_DIR);
//         const credsExist = fs.existsSync(path.join(SESSION_DIR, 'creds.json'));
        
//         if (sessionDirExists && credsExist) {
//             UltraCleanLogger.success('🔐 Found session directory with creds.json, attempting auto-reconnect...');
            
//             try {
//                 // Try to read the session file
//                 const sessionData = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf8'));
                
//                 // Check for basic required fields (more lenient check)
//                 if (sessionData && (sessionData.noiseKey || sessionData.signedIdentityKey || sessionData.creds)) {
//                     UltraCleanLogger.success('✅ Session file looks valid, auto-connecting...');
//                     await startBot('auto', null);
//                     return;
//                 } else {
//                     UltraCleanLogger.warning('⚠️ Session file exists but may be corrupted');
//                 }
//             } catch (sessionError) {
//                 UltraCleanLogger.error(`❌ Error loading session: ${sessionError.message}`);
//             }
//         }
        
//         // 2. Check for SESSION_ID in .env as secondary option
//         const sessionIdFromEnv = process.env.SESSION_ID;
//         const hasEnvSession = sessionIdFromEnv && sessionIdFromEnv.trim() !== '';
        
//         if (hasEnvSession) {
//             UltraCleanLogger.info('🔐 Found SESSION_ID in .env, attempting auto-login...');
            
//             try {
//                 const sessionData = parseWolfBotSession(sessionIdFromEnv);
//                 if (sessionData) {
//                     UltraCleanLogger.success('✅ Valid session ID found in .env, auto-connecting...');
//                     await startBot('session', sessionIdFromEnv);
//                     return;
//                 }
//             } catch (error) {
//                 UltraCleanLogger.warning(`❌ Session ID validation failed: ${error.message}`);
//             }
//         }
        
//         // 3. If no session found, check if we should attempt pairing with saved phone
//         const ownerFileExists = fs.existsSync(OWNER_FILE);
//         if (ownerFileExists) {
//             try {
//                 const ownerData = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
//                 if (ownerData.OWNER_NUMBER) {
//                     UltraCleanLogger.info(`📱 Found saved owner number: ${ownerData.OWNER_NUMBER}, attempting to reconnect...`);
                    
//                     // Try to reconnect with saved phone number
//                     await startBot('pair', ownerData.OWNER_NUMBER);
//                     return;
//                 }
//             } catch (error) {
//                 UltraCleanLogger.warning(`Could not load owner data: ${error.message}`);
//             }
//         }
        
//         // 4. If all else fails, show login options
//         UltraCleanLogger.info('📱 No valid session found, showing login options...');
//         const loginManager = new LoginManager();
//         const loginInfo = await loginManager.selectMode();
//         loginManager.close();
        
//         const loginData = loginInfo.mode === 'session' ? loginInfo.sessionId : loginInfo.phone;
//         await startBot(loginInfo.mode, loginData);
        
//     } catch (error) {
//         UltraCleanLogger.error(`Main error: ${error.message}`);
//         setTimeout(async () => {
//             await main();
//         }, 8000);
//     }
// }


// ====== SECTION 23: main() — APPLICATION ENTRY POINT ======
// main() is the very first thing that runs when Node.js starts the file.
// It wires together everything that was declared in the sections above.
//
// Startup sequence:
//   1. DiskManager.start()          — starts disk-space watchdog timers
//   2. supabaseDb.initialize()      — opens / migrates the SQLite database
//   3. runDataMigrations()          — copies legacy JSON files into SQLite
//   4. loadAllCommands()            — imports every command file (Section 18)
//   5. setupWebServer()             — starts the keep-alive HTTP server on port 8080
//                                     (prevents Replit from sleeping the repl)
//   6. setupHerokuKeepAlive()       — sends a self-ping every 25 minutes if running on Heroku
//   7. Session detection:
//        a. If ./session/creds.json exists → startBot('auto') with existing session
//        b. Else if SESSION_ID env var set → decode and write session files, then startBot()
//        c. Else → startBot('auto') to show a QR code for first-time login
//   8. startBot() returns a connected `sock`; events fire from that point forward
//
// Process signals:
//   SIGTERM / SIGINT — caught to do a clean sock.end() before shutdown
//   uncaughtException / unhandledRejection — logged; bot restarts via main() after 8 s
async function main() {
    try {
        // ====== WEB SERVER — must bind to PORT before anything else (Heroku boot timeout) ======
        try { await _dbInitPromise; } catch {}
        // printStartupBox removed — replaced by printWolfStartupBlock in handleConnectionOpen
        await setupWebServer();
        setupHerokuKeepAlive();

        // ====== HEROKU DETECTION & SETUP ======
        const isHeroku = process.env.HEROKU_APP_NAME || process.env.DYNO || process.env.HEROKU_API_KEY || false;
        const herokuSessionId = process.env.SESSION_ID;
        
        if (isHeroku) {
            UltraCleanLogger.info(`🏗️ Platform: Heroku`);
            UltraCleanLogger.info(`📦 Dyno: ${process.env.DYNO || 'Unknown'}`);
            
            // Check if we have SESSION_ID from Heroku Config Vars
            if (herokuSessionId && herokuSessionId.trim() !== '') {
                UltraCleanLogger.success('🔐 Heroku SESSION_ID detected');
                
                // Setup Heroku session automatically
                const herokuSetupSuccess = setupHerokuSession();
                
                if (herokuSetupSuccess) {
                    UltraCleanLogger.success('✅ Heroku session configured successfully');
                    UltraCleanLogger.info('🔄 Starting bot with Heroku session...');
                    
                    // Auto-start with Heroku session
                    await startBot('auto', null);
                    return;
                } else {
                    UltraCleanLogger.warning('⚠️ Heroku session setup failed, falling back to normal login');
                }
            } else {
                UltraCleanLogger.warning('⚠️ Heroku detected but no SESSION_ID found');
                UltraCleanLogger.info('💡 Add SESSION_ID to Heroku Config Vars for auto-login');
            }
        }
        DiskManager.start();
        // Start /tmp wolfbot_* and ytdlp-* periodic sweep (catches orphaned temp
        // files left by crashes, killed yt-dlp processes, imagegen, etc.)
        initStorageManager();
        
        // ====== AUTO-RECONNECT LOGIC ======
        // SESSION_ID is always the source of truth.
        // We store a fingerprint (.session_id_hash) of the last applied SESSION_ID.
        // If SESSION_ID changed (or hash file missing/deleted after logout),
        // we force-apply the new SESSION_ID and clear any stale session data.
        const sessionIdFromEnv = process.env.SESSION_ID;
        const hasEnvSession = sessionIdFromEnv && sessionIdFromEnv.trim() !== '';

        const credsPath = path.join(SESSION_DIR, 'creds.json');
        const hashFile  = './.session_id_hash';

        if (hasEnvSession) {
            // Compute a fingerprint of the current SESSION_ID (first 64 chars)
            // Use a full SHA-256 of the SESSION_ID so two different sessions
            // can't collide (all KLAUS MD IDs share the same first 64 chars).
            const { createHash } = await import('crypto');
            const currentFingerprint = createHash('sha256')
                .update(sessionIdFromEnv.trim())
                .digest('hex');

            // Check if this SESSION_ID was permanently revoked (401 on last run)
            const revokedFile = './.session_revoked';
            let revokedFingerprint = null;
            try { revokedFingerprint = fs.existsSync(revokedFile) ? fs.readFileSync(revokedFile, 'utf8').trim() : null; } catch {}
            if (revokedFingerprint && revokedFingerprint === currentFingerprint) {
                UltraCleanLogger.warning('⚠️  SESSION_ID was permanently revoked by WhatsApp — skipping. Update SESSION_ID or choose login option.');
                // Fall through to login options below
            } else {
            let storedFingerprint = null;
            try { storedFingerprint = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : null; } catch {}

            const sessionChanged = currentFingerprint !== storedFingerprint;
            const credsExist = fs.existsSync(credsPath);

            if (!sessionChanged && credsExist) {
                // Same SESSION_ID as last time — use the existing (possibly evolved) creds
                try {
                    const existingCreds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                    if (existingCreds && (existingCreds.noiseKey || existingCreds.signedIdentityKey)) {
                        UltraCleanLogger.success('🔐 Same SESSION_ID — using existing evolved session...');
                        await startBot('auto', null);
                        return;
                    }
                } catch (readErr) {
                    UltraCleanLogger.warning(`⚠️ Existing creds.json unreadable: ${readErr.message}`);
                }
            }

            // SESSION_ID is new, changed, or creds are gone — force apply
            if (sessionChanged) {
                UltraCleanLogger.warning('🔄 SESSION_ID changed — clearing stale session and applying new one...');
                // Clear stale files + DB tables
                if (fs.existsSync(SESSION_DIR)) {
                    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                }
                try {
                    const rawDb = supabaseDb.getClient();
                    try { rawDb.prepare('DELETE FROM session_keys').run(); } catch {}
                    try { rawDb.prepare('DELETE FROM session_creds').run(); } catch {}
                } catch {}
            }

            UltraCleanLogger.info('🔐 Applying SESSION_ID to creds.json...');
            try {
                const parsedSession = parseWolfBotSession(sessionIdFromEnv);
                if (parsedSession) {
                    ensureSessionDir();
                    fs.writeFileSync(credsPath, JSON.stringify(parsedSession, null, 2));
                    // Save fingerprint so we don't re-apply on normal restarts
                    try { fs.writeFileSync(hashFile, currentFingerprint, 'utf8'); } catch {}
                    UltraCleanLogger.success('✅ SESSION_ID applied — connecting...');
                    await startBot('auto', null);
                    return;
                }
            } catch (error) {
                UltraCleanLogger.warning(`⚠️ SESSION_ID parsing failed: ${error.message}`);
            }
            } // end else (not revoked)
        }

        // No SESSION_ID in env — fall back to whatever creds.json exists on disk
        const sessionDirExists = fs.existsSync(SESSION_DIR);
        const credsExist = fs.existsSync(credsPath);
        
        // 3. Fallback: try existing session that might have creds but no noise/signal keys
        if (sessionDirExists && credsExist) {
            UltraCleanLogger.success('🔐 Found existing session, attempting auto-reconnect...');
            
            try {
                const sessionData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                
                if (sessionData && (sessionData.noiseKey || sessionData.signedIdentityKey || sessionData.creds)) {
                    UltraCleanLogger.success('✅ Session file valid, auto-connecting...');
                    await startBot('auto', null);
                    return;
                } else {
                    UltraCleanLogger.warning('⚠️ Session file exists but may be corrupted');
                }
            } catch (sessionError) {
                UltraCleanLogger.error(`❌ Error loading session: ${sessionError.message}`);
            }
        }
        
        // 3. Check for PHONE_NUMBER env var (explicit override for pairing)
        if (process.env.PHONE_NUMBER && process.env.PHONE_NUMBER.trim() !== '') {
            const envPhone = process.env.PHONE_NUMBER.replace(/[^0-9]/g, '');
            if (envPhone.length >= 10) {
                UltraCleanLogger.info(`📱 PHONE_NUMBER env var found: ${envPhone}, auto-pairing...`);
                await startBot('pair', envPhone);
                return;
            }
        }

        // 4. If all else fails, show login options — but skip readline on pure cloud envs
        //    (Heroku, Railway, Render, Koyeb) where there is no interactive console at all.
        //    Pterodactyl and similar panels DO have an interactive console, so they fall
        //    through to LoginManager just like a local/interactive environment.
        const isRailway  = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_NAME || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_NAME);
        const isCloudEnv = isHeroku || isRailway ||
            !!(process.env.RENDER || process.env.RENDER_SERVICE_ID) ||
            !!(process.env.KOYEB_APP || process.env.KOYEB_REGION);

        if (isCloudEnv) {
            const platformLabel = isRailway ? 'Railway' : isHeroku ? 'Heroku' : 'Cloud';
            UltraCleanLogger.error(`❌ ${platformLabel} deployment: No valid session found`);
            UltraCleanLogger.info('💡 Set SESSION_ID in your environment/service variables and restart.');
            setInterval(() => {
                UltraCleanLogger.warning('⏳ Waiting for SESSION_ID to be configured — set it in env vars and restart.');
            }, 600000);
            return;
        }

        // 5. Show login options for interactive environments (local, Pterodactyl panels, etc.)
        UltraCleanLogger.info('📱 No valid session found, showing login options...');
        const loginManager = new LoginManager();
        const loginInfo = await loginManager.selectMode();
        loginManager.close();
        const loginData = loginInfo.mode === 'session' ? loginInfo.sessionId : loginInfo.phone;
        await startBot(loginInfo.mode, loginData);
        
    } catch (error) {
        UltraCleanLogger.error(`Main error: ${error.message}`);
        
        // Handle restarts based on platform
        if (process.env.HEROKU || process.env.DYNO) {
            UltraCleanLogger.warning('🔄 Heroku restart scheduled in 5 seconds...');
            setTimeout(async () => {
                await main();
            }, 5000);
        } else {
            // Faster restart for local/panel deployments
            UltraCleanLogger.warning('🔄 Restarting in 8 seconds...');
            setTimeout(async () => {
                await main();
            }, 8000);
        }
    }
}
// ====== PROCESS HANDLERS ======
// ── Graceful shutdown: SIGTERM (Heroku dyno kill / PM2 / systemd stop) ────────
process.on('SIGTERM', async () => {
    try { if (typeof globalThis.preExitSave === 'function') await globalThis.preExitSave(); } catch {}
    try { stopHeartbeat(); } catch {}
    try { memoryMonitor.stop(); } catch {}
    try { if (SOCKET_INSTANCE) SOCKET_INSTANCE.ws.close(); } catch {}
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Shutting down gracefully...'));
    try { if (typeof globalThis.preExitSave === 'function') await globalThis.preExitSave(); } catch {}
    stopHeartbeat();
    memoryMonitor.stop();
    if (SOCKET_INSTANCE) SOCKET_INSTANCE.ws.close();
    process.exit(0);
});

let _isRecoveringFromException = false;
process.on('uncaughtException', (error) => {
    UltraCleanLogger.error(`Uncaught exception: ${error.message}`);
    UltraCleanLogger.error(error.stack);
    if (!error.message?.includes('SIGINT') && !error.message?.includes('shutdown')) {
        if (_isRecoveringFromException) {
            UltraCleanLogger.error('Recovery already in progress, skipping duplicate recovery attempt.');
            return;
        }
        _isRecoveringFromException = true;
        setTimeout(async () => {
            UltraCleanLogger.info('🔄 Auto-recovering from uncaught exception...');
            try {
                await main();
            } catch (e) {
                UltraCleanLogger.error(`Recovery failed: ${e.message}`);
            } finally {
                _isRecoveringFromException = false;
            }
        }, 5000);
    }
});

process.on('unhandledRejection', (error) => {
    UltraCleanLogger.error(`Unhandled rejection: ${error?.message || error}`);
});


// Start the bot
main().catch((error) => {
    UltraCleanLogger.critical(`Fatal error: ${error.message}`);
    process.exit(1);
});