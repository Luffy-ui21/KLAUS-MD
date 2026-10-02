import { downloadContentFromMessage } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getPhoneFromLid } from '../../lib/sudo-store.js';

// Core poster — sends to status@broadcast.
// index.js bypasses the custom sendMessage wrapper for status@broadcast
// and routes it straight to Baileys' original sendMessage so that:
//   • backgroundColor is converted to ARGB int (Baileys' assertColor)
//   • font is set as an enum number
//   • messageContextInfo.messageSecret is NOT injected (only for events/polls)
async function postPersonalStatus(sock, content, statusJidList, extraOpts = {}) {
    return sock.sendMessage('status@broadcast', content, {
        ...extraOpts,
        statusJidList
    });
}

// Download media from a quoted/direct message into a Buffer
async function downloadMedia(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return {
        buffer: Buffer.concat(chunks),
        mimetype: message.mimetype || (
            type === 'image'   ? 'image/jpeg'  :
            type === 'video'   ? 'video/mp4'   :
            type === 'audio'   ? 'audio/mp4'   :
            type === 'sticker' ? 'image/webp'  :
            'application/octet-stream'
        )
    };
}

// Detect the type of a quoted message and prepare the status content object
async function processQuoted(quoted, captionOverride) {
    if (quoted.imageMessage) {
        const m = await downloadMedia(quoted.imageMessage, 'image');
        return {
            content: { image: m.buffer, mimetype: m.mimetype, caption: captionOverride || quoted.imageMessage.caption || '' },
            mediaType: 'Image'
        };
    }
    if (quoted.videoMessage) {
        const m = await downloadMedia(quoted.videoMessage, 'video');
        return {
            content: { video: m.buffer, mimetype: m.mimetype, caption: captionOverride || quoted.videoMessage.caption || '' },
            mediaType: 'Video'
        };
    }
    if (quoted.audioMessage) {
        const m = await downloadMedia(quoted.audioMessage, 'audio');
        return {
            content: { audio: m.buffer, mimetype: m.mimetype || 'audio/mp4', ptt: quoted.audioMessage.ptt || false },
            mediaType: 'Audio'
        };
    }
    if (quoted.stickerMessage) {
        const m = await downloadMedia(quoted.stickerMessage, 'sticker');
        return {
            content: { image: m.buffer, caption: captionOverride || '' },
            mediaType: 'Sticker'
        };
    }
    const text = quoted.conversation || quoted.extendedTextMessage?.text || '';
    const finalText = captionOverride ? `${text}\n\n${captionOverride}` : text;
    return {
        content: { text: finalText },
        mediaType: 'Text'
    };
}

// ─── Contact list cache (rebuilt max once per hour) ──────────────────────────
let _statusContactsCache = null;
let _statusContactsCacheTs  = 0;
const STATUS_CONTACTS_TTL   = 60 * 60 * 1000; // 1 hour

const isValidPnJid = (jid) =>
    typeof jid === 'string' &&
    jid.endsWith('@s.whatsapp.net') &&
    !jid.includes(':');

// Resolve a @lid JID → "phoneNumber@s.whatsapp.net"
function resolveLidJid(jid, sock) {
    if (!jid || !jid.endsWith('@lid')) return null;
    const lidNum = jid.split('@')[0].split(':')[0];

    const cached = globalThis.lidPhoneCache?.get(lidNum);
    if (cached) return `${cached}@s.whatsapp.net`;

    const stored = getPhoneFromLid(lidNum);
    if (stored) return `${stored}@s.whatsapp.net`;

    try {
        const sig = sock?.signalRepository?.lidMapping;
        if (sig?.getPNForLID) {
            const formats = [jid, `${lidNum}:0@lid`, `${lidNum}@lid`];
            for (const fmt of formats) {
                try {
                    const pn = sig.getPNForLID(fmt);
                    if (pn) {
                        const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                        if (num.length >= 7 && num !== lidNum) return `${num}@s.whatsapp.net`;
                    }
                } catch {}
            }
        }
    } catch {}

    return null;
}

// Add a single participant JID to the set.
function addParticipant(jid, jidSet, sock) {
    if (!jid) return;
    if (isValidPnJid(jid)) { jidSet.add(jid); return; }
    if (jid.endsWith('@lid')) {
        const resolved = resolveLidJid(jid, sock);
        if (resolved) jidSet.add(resolved);
    }
}

// Build the full list of JIDs that should receive the status encryption key.
async function buildStatusJidList(sock) {
    const rawId   = globalThis.OWNER_JID || sock.user?.id || '';
    const numPart = rawId.split('@')[0].split(':')[0];
    const ownerJid = numPart ? `${numPart}@s.whatsapp.net` : null;

    const now = Date.now();
    if (_statusContactsCache && (now - _statusContactsCacheTs) < STATUS_CONTACTS_TTL) {
        const cached = new Set(_statusContactsCache);
        if (ownerJid) cached.add(ownerJid);
        return Array.from(cached);
    }

    const jidSet = new Set();

    const contactMap = global.contactNames || new Map();
    for (const [jid] of contactMap) addParticipant(jid, jidSet, sock);

    const groupCache = globalThis.groupMetadataCache || new Map();
    for (const [, entry] of groupCache) {
        for (const p of (entry?.data?.participants || [])) addParticipant(p.id, jidSet, sock);
    }

    let lidCount = 0, resolvedCount = 0;
    try {
        const groups = await Promise.race([
            sock.groupFetchAllParticipating(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
        ]);
        const groupEntries = Object.entries(groups);
        for (let gi = 0; gi < groupEntries.length; gi++) {
            const [, group] = groupEntries[gi];
            for (const p of (group.participants || [])) {
                const before = jidSet.size;
                if (p.id?.endsWith('@lid')) lidCount++;
                addParticipant(p.id, jidSet, sock);
                if (p.id?.endsWith('@lid') && jidSet.size > before) resolvedCount++;
            }
            // Yield the event loop every 25 groups to prevent blocking
            if (gi % 25 === 24) await new Promise(r => setImmediate(r));
        }
        console.log(`📱 [toStatus] Fetched ${groupEntries.length} groups — ${lidCount} LIDs, resolved ${resolvedCount}`);
    } catch (e) {
        console.log(`📱 [toStatus] groupFetchAllParticipating skipped: ${e.message}`);
    }

    if (ownerJid) jidSet.add(ownerJid);

    const list = Array.from(jidSet);
    _statusContactsCache  = list;
    _statusContactsCacheTs = now;

    console.log(`📱 [toStatus] statusJidList built: ${list.length} contacts — cached for 1h`);
    return list.length > 0 ? list : (ownerJid ? [ownerJid] : ['0@s.whatsapp.net']);
}

export default {
    name: 'tostatus',
    alias: ['setstatus', 'updatestatus', 'mystatus', 'poststatus'],
    category: 'owner',
    description: 'Post content to your WhatsApp Status (Stories)',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, { text: '❌ *Owner Only Command!*' }, { quoted: msg });
        }

        const rawText =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || '';

        const textAfterCmd = rawText
            .replace(/^[=!#?/.]?(tostatus|status|setstatus|updatestatus|mystatus|poststatus)\s*/i, '')
            .trim();

        const directImage  = msg.message?.imageMessage;
        const directVideo  = msg.message?.videoMessage;
        const directAudio  = msg.message?.audioMessage;
        const quotedMsg    = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg && !textAfterCmd && !directImage && !directVideo && !directAudio) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 📱 *POST TO STATUS* ⌋\n│\n` +
                    `├─⊷ *${PREFIX}tostatus <text>*\n│  └⊷ Post a text status\n` +
                    `├─⊷ Reply to image + *${PREFIX}tostatus [caption]*\n│  └⊷ Post an image\n` +
                    `├─⊷ Reply to video + *${PREFIX}tostatus [caption]*\n│  └⊷ Post a video\n` +
                    `├─⊷ Reply to audio + *${PREFIX}tostatus*\n│  └⊷ Post an audio note\n` +
                    `├─⊷ Send image with caption *${PREFIX}tostatus [caption]*\n│  └⊷ Post that image\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        try {
            let content   = null;
            let mediaType = 'Text';
            const bgColor = '#1b5e20';
            const font    = 0;

            if (directImage && !quotedMsg) {
                const m = await downloadMedia(directImage, 'image');
                const cap = textAfterCmd ||
                    directImage.caption?.replace(/^[=!#?/.]?(tostatus|status|setstatus|updatestatus|mystatus|poststatus)\s*/i, '').trim() || '';
                content   = { image: m.buffer, mimetype: m.mimetype, caption: cap };
                mediaType = 'Image';
            } else if (directVideo && !quotedMsg) {
                const m = await downloadMedia(directVideo, 'video');
                const cap = textAfterCmd ||
                    directVideo.caption?.replace(/^[=!#?/.]?(tostatus|status|setstatus|updatestatus|mystatus|poststatus)\s*/i, '').trim() || '';
                content   = { video: m.buffer, mimetype: m.mimetype, caption: cap };
                mediaType = 'Video';
            } else if (directAudio && !quotedMsg) {
                const m = await downloadMedia(directAudio, 'audio');
                content   = { audio: m.buffer, mimetype: m.mimetype || 'audio/mp4', ptt: directAudio.ptt || false };
                mediaType = 'Audio';
            } else if (quotedMsg) {
                const r   = await processQuoted(quotedMsg, textAfterCmd);
                content   = r.content;
                mediaType = r.mediaType;
            } else if (textAfterCmd) {
                content   = { text: textAfterCmd };
                mediaType = 'Text';
            }

            if (!content) {
                return sock.sendMessage(chatId, { text: '❌ No valid content to post!' }, { quoted: msg });
            }

            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            const statusJidList = await buildStatusJidList(sock);
            console.log(`📱 [toStatus] Posting ${mediaType} to ${statusJidList.length} contacts`);

            const extraOpts = mediaType === 'Text' ? { backgroundColor: bgColor, font } : {};
            const result = await postPersonalStatus(sock, content, statusJidList, extraOpts);

            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

            let confirmMsg = `✅ *Status Posted!*\n\n📊 Type: ${mediaType}\n`;
            if (content.caption) confirmMsg += `📝 Caption: ${content.caption.substring(0, 60)}${content.caption.length > 60 ? '...' : ''}\n`;
            if (content.text)    confirmMsg += `📄 Text: ${content.text.substring(0, 60)}${content.text.length > 60 ? '...' : ''}\n`;
            confirmMsg += `👥 Recipients: ${statusJidList.length}\n⏰ Visible for 24 hours`;

            await sock.sendMessage(chatId, { text: confirmMsg }, { quoted: msg });
            console.log(`✅ [toStatus] ${mediaType} posted — msgId: ${result?.key?.id}`);

        } catch (err) {
            console.error('❌ [toStatus] Error:', err.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }).catch(() => {});

            let errMsg = `❌ Failed to post status: ${err.message}`;
            if (/connection closed/i.test(err.message))     errMsg = '❌ Connection dropped. Wait a moment and try again.';
            else if (/timed?[\s-]?out/i.test(err.message))  errMsg = '❌ Request timed out. Try a smaller file.';
            else if (/media/i.test(err.message))             errMsg = '❌ Media upload failed. File may be too large (max ~16 MB for video, 30 s max).';

            await sock.sendMessage(chatId, { text: errMsg }, { quoted: msg });
        }
    }
};
