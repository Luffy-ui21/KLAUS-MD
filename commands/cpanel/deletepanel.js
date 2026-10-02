import { deleteServer, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'deletepanel',
    alias: ['deleteserver', 'removepanel', 'removeserver'],
    category: 'cpanel',
    desc: 'Delete a panel server by ID',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        const serverId = args[0]?.trim();

        if (!serverId || isNaN(serverId)) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 🖥️ *DELETE PANEL* ⌋\n├─⊷ *${PREFIX}deletepanel <server-id>*\n│  └⊷ Get the ID from ${PREFIX}listpanels\n╰─⊷`
            }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(jid, {
                text: `❌ Not configured. Run ${PREFIX}setkey and ${PREFIX}setlink first.`
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        try {
            await deleteServer(Number(serverId));
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(jid, {
                text: `✅ *Server ${serverId} deleted successfully.*`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
