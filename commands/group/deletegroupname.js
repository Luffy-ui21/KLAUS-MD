import { getFooter } from '../../lib/menuHelper.js';

const BLANK_NAME = '\u00AD\u200B\u200C\u200D\u2060\uFEFF\u034F\u200E\u200F';

export default {
    name: 'deletegroupname',
    aliases: ['cleargroupname', 'removegroupname', 'blankgroupname', 'emptygroupname'],
    description: 'Set the group name to an empty/invisible string',
    category: 'group',

    async execute(sock, m, args, PREFIX, extra) {
        const jid   = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });
        const react = (e)    => sock.sendMessage(jid, { react: { text: e, key: m.key } }).catch(() => {});

        if (!jid.endsWith('@g.us')) {
            return reply('❌ This command can only be used inside a group.');
        }

        try {
            const groupMetadata = extra?.groupMetadata || await sock.groupMetadata(jid);

            const senderRaw   = m.key.participant || m.key.remoteJid;
            const senderClean = senderRaw.split(':')[0].split('@')[0];

            const senderParticipant = groupMetadata.participants.find(p =>
                p.id.split(':')[0].split('@')[0] === senderClean
            );
            const senderIsAdmin = senderParticipant &&
                (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');
            const senderIsOwner = typeof extra?.isOwner === 'function' ? extra.isOwner() : !!extra?.isOwner;

            if (!senderIsAdmin && !senderIsOwner) {
                return reply('⛔ Only group admins can change the group name.');
            }

            await react('⏳');
            await sock.groupUpdateSubject(jid, BLANK_NAME);
            await react('✅');

            await reply(
                `╭─⌈ 🗑️ *GROUP NAME CLEARED* ⌋\n│\n` +
                `│ ✧ The group name has been set to blank.\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );

        } catch (err) {
            await react('❌');
            if (err.message?.includes('not-authorized') || err.message?.includes('403')) {
                return reply('⚠️ Failed — make sure I am an admin in this group.');
            }
            return reply(`❌ Failed to clear group name.\n_${err.message || 'Unknown error'}_`);
        }
    }
};
