import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'pin',
    description: 'Pin a message in the chat',
    category: 'group',
    aliases: ['pinmsg', 'pinmessage'],

    async execute(sock, m, args, PREFIX, extra) {
        const jid = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });
        const react  = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: m.key } }).catch(() => {});

        if (!jid.endsWith('@g.us')) {
            return reply('❌ Pinning messages is only available in groups.');
        }

        // Get the quoted message key
        const msgContent = m.message || {};
        const inner =
            msgContent.ephemeralMessage?.message ||
            msgContent.viewOnceMessage?.message ||
            msgContent.documentWithCaptionMessage?.message ||
            msgContent;

        const quotedCtx =
            inner.extendedTextMessage?.contextInfo ||
            inner.imageMessage?.contextInfo ||
            inner.videoMessage?.contextInfo ||
            inner.stickerMessage?.contextInfo ||
            inner.audioMessage?.contextInfo;

        if (!quotedCtx?.stanzaId || !quotedCtx?.participant) {
            return reply(
                `╭─⌈ 📌 *PIN MESSAGE* ⌋\n│\n` +
                `├─⊷ *Usage:*\n│  └⊷ Reply to a message with:\n│     \`${PREFIX}pin <duration>\`\n│\n` +
                `├─⊷ *Durations:*\n` +
                `│  └⊷ \`24h\` — 24 hours\n` +
                `│  └⊷ \`7d\`  — 7 days\n` +
                `│  └⊷ \`30d\` — 30 days\n│\n` +
                `├─⊷ *Example:* \`${PREFIX}pin 7d\`\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );
        }

        const durationArg = args[0]?.toLowerCase() || '24h';
        let durationSeconds;
        let durationLabel;

        switch (durationArg) {
            case '24h': case '24': case '1d':
                durationSeconds = 86400; durationLabel = '24 hours'; break;
            case '7d': case '7':
                durationSeconds = 604800; durationLabel = '7 days'; break;
            case '30d': case '30':
                durationSeconds = 2592000; durationLabel = '30 days'; break;
            default:
                return reply(`❌ Invalid duration: *${durationArg}*\n\nValid options:\n• \`24h\` — 24 hours\n• \`7d\`  — 7 days\n• \`30d\` — 30 days`);
        }

        try {
            const groupMetadata = extra?.groupMetadata || await sock.groupMetadata(jid);
            const senderRaw = m.key.participant || m.key.remoteJid;
            const senderClean = senderRaw.split(':')[0].split('@')[0];
            const senderParticipant = groupMetadata.participants.find(p => p.id.split(':')[0].split('@')[0] === senderClean);
            const senderIsAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');
            const senderIsOwner = typeof extra?.isOwner === 'function' ? extra.isOwner() : !!extra?.isOwner;

            if (!senderIsAdmin && !senderIsOwner) {
                return reply('⛔ Only group admins can pin messages.');
            }

            await react('📌');

            // Resolve LID to proper JID
            let resolvedParticipant = quotedCtx.participant;
            if (resolvedParticipant.endsWith('@lid')) {
                // Try to resolve from group metadata
                try {
                    const p = groupMetadata.participants.find(x => x.id === resolvedParticipant);
                    if (p) {
                        resolvedParticipant = p.id; // Use the JID from group metadata
                    }
                } catch {}
                
                // If still @lid, try contact store
                if (resolvedParticipant.endsWith('@lid') && sock.store?.contacts) {
                    for (const [contactJid, contact] of Object.entries(sock.store.contacts)) {
                        if (contact.lid === quotedCtx.participant) {
                            resolvedParticipant = contactJid;
                            break;
                        }
                    }
                }
            }

            console.log('Resolved participant:', resolvedParticipant);

            // Use raw XML stanza for pinning - most reliable method
            const pinXml = {
                tag: 'iq',
                attrs: {
                    id: sock.generateMessageTag?.() || Date.now().toString(),
                    to: jid,
                    type: 'set',
                    xmlns: 'pin'
                },
                content: [{
                    tag: 'pin',
                    attrs: { 
                        type: '1',
                        time: String(durationSeconds)
                    },
                    content: [{
                        tag: 'key',
                        attrs: {
                            remote_jid: jid,
                            from_me: '0',
                            id: quotedCtx.stanzaId,
                            participant: resolvedParticipant
                        }
                    }]
                }]
            };

            console.log('Sending pin stanza');
            await sock.query(pinXml);

            await react('✅');
            await reply(
                `╭─⌈ 📌 *MESSAGE PINNED* ⌋\n│\n` +
                `│ ✧ *Duration:* ${durationLabel}\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );

        } catch (err) {
            await react('❌').catch(() => {});
            console.log('Pin error:', err.message);
            
            if (err.message?.includes('over-pinning-limit') || err.message?.includes('conflict')) {
                return reply('❌ This group has reached the maximum number of pinned messages (3). Unpin one first.');
            }
            return reply(`❌ Failed to pin message.\n_${err.message || 'Unknown error'}_`);
        }
    }
};