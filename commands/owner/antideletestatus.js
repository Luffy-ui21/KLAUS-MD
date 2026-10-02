import { createRequire } from 'module';
import { downloadMediaMessage, downloadContentFromMessage, normalizeMessageContent, jidNormalizedUser } from 'wolfsocket';
import { getBotName } from '../../lib/botname.js';
import { WolfLogger } from '../../lib/wolfLogger.js';
import db from '../../lib/database.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { getPhoneFromLid } from '../../lib/sudo-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const _requireAds = createRequire(import.meta.url);
let giftedBtnsAds;
try { giftedBtnsAds = _requireAds('wolfbtns'); } catch (e) {}

const CACHE_CLEAN_INTERVAL = 1 * 60 * 60 * 1000;
const MAX_CACHE_AGE = 3 * 60 * 60 * 1000;
const MAX_STATUS_AGE_FOR_DOWNLOAD = 30 * 60 * 1000; // skip media older than 30 min (backlog)
const MAX_CONCURRENT_DOWNLOADS = 3;
let _activeDownloads = 0;

let statusAntideleteState = {
    enabled: true,
    mode: 'private',
    ownerJid: null,
    sock: null,
    statusCache: new Map(),
    deletedStatusCache: new Map(),
    mediaCache: new Map(),
    stats: {
        totalStatuses: 0,
        deletedDetected: 0,
        retrieved: 0,
        mediaCaptured: 0,
        sentToDm: 0,
        cacheCleans: 0,
        totalStorageMB: 0
    },
    settings: {
        autoCleanEnabled: true,
        maxAgeHours: 3,
        maxStorageMB: 30,
        ownerOnly: true,
        autoCleanRetrieved: true,
        initialized: false
    },
    cleanupInterval: null
};

const STATUS_PATTERNS = {
    STATUS_JID: 'status@broadcast',
    DELETE_STUB_TYPES: [0, 1, 4, 7, 8, 68, 69]
};

const defaultSettings = {
    autoCleanEnabled: true,
    maxAgeHours: 3,
    maxStorageMB: 30,
    ownerOnly: true,
    autoCleanRetrieved: true,
    initialized: false
};

async function loadStatusData() {
    try {
        const savedSettings = await db.getConfig('antidelete_status_settings', defaultSettings);
        if (savedSettings) {
            statusAntideleteState.settings = { ...statusAntideleteState.settings, ...savedSettings };
        }
        const savedEnabled = await db.getConfig('antidelete_status_enabled', true);
        statusAntideleteState.enabled = savedEnabled;
        const savedMode = await db.getConfig('antidelete_status_mode', 'private');
        statusAntideleteState.mode = savedMode || 'private';
    } catch (error) {
        console.error('❌ Status Antidelete: Error loading settings from DB:', error.message);
    }
}

async function saveStatusData() {
    try {
        await db.setConfig('antidelete_status_settings', statusAntideleteState.settings);
        await db.setConfig('antidelete_status_enabled', statusAntideleteState.enabled);
        await db.setConfig('antidelete_status_mode', statusAntideleteState.mode || 'private');
    } catch (error) {
        console.error('❌ Status Antidelete: Error saving settings to DB:', error.message);
    }
}

async function calculateStorageSize() {
    try {
        let totalBytes = 0;
        for (const [, media] of statusAntideleteState.mediaCache.entries()) {
            totalBytes += media.size || 0;
        }
        statusAntideleteState.stats.totalStorageMB = Math.round(totalBytes / 1024 / 1024);
    } catch (error) {
        console.error('❌ Status Antidelete: Error calculating storage:', error.message);
    }
}

async function cleanRetrievedStatus(statusId) {
    try {
        if (!statusAntideleteState.settings.autoCleanRetrieved) {
            return;
        }

        statusAntideleteState.statusCache.delete(statusId);
        statusAntideleteState.mediaCache.delete(statusId);

        try {
            await db.deleteAntideleteStatus(statusId);
        } catch {}

    } catch (error) {
        console.error('❌ Status Antidelete: Error cleaning retrieved status:', error.message);
    }
}

async function autoCleanCache() {
    try {
        if (!statusAntideleteState.settings.autoCleanEnabled) {
            return;
        }

        const now = Date.now();
        const maxAge = statusAntideleteState.settings.maxAgeHours * 60 * 60 * 1000;
        let cleanedCount = 0;
        let cleanedMedia = 0;

        for (const [key, status] of statusAntideleteState.statusCache.entries()) {
            if (now - status.timestamp > maxAge) {
                statusAntideleteState.statusCache.delete(key);
                cleanedCount++;
            }
        }

        for (const [key, deletedStatus] of statusAntideleteState.deletedStatusCache.entries()) {
            if (now - deletedStatus.timestamp > maxAge) {
                statusAntideleteState.deletedStatusCache.delete(key);
                cleanedCount++;
            }
        }

        for (const [key, media] of statusAntideleteState.mediaCache.entries()) {
            if (now - media.savedAt > maxAge) {
                statusAntideleteState.mediaCache.delete(key);
                cleanedMedia++;
            }
        }

        try {
            await db.cleanOlderThan('antidelete_statuses', 'timestamp', maxAge);
        } catch {}

        await calculateStorageSize();

        if (cleanedCount > 0 || cleanedMedia > 0) {
            statusAntideleteState.stats.cacheCleans++;
            await saveStatusData();
        }

    } catch (error) {
        console.error('❌ Status Antidelete: Auto-clean error:', error.message);
    }
}

async function forceCleanup() {
    try {
        const mediaEntries = Array.from(statusAntideleteState.mediaCache.entries());
        mediaEntries.sort((a, b) => a[1].savedAt - b[1].savedAt);

        let freedSize = 0;
        const targetSize = statusAntideleteState.settings.maxStorageMB * 1024 * 1024 * 0.8;
        let deletedCount = 0;

        for (const [key, media] of mediaEntries) {
            if (statusAntideleteState.stats.totalStorageMB * 1024 * 1024 - freedSize <= targetSize) {
                break;
            }
            statusAntideleteState.mediaCache.delete(key);
            freedSize += media.size || 0;
            deletedCount++;
        }

        const cacheEntries = Array.from(statusAntideleteState.statusCache.entries());
        cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        for (let i = 0; i < Math.min(10, cacheEntries.length); i++) {
            statusAntideleteState.statusCache.delete(cacheEntries[i][0]);
        }

        await calculateStorageSize();
        await saveStatusData();

        console.log(`✅ Status force cleanup completed. Removed ${deletedCount} media entries, freed ~${Math.round(freedSize / 1024 / 1024)}MB`);

    } catch (error) {
        console.error('❌ Status Antidelete: Force cleanup error:', error.message);
    }
}

function startAutoClean() {
    if (statusAntideleteState.cleanupInterval) {
        clearInterval(statusAntideleteState.cleanupInterval);
    }

    statusAntideleteState.cleanupInterval = setInterval(async () => {
        await autoCleanCache();
    }, CACHE_CLEAN_INTERVAL);
}

function getStatusExtensionFromMime(mimetype) {
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
        'audio/aac': '.aac',
        'image/vnd.wap.wbmp': '.wbmp'
    };

    return mimeToExt[mimetype] || '.bin';
}

function getRealWhatsAppNumber(jid) {
    if (!jid) return 'Unknown';

    try {
        const numberPart = jid.split('@')[0];

        if (jid.endsWith('@lid')) {
            // 1. Check the global lidPhoneCache maintained by index.js (most up-to-date)
            const lidCache = globalThis.lidPhoneCache;
            if (lidCache) {
                const fromCache = lidCache.get(numberPart) || lidCache.get(jid);
                if (fromCache) return `+${String(fromCache).replace(/^\+/, '')}`;
            }

            // 2. Try sudo-store getPhoneFromLid
            const resolved = getPhoneFromLid(numberPart);
            if (resolved) return `+${resolved.replace(/^\+/, '')}`;

            // 3. Try globalThis.resolvePhoneFromLid (signal-level resolution)
            if (typeof globalThis.resolvePhoneFromLid === 'function') {
                const fromGlobal = globalThis.resolvePhoneFromLid(jid);
                if (fromGlobal && /^\d+$/.test(String(fromGlobal)) && String(fromGlobal).length >= 7) {
                    return `+${String(fromGlobal).replace(/^\+/, '')}`;
                }
            }

            // 4. Scan contactNames for a number whose last 6 digits match the LID
            if (global.contactNames) {
                for (const [contactJid] of Object.entries(global.contactNames)) {
                    const cPart = contactJid.split('@')[0];
                    if (
                        cPart.endsWith(numberPart.slice(-6)) &&
                        /^\d+$/.test(cPart) &&
                        cPart.length >= 10 &&
                        cPart.length <= 15
                    ) {
                        return `+${cPart}`;
                    }
                }
            }

            return numberPart;
        }

        let cleanNumber = numberPart.replace(/:/g, '').replace(/[^\d]/g, '');

        if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
            return `+${cleanNumber}`;
        }

        if (numberPart && /^\d+$/.test(numberPart) && numberPart.length >= 10) {
            return `+${numberPart}`;
        }

        return numberPart || 'Unknown';

    } catch (error) {
        return 'Unknown';
    }
}

const STARTUP_GRACE_MS = 90 * 1000; // block media downloads for 90s after connect

// On-demand download at delete time (mirrors antidelete.js getMediaBuffer pattern).
// Called when the pre-downloaded buffer is missing from DB/cache.
async function getStatusMediaBuffer(statusData) {
    const rawMessage = statusData.rawMessage;
    if (!rawMessage) return null;

    const type = statusData.type === 'voice' ? 'audio' : statusData.type;
    const silentLogger = {
        level: 'silent', trace: () => {}, debug: () => {}, info: () => {},
        warn: () => {}, error: () => {}, fatal: () => {}, child: function() { return this; }
    };

    // Primary: downloadMediaMessage with reupload hook
    try {
        const buffer = await Promise.race([
            downloadMediaMessage(
                rawMessage,
                'buffer',
                {},
                { logger: silentLogger, reuploadRequest: statusAntideleteState.sock?.updateMediaMessage }
            ),
            new Promise((_, rej) => setTimeout(() => rej(new Error('dl_timeout')), 25000))
        ]);
        if (buffer && buffer.length > 0) {
            return { buffer, mimetype: statusData.mimetype };
        }
    } catch {}

    // Fallback: downloadContentFromMessage stream
    try {
        const inner = rawMessage?.message;
        if (!inner) return null;
        const mediaKey = `${type}Message`;
        const mediaObj = inner[mediaKey];
        if (!mediaObj) return null;
        const stream = await Promise.race([
            downloadContentFromMessage(mediaObj, type),
            new Promise((_, rej) => setTimeout(() => rej(new Error('dl_timeout')), 25000))
        ]);
        const chunks = [];
        let totalSize = 0;
        for await (const chunk of stream) {
            chunks.push(chunk);
            totalSize += chunk.length;
            if (totalSize > 20 * 1024 * 1024) break;
        }
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 0) return { buffer, mimetype: statusData.mimetype };
    } catch {}

    return null;
}

async function downloadAndSaveStatusMedia(msgId, message, messageType, mimetype, statusTimestamp) {
    // Block ALL media downloads during startup flood window
    const _connectedAt = globalThis._botConnectionOpenTime || 0;
    if (_connectedAt > 0 && Date.now() - _connectedAt < STARTUP_GRACE_MS) return null;

    // Skip media for old statuses (backlog from initial sync) — prevents memory bomb on restart
    if (statusTimestamp && (Date.now() - statusTimestamp) > MAX_STATUS_AGE_FOR_DOWNLOAD) {
        return null;
    }
    // Concurrency cap — never download more than MAX_CONCURRENT_DOWNLOADS at once
    if (_activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return null;
    _activeDownloads++;
    let buffer = null;
    try {
        buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            {
                logger: { level: 'silent' },
                reuploadRequest: statusAntideleteState.sock?.updateMediaMessage
            }
        );
    } catch (dlErr) {
        const isKeyErr = dlErr.message?.toLowerCase().includes('media key') ||
                         dlErr.message?.toLowerCase().includes('empty') ||
                         dlErr.message?.toLowerCase().includes('decrypt');
        if (isKeyErr) {
            try {
                const msgContent = normalizeMessageContent(message.message) || message.message;
                let contentMsg = null;
                let contentType = null;
                if (msgContent?.imageMessage) { contentMsg = msgContent.imageMessage; contentType = 'image'; }
                else if (msgContent?.videoMessage) { contentMsg = msgContent.videoMessage; contentType = 'video'; }
                else if (msgContent?.audioMessage) { contentMsg = msgContent.audioMessage; contentType = 'audio'; }
                if (contentMsg && contentType) {
                    if (statusAntideleteState.sock?.updateMediaMessage) {
                        const reuploaded = await statusAntideleteState.sock.updateMediaMessage(message);
                        const reMsgContent = normalizeMessageContent(reuploaded.message) || reuploaded.message;
                        contentMsg = reMsgContent?.[`${contentType}Message`] || contentMsg;
                    }
                    const stream = await downloadContentFromMessage(contentMsg, contentType);
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    buffer = Buffer.concat(chunks);
                }
            } catch (fallbackErr) {
                console.error('❌ Status Antidelete: Fallback download failed:', fallbackErr.message);
                return null;
            }
        } else {
            console.error('❌ Status Antidelete: Media download error:', dlErr.message);
            return null;
        }
    }

    try {
        if (!buffer || buffer.length === 0) return null;

        const maxSize = 8 * 1024 * 1024; // 8MB cap — covers most status videos
        if (buffer.length > maxSize) return null;

        const timestamp = Date.now();
        const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

        let storagePath = null;
        try {
            storagePath = await db.uploadMedia(msgId, buffer, mimetype, 'statuses');
        } catch {}

        statusAntideleteState.mediaCache.set(msgId, {
            type: messageType,
            mimetype: mimetype,
            size: buffer.length,
            isStatus: true,
            savedAt: timestamp,
            dbPath: storagePath || `statuses/${msgId}`
        });

        if (statusAntideleteState.mediaCache.size > 50) {
            const oldest = statusAntideleteState.mediaCache.keys().next().value;
            statusAntideleteState.mediaCache.delete(oldest);
        }

        WolfLogger.statusAD(`💾 Stored ${sizeMB}MB`, messageType, msgId);
        statusAntideleteState.stats.mediaCaptured++;
        return 'db';

    } catch (error) {
        console.error('❌ Status Antidelete: Media download error:', error.message);
        return null;
    } finally {
        _activeDownloads--;
    }
}

function isStatusMessage(message) {
    try {
        const msgKey = message.key;
        if (!msgKey) return false;

        if (msgKey.remoteJid === STATUS_PATTERNS.STATUS_JID) {
            return true;
        }

        return false;
    } catch (error) {
        return false;
    }
}

function extractStatusInfo(message) {
    try {
        const msgKey = message.key;
        const senderJid = msgKey.participantAlt || msgKey.participant || msgKey.remoteJid;
        const pushName = message.pushName || 'Unknown';
        const timestamp = message.messageTimestamp * 1000 || Date.now();

        const msgContent = normalizeMessageContent(message.message);
        let type = 'text';
        let text = '';
        let hasMedia = false;
        let mediaInfo = null;
        let mimetype = '';

        if (msgContent?.imageMessage) {
            type = 'image';
            text = msgContent.imageMessage.caption || '';
            hasMedia = true;
            mimetype = msgContent.imageMessage.mimetype || 'image/jpeg';
            mediaInfo = { message, type: 'image', mimetype };
        } else if (msgContent?.videoMessage) {
            type = 'video';
            text = msgContent.videoMessage.caption || '';
            hasMedia = true;
            mimetype = msgContent.videoMessage.mimetype || 'video/mp4';
            mediaInfo = { message, type: 'video', mimetype };
        } else if (msgContent?.audioMessage) {
            type = 'audio';
            hasMedia = true;
            mimetype = msgContent.audioMessage.mimetype || 'audio/mpeg';
            if (msgContent.audioMessage.ptt) {
                type = 'voice';
            }
            mediaInfo = { message, type: 'audio', mimetype };
        } else if (msgContent?.extendedTextMessage?.text) {
            type = 'text';
            text = msgContent.extendedTextMessage.text;
        } else if (msgContent?.conversation) {
            type = 'text';
            text = msgContent.conversation;
        }

        if (!text && !hasMedia) {
            type = 'status_update';
        }

        return {
            senderJid,
            pushName,
            timestamp,
            type,
            text,
            hasMedia,
            mediaInfo,
            mimetype,
            isStatus: true
        };

    } catch (error) {
        console.error('❌ Status Antidelete: Error extracting status info:', error.message);
        return null;
    }
}

// Skip status messages older than this — prevents startup backlog flood
const MAX_STATUS_STORE_AGE_MS = 5 * 60 * 1000; // 5 minutes

export async function statusAntideleteStoreMessage(message) {
    try {
        if (!statusAntideleteState.sock) return;
        if (!statusAntideleteState.enabled) return;

        if (!isStatusMessage(message)) return;

        const msgKey = message.key;
        const msgId = msgKey.id;
        if (!msgId || msgKey.fromMe) return;

        // Age guard — skip backlog statuses delivered at startup
        const _ts = message.messageTimestamp
            ? (typeof message.messageTimestamp === 'object' ? message.messageTimestamp.low || 0 : Number(message.messageTimestamp)) * 1000
            : 0;
        if (_ts > 0 && Date.now() - _ts > MAX_STATUS_STORE_AGE_MS) return;

        const statusInfo = extractStatusInfo(message);
        if (!statusInfo) return;

        const senderNumber = getRealWhatsAppNumber(statusInfo.senderJid);

        // Store a slim raw reference (thumbnail stripped) for on-demand download at delete time
        let rawMessage = null;
        if (statusInfo.hasMedia && statusInfo.mediaInfo?.message) {
            try {
                const msgCopy = JSON.parse(JSON.stringify(statusInfo.mediaInfo.message));
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

        const statusData = {
            id: msgId,
            chatJid: msgKey.remoteJid,
            senderJid: statusInfo.senderJid,
            senderNumber: senderNumber,
            pushName: statusInfo.pushName,
            timestamp: statusInfo.timestamp,
            type: statusInfo.type,
            text: statusInfo.text || '',
            hasMedia: statusInfo.hasMedia,
            mimetype: statusInfo.mimetype,
            isStatus: true,
            rawMessage
        };

        statusAntideleteState.statusCache.set(msgId, statusData);
        if (statusAntideleteState.statusCache.size > 300) {
            statusAntideleteState.statusCache.delete(statusAntideleteState.statusCache.keys().next().value);
        }
        statusAntideleteState.stats.totalStatuses++;

        try {
            await db.storeAntideleteStatus(msgId, statusData);
        } catch {}

        if (statusInfo.hasMedia && statusInfo.mediaInfo) {
            const delay = Math.random() * 2000 + 1000;
            const _statusTs = statusInfo.timestamp || Date.now();
            setTimeout(async () => {
                try {
                    await downloadAndSaveStatusMedia(msgId, statusInfo.mediaInfo.message, statusInfo.type, statusInfo.mimetype, _statusTs);
                } catch (error) {
                    console.error('❌ Status Antidelete: Async media download failed:', error.message);
                }
            }, delay);
        }

        return statusData;

    } catch (error) {
        console.error('❌ Status Antidelete: Error storing status:', error.message);
        return null;
    }
}

const recentlyProcessedStatusDeletions = new Map();

export async function statusAntideleteHandleUpdate(update) {
    try {
        if (!statusAntideleteState.sock) return;
        if (!statusAntideleteState.enabled) return;

        const msgKey = update.key;
        if (!msgKey || !msgKey.id) return;

        const msgId = msgKey.id;
        
        if (recentlyProcessedStatusDeletions.has(msgId)) {
            return;
        }
        recentlyProcessedStatusDeletions.set(msgId, Date.now());
        setTimeout(() => recentlyProcessedStatusDeletions.delete(msgId), 30000);

        if (msgKey.remoteJid !== STATUS_PATTERNS.STATUS_JID) return;

        const inner = update.update || update;

        const stubType = inner.messageStubType || update.messageStubType;
        const protocolMsg = inner.message?.protocolMessage || inner.protocolMessage;
        const isProtocolRevoke = protocolMsg?.type === 0 || protocolMsg?.type === 4;

        const checks = {
            innerMsgNull: inner.message === null,
            innerMsgUndefinedWithStub: (inner.message === undefined && inner.messageStubType !== undefined),
            status5: inner.status === 5,
            status6: inner.status === 6,
            stubMatch: (stubType !== undefined && STATUS_PATTERNS.DELETE_STUB_TYPES.includes(stubType)),
            protoRevoke: isProtocolRevoke,
            updateMsgNull: update.message === null,
            updateStubMatch: (update.messageStubType !== undefined && STATUS_PATTERNS.DELETE_STUB_TYPES.includes(update.messageStubType))
        };

        const isDeleted = Object.values(checks).some(v => v);

        if (!isDeleted) {
            return;
        }


        let cachedStatus = statusAntideleteState.statusCache.get(msgId);
        if (!cachedStatus) {
            try {
                cachedStatus = await db.getAntideleteStatus(msgId);
            } catch {}
        }
        if (!cachedStatus) {
            return;
        }

        const rawDeleterJid = update.participant || msgKey.participant || cachedStatus.senderJid;
        const deletedByNumber = getRealWhatsAppNumber(rawDeleterJid);
        let postedByNumber = cachedStatus.senderNumber;
        if (!postedByNumber || !postedByNumber.startsWith('+')) {
            postedByNumber = getRealWhatsAppNumber(cachedStatus.senderJid);
        }

        statusAntideleteState.statusCache.delete(msgId);
        statusAntideleteState.deletedStatusCache.set(msgId, {
            ...cachedStatus,
            deletedAt: Date.now(),
            deletedByNumber: deletedByNumber
        });

        statusAntideleteState.stats.deletedDetected++;


        const sent = await sendStatusToOwnerDM(cachedStatus, deletedByNumber);
        if (sent) {
            statusAntideleteState.stats.sentToDm++;
            await cleanRetrievedStatus(msgId);
        }

        statusAntideleteState.stats.retrieved++;

        await saveStatusData();

    } catch (error) {
        console.error('❌ Status Antidelete: Error handling deleted status:', error.message);
    }
}

async function retrySend(sendFn, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (!statusAntideleteState.sock) {
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

async function sendStatusToOwnerDM(statusData, deletedByNumber) {
    try {
        if (!statusAntideleteState.sock || !statusAntideleteState.ownerJid) {
            console.error('❌ Status Antidelete: Socket or owner JID not set');
            return false;
        }

        const ownerJid = statusAntideleteState.ownerJid;
        const time = new Date(statusData.timestamp).toLocaleString();
        let postedByNumber = statusData.senderNumber;
        if (!postedByNumber || !postedByNumber.startsWith('+')) {
            postedByNumber = getRealWhatsAppNumber(statusData.senderJid);
        }
        const displayName = statusData.pushName || 'Unknown';
        const postedByDisplay = (postedByNumber && postedByNumber.startsWith('+'))
            ? `${postedByNumber} (${displayName})`
            : displayName;

        let detailsText = `\n\n✧ ${getBotName()} status antidelete\n`;
        detailsText += `✧ 𝙿𝚘𝚜𝚝𝚎𝚍 𝙱𝚢 : ${postedByDisplay}\n`;
        const _delByResolved = deletedByNumber && deletedByNumber.startsWith('+') ? deletedByNumber : null;
        if (_delByResolved && _delByResolved !== postedByNumber) {
            detailsText += `✧ 𝙳𝚎𝚕𝚎𝚝𝚎𝚍 𝙱𝚢 : ${_delByResolved}\n`;
        }
        detailsText += `✧ 𝚃𝚒𝚖𝚎 : ${time}\n`;
        detailsText += `✧ 𝚃𝚢𝚙𝚎 : ${statusData.type.toUpperCase()}\n`;

        if (statusData.text) {
            detailsText += `\n✧ 𝗦𝘁𝗮𝘁𝘂𝘀 𝗧𝗲𝘅𝘁:\n${statusData.text.substring(0, 1000)}`;
            if (statusData.text.length > 1000) detailsText += '...';
        }

        let mediaCache = statusAntideleteState.mediaCache.get(statusData.id);

        if (statusData.hasMedia) {
            try {
                if (mediaCache?.dbPath) {
                    const dbBuffer = await db.downloadMedia(mediaCache.dbPath);
                    if (dbBuffer) {
                        mediaCache = { ...mediaCache, base64: dbBuffer.toString('base64') };
                    }
                }
                if (!mediaCache?.base64) {
                    const ext = statusData.mimetype?.split('/')[1]?.split(';')[0] || 'bin';
                    const possiblePath = `statuses/${statusData.id}.${ext}`;
                    const dbBuffer = await db.downloadMedia(possiblePath);
                    if (dbBuffer) {
                        mediaCache = {
                            base64: dbBuffer.toString('base64'),
                            type: statusData.type,
                            mimetype: statusData.mimetype || 'application/octet-stream',
                            size: dbBuffer.length,
                            isStatus: true,
                            savedAt: Date.now()
                        };
                    }
                }
                if (!mediaCache?.base64) {
                    const dbBuffer = await db.downloadMedia(`statuses/${statusData.id}`);
                    if (dbBuffer) {
                        mediaCache = {
                            base64: dbBuffer.toString('base64'),
                            type: statusData.type,
                            mimetype: statusData.mimetype || 'application/octet-stream',
                            size: dbBuffer.length,
                            isStatus: true,
                            savedAt: Date.now()
                        };
                    }
                }
            } catch (fetchErr) {
                console.error('❌ Status Antidelete: DB media fetch error:', fetchErr.message);
            }
        }

        // On-demand fallback: if DB/cache lookup returned nothing, try live CDN download
        if (statusData.hasMedia && !mediaCache?.base64) {
            try {
                const liveResult = await getStatusMediaBuffer(statusData);
                if (liveResult?.buffer && liveResult.buffer.length > 0) {
                    WolfLogger.statusAD(`📥 On-demand fallback ok`, statusData.type, null);
                    mediaCache = {
                        base64: liveResult.buffer.toString('base64'),
                        type: statusData.type,
                        mimetype: liveResult.mimetype || statusData.mimetype,
                        size: liveResult.buffer.length,
                        isStatus: true,
                        savedAt: Date.now()
                    };
                }
            } catch {}
        }

        if (statusData.hasMedia && mediaCache?.base64) {
            let mediaSent = false;
            try {
                const buffer = Buffer.from(mediaCache.base64, 'base64');

                if (buffer && buffer.length > 0) {
                    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
                    WolfLogger.statusAD(`📥 DB recovered ${sizeMB}MB`, statusData.type, statusData.id);
                    if (statusData.type === 'image') {
                        await retrySend(() => statusAntideleteState.sock.sendMessage(ownerJid, {
                            image: buffer,
                            caption: detailsText,
                            mimetype: mediaCache.mimetype
                        }));
                        mediaSent = true;
                    } else if (statusData.type === 'video') {
                        await retrySend(() => statusAntideleteState.sock.sendMessage(ownerJid, {
                            video: buffer,
                            caption: detailsText,
                            mimetype: mediaCache.mimetype
                        }));
                        mediaSent = true;
                    } else if (statusData.type === 'audio' || statusData.type === 'voice') {
                        await retrySend(async () => {
                            await statusAntideleteState.sock.sendMessage(ownerJid, {
                                audio: buffer,
                                mimetype: mediaCache.mimetype,
                                ptt: statusData.type === 'voice'
                            });
                            await statusAntideleteState.sock.sendMessage(ownerJid, { text: detailsText });
                        });
                        mediaSent = true;
                    } else {
                        await retrySend(() => statusAntideleteState.sock.sendMessage(ownerJid, { text: detailsText }));
                    }
                } else {
                    await retrySend(() => statusAntideleteState.sock.sendMessage(ownerJid, { text: detailsText }));
                }
            } catch (mediaError) {
                console.error('❌ Status Antidelete: Media send error:', mediaError.message);
                try {
                    await retrySend(() => statusAntideleteState.sock.sendMessage(ownerJid, { 
                        text: detailsText + `\n\n❌ 𝗠𝗲𝗱𝗶𝗮 𝗰𝗼𝘂𝗹𝗱 𝗻𝗼𝘁 𝗯𝗲 𝗿𝗲𝗰𝗼𝘃𝗲𝗿𝗲𝗱`
                    }));
                } catch {}
            }

            if (mediaSent) {
                statusAntideleteState.mediaCache.delete(statusData.id);
                WolfLogger.statusAD('🗑️ Cleanup done', null, statusData.id);
            }
        } else {
            await retrySend(() => statusAntideleteState.sock.sendMessage(ownerJid, { text: detailsText }));
        }

        return true;

    } catch (error) {
        console.error('❌ Status Antidelete: Error sending to owner DM:', error.message);
        return false;
    }
}

export async function initStatusAntidelete(sock) {
    try {
        await loadStatusData();

        if (sock.user?.id) {
            statusAntideleteState.ownerJid = jidNormalizedUser(sock.user.id);
        }

        statusAntideleteState.sock = sock;
        if (!statusAntideleteState.mode) statusAntideleteState.mode = 'private';

        if (statusAntideleteState.settings.autoCleanEnabled) {
            startAutoClean();
        }

        statusAntideleteState.settings.initialized = true;
        await saveStatusData();

        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
        globalThis._wolfSysStats.statusAntidelete = `${statusAntideleteState.enabled ? 'ON' : 'OFF'} (${(statusAntideleteState.mode || 'private').toUpperCase()})`;

    } catch (error) {
        console.error('❌ Status Antidelete: Initialization error:', error.message);
    }
}

export function updateStatusAntideleteSock(sock) {
    if (sock) {
        statusAntideleteState.sock = sock;
        if (sock.user?.id) {
            statusAntideleteState.ownerJid = jidNormalizedUser(sock.user.id);
        }
    }
}

export function getStatusAntideleteInfo() {
    return {
        enabled: statusAntideleteState.enabled,
        mode: statusAntideleteState.mode || 'private'
    };
}

export default {
    name: 'antideletestatus',
    alias: ['statusantidelete', 'sad'],
    description: 'Status antidelete system - always on, captures deleted statuses',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, msg, args, prefix, metadata = {}) {
        const chatId = msg.key.remoteJid;
        const command = args[0]?.toLowerCase() || 'status';

        const { jidManager } = metadata || {};
        const isSudoUser = metadata?.isSudo ? metadata.isSudo() : false;
        if (!jidManager || (!jidManager.isOwner(msg) && !isSudoUser)) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*\n\nOnly the bot owner can use status antidelete commands.`
            }, { quoted: msg });
        }

        if (!statusAntideleteState.sock) {
            statusAntideleteState.sock = sock;
        }

        if (!statusAntideleteState.ownerJid && metadata.OWNER_JID) {
            statusAntideleteState.ownerJid = metadata.OWNER_JID;
        }

        switch (command) {
            case 'private': {
                statusAntideleteState.enabled = true;
                statusAntideleteState.mode = 'private';
                await saveStatusData();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ✅ *STATUS ANTIDELETE: PRIVATE* ⌋\n├─⊷ Deleted statuses sent to owner DM\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }

            case 'public': {
                statusAntideleteState.enabled = true;
                statusAntideleteState.mode = 'public';
                await saveStatusData();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ✅ *STATUS ANTIDELETE: PUBLIC* ⌋\n├─⊷ Deleted statuses sent to same chat\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }

            case 'on':
            case 'enable': {
                statusAntideleteState.enabled = true;
                await saveStatusData();
                const currentMode = (statusAntideleteState.mode || 'private').toUpperCase();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ✅ *STATUS ANTIDELETE: ON (${currentMode})* ⌋\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }

            case 'off':
            case 'disable': {
                statusAntideleteState.enabled = false;
                await saveStatusData();
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ ❌ *STATUS ANTIDELETE: OFF* ⌋\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }

            case 'status':
            case 'stats': {
                const modeDisplay = statusAntideleteState.enabled ? (statusAntideleteState.mode || 'private').toUpperCase() : 'OFF';
                const statsText = `╭─⌈ 📊 *STATUS ANTIDELETE* ⌋\n` +
                    `├─⊷ Status: ${modeDisplay}\n` +
                    `├─⊷ Tracked: ${statusAntideleteState.statusCache.size}\n` +
                    `├─⊷ Deleted: ${statusAntideleteState.stats.deletedDetected}\n` +
                    `├─⊷ Media: ${statusAntideleteState.stats.mediaCaptured}\n` +
                    `├─⊷ Sent: ${statusAntideleteState.stats.sentToDm}\n╰───`;

                await sock.sendMessage(chatId, { text: statsText }, { quoted: msg });
                break;
            }

            case 'list': {
                const deletedStatuses = Array.from(statusAntideleteState.deletedStatusCache.values())
                    .slice(-10)
                    .reverse();

                if (deletedStatuses.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: `📭 *Recent Deleted Statuses*\n\nNo deleted statuses recorded yet.`
                    }, { quoted: msg });
                } else {
                    let listText = `📱 *RECENT DELETED STATUSES (Last 10)*\n\n`;

                    deletedStatuses.forEach((status, index) => {
                        const time = new Date(status.timestamp).toLocaleTimeString();
                        const type = status.type.toUpperCase();
                        const preview = status.text
                            ? status.text.substring(0, 30) + (status.text.length > 30 ? '...' : '')
                            : 'Media only';
                        const senderNumber = status.senderNumber || getRealWhatsAppNumber(status.senderJid);

                        listText += `${index + 1}. ${senderNumber} (${status.pushName})\n`;
                        listText += `   📅 ${time} | 📝 ${type}\n`;
                        listText += `   💬 ${preview}\n`;
                        listText += `   ─────\n`;
                    });

                    listText += `\nTotal deleted statuses: ${statusAntideleteState.deletedStatusCache.size}`;

                    await sock.sendMessage(chatId, { text: listText }, { quoted: msg });
                }
                break;
            }

            case 'clear':
            case 'clean': {
                const cacheSize = statusAntideleteState.statusCache.size;
                const deletedSize = statusAntideleteState.deletedStatusCache.size;
                const mediaSize = statusAntideleteState.mediaCache.size;

                statusAntideleteState.statusCache.clear();
                statusAntideleteState.deletedStatusCache.clear();
                statusAntideleteState.mediaCache.clear();

                statusAntideleteState.stats = {
                    totalStatuses: 0,
                    deletedDetected: 0,
                    retrieved: 0,
                    mediaCaptured: 0,
                    sentToDm: 0,
                    cacheCleans: 0,
                    totalStorageMB: 0
                };

                await saveStatusData();

                await sock.sendMessage(chatId, {
                    text: `🧹 *Status Cache Cleared*\n\n• Statuses: ${cacheSize}\n• Deleted Statuses: ${deletedSize}\n• Media files: ${mediaSize}\n\nAll status data cleared. System remains ACTIVE.`
                }, { quoted: msg });
                break;
            }

            case 'settings': {
                const subCommand = args[1]?.toLowerCase();

                if (!subCommand) {
                    const settingsText = `╭─⌈ ⚙️ *STATUS ANTIDELETE SETTINGS* ⌋\n│\n├─⊷ *${prefix}ads settings autoclean on/off*\n│  └⊷ Toggle auto-clean\n├─⊷ *${prefix}ads settings cleanretrieved on/off*\n│  └⊷ Toggle clean mode\n├─⊷ *${prefix}ads settings maxage <hours>*\n│  └⊷ Set max age\n├─⊷ *${prefix}ads settings maxstorage <MB>*\n│  └⊷ Set max storage\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
                    await sock.sendMessage(chatId, { text: settingsText }, { quoted: msg });
                    return;
                }

                switch (subCommand) {
                    case 'autoclean': {
                        const val = args[2]?.toLowerCase();
                        if (val === 'on' || val === 'enable') {
                            statusAntideleteState.settings.autoCleanEnabled = true;
                            startAutoClean();
                            await saveStatusData();
                            await sock.sendMessage(chatId, { text: `✅ Auto-clean enabled.` }, { quoted: msg });
                        } else if (val === 'off' || val === 'disable') {
                            statusAntideleteState.settings.autoCleanEnabled = false;
                            if (statusAntideleteState.cleanupInterval) {
                                clearInterval(statusAntideleteState.cleanupInterval);
                                statusAntideleteState.cleanupInterval = null;
                            }
                            await saveStatusData();
                            await sock.sendMessage(chatId, { text: `✅ Auto-clean disabled.` }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, { text: `Usage: \`${prefix}ads settings autoclean on/off\`` }, { quoted: msg });
                        }
                        break;
                    }

                    case 'cleanretrieved': {
                        const val = args[2]?.toLowerCase();
                        if (val === 'on' || val === 'enable') {
                            statusAntideleteState.settings.autoCleanRetrieved = true;
                            await saveStatusData();
                            await sock.sendMessage(chatId, { text: `✅ Clean retrieved enabled.` }, { quoted: msg });
                        } else if (val === 'off' || val === 'disable') {
                            statusAntideleteState.settings.autoCleanRetrieved = false;
                            await saveStatusData();
                            await sock.sendMessage(chatId, { text: `✅ Clean retrieved disabled.` }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, { text: `Usage: \`${prefix}ads settings cleanretrieved on/off\`` }, { quoted: msg });
                        }
                        break;
                    }

                    case 'maxage': {
                        const hours = parseInt(args[2]);
                        if (isNaN(hours) || hours < 1 || hours > 720) {
                            await sock.sendMessage(chatId, { text: `❌ Invalid. Use 1-720 hours.` }, { quoted: msg });
                            return;
                        }
                        statusAntideleteState.settings.maxAgeHours = hours;
                        await saveStatusData();
                        await sock.sendMessage(chatId, { text: `✅ Max age set to ${hours} hours.` }, { quoted: msg });
                        break;
                    }

                    case 'maxstorage': {
                        const mb = parseInt(args[2]);
                        if (isNaN(mb) || mb < 10 || mb > 5000) {
                            await sock.sendMessage(chatId, { text: `❌ Invalid. Use 10-5000MB.` }, { quoted: msg });
                            return;
                        }
                        statusAntideleteState.settings.maxStorageMB = mb;
                        await saveStatusData();
                        await sock.sendMessage(chatId, { text: `✅ Max storage set to ${mb}MB.` }, { quoted: msg });
                        break;
                    }

                    default:
                        await sock.sendMessage(chatId, { text: `❌ Unknown setting. Use \`${prefix}ads settings\` for options.` }, { quoted: msg });
                }
                break;
            }

            case 'help': {
                const helpText = `╭─⌈ 🔍 *STATUS ANTIDELETE* ⌋\n` +
                    `├─⊷ *${prefix}ads private/public/off*\n` +
                    `├─⊷ *${prefix}ads stats*\n` +
                    `├─⊷ *${prefix}ads list*\n` +
                    `├─⊷ *${prefix}ads clear*\n` +
                    `├─⊷ *${prefix}ads settings*\n╰───`;

                await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
                break;
            }

            default: {
                const modeNow = statusAntideleteState.enabled ? (statusAntideleteState.mode || 'private').toUpperCase() : 'OFF';
                const helpText = `╭─⌈ 🔍 *STATUS ANTIDELETE* ⌋\n├─⊷ *Mode:* ${modeNow}\n├─⊷ *${prefix}ads on*\n│  └⊷ Enable tracking\n├─⊷ *${prefix}ads off*\n│  └⊷ Disable tracking\n├─⊷ *${prefix}ads status*\n│  └⊷ View stats\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
                if (isButtonModeEnabled() && giftedBtnsAds?.sendInteractiveMessage) {
                    try {
                        await giftedBtnsAds.sendInteractiveMessage(sock, chatId, {
                            body: { text: helpText },
                            footer: { text: `Current: ${modeNow}` },
                            interactiveButtons: [
                                { type: 'quick_reply', display_text: '✅ Enable', id: `${prefix}ads on` },
                                { type: 'quick_reply', display_text: '❌ Disable', id: `${prefix}ads off` },
                                { type: 'quick_reply', display_text: '📊 Status', id: `${prefix}ads status` }
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
