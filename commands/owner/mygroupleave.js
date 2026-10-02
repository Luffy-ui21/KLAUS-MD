import { getActionSession, deleteActionSession } from '../../lib/actionSession.js';

export default {
    name: 'mygroupleave',
    alias: [],
    description: 'Leave a group selected from the mygroups list',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX) {
        const chatId   = msg.key.remoteJid;
        const senderJid = msg.key.participant || (msg.key.fromMe ? sock.user?.id : chatId);
        const sessionKey = `mygroup:${senderJid?.split('@')[0]}`;

        const session = getActionSession(sessionKey);

        if (!session) {
            return sock.sendMessage(chatId, {
                text: `❌ No group selected. Use *${PREFIX}mygroups*, then reply to the list with a number first.`
            }, { quoted: msg });
        }

        deleteActionSession(sessionKey);

        try {
            await sock.groupLeave(session.id);
            return sock.sendMessage(chatId, {
                text: `✅ Successfully left *${session.name}*`
            }, { quoted: msg });
        } catch (err) {
            return sock.sendMessage(chatId, {
                text: `❌ Failed to leave *${session.name}*\n${err.message}`
            }, { quoted: msg });
        }
    }
};
