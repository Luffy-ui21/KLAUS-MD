import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const silentLogger = {
    info: () => {}, error: () => {}, warn: () => {},
    debug: () => {}, trace: () => {}, child: function () { return this; }
};

export default {
    name: 'setgroupname',
    description: 'Change the group name/subject',
    category: 'group',
    aliases: ['setgroupsubject', 'renamegroupname', 'groupname', 'setgn'],

    async execute(sock, m, args, PREFIX, extra) {
        const jid = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });
        const react  = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: m.key } }).catch(() => {});

        if (!jid.endsWith('@g.us')) {
            return reply('❌ This command can only be used inside a group.');
        }

        const newName = args.join(' ').trim();

        if (!newName) {
            return reply(
                `╭─⌈ ✏️ *SET GROUP NAME* ⌋\n│\n` +
                `├─⊷ *Usage:*\n│  └⊷ \`${PREFIX}setgroupname <new name>\`\n│\n` +
                `├─⊷ *Aliases:* setgn, groupname\n│\n` +
                `├─⊷ ⚠️ Max 25 characters\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );
        }

        if (newName.length > 25) {
            return reply(`❌ Group name is too long (*${newName.length}* chars).\nWhatsApp allows a maximum of *25 characters*.`);
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
                return reply('⛔ Only group admins can change the group name.');
            }

            const oldName = groupMetadata.subject || 'Unknown';

            await react('⏳');
            await sock.groupUpdateSubject(jid, newName);
            await react('✅');

            await reply(
                `╭─⌈ ✏️ *GROUP NAME UPDATED* ⌋\n│\n` +
                `│ ✧ *Old:* ${oldName}\n` +
                `│ ✧ *New:* ${newName}\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );

        } catch (err) {
            await react('❌');
            if (err.message?.includes('not-authorized') || err.message?.includes('403')) {
                return reply('⚠️ Failed — make sure I am an admin in this group.');
            }
            return reply(`❌ Failed to update group name.\n_${err.message || 'Unknown error'}_`);
        }
    }
};