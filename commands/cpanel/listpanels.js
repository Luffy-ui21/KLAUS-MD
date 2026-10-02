import { listServers, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'listpanels',
    alias: ['listservers', 'getpanels', 'getservers'],
    category: 'cpanel',
    desc: 'List all panel servers',
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
            const servers = await listServers();
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

            if (!servers.length) {
                return sock.sendMessage(jid, { text: '📭 No servers found on the panel.' }, { quoted: msg });
            }

            const lines = servers.map((s, i) => {
                const a = s.attributes;
                return `${i + 1}. *${a.name}* (ID: ${a.id})\n   👤 Owner ID: ${a.user}`;
            });

            await sock.sendMessage(jid, {
                text: `🖥️ *Panel Servers (${servers.length})*\n\n${lines.join('\n\n')}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
