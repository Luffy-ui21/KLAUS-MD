import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const BRAND = () => getOwnerName().toUpperCase();

export default {
    name: 'getgroupdescription',
    alias: ['getgdesc', 'getdesc', 'groupdesc', 'gdesc'],
    description: 'Get the description of a group. Run inside a group, or pass a group JID from anywhere.',
    category: 'group',

    execute: async (sock, msg, args, PREFIX) => {
        const chatId = msg.key.remoteJid;
        const isInGroup = chatId.endsWith('@g.us');
        const usedJid = !!args[0];

        // Resolve which group JID to look up
        let targetJid = null;

        if (args[0]) {
            let input = args[0].trim();
            if (!input.endsWith('@g.us')) {
                input = input.replace(/[^0-9\-]/g, '');
                input = `${input}@g.us`;
            }
            targetJid = input;
        } else if (isInGroup) {
            targetJid = chatId;
        } else {
            return sock.sendMessage(chatId, {
                text:
                    `╭⌈ ❌ *NO GROUP SPECIFIED* ⌋\n` +
                    `├⊷ Run inside a group, or provide a JID:\n` +
                    `├⊷ *${PREFIX}getdesc 1234567890-1234567890@g.us*\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        let groupMeta;
        try {
            groupMeta = await sock.groupMetadata(targetJid);
        } catch {
            return sock.sendMessage(chatId, {
                text: `❌ Could not fetch group info. Make sure the bot is a member of that group and the JID is correct.`
            }, { quoted: msg });
        }

        const desc = groupMeta.desc?.trim();
        const name = groupMeta.subject || targetJid;
        const created = groupMeta.creation
            ? new Date(groupMeta.creation * 1000).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })
            : 'Unknown';

        if (!desc) {
            return sock.sendMessage(chatId, {
                text:
                    `╭⌈ 📋 *GROUP DESCRIPTION* ⌋\n` +
                    `├⊷ Group : *${name}*\n` +
                    `├⊷ Description : _No description set._\n` +
                    (!usedJid ? `├⊷ 💡 Tip: Use *${PREFIX}getdesc <JID>* to check any group from anywhere\n` : '') +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        return sock.sendMessage(chatId, {
            text:
                `╭⌈ 📋 *GROUP DESCRIPTION* ⌋\n` +
                `├⊷ *${name}*\n` +
                `├⊷ Created : ${created}\n` +
                `│\n` +
                `${desc}\n` +
                `│\n` +
                (!usedJid ? `├⊷ 💡 Tip: Use *${PREFIX}getdesc <JID>* to check any group from anywhere\n` : '') +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        }, { quoted: msg });
    },
};
