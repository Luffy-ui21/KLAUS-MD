import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'removegpp',
    description: 'Remove the group profile picture',
    category: 'group',
    aliases: ['delgpp', 'deletegpp', 'removegroupphoto', 'nogpic', 'cleargpp'],

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
                return reply('⛔ Only group admins can remove the group profile picture.');
            }

            await react('⏳');

            // Remove group picture by passing an empty Buffer
            try {
                await sock.updateProfilePicture(jid, Buffer.alloc(0));
            } catch (firstErr) {
                // Alternative method: some baileys forks use removeProfilePicture
                if (typeof sock.removeProfilePicture === 'function') {
                    await sock.removeProfilePicture(jid);
                } else {
                    throw firstErr;
                }
            }

            await react('✅');

            await reply(
                `╭─⌈ 🗑️ *GROUP PIC REMOVED* ⌋\n│\n` +
                `│ ✧ *Group:* ${groupMetadata.subject || jid}\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );

        } catch (err) {
            await react('❌').catch(() => {});
            if (err.message?.includes('not-authorized') || err.message?.includes('403')) {
                return reply('⚠️ Failed — make sure I am an admin in this group.');
            }
            if (err.message?.includes('bad-request') || err.message?.includes('400')) {
                return reply('❌ WhatsApp rejected the request. The group may not have a profile picture to remove.');
            }
            return reply(`❌ Failed to remove group picture.\n_${err.message || 'Unknown error'}_`);
        }
    }
};