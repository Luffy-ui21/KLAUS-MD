import { createRequire } from 'module';
import { downloadMediaMessage, normalizeMessageContent, jidNormalizedUser } from 'wolfsocket';
import { getBotName } from '../../lib/botname.js';
import { WolfLogger } from '../../lib/wolfLogger.js';
import db from '../../lib/database.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const _require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = _require('wolfbtns'); } catch (e) {}

const CACHE_CLEAN_INTERVAL = 2 * 60 * 60 * 1000;
const MAX_MESSAGE_CACHE = 200;
const MAX_CONCURRENT_DOWNLOADS = 3;
let _activeDownloads = 0;

let antideleteState = {
    enabled: false,
    mode: 'private',
    ownerJid: null,
    sock: null,
    messageCache: new Map(),
    mediaCache: new Map(),
    groupCache: new Map(),
    stats: {
        totalMessages: 0,
        deletedDetected: 0,
        retrieved: 0,
        mediaCaptured: 0,
        sentToDm: 0,
        sentToChat: 0,
        cacheCleans: 0,
        totalStorageMB: 0
    },
    settings: {
        autoCleanEnabled: true,
        maxAgeHours: 6,
        maxStorageMB: 50,
        showPhoneNumbers: true,
        ownerOnly: true,
        autoCleanRetrieved: true,
        showGroupNames: true,
        initialized: false
    },
    cleanupInterval: null
};

async function calculateStorageSize() {
    try {
        let totalBytes = 0;
        for (const [, media] of antideleteState.mediaCache.entries()) {
            totalBytes += media.size || 0;
        }
        antideleteState.stats.totalStorageMB = Math.round(totalBytes / 1024 / 1024);
    } catch (error) {
        console.error('❌ Antidelete: Error calculating storage:', error.message);
    }
}

async function loadData() {
    try {
        const defaultSettings = { ...antideleteState.settings };
        const savedSettings = await db.getConfig('antidelete_settings', defaultSettings);
        if (savedSettings && typeof savedSettings === 'object') {
            antideleteState.settings = { ...antideleteState.settings, ...savedSettings };
            if (typeof savedSettings.enabled === 'boolean') {
                antideleteState.enabled = savedSettings.enabled;
                globalThis._antideleteEnabled = antideleteState.enabled;
            }
            if (savedSettings.mode && (savedSettings.mode === 'private' || savedSettings.mode === 'public')) {
                antideleteState.mode = savedSettings.mode;
            }
            if (savedSettings.stats) {
                antideleteState.stats = { ...antideleteState.stats, ...savedSettings.stats };
            }
        }
        await calculateStorageSize();
    } catch (error) {
        console.error('❌ Antidelete: Error loading data from DB:', error.message);
    }
}

async function saveData() {
    try {
        const settingsToSave = {
            ...antideleteState.settings,
            enabled: antideleteState.enabled,
            mode: antideleteState.mode,
            stats: antideleteState.stats
        };
        await db.setConfig('antidelete_settings', settingsToSave);
    } catch (error) {
        console.error('❌ Antidelete: Error saving data to DB:', error.message);
    }
}

function getRealWhatsAppNumber(jid) {
    if (!jid) return 'Unknown';
    
    try {
        const numberPart = jid.split('@')[0];
        let cleanNumber = numberPart.replace(/[^\d+]/g, '');
        
        if (cleanNumber.length >= 10 && !cleanNumber.startsWith('+')) {
            if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
                return `+${cleanNumber}`;
            }
        }
        
        if (cleanNumber.startsWith('+') && cleanNumber.length >= 12) {
            return cleanNumber;
        }
        
        if (cleanNumber && /^\d+$/.test(cleanNumber) && cleanNumber.length >= 10) {
            return `+${cleanNumber}`;
        }
        
        return numberPart || 'Unknown';
        
    } catch (error) {
        console.error('❌ Antidelete: Error extracting real number:', error.message);
        return 'Unknown';
    }
}

function getGroupName(chatJid) {
    if (!chatJid || !chatJid.includes('@g.us')) {
        return 'Private Chat';
    }
    if (antideleteState.groupCache.has(chatJid)) {
        const groupInfo = antideleteState.groupCache.get(chatJid);
        return groupInfo.name || 'Group Chat';
    }
    const gmdCache = globalThis.groupMetadataCache;
    if (gmdCache) {
        const cached = gmdCache.get(chatJid);
        if (cached && cached.data && cached.data.subject) {
            const groupName = cached.data.subject;
            antideleteState.groupCache.set(chatJid, {
                name: groupName,
                subject: cached.data.subject,
                id: chatJid,
                size: cached.data.participants?.length || 0,
                cachedAt: Date.now()
            });
            return groupName;
        }
    }
    return chatJid.split('@')[0];
}

async function cleanRetrievedMessage(msgId) {
    try {
        if (!antideleteState.settings.autoCleanRetrieved) {
            return;
        }
        
        antideleteState.messageCache.delete(msgId);
        antideleteState.mediaCache.delete(msgId);
        
        db.deleteAntideleteMessage(msgId).catch(() => {});
        
    } catch (error) {
        console.error('❌ Antidelete: Error cleaning retrieved message:', error.message);
    }
}

async function autoCleanCache() {
    try {
        if (!antideleteState.settings.autoCleanEnabled) {
            return;
        }
        
        const now = Date.now();
        const maxAge = antideleteState.settings.maxAgeHours * 60 * 60 * 1000;
        let cleanedCount = 0;
        let cleanedMedia = 0;
        
        for (const [key, message] of antideleteState.messageCache.entries()) {
            if (now - message.timestamp > maxAge) {
                antideleteState.messageCache.delete(key);
                cleanedCount++;
            }
        }
        
        for (const [key, media] of antideleteState.mediaCache.entries()) {
            if (now - media.savedAt > maxAge) {
                antideleteState.mediaCache.delete(key);
                cleanedMedia++;
            }
        }
        
        try {
            await db.cleanOlderThan('antidelete_messages', 'timestamp', maxAge);
            try {
                if (db.isAvailable()) {
                    const mediaCutoff = new Date(Date.now() - maxAge).toISOString();
                    await db.removeWhere('media_store', { created_at: mediaCutoff });
                }
            } catch {}
        } catch {}
        
        await calculateStorageSize();
        
        if (cleanedCount > 0 || cleanedMedia > 0) {
            antideleteState.stats.cacheCleans++;
            await saveData();
        }
        
    } catch (error) {
        console.error('❌ Antidelete: Auto-clean error:', error.message);
    }
}

async function forceCleanup() {
    try {
        const mediaEntries = Array.from(antideleteState.mediaCache.entries());
        mediaEntries.sort((a, b) => a[1].savedAt - b[1].savedAt);
        
        let freedSize = 0;
        const targetSize = antideleteState.settings.maxStorageMB * 1024 * 1024 * 0.8;
        let deletedCount = 0;
        
        for (const [key, media] of mediaEntries) {
            if (antideleteState.stats.totalStorageMB * 1024 * 1024 - freedSize <= targetSize) {
                break;
            }
            antideleteState.mediaCache.delete(key);
            freedSize += media.size || 0;
            deletedCount++;
        }
        
        const cacheEntries = Array.from(antideleteState.messageCache.entries());
        cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        for (let i = 0; i < Math.min(10, cacheEntries.length); i++) {
            antideleteState.messageCache.delete(cacheEntries[i][0]);
        }
        
        await calculateStorageSize();
        await saveData();
        
        console.log(`✅ Force cleanup completed. Removed ${deletedCount} media entries, freed ~${Math.round(freedSize / 1024 / 1024)}MB`);
        
    } catch (error) {
        console.error('❌ Antidelete: Force cleanup error:', error.message);
    }
}

function startAutoClean() {
    if (antideleteState.cleanupInterval) {
        clearInterval(antideleteState.cleanupInterval);
    }
    
    antideleteState.cleanupInterval = setInterval(async () => {
        await autoCleanCache();
    }, CACHE_CLEAN_INTERVAL);
    
}

function stopAutoClean() {
    if (antideleteState.cleanupInterval) {
        clearInterval(antideleteState.cleanupInterval);
        antideleteState.cleanupInterval = null;
    }
}

function getExtensionFromMime(mimetype) {
    const mimeToExt = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/3gpp': '.3gp',
        'audio/mpeg': '.mp3',
        'audio/mp4': '.m4a',
        'audio/ogg': '.ogg',
        'audio/aac': '.aac'
    };
    
    return mimeToExt[mimetype] || '.bin';
}

const STARTUP_GRACE_MS = 90 * 1000; // block media downloads for 90s after connect

async function downloadAndSaveMedia(msgId, message, messageType, mimetype) {
    // Block ALL media downloads during startup flood window
    const _connectedAt = globalThis._botConnectionOpenTime || 0;
    if (_connectedAt > 0 && Date.now() - _connectedAt < STARTUP_GRACE_MS) return null;

    if (_activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return null;
    _activeDownloads++;
    try {
        const buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            {
                logger: { level: 'silent' },
                reuploadRequest: antideleteState.sock?.updateMediaMessage
            }
        );

        if (!buffer || buffer.length === 0) return null;

        const maxSize = 3 * 1024 * 1024; // 3MB cap (was 10MB)
        if (buffer.length > maxSize) return null;

        const timestamp = Date.now();
        const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

        antideleteState.mediaCache.set(msgId, {
            type: messageType,
            mimetype: mimetype,
            size: buffer.length,
            savedAt: timestamp,
            dbPath: `messages/${msgId}`
        });

        if (antideleteState.mediaCache.size > 100) {
            const oldest = antideleteState.mediaCache.keys().next().value;
            antideleteState.mediaCache.delete(oldest);
        }

        db.uploadMedia(msgId, buffer, mimetype, 'messages').catch(err => {
            console.error('❌ Antidelete: DB media upload error:', err.message);
        });

        WolfLogger.antidelete(`💾 Stored ${sizeMB}MB`, messageType, msgId);
        antideleteState.stats.mediaCaptured++;
        return 'db';

    } catch (error) {
        console.error('❌ Antidelete: Media download error:', error.message);
        return null;
    } finally {
        _activeDownloads--;
    }
}

// Skip messages older than this at startup — prevents backlog flood
const MAX_ANTIDELETE_AGE_MS = 5 * 60 * 1000; // 5 minutes

export async function antideleteStoreMessage(message) {
    try {
        if (!antideleteState.settings.initialized || !antideleteState.enabled || !antideleteState.sock) return;
        
        const msgKey = message.key;
        if (!msgKey || !msgKey.id || msgKey.fromMe) return;
        
        const msgId = msgKey.id;
        const chatJid = msgKey.remoteJidAlt || msgKey.remoteJid;
        const senderJid = msgKey.participantAlt || msgKey.participant || chatJid;
        const pushName = message.pushName || 'Unknown';
        const timestamp = message.messageTimestamp * 1000 || Date.now();

        // ── DM diagnostic ──────────────────────────────────────────
        // Logs only for DM chats to help pinpoint why DM antidelete fails
        const _isDm = chatJid && !chatJid.endsWith('@g.us')
                     && !chatJid.endsWith('@newsletter')
                     && chatJid !== 'status@broadcast';
        if (_isDm) {
            const printer = globalThis._printAntideleteBox;
            if (typeof printer === 'function') {
                printer({
                    event: 'store',
                    fields: {
                        'Msg ID': msgId,
                        Chat:    chatJid,
                        Sender:  senderJid,
                        'From Me': msgKey.fromMe,
                    },
                });
            } else {
                console.log(`[AD-DM-STORE] msgId=${msgId} chat=${chatJid} sender=${senderJid} fromMe=${msgKey.fromMe}`);
            }
        }

        // Age guard — skip backlog messages delivered at startup to avoid memory flood
        if (timestamp > 0 && Date.now() - timestamp > MAX_ANTIDELETE_AGE_MS) return;
        
        // Skip channels only — `@lid` DMs are legitimate in Baileys v7 and must be stored
        if (chatJid?.endsWith('@newsletter')) return;
        
        const isStatus = chatJid === 'status@broadcast';
        
        if (isStatus) {
            return;
        }
        
        const msgContent = normalizeMessageContent(message.message);
        let type = 'text';
        let text = '';
        let hasMedia = false;
        let mediaInfo = null;
        let mimetype = '';
        
        if (msgContent?.conversation) {
            text = msgContent.conversation;
        } else if (msgContent?.extendedTextMessage?.text) {
            text = msgContent.extendedTextMessage.text;
        } else if (msgContent?.imageMessage) {
            type = 'image';
            text = msgContent.imageMessage.caption || '';
            hasMedia = true;
            mimetype = msgContent.imageMessage.mimetype || 'image/jpeg';
            mediaInfo = { message: { key: message.key, message: { imageMessage: msgContent.imageMessage } }, type: 'image', mimetype };
        } else if (msgContent?.videoMessage) {
            type = 'video';
            text = msgContent.videoMessage.caption || '';
            hasMedia = true;
            mimetype = msgContent.videoMessage.mimetype || 'video/mp4';
            mediaInfo = { message: { key: message.key, message: { videoMessage: msgContent.videoMessage } }, type: 'video', mimetype };
        } else if (msgContent?.audioMessage) {
            type = 'audio';
            hasMedia = true;
            mimetype = msgContent.audioMessage.mimetype || 'audio/mpeg';
            if (msgContent.audioMessage.ptt) {
                type = 'voice';
            }
            mediaInfo = { message: { key: message.key, message: { audioMessage: msgContent.audioMessage } }, type: 'audio', mimetype };
        } else if (msgContent?.documentMessage) {
            type = 'document';
            text = msgContent.documentMessage.fileName || 'Document';
            hasMedia = true;
            mimetype = msgContent.documentMessage.mimetype || 'application/octet-stream';
            mediaInfo = { message: { key: message.key, message: { documentMessage: msgContent.documentMessage } }, type: 'document', mimetype };
        } else if (msgContent?.stickerMessage) {
            type = 'sticker';
            hasMedia = true;
            mimetype = msgContent.stickerMessage.mimetype || 'image/webp';
            mediaInfo = { message: { key: message.key, message: { stickerMessage: msgContent.stickerMessage } }, type: 'sticker', mimetype };
        }
        
        if (!text && !hasMedia) return;
        
        const realNumber = getRealWhatsAppNumber(senderJid);
        
        let chatName = 'Private Chat';
        if (isStatus) {
            chatName = 'WhatsApp Status';
        } else if (chatJid.includes('@g.us')) {
            chatName = getGroupName(chatJid);
        } else {
            chatName = getRealWhatsAppNumber(chatJid);
        }
        
        // Store a slim raw reference for on-demand download at delete time.
        // Strip jpegThumbnail to avoid storing large base64 blobs in SQLite.
        let rawMessage = null;
        if (hasMedia && mediaInfo?.message) {
            try {
                const msgCopy = JSON.parse(JSON.stringify(mediaInfo.message));
                const inner = msgCopy?.message;
                if (inner) {
                    for (const k of Object.keys(inner)) {
                        if (inner[k]?.jpegThumbnail) delete inner[k].jpegThumbnail;
                        if (inner[k]?.thumbnail) delete inner[k].thumbnail;
                    }
                }
                rawMessage = msgCopy;
            } catch {}
        }

        const messageData = {
            id: msgId,
            chatJid,
            chatName,
            senderJid,
            realNumber,
            pushName,
            timestamp,
            type,
            text: text || '',
            hasMedia,
            mimetype,
            isGroup: chatJid.includes('@g.us'),
            isStatus,
            rawMessage
        };
        
        antideleteState.messageCache.set(msgId, messageData);
        antideleteState.stats.totalMessages++;
        
        db.storeAntideleteMessage(msgId, messageData).catch(() => {});
        
        if (antideleteState.messageCache.size > MAX_MESSAGE_CACHE) {
            const excess = antideleteState.messageCache.size - MAX_MESSAGE_CACHE;
            const iter = antideleteState.messageCache.keys();
            for (let i = 0; i < excess; i++) {
                const key = iter.next().value;
                antideleteState.messageCache.delete(key);
            }
        }
        
        return messageData;
        
    } catch (error) {
        console.error('❌ Antidelete: Error storing message:', error.message);
        return null;
    }
}

const recentlyProcessedDeletions = new Map();
const publicModeChatCooldowns = new Map();
const PUBLIC_MODE_COOLDOWN_MS = 30000; // 30s between sends per group in public mode
const _groupAdminCache = new Map(); // cache bot admin status per group (5 min TTL)

export async function antideleteHandleUpdate(update) {
    try {
        if (!antideleteState.settings.initialized || !antideleteState.enabled || !antideleteState.sock) return;
        
        const msgKey = update.key;
        if (!msgKey || !msgKey.id) return;

        const msgId = msgKey.id;
        const _chatJid_dbg = msgKey.remoteJidAlt || msgKey.remoteJid;
        const _isDm_dbg = _chatJid_dbg && !_chatJid_dbg.endsWith('@g.us')
                         && !_chatJid_dbg.endsWith('@newsletter')
                         && _chatJid_dbg !== 'status@broadcast';
        const _stub = update.update?.messageStubType ?? update.messageStubType ?? 'none';

        // Silently drop our own outbound noise BEFORE logging — every message
        // you send used to print enter+skip pairs. They carry no info.
        if (msgKey.fromMe) return;

        // Pretty multi-row debug box (DM-only, matching the old _dlog scope).
        const _dlog = (event, fields = {}) => {
            if (!_isDm_dbg) return;
            const printer = globalThis._printAntideleteBox;
            if (typeof printer === 'function') {
                printer({ event, fields: { 'Msg ID': msgId, Chat: _chatJid_dbg, ...fields } });
            } else {
                console.log('[AD-DM-DEL]', event, JSON.stringify(fields));
            }
        };

        _dlog('enter', { Stub: _stub });
        
        const now = Date.now();
        if (recentlyProcessedDeletions.has(msgId)) {
            _dlog('skip: already processed');
            return;
        }
        recentlyProcessedDeletions.set(msgId, now);
        setTimeout(() => recentlyProcessedDeletions.delete(msgId), 30000);
        const chatJid = msgKey.remoteJidAlt || msgKey.remoteJid;
        
        // Skip channels only — `@lid` DMs are legitimate in Baileys v7
        if (chatJid?.endsWith('@newsletter')) {
            _dlog('skip: newsletter');
            return;
        }
        
        const isStatus = chatJid === 'status@broadcast';
        
        if (isStatus) {
            _dlog('skip: status');
            return;
        }
        
        const isDeleted = 
            update.update?.messageStubType === 1 ||
            update.update?.messageStubType === 2 ||
            update.messageStubType === 1 ||
            update.messageStubType === 2;
        
        if (!isDeleted) {
            _dlog('skip: not a delete (no stubType 1/2)');
            return;
        }
        
        
        let cachedMessage = antideleteState.messageCache.get(msgId);
        if (!cachedMessage) {
            cachedMessage = await db.getAntideleteMessage(msgId);
            if (!cachedMessage) {
                _dlog('skip: no cached message found for this id (was never stored)');
                return;
            }
            _dlog('cache miss → loaded from DB');
        } else {
            _dlog('cache hit');
        }
        
        const rawDeleterJid = update.participant || msgKey.participant || chatJid;
        
        let deletedByNumber;
        const rawDeleterNum = rawDeleterJid.split('@')[0].split(':')[0];
        
        if (rawDeleterJid.endsWith('@lid') || !/^\d+$/.test(rawDeleterNum) || rawDeleterNum.length < 10) {
            if (rawDeleterNum === cachedMessage.senderJid?.split('@')[0]?.split(':')[0]) {
                deletedByNumber = cachedMessage.realNumber || getRealWhatsAppNumber(cachedMessage.senderJid);
            } else {
                deletedByNumber = cachedMessage.realNumber || getRealWhatsAppNumber(cachedMessage.senderJid);
            }
        } else {
            deletedByNumber = getRealWhatsAppNumber(rawDeleterJid);
        }
        
        if (!isStatus) {
            const ownerNumber = antideleteState.ownerJid ? antideleteState.ownerJid.split('@')[0].split(':')[0] : null;
            const senderNumber = cachedMessage.senderJid ? cachedMessage.senderJid.split('@')[0].split(':')[0] : null;
            if (ownerNumber && senderNumber === ownerNumber) {
                _dlog(`skip: senderNumber(${senderNumber}) === ownerNumber(${ownerNumber}) — looks like owner's own msg`);
                return;
            }
        }
        _dlog(`processing → mode=${antideleteState.mode} sendToOwnerDM`);
        
        antideleteState.messageCache.delete(msgId);
        antideleteState.mediaCache.delete(msgId);
        db.deleteAntideleteMessage(msgId).catch(() => {});
        antideleteState.stats.deletedDetected++;
        
        let sent = false;
        
        if (isStatus || cachedMessage.isStatus) {
            sent = await sendToOwnerDM(cachedMessage, deletedByNumber);
            if (sent) {
                antideleteState.stats.sentToDm++;
            }
        } else if (antideleteState.mode === 'private') {
            sent = await sendToOwnerDM(cachedMessage, deletedByNumber);
            if (sent) {
                antideleteState.stats.sentToDm++;
            }
        } else if (antideleteState.mode === 'public') {
            const lastSendTime = publicModeChatCooldowns.get(chatJid) || 0;
            if (now - lastSendTime < PUBLIC_MODE_COOLDOWN_MS) {
                return;
            }
            publicModeChatCooldowns.set(chatJid, now);
            if (publicModeChatCooldowns.size > 200) {
                const oldest = [...publicModeChatCooldowns.entries()].sort((a, b) => a[1] - b[1]).slice(0, 50);
                oldest.forEach(([k]) => publicModeChatCooldowns.delete(k));
            }
            sent = await sendToChat(cachedMessage, chatJid, deletedByNumber);
            if (sent) {
                antideleteState.stats.sentToChat++;
            }
        }
        
        if (sent) {
            antideleteState.stats.retrieved++;
            await saveData();
        }
        
    } catch (error) {
        console.error('❌ Antidelete: Error handling deleted message:', error.message);
    }
}

async function retrySend(sendFn, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (!antideleteState.sock) {
                await new Promise(r => setTimeout(r, attempt * 3000));
                continue;
            }
            await sendFn();
            return true;
        } catch (err) {
            const msg = (err.message || '').toLowerCase();
            const isConnectionError = msg.includes('connection closed') || msg.includes('connection lost') || msg.includes('timed out') || msg.includes('not open');
            if (isConnectionError && attempt < maxRetries) {
                await new Promise(r => setTimeout(r, attempt * 3000));
                continue;
            }
            throw err;
        }
    }
    return false;
}

async function getMediaBuffer(messageData) {
    // Download live from WhatsApp CDN at the moment of deletion.
    // No disk writes, no pre-caching — buffer is used once then released.
    const rawMessage = messageData.rawMessage;
    if (!rawMessage) return null;

    const type = messageData.type === 'voice' ? 'audio' : messageData.type;
    const silentLogger = {
        level: 'silent', trace: () => {}, debug: () => {}, info: () => {},
        warn: () => {}, error: () => {}, fatal: () => {}, child: () => silentLogger
    };

    try {
        const buffer = await Promise.race([
            downloadMediaMessage(
                rawMessage,
                'buffer',
                {},
                { logger: silentLogger, reuploadRequest: antideleteState.sock?.updateMediaMessage }
            ),
            new Promise((_, rej) => setTimeout(() => rej(new Error('dl_timeout')), 20000))
        ]);
        if (buffer && buffer.length > 0) {
            return { buffer, mimetype: messageData.mimetype };
        }
    } catch {}

    // Fallback: try downloadContentFromMessage stream
    try {
        const { downloadContentFromMessage } = await import('wolfsocket');
        const inner = rawMessage?.message;
        if (!inner) return null;
        const mediaKey = `${type}Message`;
        const mediaObj = inner[mediaKey];
        if (!mediaObj) return null;
        const stream = await Promise.race([
            downloadContentFromMessage(mediaObj, type),
            new Promise((_, rej) => setTimeout(() => rej(new Error('dl_timeout')), 20000))
        ]);
        const chunks = [];
        let totalSize = 0;
        for await (const chunk of stream) {
            chunks.push(chunk);
            totalSize += chunk.length;
            if (totalSize > 15 * 1024 * 1024) break; // 15MB cap
        }
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 0) return { buffer, mimetype: messageData.mimetype };
    } catch {}

    return null;
}

async function sendToOwnerDM(messageData, deletedByNumber) {
    try {
        if (!antideleteState.sock || !antideleteState.ownerJid) {
            console.error('❌ Antidelete: Socket or owner JID not set');
            return false;
        }
        
        const ownerJid = antideleteState.ownerJid;
        const time = new Date(messageData.timestamp).toLocaleString();
        
        const senderNumber = messageData.realNumber || getRealWhatsAppNumber(messageData.senderJid);
        
        let chatName = messageData.chatName || (messageData.isGroup ? 'Group Chat' : 'Private Chat');

        // Live re-resolve group subject if cache missed when the message was first seen
        if (messageData.isGroup && messageData.chatJid?.endsWith('@g.us')) {
            const bareId = messageData.chatJid.split('@')[0];
            if (chatName === bareId || chatName === 'Group Chat') {
                try {
                    const meta = await antideleteState.sock.groupMetadata(messageData.chatJid);
                    if (meta?.subject) {
                        chatName = meta.subject;
                        antideleteState.groupCache.set(messageData.chatJid, {
                            name: meta.subject,
                            subject: meta.subject,
                            id: messageData.chatJid,
                            size: meta.participants?.length || 0,
                            cachedAt: Date.now()
                        });
                    }
                } catch {}
            }
        }
        
        let detailsText;
        if (messageData.isStatus) {
            detailsText = `\n\n✧ ${getBotName()} status antidelete\n`;
            detailsText += `✧ 𝙿𝚘𝚜𝚝𝚎𝚍 𝙱𝚢 : ${senderNumber} (${messageData.pushName})\n`;
            if (deletedByNumber && deletedByNumber !== senderNumber) {
                detailsText += `✧ 𝙳𝚎𝚕𝚎𝚝𝚎𝚍 𝙱𝚢 : ${deletedByNumber}\n`;
            }
            detailsText += `✧ 𝚃𝚒𝚖𝚎 : ${time}\n`;
            detailsText += `✧ 𝚃𝚢𝚙𝚎 : ${messageData.type.toUpperCase()}\n`;
        } else {
            detailsText = `\n\n✧ ${getBotName()} message antidelete\n`;
            detailsText += `✧ 𝙵𝚛𝚘𝚖 : ${senderNumber} (${messageData.pushName})\n`;
            if (deletedByNumber && deletedByNumber !== senderNumber) {
                detailsText += `✧ 𝙳𝚎𝚕𝚎𝚝𝚎𝚍 𝙱𝚢 : ${deletedByNumber}\n`;
            }
            detailsText += `✧ 𝙲𝚑𝚊𝚝 : ${chatName}\n`;
            detailsText += `✧ 𝚃𝚒𝚖𝚎 : ${time}\n`;
            detailsText += `✧ 𝚃𝚢𝚙𝚎 : ${messageData.type.toUpperCase()}\n`;
        }
        
        if (messageData.text) {
            detailsText += messageData.isStatus ? `\n✧ 𝗦𝘁𝗮𝘁𝘂𝘀 𝗧𝗲𝘅𝘁:\n${messageData.text}` : `\n✧ 𝗠𝗲𝘀𝘀𝗮𝗴𝗲:\n${messageData.text}`;
        }
        
        if (messageData.hasMedia) {
            const mediaResult = await getMediaBuffer(messageData);
            
            if (mediaResult && mediaResult.buffer && mediaResult.buffer.length > 0) {
                const buffer = mediaResult.buffer;
                const mimetype = mediaResult.mimetype;
                try {
                    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
                    WolfLogger.antidelete(`📥 DM recovered ${sizeMB}MB`, messageData.type, messageData.id);
                    if (messageData.type === 'sticker') {
                        await retrySend(async () => {
                            const stickerMsg = await antideleteState.sock.sendMessage(ownerJid, {
                                sticker: buffer,
                                mimetype: mimetype
                            });
                            await antideleteState.sock.sendMessage(ownerJid, { 
                                text: detailsText 
                            }, { 
                                quoted: stickerMsg 
                            });
                        });
                    } else if (messageData.type === 'image') {
                        await retrySend(() => antideleteState.sock.sendMessage(ownerJid, {
                            image: buffer,
                            caption: detailsText,
                            mimetype: mimetype
                        }));
                    } else if (messageData.type === 'video') {
                        await retrySend(() => antideleteState.sock.sendMessage(ownerJid, {
                            video: buffer,
                            caption: detailsText,
                            mimetype: mimetype
                        }));
                    } else if (messageData.type === 'audio' || messageData.type === 'voice') {
                        await retrySend(async () => {
                            await antideleteState.sock.sendMessage(ownerJid, {
                                audio: buffer,
                                mimetype: mimetype,
                                ptt: messageData.type === 'voice'
                            });
                            await antideleteState.sock.sendMessage(ownerJid, { text: detailsText });
                        });
                    } else if (messageData.type === 'document') {
                        await retrySend(() => antideleteState.sock.sendMessage(ownerJid, {
                            document: buffer,
                            fileName: messageData.text || 'deleted_file',
                            mimetype: mimetype,
                            caption: detailsText
                        }));
                    } else {
                        await retrySend(() => antideleteState.sock.sendMessage(ownerJid, {
                            text: detailsText + `\n\n◉ 𝗠𝗲𝗱𝗶𝗮 𝗧𝘆𝗽𝗲: ${messageData.type}`
                        }));
                    }
                    
                    antideleteState.mediaCache.delete(messageData.id);
                    WolfLogger.antidelete('🗑️ DM cleanup done', null, messageData.id);
                } catch (mediaError) {
                    console.error('❌ Antidelete: Media send error:', mediaError.message);
                    try {
                        await retrySend(() => antideleteState.sock.sendMessage(ownerJid, { 
                            text: detailsText + `\n\n❌ 𝗠𝗲𝗱𝗶𝗮 𝗰𝗼𝘂𝗹𝗱 𝗻𝗼𝘁 𝗯𝗲 𝗿𝗲𝗰𝗼𝘃𝗲𝗿𝗲𝗱` 
                        }));
                    } catch {}
                }
            } else {
                await retrySend(() => antideleteState.sock.sendMessage(ownerJid, { text: detailsText }));
            }
        } else {
            await retrySend(() => antideleteState.sock.sendMessage(ownerJid, { text: detailsText }));
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Antidelete: Error sending to owner DM:', error.message);
        return false;
    }
}

async function isBotAdminInGroup(chatJid) {
    if (!chatJid?.endsWith('@g.us') || !antideleteState.sock) return false;
    const now = Date.now();
    const cached = _groupAdminCache.get(chatJid);
    if (cached && now - cached.ts < 5 * 60 * 1000) return cached.isAdmin;
    try {
        const meta = await antideleteState.sock.groupMetadata(chatJid);
        const botNum = antideleteState.sock.user?.id?.split('@')[0]?.split(':')[0];
        const isAdmin = !!meta?.participants?.some(p => {
            const pNum = p.id?.split('@')[0]?.split(':')[0];
            return pNum === botNum && (p.admin === 'admin' || p.admin === 'superadmin');
        });
        _groupAdminCache.set(chatJid, { isAdmin, ts: now });
        if (_groupAdminCache.size > 100) {
            const oldest = _groupAdminCache.keys().next().value;
            _groupAdminCache.delete(oldest);
        }
        return isAdmin;
    } catch {
        return false;
    }
}

async function sendToChat(messageData, chatJid, deletedByNumber) {
    try {
        if (!antideleteState.sock) return false;

        // If bot is not admin in this group, it cannot send — fall back to owner DM silently
        if (chatJid?.endsWith('@g.us')) {
            const botIsAdmin = await isBotAdminInGroup(chatJid);
            if (!botIsAdmin) {
                return await sendToOwnerDM(messageData, deletedByNumber);
            }
        }

        const time = new Date(messageData.timestamp).toLocaleString();
        
        const senderNumber = messageData.realNumber || getRealWhatsAppNumber(messageData.senderJid);
        
        let detailsText = `\n\n✧ ${getBotName()} antidelete\n`;
        detailsText += `✧ 𝙳𝚎𝚕𝚎𝚝𝚎𝚍 𝙱𝚢 : ${deletedByNumber}\n`;
        detailsText += `✧ 𝚂𝚎𝚗𝚝 𝚋𝚢 : ${senderNumber} (${messageData.pushName})\n`;
        if (chatJid?.endsWith('@g.us')) {
            let groupName = getGroupName(chatJid);
            if (groupName === chatJid.split('@')[0] && antideleteState.sock) {
                try {
                    const meta = await antideleteState.sock.groupMetadata(chatJid);
                    if (meta?.subject) {
                        groupName = meta.subject;
                        antideleteState.groupCache.set(chatJid, { name: meta.subject, subject: meta.subject, id: chatJid, size: meta.participants?.length || 0, cachedAt: Date.now() });
                    }
                } catch {}
            }
            detailsText += `✧ 𝙶𝚛𝚘𝚞𝚙 : ${groupName}\n`;
        }
        detailsText += `✧ 𝚃𝚒𝚖𝚎 : ${time}\n`;
        detailsText += `✧ 𝚃𝚢𝚙𝚎 : ${messageData.type.toUpperCase()}\n`;
        
        if (messageData.text) {
            detailsText += `\n✧ 𝕯𝖊𝖑𝖊𝖙𝖊𝖉 𝕸𝖊𝖘𝖘𝖆𝖌𝖊:\n${messageData.text}`;
        }
        
        if (messageData.hasMedia) {
            const mediaResult = await getMediaBuffer(messageData);
            
            if (mediaResult && mediaResult.buffer && mediaResult.buffer.length > 0) {
                const buffer = mediaResult.buffer;
                const mimetype = mediaResult.mimetype;
                try {
                    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
                    WolfLogger.antidelete(`📥 Chat recovered ${sizeMB}MB`, messageData.type, messageData.id);
                    
                    if (messageData.type === 'sticker') {
                        await retrySend(async () => {
                            const stickerMsg = await antideleteState.sock.sendMessage(chatJid, {
                                sticker: buffer,
                                mimetype: mimetype
                            });
                            await antideleteState.sock.sendMessage(chatJid, { 
                                text: detailsText 
                            }, { 
                                quoted: stickerMsg 
                            });
                        });
                    } else if (messageData.type === 'image') {
                        detailsText = `⚠️ Deleted Image\n${detailsText}`;
                        await retrySend(() => antideleteState.sock.sendMessage(chatJid, {
                            image: buffer,
                            caption: detailsText,
                            mimetype: mimetype
                        }));
                    } else if (messageData.type === 'video') {
                        detailsText = `⚠️ Deleted Video\n${detailsText}`;
                        await retrySend(() => antideleteState.sock.sendMessage(chatJid, {
                            video: buffer,
                            caption: detailsText,
                            mimetype: mimetype
                        }));
                    } else if (messageData.type === 'audio' || messageData.type === 'voice') {
                        await retrySend(async () => {
                            await antideleteState.sock.sendMessage(chatJid, {
                                audio: buffer,
                                mimetype: mimetype,
                                ptt: messageData.type === 'voice'
                            });
                            await antideleteState.sock.sendMessage(chatJid, { text: detailsText });
                        });
                    } else if (messageData.type === 'document') {
                        detailsText = `⚠️ Deleted Document\n${detailsText}`;
                        await retrySend(() => antideleteState.sock.sendMessage(chatJid, {
                            document: buffer,
                            fileName: messageData.text || 'deleted_file',
                            mimetype: mimetype,
                            caption: detailsText
                        }));
                    } else {
                        await retrySend(() => antideleteState.sock.sendMessage(chatJid, {
                            text: detailsText + `\n\n◉ 𝗠𝗲𝗱𝗶𝗮 𝗧𝘆𝗽𝗲: ${messageData.type}`
                        }));
                    }
                    
                    antideleteState.mediaCache.delete(messageData.id);
                    WolfLogger.antidelete('🗑️ Chat cleanup done', null, messageData.id);
                } catch (mediaError) {
                    console.error('❌ Antidelete: Media send error:', mediaError.message);
                    try {
                        await retrySend(() => antideleteState.sock.sendMessage(chatJid, { 
                            text: detailsText + `\n\n❌ 𝗠𝗲𝗱𝗶𝗮 𝗰𝗼𝘂𝗹𝗱 𝗻𝗼𝘁 𝗯𝗲 𝗿𝗲𝗰𝗼𝘃𝗲𝗿𝗲𝗱` 
                        }));
                    } catch {}
                }
            } else {
                WolfLogger.antidelete('⚠️ Not recoverable', null, messageData.id);
                await retrySend(() => antideleteState.sock.sendMessage(chatJid, { text: detailsText }));
            }
        } else {
            await retrySend(() => antideleteState.sock.sendMessage(chatJid, { text: detailsText }));
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Antidelete: Error sending to chat:', error.message);
        return false;
    }
}

export async function initAntidelete(sock) {
    try {
        await loadData();
        
        antideleteState.sock = sock;
        
        if (sock.user?.id) {
            antideleteState.ownerJid = jidNormalizedUser(sock.user.id);
        }
        
        if (antideleteState.settings.autoCleanEnabled) {
            startAutoClean();
        }
        
        antideleteState.settings.initialized = true;
        await saveData();
        
    } catch (error) {
        console.error('❌ Antidelete: Initialization error:', error.message);
    }
}

export function updateAntideleteSock(sock) {
    if (sock) {
        antideleteState.sock = sock;
        if (sock.user?.id) {
            antideleteState.ownerJid = jidNormalizedUser(sock.user.id);
        }
    }
}

export function getAntideleteMode() {
    return antideleteState.mode;
}

export default {
    name: 'antidelete',
    alias: ['undelete', 'antidel', 'ad'],
    description: 'Toggle antidelete mode between PRIVATE and PUBLIC - owner only',
    category: 'owner',
    ownerOnly: true,
    
    async execute(sock, msg, args, prefix, metadata = {}) {
        const chatId = msg.key.remoteJid;
        const command = args[0]?.toLowerCase() || 'status';
        
        const { jidManager } = metadata || {};
        const isSudoUser = metadata?.isSudo ? metadata.isSudo() : false;
        if (!jidManager || (!jidManager.isOwner(msg) && !isSudoUser)) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*\n\nOnly the bot owner can use antidelete commands.`
            }, { quoted: msg });
        }
        
        if (!antideleteState.sock) {
            antideleteState.sock = sock;
        }
        
        if (!antideleteState.ownerJid && metadata.OWNER_JID) {
            antideleteState.ownerJid = metadata.OWNER_JID;
        }
        
        switch (command) {
            case 'public':
                antideleteState.enabled = true;
                globalThis._antideleteEnabled = true;
                antideleteState.mode = 'public';
                await saveData();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ✅ *ANTIDELETE: PUBLIC* ⌋\n├─⊷ Deleted messages will be resent\n│  └⊷ In the original chat\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
                
            case 'private':
            case 'on':
            case 'enable':
                antideleteState.enabled = true;
                globalThis._antideleteEnabled = true;
                antideleteState.mode = 'private';
                await saveData();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ✅ *ANTIDELETE: PRIVATE* ⌋\n├─⊷ Deleted messages will be\n│  └⊷ Sent to your DM only\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
                
            case 'off':
            case 'disable':
                antideleteState.enabled = false;
                globalThis._antideleteEnabled = false;
                await saveData();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ❌ *ANTIDELETE: OFF* ⌋\n├─⊷ Antidelete is now disabled\n│  └⊷ Deleted messages will not be tracked\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
                
            case 'status':
            case 'stats':
                const statusIcon = antideleteState.enabled ? '✅' : '❌';
                const statusLabel = antideleteState.enabled ? 'ACTIVE' : 'OFF';
                const statsText = `╭─⌈ 📊 *ANTIDELETE* ⌋\n├─⊷ *Mode:* ${antideleteState.enabled ? antideleteState.mode.toUpperCase() : 'OFF'}\n├─⊷ *${prefix}antidelete on*\n│  └⊷ Enable (private mode)\n├─⊷ *${prefix}antidelete off*\n│  └⊷ Disable antidelete\n├─⊷ *${prefix}antidelete public*\n│  └⊷ Show in chat\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
                
                await sock.sendMessage(chatId, { text: statsText }, { quoted: msg });
                break;
                
            case 'clear':
            case 'clean':
                const cacheSize = antideleteState.messageCache.size;
                const mediaSize = antideleteState.mediaCache.size;
                const groupSize = antideleteState.groupCache.size;
                
                antideleteState.messageCache.clear();
                antideleteState.mediaCache.clear();
                antideleteState.groupCache.clear();
                
                antideleteState.stats = {
                    totalMessages: 0,
                    deletedDetected: 0,
                    retrieved: 0,
                    mediaCaptured: 0,
                    sentToDm: 0,
                    sentToChat: 0,
                    cacheCleans: 0,
                    totalStorageMB: 0
                };
                
                try {
                    if (db.isAvailable()) {
                        await db.clearAllAntideleteData();
                    }
                } catch (error) {
                    console.error('❌ Error clearing DB antidelete data:', error.message);
                }
                
                await saveData();
                
                await sock.sendMessage(chatId, {
                    text: `🧹 *Cache Cleared*\n\n• Messages: ${cacheSize}\n• Media files: ${mediaSize}\n• Group data: ${groupSize}\n\nAll data has been cleared. Storage reset to 0MB.\n\n✅ Antidelete remains ACTIVE (Mode: ${antideleteState.mode.toUpperCase()})`
                }, { quoted: msg });
                break;
                
            case 'settings':
                const subCommand = args[1]?.toLowerCase();
                
                if (!subCommand) {
                    const settingsText = `╭─⌈ ⚙️ *ANTIDELETE SETTINGS* ⌋\n│\n│ ✅ System: ALWAYS ACTIVE\n│ Mode: ${antideleteState.mode.toUpperCase()} | Storage: DB\n│\n│ 🔧 Auto-clean: ${antideleteState.settings.autoCleanEnabled ? '✅' : '❌'}\n│ 🔧 Clean Retrieved: ${antideleteState.settings.autoCleanRetrieved ? '✅' : '❌'}\n│ 🔧 Max Age: ${antideleteState.settings.maxAgeHours}h | Max Storage: ${antideleteState.settings.maxStorageMB}MB\n│ 🔧 Group Names: ${antideleteState.settings.showGroupNames ? '✅' : '❌'}\n│\n├─⊷ *${prefix}antidelete settings autoclean on/off*\n│  └⊷ Toggle auto-clean\n├─⊷ *${prefix}antidelete settings cleanretrieved on/off*\n│  └⊷ Toggle clean retrieved\n├─⊷ *${prefix}antidelete settings maxage <hours>*\n│  └⊷ Set max cache age\n├─⊷ *${prefix}antidelete settings maxstorage <MB>*\n│  └⊷ Set max storage\n├─⊷ *${prefix}antidelete settings groupnames on/off*\n│  └⊷ Toggle group names\n├─⊷ *${prefix}antidelete settings save*\n│  └⊷ Save settings\n│\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
                    await sock.sendMessage(chatId, { text: settingsText }, { quoted: msg });
                    return;
                }
                
                switch (subCommand) {
                    case 'autoclean':
                        const autocleanValue = args[2]?.toLowerCase();
                        if (autocleanValue === 'on' || autocleanValue === 'enable') {
                            antideleteState.settings.autoCleanEnabled = true;
                            startAutoClean();
                            await saveData();
                            await sock.sendMessage(chatId, {
                                text: `✅ Auto-clean enabled. Cache will be cleaned every 24 hours.`
                            }, { quoted: msg });
                        } else if (autocleanValue === 'off' || autocleanValue === 'disable') {
                            antideleteState.settings.autoCleanEnabled = false;
                            stopAutoClean();
                            await saveData();
                            await sock.sendMessage(chatId, {
                                text: `✅ Auto-clean disabled.`
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, {
                                text: `Usage: \`${prefix}antidelete settings autoclean on/off\``
                            }, { quoted: msg });
                        }
                        break;
                        
                    case 'cleanretrieved':
                        const cleanRetrievedValue = args[2]?.toLowerCase();
                        if (cleanRetrievedValue === 'on' || cleanRetrievedValue === 'enable') {
                            antideleteState.settings.autoCleanRetrieved = true;
                            await saveData();
                            await sock.sendMessage(chatId, {
                                text: `✅ Clean retrieved messages enabled. Messages will be auto-cleaned after being sent to you.`
                            }, { quoted: msg });
                        } else if (cleanRetrievedValue === 'off' || cleanRetrievedValue === 'disable') {
                            antideleteState.settings.autoCleanRetrieved = false;
                            await saveData();
                            await sock.sendMessage(chatId, {
                                text: `✅ Clean retrieved messages disabled. Messages will remain after retrieval.`
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, {
                                text: `Usage: \`${prefix}antidelete settings cleanretrieved on/off\``
                            }, { quoted: msg });
                        }
                        break;
                        
                    case 'groupnames':
                        const groupNamesValue = args[2]?.toLowerCase();
                        if (groupNamesValue === 'on' || groupNamesValue === 'enable') {
                            antideleteState.settings.showGroupNames = true;
                            await saveData();
                            await sock.sendMessage(chatId, {
                                text: `✅ Group names enabled in antidelete notifications.`
                            }, { quoted: msg });
                        } else if (groupNamesValue === 'off' || groupNamesValue === 'disable') {
                            antideleteState.settings.showGroupNames = false;
                            await saveData();
                            await sock.sendMessage(chatId, {
                                text: `✅ Group names disabled in antidelete notifications.`
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, {
                                text: `Usage: \`${prefix}antidelete settings groupnames on/off\``
                            }, { quoted: msg });
                        }
                        break;
                        
                    case 'maxage':
                        const hours = parseInt(args[2]);
                        if (isNaN(hours) || hours < 1 || hours > 168) {
                            await sock.sendMessage(chatId, {
                                text: `❌ Invalid hours. Use 1-168.\nExample: \`${prefix}antidelete settings maxage 48\``
                            }, { quoted: msg });
                            return;
                        }
                        antideleteState.settings.maxAgeHours = hours;
                        await saveData();
                        await sock.sendMessage(chatId, {
                            text: `✅ Max age set to ${hours} hours. Old cache will be cleaned automatically.`
                        }, { quoted: msg });
                        break;
                        
                    case 'maxstorage':
                        const mb = parseInt(args[2]);
                        if (isNaN(mb) || mb < 10 || mb > 5000) {
                            await sock.sendMessage(chatId, {
                                text: `❌ Invalid storage. Use 10-5000MB.\nExample: \`${prefix}antidelete settings maxstorage 1000\``
                            }, { quoted: msg });
                            return;
                        }
                        antideleteState.settings.maxStorageMB = mb;
                        await saveData();
                        await sock.sendMessage(chatId, {
                            text: `✅ Max storage set to ${mb}MB. Force cleanup will trigger at 80% capacity.`
                        }, { quoted: msg });
                        break;
                        
                    case 'save':
                        await saveData();
                        await sock.sendMessage(chatId, {
                            text: `✅ Settings saved successfully to database.`
                        }, { quoted: msg });
                        break;
                        
                    default:
                        await sock.sendMessage(chatId, {
                            text: `❌ Unknown setting. Use \`${prefix}antidelete settings\` for options.`
                        }, { quoted: msg });
                }
                break;
                
            case 'help':
                const helpText = `╭─⌈ 📊 *ANTIDELETE* ⌋\n├─⊷ *Mode:* ${antideleteState.enabled ? antideleteState.mode.toUpperCase() : 'OFF'}\n├─⊷ *${prefix}antidelete on*\n│  └⊷ Enable (private mode)\n├─⊷ *${prefix}antidelete off*\n│  └⊷ Disable antidelete\n├─⊷ *${prefix}antidelete public*\n│  └⊷ Show in chat\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
                
                await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
                break;
                
            default: {
                const modeNow = antideleteState.enabled ? antideleteState.mode.toUpperCase() : 'OFF';
                const helpText = `╭─⌈ 📊 *ANTIDELETE* ⌋\n├─⊷ *Mode:* ${modeNow}\n├─⊷ *${prefix}antidelete on*\n│  └⊷ Enable (private mode)\n├─⊷ *${prefix}antidelete off*\n│  └⊷ Disable antidelete\n├─⊷ *${prefix}antidelete public*\n│  └⊷ Show in chat\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
                if (isButtonModeEnabled() && giftedBtns?.sendInteractiveMessage) {
                    try {
                        await giftedBtns.sendInteractiveMessage(sock, chatId, {
                            body: { text: helpText },
                            footer: { text: `Current: ${modeNow}` },
                            interactiveButtons: [
                                { type: 'quick_reply', display_text: '🔒 Private Mode', id: `${prefix}antidelete private` },
                                { type: 'quick_reply', display_text: '📢 Public Mode', id: `${prefix}antidelete public` },
                                { type: 'quick_reply', display_text: '❌ Turn Off', id: `${prefix}antidelete off` }
                            ]
                        }, { quoted: msg });
                        break;
                    } catch (e) {}
                }
                await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
                break;
            }
        }
    }
};
