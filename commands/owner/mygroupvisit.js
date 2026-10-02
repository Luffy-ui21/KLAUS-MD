import { getActionSession } from '../../lib/actionSession.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'mygroupvisit',
    alias: [],
    description: 'Get invite link for a group selected from the mygroups list',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX) {
        const chatId    = msg.key.remoteJid;
        const senderJid = msg.key.participant || (msg.key.fromMe ? sock.user?.id : chatId);
        const sessionKey = `mygroup:${senderJid?.split('@')[0]}`;

        const session = getActionSession(sessionKey);

        if (!session) {
            return sock.sendMessage(chatId, {
                text: `❌ No group selected. Use *${PREFIX}mygroups*, then reply to the list with a number first.`
            }, { quoted: msg });
        }

        let inviteCode;
        try {
            inviteCode = await sock.groupInviteCode(session.id);
        } catch (err) {
            return sock.sendMessage(chatId, {
                text: `❌ Could not get invite link for *${session.name}*.\nThe bot may not be an admin in this group.\n${err.message}`
            }, { quoted: msg });
        }

        return sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🔗 *VISIT GROUP* ⌋\n│\n` +
                `│  *${session.name}*\n│\n` +
                `│  https://chat.whatsapp.com/${inviteCode}\n│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        }, { quoted: msg });
    }
};
