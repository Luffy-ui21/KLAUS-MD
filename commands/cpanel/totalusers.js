import { listUsers, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'totalusers',
    alias: ['userscount', 'countusers'],
    category: 'cpanel',
    desc: 'Show total number of panel users',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(jid, {
                text: `❌ Not configured. Run ${PREFIX}setkey and ${PREFIX}setlink first.`
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        try {
            const users = await listUsers();
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(jid, {
                text: `👥 *Total Users: ${users.length}*`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
