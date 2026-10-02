import { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } from 'wolfsocket';
import crypto from 'crypto';
import { PassThrough } from 'stream';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { GROUP } from '../../lib/emojis.js';

/* ─────────────────────────────────────────────────────────────────────────────
   PENDING-MEDIA CACHE
   When the user calls .togstatus from a DM without specifying a group JID,
   we show them a group list and store the media here so the second step
   (replying with a number) can retrieve and post it.

   Two parallel lookups so the reply-with-number works whether or not the
   user properly quoted the list message:
     • by stanzaId  (togStatusSessionCache)   — exact quoted-reply match
     • by senderJid (togStatusSenderCache)     — fallback for plain number sends
───────────────────────────────────────────────────────────────────────────── */
const togStatusSessionCache = new Map(); // stanzaId  → session
const togStatusSenderCache  = new Map(); // senderJid → session
globalThis.togStatusSessionCache = togStatusSessionCache;
globalThis.togStatusSenderCache  = togStatusSenderCache;
const MAX_SESSION_CACHE = 30;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        try {
            import('fluent-ffmpeg').then(ffmpeg => {
                const inStream  = new PassThrough();
                inStream.end(inputBuffer);
                const outStream = new PassThrough();
                const chunks    = [];
                ffmpeg.default(inStream)
                    .noVideo()
                    .audioCodec('libopus')
                    .format('ogg')
                    .audioBitrate('48k')
                    .audioChannels(1)
                    .audioFrequency(48000)
                    .on('error', reject)
                    .on('end', () => resolve(Buffer.concat(chunks)))
                    .pipe(outStream, { end: true });
                outStream.on('data', chunk => chunks.push(chunk));
            }).catch(() => resolve(inputBuffer));
        } catch {
            resolve(inputBuffer);
        }
    });
}

async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer   = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

async function buildPayloadFromQuoted(quotedMessage) {
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return {
            video: buffer,
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    }
    if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return {
            image: buffer,
            caption: quotedMessage.imageMessage.caption || ''
        };
    }
    if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        if (quotedMessage.audioMessage.ptt) {
            try {
                const audioVn = await toVN(buffer);
                return { audio: audioVn, mimetype: 'audio/ogg; codecs=opus', ptt: true };
            } catch {
                return { audio: buffer, mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg', ptt: true };
            }
        }
        return { audio: buffer, mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg', ptt: false };
    }
    if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        return { sticker: buffer, mimetype: quotedMessage.stickerMessage.mimetype || 'image/webp' };
    }
    if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

// Build a media payload from a directly-sent image/video/audio (not a quoted one)
async function buildPayloadFromDirectMedia(msg) {
    const directImage = msg.message?.imageMessage;
    const directVideo = msg.message?.videoMessage;
    const directAudio = msg.message?.audioMessage;

    if (directImage) {
        const buffer = await downloadToBuffer(directImage, 'image');
        return { payload: { image: buffer, caption: directImage.caption || '' }, mediaType: 'Image' };
    }
    if (directVideo) {
        const buffer = await downloadToBuffer(directVideo, 'video');
        return { payload: { video: buffer, caption: directVideo.caption || '', mimetype: directVideo.mimetype || 'video/mp4' }, mediaType: 'Video' };
    }
    if (directAudio) {
        const buffer = await downloadToBuffer(directAudio, 'audio');
        return { payload: { audio: buffer, mimetype: directAudio.mimetype || 'audio/mp4', ptt: directAudio.ptt || false }, mediaType: 'Audio' };
    }
    return null;
}

function detectMediaType(quotedMessage) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.videoMessage)   return 'Video';
    if (quotedMessage.imageMessage)   return 'Image';
    if (quotedMessage.audioMessage)   return 'Audio';
    if (quotedMessage.stickerMessage) return 'Sticker';
    return 'Text';
}

async function sendGroupStatus(conn, jid, content) {
    const inside        = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
    }, {});
    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

function stripCommand(messageText) {
    return messageText
        .replace(/^[^a-zA-Z0-9]?(togstatus|swgc|groupstatus|tosgroup|gs|gstatus|togroupstatus)\s*/i, '')
        .trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHOW GROUP LIST  (DM flow — step 1)
   Fetches all groups, shows a numbered list, caches pending media so the
   reply-with-number handler (step 2) can post it.
───────────────────────────────────────────────────────────────────────────── */
async function showGroupListForStatus(sock, jid, msg, payload, mediaType, PREFIX) {
    let groups;
    try {
        groups = await sock.groupFetchAllParticipating();
    } catch (err) {
        return sock.sendMessage(jid, {
                text: `${GROUP.ERROR} Failed to fetch groups: ${err.message}`
        }, { quoted: msg });
    }

    const entries   = Object.values(groups || {});
    const metaCache = globalThis.groupMetadataCache;

    const resolved = await Promise.all(entries.map(async (g) => {
        let name = (g.subject || '').trim();
        if (!name && metaCache) {
            const cached = metaCache.get(g.id);
            if (cached?.data?.subject) name = cached.data.subject.trim();
        }
        if (!name) {
            try {
                const meta = await sock.groupMetadata(g.id);
                if (meta?.subject) name = meta.subject.trim();
            } catch {}
        }
        return { id: g.id, name: name || 'Unnamed Group' };
    }));

    resolved.sort((a, b) => a.name.localeCompare(b.name));

    const PAGE_SIZE = 20;
    const slice     = resolved.slice(0, PAGE_SIZE);

        let text  = `╭─⌈ ${GROUP.PEOPLE} *SELECT A GROUP* ⌋\n│\n`;
        text     += `│  ${GROUP.CHART} ${resolved.length} group${resolved.length !== 1 ? 's' : ''} · `;
        text     += `${GROUP.UPLOAD} posting *${mediaType}*\n│\n`;
    slice.forEach((g, i) => {
        text += `├─⊷ *${i + 1}.* ${g.name}\n`;
    });
    if (resolved.length > PAGE_SIZE) {
        text += `│\n├─⊷ _(showing first ${PAGE_SIZE} — use \`${PREFIX}togstatus <JID>\` for others)_\n`;
    }
    text += `│\n╰─ Reply with *${PREFIX}togstatus <number>* or *all* to post`;

    const sent      = await sock.sendMessage(jid, { text }, { quoted: msg });
    const sentId    = sent?.key?.id;
    const senderJid = msg.key.participant || (msg.key.fromMe ? sock.user?.id : jid);
    const session   = { payload, mediaType, groups: resolved, senderJid };

    // Store by stanzaId (exact quoted-reply match)
    if (sentId) {
        togStatusSessionCache.set(sentId, session);
        if (togStatusSessionCache.size > MAX_SESSION_CACHE) {
            togStatusSessionCache.delete(togStatusSessionCache.keys().next().value);
        }
    }

    // Store by senderJid (fallback for plain-number sends without quoting)
    const senderKey = senderJid?.split('@')[0] || jid.split('@')[0];
    togStatusSenderCache.set(senderKey, session);
    if (togStatusSenderCache.size > MAX_SESSION_CACHE) {
        togStatusSenderCache.delete(togStatusSenderCache.keys().next().value);
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMMAND EXPORT
───────────────────────────────────────────────────────────────────────────── */
export default {
    name: 'togstatus',
    aliases: ['swgc', 'groupstatus', 'tosgroup', 'gs', 'gstatus', 'togroupstatus'],
    description: 'Post to group status — works from inside a group or from any DM',
    category: 'group',
    adminOnly: false,

    async execute(sock, m, args, PREFIX, extra) {
        try {
            const jid        = m.key.remoteJid;
            const isGroup    = jid.endsWith('@g.us');
            const isDM       = !isGroup;
            const messageText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
            const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedId   = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
            const textAfterCommand = stripCommand(messageText);

            /* ──────────────────────────────────────────────────────────────
               STEP 2 — DM reply-with-number handler
               Triggered when the user replies to (or follows up after) the
               group list we sent them.  Two lookup paths:
                 1. stanzaId  → exact quoted-reply match (most reliable)
                 2. senderJid → fallback for plain standalone number sends
            ────────────────────────────────────────────────────────────── */
            // Resolve the numeric input — could come from textAfterCommand or args[0]
            const _selection = (textAfterCommand || args[0] || '').trim().toLowerCase();

            if (isDM && _selection === 'all') {
                const senderKey = (m.key.participant || (m.key.fromMe ? sock.user?.id : jid) || jid)
                    .split('@')[0].split(':')[0];
                let session = (quotedId && togStatusSessionCache.has(quotedId))
                    ? togStatusSessionCache.get(quotedId)
                    : null;
                if (!session && togStatusSenderCache.has(senderKey)) {
                    session = togStatusSenderCache.get(senderKey);
                }

                if (session) {
                    await sock.sendMessage(jid, { react: { text: GROUP.LOADING, key: m.key } });
                    const results = [];
                    for (const group of session.groups) {
                        try {
                            await sendGroupStatus(sock, group.id, session.payload);
                            results.push({ ok: true, name: group.name });
                        } catch (error) {
                            results.push({ ok: false, name: group.name, error: error?.message || 'failed' });
                        }
                    }

                    if (quotedId) togStatusSessionCache.delete(quotedId);
                    togStatusSenderCache.delete(senderKey);
                    await sock.sendMessage(jid, { react: { text: GROUP.SUCCESS, key: m.key } });

                    const posted = results.filter(result => result.ok);
                    const failed = results.filter(result => !result.ok);
                    let allMsg = `${GROUP.SUCCESS} *${session.mediaType}* posted to *${posted.length}/${results.length}* group statuses.`;
                    if (failed.length) allMsg += `\n\n${GROUP.WARNING} Failed in: ${failed.map(result => result.name).join(', ')}`;
                    if (session.payload.caption) allMsg += `\n${GROUP.NOTE} "${session.payload.caption.substring(0, 80)}"`;
                    if (session.payload.text) allMsg += `\n${GROUP.FILE} "${session.payload.text.substring(0, 80)}"`;
                    allMsg += `\n\n${GROUP.EYE} Visible to group members`;
                    return sock.sendMessage(jid, { text: allMsg }, { quoted: m });
                }
            }

            const _numStr = /^\d+$/.test(textAfterCommand)
                ? textAfterCommand
                : (args[0] && /^\d+$/.test(args[0]) ? args[0] : null);

            if (isDM && _numStr) {
                const senderKey = (m.key.participant || (m.key.fromMe ? sock.user?.id : jid) || jid)
                    .split('@')[0].split(':')[0];

                // Lookup 1: by quoted stanzaId
                let session = (quotedId && togStatusSessionCache.has(quotedId))
                    ? togStatusSessionCache.get(quotedId)
                    : null;

                // Lookup 2: by sender JID (covers standalone number sends)
                if (!session && togStatusSenderCache.has(senderKey)) {
                    session = togStatusSenderCache.get(senderKey);
                }

                if (session) {
                    const idx   = parseInt(_numStr, 10) - 1;
                    const group = session.groups[idx];

                    if (!group) {
                        return sock.sendMessage(jid, {
                text: `${GROUP.ERROR} No group at position *${_numStr}*. The list has *${session.groups.length}* groups.\n\nSend *${PREFIX}togstatus* (replying to your media) to get a fresh list.`
                        }, { quoted: m });
                    }

            await sock.sendMessage(jid, { react: { text: GROUP.LOADING, key: m.key } });
                    await sendGroupStatus(sock, group.id, session.payload);
            await sock.sendMessage(jid, { react: { text: GROUP.SUCCESS, key: m.key } });

                    // Clean up both caches
                    if (quotedId) togStatusSessionCache.delete(quotedId);
                    togStatusSenderCache.delete(senderKey);

        let successMsg = `${GROUP.SUCCESS} *${session.mediaType}* posted to group status!\n`;
        successMsg    += `${GROUP.PEOPLE} *${group.name}*\n`;
        if (session.payload.caption) successMsg += `${GROUP.NOTE} "${session.payload.caption.substring(0, 80)}"\n`;
        if (session.payload.text)    successMsg += `${GROUP.FILE} "${session.payload.text.substring(0, 80)}"\n`;
        successMsg    += `\n${GROUP.EYE} Visible to all group members`;

                    return sock.sendMessage(jid, { text: successMsg }, { quoted: m });
                }

                // Session not found (e.g. bot restarted) — give clear guidance
                if (quotedId || togStatusSessionCache.size === 0) {
                    // Only show stale message if they're clearly replying to something
                    if (quotedId) {
                        return sock.sendMessage(jid, {
                text: `${GROUP.WARNING} That session has expired (bot may have restarted).\n\nPlease reply to your image/video again with *${PREFIX}togstatus* to get a fresh group list.`
                        }, { quoted: m });
                    }
                }
            }

            /* ──────────────────────────────────────────────────────────────
               GROUP FLOW (unchanged behaviour)
               Command was sent inside a group — post to this group's status.
            ────────────────────────────────────────────────────────────── */
            if (isGroup) {
                if (!quotedMessage && !textAfterCommand) {
                    return sock.sendMessage(jid, {
                        text:
            `╭─⌈ ${GROUP.IDEA} *GROUP STATUS* ⌋\n│\n` +
                            `├─⊷ *${PREFIX}togstatus* (reply)\n│  └⊷ Reply to media/text\n` +
                            `├─⊷ *${PREFIX}togstatus Your text here*\n│  └⊷ Post text status\n` +
                            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                    }, { quoted: m });
                }

                let payload = null;
                let mediaType = 'Text';

                if (quotedMessage) {
                    mediaType = detectMediaType(quotedMessage);
                    payload   = await buildPayloadFromQuoted(quotedMessage);
                    if (payload && (payload.video || payload.image) && textAfterCommand) {
                        payload.caption = textAfterCommand;
                    }
                } else if (textAfterCommand) {
                    payload = { text: textAfterCommand };
                }

                if (!payload) {
            return sock.sendMessage(jid, { text: `${GROUP.ERROR} Could not process the message.` }, { quoted: m });
                }

            await sock.sendMessage(jid, { react: { text: GROUP.LOADING, key: m.key } });
                await sendGroupStatus(sock, jid, payload);
            await sock.sendMessage(jid, { react: { text: GROUP.SUCCESS, key: m.key } });

        let successMsg = `${GROUP.SUCCESS} ${mediaType} group status posted!\n`;
        if (payload.caption) successMsg += `${GROUP.NOTE} Caption: "${payload.caption.substring(0, 80)}"\n`;
        if (payload.text)    successMsg += `${GROUP.FILE} "${payload.text.substring(0, 80)}"\n`;
        successMsg += `\n${GROUP.PEOPLE} Visible to all group members`;
                return sock.sendMessage(jid, { text: successMsg }, { quoted: m });
            }

            /* ──────────────────────────────────────────────────────────────
               DM FLOW — step 1
               Command was sent in a DM (private chat).
               Accepted forms:
                 a) .togstatus 1234567890-1234567890@g.us  (reply to media)
                    → post directly to that JID
                 b) .togstatus  (reply to media, no JID)
                    → show group list, user picks with .togstatus <number>
            ────────────────────────────────────────────────────────────── */

            // ── Resolve media payload (from quoted or direct media) ──────
            let payload   = null;
            let mediaType = 'Text';

            // Check for directly-sent media (image/video/audio sent with the command)
            const directResult = await buildPayloadFromDirectMedia(m);
            if (directResult) {
                payload   = directResult.payload;
                mediaType = directResult.mediaType;
            } else if (quotedMessage) {
                mediaType = detectMediaType(quotedMessage);
                payload   = await buildPayloadFromQuoted(quotedMessage);
                if (payload && (payload.video || payload.image) && textAfterCommand && !textAfterCommand.endsWith('@g.us')) {
                    payload.caption = textAfterCommand;
                }
            } else if (textAfterCommand && !textAfterCommand.endsWith('@g.us')) {
                // Plain text status from DM
                payload   = { text: textAfterCommand };
                mediaType = 'Text';
            }

            // ── Check if a group JID was provided as the argument ────────
            // Matches "1234567890-1234567890@g.us" pattern anywhere in args
            const argStr   = args.join(' ').trim();
            const jidMatch = argStr.match(/\d[\d-]+@g\.us/);
            const targetJid = jidMatch ? jidMatch[0] : null;

            // ── No media and no JID → show help ─────────────────────────
            if (!payload && !targetJid) {
                return sock.sendMessage(jid, {
                    text:
            `╭─⌈ ${GROUP.IDEA} *GROUP STATUS FROM DM* ⌋\n│\n` +
                        `├─⊷ *Reply to media + ${PREFIX}togstatus*\n` +
                        `│  └⊷ Shows your group list → reply with number or *all* to post\n` +
                        `├─⊷ *Reply to media + ${PREFIX}togstatus <GroupJID>*\n` +
                        `│  └⊷ Posts directly to that group\n` +
                        `├─⊷ *${PREFIX}togstatus <text>*\n` +
                        `│  └⊷ Post text status (select group or reply *all*)\n` +
                        `│\n` +
            `├─⊷ ${GROUP.IDEA} Get a group JID: use *${PREFIX}mygroups*\n` +
                        `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            // ── If no media, default to empty text so user picks group ───
            if (!payload) payload = { text: '' };

            // ── Direct JID: post immediately ─────────────────────────────
            if (targetJid) {
                // Verify we're actually in that group
                let groupName = targetJid;
                try {
                    const meta = await sock.groupMetadata(targetJid);
                    groupName  = meta?.subject || targetJid;
                } catch {}

                if (!payload || (!payload.image && !payload.video && !payload.audio && !payload.sticker && !payload.text)) {
                    return sock.sendMessage(jid, {
                text: `${GROUP.ERROR} Please reply to a media message (or include text) along with the group JID.`
                    }, { quoted: m });
                }

            await sock.sendMessage(jid, { react: { text: GROUP.LOADING, key: m.key } });
                await sendGroupStatus(sock, targetJid, payload);
            await sock.sendMessage(jid, { react: { text: GROUP.SUCCESS, key: m.key } });

        let successMsg = `${GROUP.SUCCESS} *${mediaType}* posted to group status!\n`;
        successMsg    += `${GROUP.PEOPLE} *${groupName}*\n`;
        if (payload.caption) successMsg += `${GROUP.NOTE} "${payload.caption.substring(0, 80)}"\n`;
        if (payload.text)    successMsg += `${GROUP.FILE} "${payload.text.substring(0, 80)}"\n`;
        successMsg    += `\n${GROUP.EYE} Visible to all group members`;
                return sock.sendMessage(jid, { text: successMsg }, { quoted: m });
            }

            // ── No JID: show group list and cache the media ───────────────
            await showGroupListForStatus(sock, jid, m, payload, mediaType, PREFIX);

        } catch (error) {
            console.error('[TogStatus] Error:', error);
            try {
                await sock.sendMessage(m.key.remoteJid, {
            text: `${GROUP.ERROR} Failed: ${error.message}`
                }, { quoted: m });
            } catch {}
        }
    }
};
