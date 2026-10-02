import { downloadMediaMessage } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const silentLogger = {
    info: () => {}, error: () => {}, warn: () => {},
    debug: () => {}, trace: () => {}, child: function () { return this; }
};

export default {
    name: 'setgrouppic',
    description: 'Change the group profile picture',
    category: 'group',
    aliases: ['setgpp', 'grouppp', 'setgroupphoto', 'gpic'],

    async execute(sock, m, args, PREFIX, extra) {
        const jid   = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });
        const react  = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: m.key } }).catch(() => {});

        if (!jid.endsWith('@g.us')) {
            return reply('❌ This command can only be used inside a group.');
        }

        try {
            const groupMetadata = extra?.groupMetadata || await sock.groupMetadata(jid);

            const senderRaw   = m.key.participant || m.key.remoteJid;
            const senderClean = senderRaw.split(':')[0].split('@')[0];

            const senderParticipant = groupMetadata.participants.find(p => {
                return p.id.split(':')[0].split('@')[0] === senderClean;
            });
            const senderIsAdmin = senderParticipant && (
                senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin'
            );
            const senderIsOwner = typeof extra?.isOwner === 'function' ? extra.isOwner() : !!extra?.isOwner;

            if (!senderIsAdmin && !senderIsOwner) {
                return reply('⛔ Only group admins can change the group profile picture.');
            }

            // ── Resolve the image source ────────────────────────────────────────
            // Priority: quoted image > quoted sticker > direct image > direct sticker
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
            const quotedMsg = quotedCtx?.quotedMessage;

            let mediaMsg  = null;
            let mediaType = null;
            let msgKey    = null;

            // 1. Quoted image
            if (quotedMsg?.imageMessage) {
                mediaMsg  = quotedMsg;
                mediaType = 'imageMessage';
                msgKey    = { remoteJid: jid, fromMe: false, id: quotedCtx.stanzaId, participant: quotedCtx.participant };
            }
            // 2. Quoted sticker
            else if (quotedMsg?.stickerMessage) {
                mediaMsg  = quotedMsg;
                mediaType = 'stickerMessage';
                msgKey    = { remoteJid: jid, fromMe: false, id: quotedCtx.stanzaId, participant: quotedCtx.participant };
            }
            // 3. Direct image in this message
            else if (inner.imageMessage) {
                mediaMsg  = inner;
                mediaType = 'imageMessage';
                msgKey    = m.key;
            }
            // 4. Direct sticker in this message
            else if (inner.stickerMessage) {
                mediaMsg  = inner;
                mediaType = 'stickerMessage';
                msgKey    = m.key;
            }

            if (!mediaMsg || !mediaType) {
                return reply(
                    `╭─⌈ 🖼️ *SET GROUP PIC* ⌋\n│\n` +
                    `├─⊷ *Usage:*\n│  └⊷ Send or reply to an *image* with\n│     \`${PREFIX}setgrouppic\`\n│\n` +
                    `├─⊷ *Aliases:* setgpp, grouppp, gpic\n│\n` +
                    `├─⊷ 💡 Stickers also work as group pics\n│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                );
            }

            await react('⏳');

            const buffer = await downloadMediaMessage(
                { key: msgKey, message: mediaMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage, logger: silentLogger }
            );

            if (!buffer || buffer.length === 0) {
                await react('❌');
                return reply('❌ Could not download the image. Please try again.');
            }

            await sock.updateProfilePicture(jid, buffer);
            await react('✅');

            await reply(
                `╭─⌈ 🖼️ *GROUP PIC UPDATED* ⌋\n│\n` +
                `│ ✧ *Group:* ${groupMetadata.subject || jid}\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );

        } catch (err) {
            await react('❌').catch(() => {});
            if (err.message?.includes('not-authorized') || err.message?.includes('403')) {
                return reply('⚠️ Failed — make sure I am an admin in this group.');
            }
            if (err.message?.includes('bad-request') || err.message?.includes('400')) {
                return reply('❌ WhatsApp rejected the image. Try a different photo (JPG/PNG, under 5MB).');
            }
            return reply(`❌ Failed to update group picture.\n_${err.message || 'Unknown error'}_`);
        }
    }
};