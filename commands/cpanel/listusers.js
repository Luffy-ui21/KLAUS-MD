import { listUsers, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'listusers',
    alias: ['panellusers', 'getusers'],
    category: 'cpanel',
    desc: 'List all panel users',
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

            if (!users.length) {
                return sock.sendMessage(jid, { text: '📭 No users found on the panel.' }, { quoted: msg });
            }

            const lines = users.map((u, i) => {
                const a = u.attributes;
                return `${i + 1}. *${a.username}* (ID: ${a.id})\n   📧 ${a.email}`;
            });

            await sock.sendMessage(jid, {
                text: `👥 *Panel Users (${users.length})*\n\n${lines.join('\n\n')}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
