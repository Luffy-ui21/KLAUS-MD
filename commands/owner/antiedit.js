import { downloadMediaMessage, getContentType } from 'wolfsocket';
import { createRequire } from 'module';
import db from '../../lib/database.js';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { isGiftedBtnsAvailable } from '../../lib/buttonHelper.js';

const _require = createRequire(import.meta.url);
let _giftedBtns = null;
try { _giftedBtns = _require('wolfbtns'); } catch {}

const publicModeChatCooldowns = new Map();
const PUBLIC_MODE_COOLDOWN_MS = 5000;

// Zero-width character "read more" separator — same technique as menu.js case 1
const READ_MORE_SEP = Array.from({ length: 550 }, (_, i) =>
    ['\u200E', '\u200F', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'][i % 7]
).join('');

// ── Antiedit signature logger (╭─⌈ icon TAG ⌋ … ╰⊷) ─────────────────────────
// Each row gets its own » line (good for long Keys/IDs). Tone auto-derives from
// icon: ❌ → red, ⚠️ → yellow, everything else → green (default success/info).
const _AE_PALETTE = {
    green:  { NB: '\x1b[1m\x1b[38;2;0;255;156m',  N: '\x1b[38;2;0;255;156m'  },
    yellow: { NB: '\x1b[1m\x1b[38;2;250;204;21m', N: '\x1b[38;2;250;204;21m' },
    red:    { NB: '\x1b[1m\x1b[38;2;255;80;80m',  N: '\x1b[38;2;255;80;80m'  },
};
const _AE_D = '\x1b[2m\x1b[38;2;100;120;130m';
const _AE_W = '\x1b[38;2;200;215;225m';
const _AE_R = '\x1b[0m';

function _aeToneFor(icon) {
    if (typeof icon !== 'string') return 'green';
    if (icon.includes('❌')) return 'red';
    if (icon.includes('⚠️') || icon.includes('⏭️')) return 'yellow';
    return 'green';
}
function _aeLog(icon, label, rows) {
    const tone = _aeToneFor(icon);
    const { NB, N } = _AE_PALETTE[tone] || _AE_PALETTE.green;
    const maxLbl = rows.reduce((m, [l]) => Math.max(m, l.length), 0);
    const lines = [`${NB}╭─⌈ ${icon} ${label} ⌋${_AE_R}`];
    for (const [l, v] of rows) {
        const pad = ' '.repeat(Math.max(0, maxLbl - l.length));
        lines.push(`${NB}» ${_AE_R}${_AE_D}${l}${pad}${_AE_R} ${N}:${_AE_R} ${_AE_W}${v}${_AE_R}`);
    }
    lines.push(`${NB}╰⊷${_AE_R}`);
    console.log('\n' + lines.join('\n') + '\n');
}
// ─────────────────────────────────────────────────────────────────────────────

function resolveRealNumber(jid, groupMeta) {
    if (!jid) return 'Unknown';
    const raw = jid.split('@')[0].split(':')[0];
    if (!jid.includes('@lid')) return raw;
    const cache = globalThis.lidPhoneCache;
    if (cache) {
        const cached = cache.get(raw) || cache.get(jid.split('@')[0]);
        if (cached) return cached;
    }
    if (groupMeta?.participants) {
        for (const p of groupMeta.participants) {
            const pid = p.id || '';
            const plid = p.lid || '';
            const plidNum = plid.split('@')[0].split(':')[0];
            const pidNum = pid.split('@')[0].split(':')[0];
            if (plidNum === raw || pidNum === raw) {
                if (pid && !pid.includes('@lid')) {
                    const phone = pid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    if (phone.length >= 7) {
                        if (cache) cache.set(raw, phone);
                        return phone;
                    }
                }
                if (p.phoneNumber) {
                    const phone = String(p.phoneNumber).replace(/[^0-9]/g, '');
                    if (phone.length >= 7) {
                        if (cache) cache.set(raw, phone);
                        return phone;
                    }
                }
            }
        }
    }
    return raw;
}

async function resolveNumberWithGroup(jid, chatJid) {
    if (!jid) return 'Unknown';
    const raw = jid.split('@')[0].split(':')[0];
    if (!jid.includes('@lid')) return raw;
    const cache = globalThis.lidPhoneCache;
    if (cache) {
        const cached = cache.get(raw) || cache.get(jid.split('@')[0]);
        if (cached) return cached;
    }
    if (chatJid?.includes('@g.us') && antieditState.sock) {
        try {
            const meta = await antieditState.sock.groupMetadata(chatJid);
            return resolveRealNumber(jid, meta);
        } catch {}
    }
    return raw;
}

let antieditState = {
    gc: { enabled: true, mode: 'private' },
    pm: { enabled: true, mode: 'private' },
    ownerJid: null,
    sock: null,
    messageHistory: new Map(),
    currentMessages: new Map(),
    mediaCache: new Map(),
    groupConfigs: new Map(),
    recentEditAlerts: new Map(),   // msgId → timestamp, deduplicates double-firing
    stats: {
        totalMessages: 0,
        editsDetected: 0,
        retrieved: 0,
        mediaCaptured: 0,
        sentToDm: 0,
        sentToChat: 0
    }
};

const defaultSettings = {
    gc: { enabled: true, mode: 'private' },
    pm: { enabled: true, mode: 'private' },
    groupConfigs: {},
    stats: {
        totalMessages: 0,
        editsDetected: 0,
        retrieved: 0,
        mediaCaptured: 0,
        sentToDm: 0,
        sentToChat: 0
    }
};

function getEffectiveConfig(chatId) {
    const isGroup = chatId?.endsWith('@g.us');
    if (isGroup) {
        const groupConf = antieditState.groupConfigs.get(chatId);
        if (groupConf && typeof groupConf === 'object' && groupConf.enabled !== undefined) {
            return groupConf;
        }
        return { enabled: antieditState.gc.enabled, mode: antieditState.gc.mode };
    } else {
        return { enabled: antieditState.pm.enabled, mode: antieditState.pm.mode };
    }
}

async function loadData() {
    try {
        const settings = await db.getConfig('antiedit_settings', defaultSettings);
        if (settings) {
            if (settings.gc) antieditState.gc = { ...antieditState.gc, ...settings.gc };
            if (settings.pm) antieditState.pm = { ...antieditState.pm, ...settings.pm };
            if (settings.enabled !== undefined && !settings.gc) {
                antieditState.gc.enabled = settings.enabled;
                antieditState.pm.enabled = settings.enabled;
            }
            if (settings.mode && !settings.gc) {
                antieditState.gc.mode = settings.mode;
                antieditState.pm.mode = settings.mode;
            }
            if (settings.groupConfigs && typeof settings.groupConfigs === 'object') {
                for (const [k, v] of Object.entries(settings.groupConfigs)) {
                    antieditState.groupConfigs.set(k, v);
                }
            }
            if (settings.stats) antieditState.stats = { ...antieditState.stats, ...settings.stats };
        }
        _aeLog('✏️', 'ANTIEDIT', [['Action', 'Settings loaded from DB'], ['GC mode', antieditState.gc.mode], ['PM mode', antieditState.pm.mode]]);
    } catch (error) {
        console.error('❌ Antiedit: Error loading data:', error.message);
    }
}

async function saveData() {
    try {
        const groupConfigsObj = {};
        for (const [k, v] of antieditState.groupConfigs.entries()) {
            groupConfigsObj[k] = v;
        }
        const settings = {
            gc: antieditState.gc,
            pm: antieditState.pm,
            groupConfigs: groupConfigsObj,
            stats: antieditState.stats
        };
        await db.setConfig('antiedit_settings', settings);
    } catch (error) {
        console.error('❌ Antiedit: Error saving data:', error.message);
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
        'audio/aac': '.aac',
        'application/pdf': '.pdf'
    };
    
    return mimeToExt[mimetype] || '.bin';
}

async function downloadAndSaveMedia(msgId, message, messageType, mimetype, version = 1) {
    try {
        // Guard: edit payloads sometimes omit the mediaKey (caption-only edits,
        // or text edits that still carry a stub media node). Without it,
        // Baileys throws "Cannot derive from empty media key" — skip silently.
        const inner = message?.message?.[`${messageType}Message`]
            || message?.message?.ephemeralMessage?.message?.[`${messageType}Message`]
            || message?.message?.viewOnceMessage?.message?.[`${messageType}Message`]
            || message?.message?.viewOnceMessageV2?.message?.[`${messageType}Message`];
        const mk = inner?.mediaKey;
        const hasKey = mk && (mk.length > 0 || (mk.byteLength && mk.byteLength > 0));
        if (!hasKey) return null;

        const buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            {
                logger: { level: 'silent' },
                reuploadRequest: antieditState.sock.updateMediaMessage
            }
        );
        
        if (!buffer || buffer.length === 0) {
            return null;
        }
        
        const mediaKey = `${msgId}_v${version}`;

        antieditState.mediaCache.set(mediaKey, {
            buffer: buffer,
            type: messageType,
            mimetype: mimetype,
            size: buffer.length,
            version: version
        });

        const dbMediaId = `edit_${mediaKey}`;
        try {
            await db.uploadMedia(dbMediaId, buffer, mimetype, 'edits');
        } catch (dbErr) {
            console.error('⚠️ Antiedit: DB media upload failed:', dbErr.message);
        }
        
        antieditState.stats.mediaCaptured++;
        
        _aeLog('📸', 'ANTIEDIT MEDIA', [['Action', 'Media saved'], ['Type', messageType], ['Key', mediaKey], ['Size', `${Math.round(buffer.length/1024)}KB`]]);
        return { mediaKey };
        
    } catch (error) {
        // Silence the known "no key" noise — caption/text edits without a real
        // mediaKey aren't fatal and antiedit still captures the text change.
        const msg = error?.message || '';
        if (!/empty media key|Cannot derive/i.test(msg)) {
            console.error('❌ Antiedit: Media download error:', msg);
        }
        return null;
    }
}

function extractMessageContent(message) {
    const msgContent = message.message;
    let type = 'text';
    let text = '';
    let hasMedia = false;
    let mimetype = '';
    
    if (msgContent?.conversation) {
        text = msgContent.conversation;
        type = 'text';
    } else if (msgContent?.extendedTextMessage?.text) {
        text = msgContent.extendedTextMessage.text;
        type = 'text';
    } else if (msgContent?.imageMessage) {
        // Store the caption (may be empty). We still need the record so that
        // if the user later adds/changes the caption we can show the original.
        type = 'image';
        text = msgContent.imageMessage.caption || '';
        hasMedia = false;   // do NOT download the image
        mimetype = '';
    } else if (msgContent?.videoMessage) {
        type = 'video';
        text = msgContent.videoMessage.caption || '';
        hasMedia = true;
        mimetype = msgContent.videoMessage.mimetype || 'video/mp4';
    } else if (msgContent?.audioMessage) {
        type = 'audio';
        hasMedia = true;
        mimetype = msgContent.audioMessage.mimetype || 'audio/mpeg';
        if (msgContent.audioMessage.ptt) {
            type = 'voice';
        }
    } else if (msgContent?.documentMessage) {
        type = 'document';
        text = msgContent.documentMessage.fileName || 'Document';
        hasMedia = true;
        mimetype = msgContent.documentMessage.mimetype || 'application/octet-stream';
    } else if (msgContent?.stickerMessage) {
        type = 'sticker';
        hasMedia = true;
        mimetype = msgContent.stickerMessage.mimetype || 'image/webp';
    } else if (msgContent?.contactMessage) {
        type = 'contact';
        text = 'Contact Message';
    } else if (msgContent?.locationMessage) {
        type = 'location';
        text = 'Location Message';
    }
    
    return { type, text, hasMedia, mimetype };
}

async function storeIncomingMessage(message, isEdit = false, originalMessageData = null) {
    try {
        const _isDMTrace = !message.key?.remoteJid?.endsWith('@g.us') &&
                           message.key?.remoteJid !== 'status@broadcast';

        if (!antieditState.sock) {
            if (_isDMTrace) console.log('[AE-DM-TRACE] dropped: no sock');
            return null;
        }
        
        const chatJidCheck = message.key?.remoteJid;
        const effectiveConf = getEffectiveConfig(chatJidCheck);
        if (!effectiveConf.enabled) {
            if (_isDMTrace) console.log('[AE-DM-TRACE] dropped: pm disabled (enabled=' + effectiveConf.enabled + ')');
            return null;
        }
        
        const msgKey = message.key;
        if (!msgKey || !msgKey.id) {
            if (_isDMTrace) console.log('[AE-DM-TRACE] dropped: no key/id');
            return null;
        }

        // Skip protocol messages (revoke/delete, ephemeral, etc.) — not real edits
        const msgContent = message.message;
        if (msgContent?.protocolMessage) {
            if (_isDMTrace) console.log('[AE-DM-TRACE] dropped: protocolMessage type=' + msgContent.protocolMessage.type);
            return null;
        }

        const msgId     = message.key.id;
        const chatJid   = msgKey.remoteJid;
        const senderJid = msgKey.participant || chatJid;
        const pushName  = message.pushName || 'Unknown';
        const timestamp = message.messageTimestamp ? message.messageTimestamp * 1000 : Date.now();

        // Resolve real phone eagerly while context is fresh, before storing
        let senderPhone = senderJid.split('@')[0].split(':')[0];
        if (senderJid.includes('@lid')) {
            const cache = globalThis.lidPhoneCache;
            const rawLid = senderJid.split('@')[0].split(':')[0];
            const cached = cache?.get(rawLid) || cache?.get(senderJid.split('@')[0]);
            if (cached) {
                senderPhone = cached;
            } else if (chatJid.includes('@g.us') && antieditState.sock) {
                try {
                    const meta = await antieditState.sock.groupMetadata(chatJid);
                    const resolved = resolveRealNumber(senderJid, meta);
                    if (resolved && resolved !== rawLid) senderPhone = resolved;
                } catch {}
            }
        }
        
        if (chatJid === 'status@broadcast') return null;

        // ── Skip owner edits — don't spy on yourself ──────────────────────────
        if (antieditState.ownerJid) {
            const ownerNum = antieditState.ownerJid.split('@')[0].split(':')[0];
            const senderNum = senderJid.split('@')[0].split(':')[0];
            if (senderNum === ownerNum || msgKey.fromMe) {
                if (_isDMTrace) console.log(`[AE-DM-TRACE] dropped: owner skip (senderNum=${senderNum} ownerNum=${ownerNum} fromMe=${msgKey.fromMe})`);
                return null;
            }
        }

        const _extracted = extractMessageContent(message);
        if (_extracted.skip) {
            if (_isDMTrace) console.log('[AE-DM-TRACE] dropped: skip flag from extractMessageContent');
            return null;
        }
        let { type, text, hasMedia, mimetype } = _extracted;
        if (_isDMTrace) console.log(`[AE-DM-TRACE] passed all gates — type=${type} text="${text}" isEdit=${isEdit}`);

        let version = 1;
        let history = antieditState.messageHistory.get(msgId) || [];

        if (isEdit) {
            version = history.length + 1;
        } else {
            const existing = antieditState.currentMessages.get(msgId);
            if (existing) {
                if (text && text !== existing.text) {
                    // Same message ID arriving via messages.upsert with DIFFERENT text.
                    // For DMs this is always a real user edit.
                    // For groups: link-preview injections keep the SAME text (they only
                    // add URL-preview metadata), so a text change is a genuine user edit.
                    isEdit = true;
                    originalMessageData = existing;
                    version = history.length + 1;
                    if (_isDMTrace) console.log(`[AE-DM-TRACE] upsert-edit detected in DM — new text="${text}"`);
                } else {
                    // Same ID, same text → re-delivery or metadata update, not a user edit.
                    return null;
                }
            }
        }

        if (isEdit) {
            // For edits we track text/caption only — skip pure media-only edits
            hasMedia = false;
            mimetype = '';
            // Allow empty text through — we still need to fire the notification
            // (original message might have had text even if new version is blank)
        } else {
            // Allow media-bearing types (image, video, sticker, audio…) with empty
            // text so we capture the record even before a caption is added.
            const isMediaType = ['image', 'video', 'sticker', 'audio', 'voice', 'document'].includes(type);
            if (!text && !hasMedia && !isMediaType) return null;
        }
        
        const messageData = {
            id: msgId,
            chatJid,
            senderJid,
            senderPhone,
            pushName,
            timestamp,
            type,
            text: text || '',
            hasMedia,
            mimetype,
            version: version,
            isEdit: isEdit,
            editTime: Date.now(),
            originalVersion: originalMessageData?.version || 1
        };
        
        antieditState.currentMessages.set(msgId, messageData);
        
        history.push({...messageData});
        antieditState.messageHistory.set(msgId, history);

        try {
            await db.storeAntideleteMessage(`edit_${msgId}`, messageData);
        } catch (dbErr) {
            console.error('⚠️ Antiedit: DB store failed:', dbErr.message);
        }
        
        if (!isEdit) {
            antieditState.stats.totalMessages++;
        } else {
            antieditState.stats.editsDetected++;

            // Dedup key: msgId + new text — prevents double-alert when WhatsApp
            // delivers the same edit via both messages.update AND messages.upsert
            const dedupKey = `${msgId}:${messageData.text}`;
            const lastAlert = antieditState.recentEditAlerts.get(dedupKey) || 0;
            if (Date.now() - lastAlert < 4000) {
                _aeLog('⏭️', 'ANTIEDIT DEDUP', [['Action', 'Duplicate skipped'], ['ID', msgId.slice(-12)]]);
                return { messageData, isEdit, history };
            }
            antieditState.recentEditAlerts.set(dedupKey, Date.now());
            // Trim the dedup map so it doesn't grow unbounded
            if (antieditState.recentEditAlerts.size > 500) {
                const cutoff = Date.now() - 10000;
                for (const [k, t] of antieditState.recentEditAlerts) {
                    if (t < cutoff) antieditState.recentEditAlerts.delete(k);
                }
            }

            setTimeout(async () => {
                const conf = getEffectiveConfig(chatJid);
                const notifyMode = conf.mode || 'private';

                if (notifyMode === 'private' || notifyMode === 'both') {
                    if (antieditState.ownerJid) {
                        await sendEditAlertToOwnerDM(originalMessageData, messageData, history);
                        antieditState.stats.sentToDm++;
                    }
                }
                if (notifyMode === 'chat' || notifyMode === 'both') {
                    const lastSend = publicModeChatCooldowns.get(chatJid) || 0;
                    if (Date.now() - lastSend >= PUBLIC_MODE_COOLDOWN_MS) {
                        publicModeChatCooldowns.set(chatJid, Date.now());
                        if (publicModeChatCooldowns.size > 200) {
                            const oldest = [...publicModeChatCooldowns.entries()].sort((a, b) => a[1] - b[1]).slice(0, 50);
                            oldest.forEach(([k]) => publicModeChatCooldowns.delete(k));
                        }
                        await sendEditAlertToChat(originalMessageData, messageData, history, chatJid);
                        antieditState.stats.sentToChat++;
                    }
                }
                antieditState.stats.retrieved++;
            }, 1000);
        }
        
        if (hasMedia) {
            setTimeout(async () => {
                try {
                    await downloadAndSaveMedia(msgId, message, type, mimetype, version);
                } catch (error) {
                    console.error('❌ Antiedit: Async media download failed:', error.message);
                }
            }, 1500);
        }
        
        if (antieditState.stats.totalMessages % 20 === 0) {
            await saveData();
        }
        
        return { messageData, isEdit, history };
        
    } catch (error) {
        console.error('❌ Antiedit: Error storing message:', error.message);
        return null;
    }
}

async function handleMessageUpdates(updates) {
    try {
        if (!antieditState.sock) return;

        for (const update of updates) {
            const msgKey = update.key;
            if (!msgKey?.id) continue;

            const msgId   = msgKey.id;
            const chatJid = msgKey.remoteJid;
            if (chatJid === 'status@broadcast') continue;

            const isDM = !chatJid.endsWith('@g.us');

            // Debug trace for DMs
            if (isDM) {
                const updKeys = update.update ? Object.keys(update.update) : [];
                console.log(`[AE-DM-UPDATE] id=${msgId.slice(-8)} keys=${updKeys.join(',')}`);
            }

            const updMsg = update.update?.message;
            if (!updMsg) {
                if (isDM) console.log(`[AE-DM-UPDATE] no update.message — skipping`);
                continue;
            }

            // Debug trace for ALL chats (DM + group)
            const updMsgKeys = Object.keys(updMsg);
            const tracePrefix = isDM ? '[AE-DM-UPDATE]' : '[AE-GC-UPDATE]';
            console.log(`${tracePrefix} id=${msgId.slice(-8)} keys=${updMsgKeys.join(',')}`);

            // Skip delete/revoke protocol messages — they are NOT edits
            // type 0 = REVOKE, type 14 = MESSAGE_EDIT
            if (updMsg.protocolMessage) {
                if (updMsg.protocolMessage.type !== 14) {
                    console.log(`${tracePrefix} protocolMessage type=${updMsg.protocolMessage.type} — not an edit, skipping`);
                    continue;
                }
            }

            // Resolve edit content from all known Baileys structures
            let editedContent = null;

            if (updMsg.protocolMessage?.type === 14) {
                // Official MESSAGE_EDIT protocol message (type 14).
                // editedMessage is the new message object directly.
                editedContent = updMsg.protocolMessage?.editedMessage?.message
                    || updMsg.protocolMessage?.editedMessage
                    || null;
                console.log(`${tracePrefix} proto-14 editedContent=${JSON.stringify(editedContent)?.slice(0,120)}`);
            } else if (updMsg.editedMessage) {
                // Some client versions wrap edits in an editedMessage envelope
                editedContent = updMsg.editedMessage?.message || updMsg.editedMessage || null;
                console.log(`${tracePrefix} editedMessage envelope editedContent=${JSON.stringify(editedContent)?.slice(0,120)}`);
            } else if (updMsg.conversation || updMsg.extendedTextMessage
                    || updMsg.imageMessage || updMsg.videoMessage) {
                // Bare-content update: WhatsApp delivers the new message body directly
                // in the update without a wrapper. Occurs in DMs and some group clients.
                editedContent = updMsg;
                console.log(`${tracePrefix} bare-content edit: ${JSON.stringify(editedContent)?.slice(0,120)}`);
            }

            if (!editedContent) {
                console.log(`${tracePrefix} no editedContent resolved — skipping`);
                continue;
            }

            const editedText =
                editedContent.conversation ||
                editedContent.extendedTextMessage?.text ||
                editedContent.imageMessage?.caption ||
                editedContent.videoMessage?.caption || '';
            if (!editedText.trim()) {
                console.log(`${tracePrefix} editedText empty — skipping`);
                continue;
            }

            // Look up original message — memory first, then DB
            let existingMessage = antieditState.currentMessages.get(msgId);
            if (!existingMessage) {
                try {
                    const dbMsg = await db.getAntideleteMessage(`edit_${msgId}`);
                    if (dbMsg) {
                        existingMessage = dbMsg;
                        antieditState.currentMessages.set(msgId, existingMessage);
                    }
                } catch {}
            }

            // If we never saw the original, create a placeholder so alerts don't crash
            if (!existingMessage) {
                existingMessage = {
                    id: msgId,
                    chatJid,
                    senderJid: msgKey.participant || chatJid,
                    pushName: update.pushName || 'Unknown',
                    timestamp: Date.now(),
                    type: 'unknown',
                    text: '[Original not captured]',
                    hasMedia: false,
                    version: 1,
                    isEdit: false,
                    editTime: Date.now()
                };
                antieditState.currentMessages.set(msgId, existingMessage);
            }

            const chatLabel = chatJid.endsWith('@g.us') ? 'Group' : 'DM';
            _aeLog('✏️', 'EDIT CAUGHT', [['Chat', chatLabel], ['ID', msgId.slice(-12)]]);

            const syntheticMsg = {
                key: msgKey,
                message: editedContent,
                pushName: existingMessage.pushName || update.pushName || '',
                messageTimestamp: Math.floor(Date.now() / 1000)
            };

            await storeIncomingMessage(syntheticMsg, true, existingMessage);
        }
    } catch (error) {
        console.error('❌ Antiedit: Error handling message updates:', error.message);
    }
}

async function getMediaBuffer(mediaKey) {
    const cached = antieditState.mediaCache.get(mediaKey);
    if (cached?.buffer) return cached.buffer;

    try {
        const dbMediaId = `edit_${mediaKey}`;
        const ext = cached?.mimetype?.split('/')[1]?.split(';')[0] || 'bin';
        const storagePath = `edits/${dbMediaId}.${ext}`;
        const buffer = await db.downloadMedia(storagePath);
        if (buffer) return buffer;
    } catch {}

    return null;
}

function cleanJid(jid) {
    if (!jid) return jid;
    // Strip device suffix (:12) so DM delivery works
    return jid.replace(/:\d+@/, '@');
}

/**
 * Resolve an owner JID that might be a @lid (WhatsApp internal linked-device
 * identifier) into the proper @s.whatsapp.net phone JID.
 *
 * Sending to a @lid can route to the WRONG person on WA's network, so we
 * always prefer the real phone number JID.
 */
function resolveOwnerJid(jid) {
    const cleaned = cleanJid(jid);
    if (!cleaned) return cleaned;

    // If it's already a real phone JID, return as-is
    if (!cleaned.includes('@lid')) return cleaned;

    // Try to grab the phone number from globals set by index.js
    const ownerNum =
        (typeof globalThis !== 'undefined' && globalThis.OWNER_NUMBER) ||
        (typeof global !== 'undefined' && global.OWNER_NUMBER) ||
        null;

    if (ownerNum) return `${ownerNum}@s.whatsapp.net`;

    // Last resort: keep the cleaned JID (still wrong, but we log it)
    console.warn('[Antiedit] resolveOwnerJid: owner is @lid and OWNER_NUMBER is not set — alert may route incorrectly');
    return cleaned;
}

function buildAlertText(originalMsg, editedMsg, { forChat = false, senderNumber = '', chatLabel = '', editTime = '', groupInviteLink = null } = {}) {
    const limit = forChat ? 200 : 400;
    const orig = originalMsg.text?.trim()
        ? originalMsg.text.substring(0, limit) + (originalMsg.text.length > limit ? '…' : '')
        : originalMsg.hasMedia ? `[${originalMsg.type.toUpperCase()}]` : '[empty]';

    const edited = editedMsg.text?.trim()
        ? editedMsg.text.substring(0, limit) + (editedMsg.text.length > limit ? '…' : '')
        : editedMsg.hasMedia ? `[${editedMsg.type.toUpperCase()}]` : '[empty]';

    let text = `\n\n✧ ${getBotName()} message antiedit\n`;
    text += `✧ 𝙵𝚛𝚘𝚖 : ${senderNumber} (${originalMsg.pushName || 'Unknown'})\n`;
    if (!forChat && chatLabel) text += `✧ 𝙲𝚑𝚊𝚝 : ${chatLabel}\n`;
    text += `✧ 𝚃𝚒𝚖𝚎 : ${editTime}\n`;
    text += `✧ 𝚅𝚎𝚛𝚜𝚒𝚘𝚗 : v${originalMsg.version || 1}→v${editedMsg.version || 2}\n`;
    text += `\n✧ 𝗢𝗿𝗶𝗴𝗶𝗻𝗮𝗹 𝗠𝗲𝘀𝘀𝗮𝗴𝗲:\n${orig}\n`;
    text += `\n✧ 𝗘𝗱𝗶𝘁𝗲𝗱 𝗧𝗼:\n${edited}`;
    if (!forChat && groupInviteLink) text += `\n\n${groupInviteLink}`;

    return text;
}

async function sendEditAlertToOwnerDM(originalMsg, editedMsg, history) {
    try {
        if (!antieditState.sock || !antieditState.ownerJid) {
            console.error('❌ Antiedit: Socket or owner JID not set');
            return false;
        }

        // Always resolve to a real @s.whatsapp.net JID — a @lid address can
        // silently route the DM to the wrong person on WhatsApp's network.
        const ownerJid     = resolveOwnerJid(antieditState.ownerJid);
        const senderNumber = originalMsg.senderPhone
            || await resolveNumberWithGroup(originalMsg.senderJid, originalMsg.chatJid);
        const editTime     = new Date(editedMsg.editTime || Date.now()).toLocaleTimeString();

        // ── Build chat label ──────────────────────────────────────────────────
        // Groups: show group name in bold — NO raw URL in the header.
        // The invite link is appended at the end of the message so WhatsApp
        // renders it as a rich preview card (group name + icon + "Open" button)
        // which acts as the tappable hyperlink.
        // DMs: show the sender's phone number.
        let chatLabel;
        let groupInviteLink = null;

        if (originalMsg.chatJid?.includes('@g.us')) {
            let groupName = 'Group';
            try {
                const meta = await antieditState.sock.groupMetadata(originalMsg.chatJid);
                groupName = meta.subject || 'Group';
            } catch {}
            try {
                const code = await antieditState.sock.groupInviteCode(originalMsg.chatJid);
                if (code) groupInviteLink = `https://chat.whatsapp.com/${code}`;
            } catch {}
            chatLabel = `*${groupName}*`;
        } else {
            const dmNum = originalMsg.senderPhone
                || await resolveNumberWithGroup(originalMsg.chatJid, null);
            chatLabel = `+${dmNum}`;
        }

        const fullText = buildAlertText(originalMsg, editedMsg, {
            forChat: false,
            senderNumber,
            chatLabel,
            editTime,
            groupInviteLink
        });

        await antieditState.sock.sendMessage(ownerJid, { text: fullText });

        _aeLog('📤', 'ANTIEDIT ALERT', [['Action', 'Sent to owner DM'], ['Owner', ownerJid]]);
        return true;

    } catch (error) {
        console.error('❌ Antiedit: Error sending edit alert to owner DM:', error.message);
        return false;
    }
}

async function sendEditAlertToChat(originalMsg, editedMsg, history, chatJid) {
    try {
        if (!antieditState.sock) return false;

        const senderNumber = originalMsg.senderPhone
            || await resolveNumberWithGroup(originalMsg.senderJid, chatJid);
        const editTime     = new Date(editedMsg.editTime || Date.now()).toLocaleTimeString();

        const fullText = buildAlertText(originalMsg, editedMsg, {
            forChat: true,
            senderNumber,
            editTime
        });

        await antieditState.sock.sendMessage(chatJid, { text: fullText });

        _aeLog('📢', 'ANTIEDIT ALERT', [['Action', 'Shown in chat'], ['Chat', chatJid.endsWith('@g.us') ? 'Group' : 'DM']]);
        return true;

    } catch (error) {
        console.error('❌ Antiedit: Error sending edit alert to chat:', error.message);
        return false;
    }
}

async function showMessageHistory(msgId, chatJid) {
    try {
        if (!antieditState.sock) return false;
        
        let history = antieditState.messageHistory.get(msgId);

        if (!history || history.length < 1) {
            try {
                const dbMsg = await db.getAntideleteMessage(`edit_${msgId}`);
                if (dbMsg) {
                    history = [dbMsg];
                }
            } catch {}
        }

        if (!history || history.length < 1) {
            await antieditState.sock.sendMessage(chatJid, { 
                text: `❌ No history found for this message.` 
            });
            return false;
        }
        
        const firstMessage = history[0];
        const latestMessage = history[history.length - 1];
        const senderNum = firstMessage.senderPhone
            || await resolveNumberWithGroup(firstMessage.senderJid, firstMessage.chatJid || chatJid);

        let historyText = `📜 *MESSAGE HISTORY*\n\n`;
        historyText += `👤 From: +${senderNum} (${firstMessage.pushName})\n`;
        historyText += `📅 Total versions: ${history.length}\n`;
        historyText += `🕒 First sent: ${new Date(firstMessage.timestamp).toLocaleString()}\n`;
        historyText += `✏️ Last edit: ${new Date(latestMessage.editTime || latestMessage.timestamp).toLocaleString()}\n`;
        
        historyText += `\n─────────────────\n`;
        
        history.forEach((msg, index) => {
            const version = index + 1;
            const time = new Date(msg.editTime || msg.timestamp).toLocaleTimeString();
            const prefix = msg.isEdit ? '✏️' : '📝';
            
            historyText += `\n${prefix} v${version} [${time}]: `;
            if (msg.text && msg.text.trim()) {
                historyText += `${msg.text.substring(0, 80)}`;
                if (msg.text.length > 80) historyText += '...';
            } else if (msg.hasMedia) {
                historyText += `[${msg.type.toUpperCase()} MEDIA]`;
            } else {
                historyText += `[Empty]`;
            }
        });
        
        historyText += `\n\n────────────\n`;
        historyText += `🔍 *History retrieved by antiedit*`;
        
        await antieditState.sock.sendMessage(chatJid, { text: historyText });
        return true;
        
    } catch (error) {
        console.error('❌ Antiedit: Error showing message history:', error.message);
        return false;
    }
}

function setupListeners(sock) {
    if (!sock) {
        console.error('❌ Antiedit: No socket provided');
        return;
    }
    
    antieditState.sock = sock;
    
    _aeLog('🚀', 'ANTIEDIT', [['Action', 'Setting up listeners']]);
    
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            for (const message of messages) {
                await storeIncomingMessage(message, false);
            }
        } catch (error) {
            console.error('❌ Antiedit: Message storage error:', error.message);
        }
    });
    
    sock.ev.on('messages.update', async (updates) => {
        try {
            
            await handleMessageUpdates(updates);
        } catch (error) {
            console.error('❌ Antiedit: Edit detection error:', error.message);
        }
    });
    
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            _aeLog('✅', 'ANTIEDIT', [['Status', 'Connected and ready']]);
        }
    });
    
    _aeLog('✅', 'ANTIEDIT', [['Status', 'Listeners active']]);
}

async function initializeSystem(sock, ownerJid) {
    try {
        await loadData();

        // Prefer the explicitly passed owner JID (from OWNER_CLEAN_JID in index.js).
        // Always resolve through resolveOwnerJid() so a @lid address is never
        // stored — @lid can route alerts to the wrong person on WA's network.
        if (ownerJid) {
            antieditState.ownerJid = resolveOwnerJid(ownerJid);
        } else if (sock.user?.id) {
            antieditState.ownerJid = resolveOwnerJid(sock.user.id);
        }
        setupListeners(sock);

        const gcStatus = antieditState.gc.enabled ? `✅ ON (${antieditState.gc.mode})` : '❌ OFF';
        const pmStatus = antieditState.pm.enabled ? `✅ ON (${antieditState.pm.mode})` : '❌ OFF';
        _aeLog('🎯', 'ANTIEDIT INIT', [
            ['Owner',   antieditState.ownerJid || 'not set'],
            ['Groups',  gcStatus],
            ['DMs',     pmStatus],
            ['Tracked', `${antieditState.currentMessages.size} messages`],
        ]);
        
        setInterval(async () => {
            if (antieditState.stats.totalMessages > 0) {
                await saveData();
            }
        }, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Antiedit: Initialization error:', error.message);
    }
}

export async function initAntiedit(sock, ownerJid) {
    await initializeSystem(sock, ownerJid);
}

export function updateAntieditSock(sock) {
    if (!sock) return;
    antieditState.sock = sock;

    // On reconnect OWNER_NUMBER is already in globals — re-resolve the owner JID
    // so a stale @lid address is replaced with the correct @s.whatsapp.net JID.
    if (antieditState.ownerJid) {
        antieditState.ownerJid = resolveOwnerJid(antieditState.ownerJid);
    }

    _aeLog('🔄', 'ANTIEDIT', [['Action', 'Socket updated after reconnect'], ['Owner', antieditState.ownerJid || 'not set']]);
}

export function getAntieditInfo() {
    return {
        gc: { enabled: antieditState.gc.enabled, mode: antieditState.gc.mode },
        pm: { enabled: antieditState.pm.enabled, mode: antieditState.pm.mode }
    };
}

export default {
    name: 'antiedit',
    alias: ['editdetect', 'edited', 'ae'],
    description: 'Capture edited messages - public/private/off modes',
    category: 'utility',
    
    async execute(sock, msg, args, prefix, metadata = {}) {
        const chatId = msg.key.remoteJid;
        const command = args[0]?.toLowerCase() || 'status';
        
        if (!antieditState.sock) {
            antieditState.sock = sock;
            setupListeners(sock);
        }
        
        if (!antieditState.ownerJid && metadata.OWNER_JID) {
            antieditState.ownerJid = resolveOwnerJid(metadata.OWNER_JID);
        }
        if (!antieditState.ownerJid && sock.user?.id) {
            antieditState.ownerJid = resolveOwnerJid(sock.user.id);
        }
        
        const scope = args[0]?.toLowerCase() || '';

        const ownerName = getOwnerName().toUpperCase();

        const modeLabel = () => {
            const gcOn = antieditState.gc.enabled;
            const pmOn = antieditState.pm.enabled;
            if (!gcOn && !pmOn) return '❌ OFF';
            const mode = gcOn ? antieditState.gc.mode : antieditState.pm.mode;
            const modeStr = mode === 'private' ? '🔒 → DM' : '📢 → Chat';
            if (gcOn && pmOn)  return `✅ ALL  ${modeStr}`;
            if (gcOn && !pmOn) return `✅ GROUPS only  ${modeStr}`;
            if (!gcOn && pmOn) return `✅ DMs only  ${modeStr}`;
        };

        const setMode = (gcEnabled, pmEnabled, mode) => {
            antieditState.gc.enabled = gcEnabled;
            antieditState.gc.mode    = mode;
            antieditState.pm.enabled = pmEnabled;
            antieditState.pm.mode    = mode;
        };

        const footer = getFooter(msg.key.participant || msg.key.remoteJid);

        // Helper: builds the status reply after a toggle
        const statusReply = () =>
            `╭─⌈ ✏️ *ANTIEDIT* ⌋\n` +
            `├─⊷ Status : ${modeLabel()}\n` +
            `╰⊷ ${footer}`;

        if (scope === 'off' || scope === 'disable') {
            setMode(false, false, 'private');
            await saveData();
            await sock.sendMessage(chatId, { text: statusReply() }, { quoted: msg });

        } else if (['private', 'priv'].includes(scope)) {
            setMode(true, true, 'private');
            await saveData();
            await sock.sendMessage(chatId, { text: statusReply() }, { quoted: msg });

        } else if (['public', 'chat', 'pub'].includes(scope)) {
            setMode(true, true, 'chat');
            await saveData();
            await sock.sendMessage(chatId, { text: statusReply() }, { quoted: msg });

        } else if (['gc', 'groups', 'group'].includes(scope)) {
            setMode(true, false, 'private');
            await saveData();
            await sock.sendMessage(chatId, { text: statusReply() }, { quoted: msg });

        } else if (['dms', 'dm', 'pm', 'pms'].includes(scope)) {
            setMode(false, true, 'private');
            await saveData();
            await sock.sendMessage(chatId, { text: statusReply() }, { quoted: msg });

        } else if (scope === 'clear' || scope === 'reset') {
            antieditState.messageHistory.clear();
            antieditState.currentMessages.clear();
            antieditState.mediaCache.clear();
            antieditState.stats = { totalMessages:0, editsDetected:0, retrieved:0, mediaCaptured:0, sentToDm:0, sentToChat:0 };
            try { await db.cleanOlderThan('antidelete_messages', 'timestamp', 0); } catch {}
            await saveData();
            await sock.sendMessage(chatId, {
                text: `╭─⌈ ✏️ *ANTIEDIT* ⌋\n├─⊷ 🧹 Cache cleared\n╰⊷ ${footer}`
            }, { quoted: msg });

        } else {
            // No args, 'status', 'stats', or unknown — show help + current status
            await sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ✏️ *ANTIEDIT* ⌋\n` +
                    `├─⊷ Status : ${modeLabel()}\n` +
                    `│\n` +
                    `├─⊷ *${prefix}antiedit off* — disable\n` +
                    `├─⊷ *${prefix}antiedit private* — groups + DMs → your DM\n` +
                    `├─⊷ *${prefix}antiedit public* — groups + DMs → shown in chat\n` +
                    `├─⊷ *${prefix}antiedit gc* — groups only → your DM\n` +
                    `├─⊷ *${prefix}antiedit dms* — DMs only → your DM\n` +
                    `├─⊷ *${prefix}antiedit clear* — reset cache\n` +
                    `╰⊷ ${footer}`
            }, { quoted: msg });
        }
    }
};
