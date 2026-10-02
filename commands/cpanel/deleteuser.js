import { getUserByEmail, getServersByUserId, deleteServer, deleteUser, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'deleteuser',
    alias: ['removepaneluser', 'removepanel'],
    category: 'cpanel',
    desc: 'Delete a panel user and all their servers',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        const email = args[0]?.trim();

        if (!email || !email.includes('@')) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 🗑️ *DELETE USER* ⌋\n├─⊷ *${PREFIX}deleteuser <email>*\n│  └⊷ Deletes the user and all their servers\n╰─⊷`
            }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(jid, {
                text: `❌ Not configured. Run ${PREFIX}setkey and ${PREFIX}setlink first.`
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        try {
            const user = await getUserByEmail(email);

            if (!user) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: `❌ No user found with email *${email}*`
                }, { quoted: msg });
            }

            const userId = user.attributes.id;
            const username = user.attributes.username;

            const servers = await getServersByUserId(userId);
            let deletedServers = 0;

            for (const server of servers) {
                try {
                    await deleteServer(server.attributes.id);
                    deletedServers++;
                } catch {}
            }

            await deleteUser(userId);

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(jid, {
                text: `✅ *User Deleted*\n\n👤 ${username} (${email})\n🖥️ Servers removed: ${deletedServers}`
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
