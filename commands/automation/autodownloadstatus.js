// commands/automation/autodownloadstatus.js
import { downloadMediaMessage, normalizeMessageContent, jidNormalizedUser } from 'wolfsocket';
import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CONFIG_DB_KEY = 'autodownloadstatus_config';

const DEFAULT_CONFIG = {
    enabled:          false,
    mode:             'private',
    publicJid:        '',
    ownerJid:         '',
    downloadTypes:    ['image', 'video', 'audio', 'document', 'sticker', 'text'],
    excludedContacts: [],
    skipOwnerStatus:  true,
    totalDownloaded:  0,
    logs:             []
};

class AutoDownloadStatusManager {
    constructor() {
        this.config = this.loadConfig();
        this._saveTimer = null;
        this._downloadedIds = new Set((this.config.downloadedIds || []));
    }

    loadConfig() {
        try {
            const c = supabase.getConfigSync(CONFIG_DB_KEY, DEFAULT_CONFIG);
            if (!Array.isArray(c.excludedContacts)) c.excludedContacts = [];
            if (!Array.isArray(c.downloadTypes))    c.downloadTypes    = [...DEFAULT_CONFIG.downloadTypes];
            if (!Array.isArray(c.logs))              c.logs             = [];
            return { ...DEFAULT_CONFIG, ...c };
        } catch { return { ...DEFAULT_CONFIG }; }
    }

    saveConfig() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            try {
                this.config.downloadedIds = Array.from(this._downloadedIds).slice(-300);
                supabase.setConfig(CONFIG_DB_KEY, this.config).catch(() => {});
            } catch {}
            this._saveTimer = null;
        }, 3000);
    }

    saveImmediate() {
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        try {
            this.config.downloadedIds = Array.from(this._downloadedIds).slice(-300);
            supabase.setConfig(CONFIG_DB_KEY, this.config).catch(() => {});
        } catch {}
    }

    get enabled() { return this.config.enabled; }
    get mode()    { return this.config.mode; }

    _num(input) { return String(input).replace(/[^0-9]/g, ''); }

    isExcluded(statusKey) {
        const list = this.config.excludedContacts;
        if (!list.length) return false;
        const pNum   = (statusKey.participantPn || statusKey.participant || statusKey.remoteJid || '').split('@')[0].split(':')[0];
        const altNum = statusKey.remoteJidAlt ? statusKey.remoteJidAlt.split('@')[0] : null;
        return list.some(n => n === pNum || (altNum && n === altNum));
    }

    hasDownloaded(id) { return this._downloadedIds.has(id); }
    markDownloaded(id) {
        this._downloadedIds.add(id);
        if (this._downloadedIds.size > 400) {
            const arr = Array.from(this._downloadedIds);
            this._downloadedIds = new Set(arr.slice(-200));
        }
        this.saveConfig();
    }

    addLog(sender, type) {
        const entry = { sender, type, timestamp: Date.now() };
        this.config.logs.push(entry);
        this.config.totalDownloaded++;
        if (this.config.logs.length > 100) this.config.logs.shift();
        this.saveConfig();
    }

    excludeContact(input) {
        const num = this._num(input);
        if (!num) return false;
        if (!this.config.excludedContacts.includes(num)) {
            this.config.excludedContacts.push(num); this.saveImmediate(); return true;
        }
        return false;
    }

    includeContact(input) {
        const num = this._num(input);
        const idx = this.config.excludedContacts.indexOf(num);
        if (idx !== -1) { this.config.excludedContacts.splice(idx, 1); this.saveImmediate(); return true; }
        return false;
    }

    hasType(t) { return this.config.downloadTypes.includes(t); }

    setOwnerJid(jid) {
        this.config.ownerJid = jid; this.saveImmediate();
    }

    getStats() {
        return {
            enabled:       this.config.enabled,
            mode:          this.config.mode,
            publicJid:     this.config.publicJid || 'not set',
            types:         this.config.downloadTypes.join(', '),
            total:         this.config.totalDownloaded,
            excluded:      this.config.excludedContacts.length,
            lastLog:       this.config.logs.at(-1) || null,
            skipOwn:       this.config.skipOwnerStatus
        };
    }
}

const manager = new AutoDownloadStatusManager();
export { manager as autoDownloadStatusManager };
globalThis._autoDownloadReload = () => { try { manager.config = manager.loadConfig(); } catch {} };

// ── In-memory cache: stores incoming statuses so we can save on demand ──────
// Key = statusKey.id, Value = { statusKey, resolvedMessage, cachedAt }
const _statusCache = new Map();
const STATUS_CACHE_MAX  = 300;
const STATUS_CACHE_TTL  = 23 * 60 * 60 * 1000; // 23 hours

function _pruneCache() {
    const now = Date.now();
    for (const [id, entry] of _statusCache) {
        if (now - entry.cachedAt > STATUS_CACHE_TTL) _statusCache.delete(id);
    }
    if (_statusCache.size > STATUS_CACHE_MAX) {
        const oldest = [..._statusCache.keys()].slice(0, _statusCache.size - STATUS_CACHE_MAX);
        oldest.forEach(k => _statusCache.delete(k));
    }
}

export function cacheStatusMessage(msgId, statusKey, resolvedMessage) {
    if (!msgId || !resolvedMessage) return;
    _statusCache.set(msgId, { statusKey, resolvedMessage, cachedAt: Date.now() });
    if (_statusCache.size > STATUS_CACHE_MAX + 50) _pruneCache();
}

// Returns true only when a real received status is cached under this ID.
// Used by index.js to reject fake quoted-contact-card stanzaIds (e.g. from
// .ping, .alive, .menu) that share remoteJid:'status@broadcast' but were
// never actually received as a status update.
export function isStatusCached(stanzaId) {
    if (!stanzaId) return false;
    return _statusCache.has(stanzaId);
}

// ── Helper: get media type + media object from normalized message ──────────
function getMediaInfo(msgContent) {
    if (!msgContent) return null;
    if (msgContent.imageMessage)    return { type: 'image',    media: msgContent.imageMessage,    caption: msgContent.imageMessage.caption || '' };
    if (msgContent.videoMessage)    return { type: 'video',    media: msgContent.videoMessage,    caption: msgContent.videoMessage.caption || '' };
    if (msgContent.audioMessage)    return { type: 'audio',    media: msgContent.audioMessage,    caption: '' };
    if (msgContent.stickerMessage)  return { type: 'sticker',  media: msgContent.stickerMessage,  caption: '' };
    if (msgContent.documentMessage) return { type: 'document', media: msgContent.documentMessage, caption: msgContent.documentMessage.caption || '' };
    return null;
}

function getTextInfo(msgContent) {
    if (!msgContent) return null;
    const t = msgContent.extendedTextMessage?.text || msgContent.conversation;
    return t ? { type: 'text', text: t } : null;
}

function getRealNumber(jid) {
    if (!jid) return 'Unknown';
    const num = jid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
    return num.length >= 7 ? `+${num}` : jid.split('@')[0];
}

// ── Main export: called for every status@broadcast message ─────────────────
export async function handleAutoDownloadStatus(sock, statusKey, resolvedMessage) {
    try {
        if (!manager.enabled) return;
        if (!resolvedMessage) return;
        if (statusKey.fromMe) return;

        const msgId = statusKey.id;
        if (!msgId) return;
        if (manager.hasDownloaded(msgId)) return;
        if (manager.isExcluded(statusKey)) return;

        const msgContent = normalizeMessageContent(resolvedMessage) || resolvedMessage;
        if (!msgContent) return;

        // Skip protocol/reaction/stub messages
        if (msgContent.protocolMessage || msgContent.reactionMessage || msgContent.messageStubType) return;

        const mediaInfo = getMediaInfo(msgContent);
        const textInfo  = getTextInfo(msgContent);
        if (!mediaInfo && !textInfo) return;

        const mediaType = mediaInfo?.type || 'text';
        if (!manager.hasType(mediaType)) return;

        // Resolve sender number
        const senderJid    = statusKey.participantPn || statusKey.remoteJidAlt || statusKey.participant || statusKey.remoteJid;
        const senderNumber = getRealNumber(senderJid);
        const pushName     = statusKey.pushName || '';

        // Skip owner's own statuses if configured
        if (manager.config.skipOwnerStatus) {
            const ownerNum = (manager.config.ownerJid || global.OWNER_CLEAN_JID || '').split('@')[0];
            const senderNum = senderJid.split('@')[0].split(':')[0];
            if (ownerNum && senderNum === ownerNum) return;
        }

        // Resolve destination JID
        let destJid = '';
        if (manager.config.mode === 'private') {
            destJid = manager.config.ownerJid || global.OWNER_CLEAN_JID || '';
            if (!destJid) return;
            destJid = jidNormalizedUser(destJid);
        } else {
            destJid = manager.config.publicJid;
            if (!destJid) return;
        }

        // Mark downloaded before async work to block duplicates
        manager.markDownloaded(msgId);

        const timeStr   = new Date().toLocaleTimeString();
        const nameLabel = pushName ? `${pushName} (${senderNumber})` : senderNumber;

        const silentLogger = {
            level: 'silent', trace: () => {}, debug: () => {}, info: () => {},
            warn:  () => {}, error: () => {}, fatal: () => {},
            child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {},
                            warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) })
        };

        if (mediaInfo) {
            const cleanMedia = { ...mediaInfo.media };
            delete cleanMedia.viewOnce;

            let buffer;
            try {
                const dlMsg = {
                    key:     { remoteJid: 'status@broadcast', id: msgId, participant: senderJid, fromMe: false },
                    message: { [`${mediaType}Message`]: cleanMedia }
                };
                buffer = await Promise.race([
                    downloadMediaMessage(dlMsg, 'buffer', {}, { logger: silentLogger, reuploadRequest: sock.updateMediaMessage }),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('dl_timeout')), 20000))
                ]);
            } catch {
                return; // silent fail — status may have expired
            }

            if (!buffer || buffer.length === 0) return;

            let caption = `╭─⌈ 📲 *STATUS DOWNLOADED* ⌋\n`;
            caption += `│ 👤 *From:* ${nameLabel}\n`;
            if (mediaInfo.caption) caption += `│ 💬 *Caption:* ${mediaInfo.caption}\n`;
            caption += `│ 📁 *Type:* ${mediaType}\n`;
            caption += `│ ⏰ *Time:* ${timeStr}\n`;
            caption += `╰⊷ ${getFooter(global.OWNER_CLEAN_JID || '')}`;

            const payload = {};
            if (mediaType === 'sticker') {
                payload.sticker = buffer;
            } else if (mediaType === 'document') {
                payload.document = buffer;
                payload.fileName = mediaInfo.media.fileName || `status_${msgId}.bin`;
                payload.mimetype = mediaInfo.media.mimetype || 'application/octet-stream';
                payload.caption  = caption;
            } else {
                payload[mediaType] = buffer;
                payload.caption    = caption;
                if (mediaInfo.media.mimetype) payload.mimetype = mediaInfo.media.mimetype;
            }

            await sock.sendMessage(destJid, payload);

            if (mediaType === 'sticker') {
                await sock.sendMessage(destJid, { text: caption });
            }

        } else if (textInfo) {
            let msg = `╭─⌈ 📲 *STATUS DOWNLOADED* ⌋\n`;
            msg += `│ 👤 *From:* ${nameLabel}\n`;
            msg += `│ 📝 *Text:* ${textInfo.text}\n`;
            msg += `│ ⏰ *Time:* ${timeStr}\n`;
            msg += `╰⊷ ${getFooter(global.OWNER_CLEAN_JID || '')}`;
            await sock.sendMessage(destJid, { text: msg });
        }

        manager.addLog(senderNumber, mediaType);
        console.log(`\x1b[36m[AutoDL-Status] ✅ ${mediaType} from ${senderNumber} → ${destJid}\x1b[0m`);

    } catch (err) {
        if (!err.message?.includes('dl_timeout') && !err.message?.includes('not-authorized')) {
            console.log(`\x1b[31m[AutoDL-Status] ❌ ${err.message}\x1b[0m`);
        }
    }
}

// ── Called when owner manually replies to a status with text or sticker ────
export async function triggerSaveFromOwnerReply(sock, replyContextInfo) {
    try {
        const stanzaId    = replyContextInfo?.stanzaId;
        const participant = replyContextInfo?.participant;
        if (!stanzaId) return;

        // Ensure ownerJid is populated so we know where to deliver
        if (!manager.config.ownerJid && global.OWNER_CLEAN_JID) {
            manager.setOwnerJid(global.OWNER_CLEAN_JID);
        }

        const cached = _statusCache.get(stanzaId);
        if (!cached) {
            // Status not in cache (too old or bot was restarted)
            const ownerJid = manager.config.ownerJid || global.OWNER_CLEAN_JID || '';
            if (ownerJid) {
                await sock.sendMessage(ownerJid, {
                    text: '⚠️ *STATUS NOT FOUND*\nThe status you replied to is no longer in memory (too old or bot was restarted). Please view it again or wait for the next one.'
                });
            }
            return;
        }

        // Build a modified statusKey using cached data + reply context participant
        const statusKey = {
            ...cached.statusKey,
            id: stanzaId,
            participant: participant || cached.statusKey.participant,
            fromMe: false
        };

        // Remove from dedup set so it can be re-saved on explicit request
        manager._downloadedIds.delete(stanzaId);

        // Ensure enabled state doesn't block us — call download logic directly
        const wasEnabled = manager.config.enabled;
        manager.config.enabled = true;
        try {
            await handleAutoDownloadStatus(sock, statusKey, cached.resolvedMessage);
        } finally {
            manager.config.enabled = wasEnabled;
        }
    } catch (err) {
        console.log(`\x1b[31m[AutoDL-Status] triggerSaveFromOwnerReply error: ${err.message}\x1b[0m`);
    }
}

// ── WhatsApp command ───────────────────────────────────────────────────────
export default {
    name:      'autodownloadstatus',
    alias:     ['autosave', 'autostatussave', 'autodlstatus'],
    desc:      'Auto-download statuses to private DM or a public chat',
    category:  'automation',
    ownerOnly: true,

    async execute(sock, msg, args, prefix, extras) {
        const chatId  = msg.key.remoteJid;
        const isOwner = extras?.isOwner ? extras.isOwner() : false;
        const isSudo  = extras?.isSudo  ? extras.isSudo()  : false;

        if (!isOwner && !isSudo) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command' }, { quoted: msg });
            return;
        }

        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
        const sub    = (args[0] || '').toLowerCase();
        const action = (args[1] || '').toLowerCase();

        // Register owner JID on first use
        const callerJid = jidNormalizedUser(msg.key.participant || chatId);
        if (!manager.config.ownerJid) manager.setOwnerJid(callerJid);

        if (!sub) {
            const s = manager.getStats();
            return reply(
                `╭─⌈ 📲 *AUTO-DOWNLOAD STATUS* ⌋\n│\n` +
                `│ Status : ${s.enabled ? '✅ ON' : '❌ OFF'}\n` +
                `│ Mode   : ${s.mode === 'private' ? '🔒 Private (DM)' : `🌐 Public (${s.publicJid})`}\n` +
                `│ Types  : ${s.types}\n` +
                `│ Total  : ${s.total} downloaded\n` +
                `│ Skip own status: ${s.skipOwn ? '✅' : '❌'}\n` +
                `│\n` +
                `├─⊷ *${prefix}ads on / off*\n` +
                `├─⊷ *${prefix}ads private*  → save to your DM\n` +
                `├─⊷ *${prefix}ads public <groupJid>*  → save to a chat\n` +
                `├─⊷ *${prefix}ads types*  → show/set media types\n` +
                `├─⊷ *${prefix}ads exclude <number>*\n` +
                `├─⊷ *${prefix}ads include <number>*\n` +
                `├─⊷ *${prefix}ads skipown on/off*\n` +
                `├─⊷ *${prefix}ads stats*\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        if (['on', 'enable'].includes(sub)) {
            manager.config.enabled = true;
            manager.saveImmediate();
            const s = manager.getStats();
            return reply(`✅ *AUTO-DOWNLOAD STATUS ENABLED*\nMode: ${s.mode === 'private' ? 'Private DM' : `Public → ${s.publicJid}`}\nTypes: ${s.types}`);
        }

        if (['off', 'disable'].includes(sub)) {
            manager.config.enabled = false;
            manager.saveImmediate();
            return reply(`❌ *AUTO-DOWNLOAD STATUS DISABLED*`);
        }

        if (sub === 'private') {
            manager.config.mode = 'private';
            manager.setOwnerJid(callerJid);
            manager.saveImmediate();
            return reply(`🔒 *PRIVATE MODE*\nStatuses will be saved to your DM.`);
        }

        if (sub === 'public') {
            const jid = args[1] || '';
            if (!jid || (!jid.endsWith('@g.us') && !jid.endsWith('@s.whatsapp.net'))) {
                return reply(`Usage: *${prefix}ads public <groupJid>*\nExample: ${prefix}ads public 1234567890-1234567890@g.us\n\nYou can also reply in the target group and use *${prefix}ads public here*`);
            }
            manager.config.mode      = 'public';
            manager.config.publicJid = jid;
            manager.saveImmediate();
            return reply(`🌐 *PUBLIC MODE*\nStatuses will be forwarded to:\n${jid}`);
        }

        // .ads public here — use current chat as destination
        if (sub === 'public' && action === 'here' || (sub === 'here')) {
            manager.config.mode      = 'public';
            manager.config.publicJid = chatId;
            manager.saveImmediate();
            return reply(`🌐 *PUBLIC MODE*\nStatuses will be forwarded to *this chat*.`);
        }

        if (sub === 'here') {
            manager.config.mode      = 'public';
            manager.config.publicJid = chatId;
            manager.saveImmediate();
            return reply(`🌐 *PUBLIC MODE*\nStatuses will be forwarded to *this chat*.`);
        }

        if (['exclude', 'skip', 'block'].includes(sub)) {
            const num = args[1];
            if (!num) return reply(`Usage: *${prefix}ads exclude <number>*`);
            if (manager.excludeContact(num))
                return reply(`✅ ${num.replace(/[^0-9]/g, '')} excluded — their statuses won't be downloaded.`);
            return reply(`⚠️ Already excluded.`);
        }

        if (['include', 'unexclude', 'unblock'].includes(sub)) {
            const num = args[1];
            if (!num) return reply(`Usage: *${prefix}ads include <number>*`);
            if (manager.includeContact(num))
                return reply(`✅ ${num.replace(/[^0-9]/g, '')} removed from exclusion list.`);
            return reply(`⚠️ Not in exclusion list.`);
        }

        if (sub === 'types') {
            const all = ['image', 'video', 'audio', 'document', 'sticker', 'text'];
            if (!action) {
                return reply(
                    `📁 *MEDIA TYPES*\n\n` +
                    `Active: ${manager.config.downloadTypes.join(', ')}\n\n` +
                    `Add:    *${prefix}ads types add image/video/audio/document/sticker/text*\n` +
                    `Remove: *${prefix}ads types remove video*\n` +
                    `All:    *${prefix}ads types all*\n` +
                    `Reset:  *${prefix}ads types reset*`
                );
            }
            const typeArg = args[2]?.toLowerCase();
            if (action === 'all') {
                manager.config.downloadTypes = [...all];
                manager.saveImmediate();
                return reply(`✅ All types enabled: ${all.join(', ')}`);
            }
            if (action === 'reset') {
                manager.config.downloadTypes = [...DEFAULT_CONFIG.downloadTypes];
                manager.saveImmediate();
                return reply(`🔄 Types reset to defaults: ${manager.config.downloadTypes.join(', ')}`);
            }
            if (action === 'add' && typeArg) {
                if (!all.includes(typeArg)) return reply(`❌ Unknown type. Choose: ${all.join(', ')}`);
                if (!manager.config.downloadTypes.includes(typeArg)) {
                    manager.config.downloadTypes.push(typeArg);
                    manager.saveImmediate();
                    return reply(`✅ Added *${typeArg}*. Active: ${manager.config.downloadTypes.join(', ')}`);
                }
                return reply(`⚠️ *${typeArg}* already active.`);
            }
            if (action === 'remove' && typeArg) {
                const idx = manager.config.downloadTypes.indexOf(typeArg);
                if (idx !== -1) {
                    manager.config.downloadTypes.splice(idx, 1);
                    manager.saveImmediate();
                    return reply(`✅ Removed *${typeArg}*. Active: ${manager.config.downloadTypes.join(', ')}`);
                }
                return reply(`⚠️ *${typeArg}* not active.`);
            }
            return reply(`Usage: *${prefix}ads types add/remove/all/reset <type>*`);
        }

        if (sub === 'skipown') {
            if (!action) return reply(`Current: ${manager.config.skipOwnerStatus ? 'ON' : 'OFF'}\nUsage: *${prefix}ads skipown on/off*`);
            manager.config.skipOwnerStatus = (action === 'on');
            manager.saveImmediate();
            return reply(`✅ Skip own status: *${manager.config.skipOwnerStatus ? 'ON' : 'OFF'}*`);
        }

        if (['stats', 'status', 'info'].includes(sub)) {
            const s = manager.getStats();
            let text = `📊 *AUTO-DOWNLOAD STATUS STATS*\n\n`;
            text += `🟢 Status     : ${s.enabled ? 'ACTIVE ✅' : 'INACTIVE ❌'}\n`;
            text += `📤 Mode       : ${s.mode === 'private' ? 'Private DM' : `Public → ${s.publicJid}`}\n`;
            text += `📁 Types      : ${s.types}\n`;
            text += `📥 Total      : *${s.total}* statuses downloaded\n`;
            text += `🚫 Excluded   : ${s.excluded} contacts\n`;
            text += `🙈 Skip own   : ${s.skipOwn ? 'Yes' : 'No'}\n`;
            if (s.lastLog) {
                const ago = Math.floor((Date.now() - s.lastLog.timestamp) / 60000);
                text += `\n🕒 Last: ${s.lastLog.sender} (${s.lastLog.type}) — ${ago < 1 ? 'just now' : ago + ' min ago'}`;
            }
            return reply(text);
        }

        if (['clear', 'reset'].includes(sub)) {
            manager.config.totalDownloaded = 0;
            manager.config.logs = [];
            manager._downloadedIds.clear();
            manager.saveImmediate();
            return reply(`🔄 Download history cleared.`);
        }

        return reply(`❌ Unknown option. Use *${prefix}ads* to see available commands.`);
    }
};
