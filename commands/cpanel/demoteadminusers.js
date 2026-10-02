import { listUsers, updateUser, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'demoteadminusers',
    alias: ['demotealladmins', 'removeadmins'],
    category: 'cpanel',
    desc: 'Demote all panel admins except the main admin',
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
            const allUsers = await listUsers();
            const admins = allUsers
                .filter(u => u.attributes.root_admin)
                .sort((a, b) => a.attributes.id - b.attributes.id);

            if (admins.length <= 1) {
                await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: `✅ Only the main admin exists. Nothing to demote.`
                }, { quoted: msg });
            }

            // The first (lowest ID) is the main admin — skip them
            const mainAdmin = admins[0];
            const toDemote = admins.slice(1);

            let demoted = 0;
            for (const user of toDemote) {
                const a = user.attributes;
                try {
                    await updateUser(a.id, {
                        email:      a.email,
                        username:   a.username,
                        first_name: a.first_name,
                        last_name:  a.last_name,
                        root_admin: false,
                        language:   a.language || 'en'
                    });
                    demoted++;
                    console.log(`[demoteall] Demoted ${a.username} (ID: ${a.id})`);
                } catch (e) {
                    console.log(`[demoteall] Failed to demote ${a.username}: ${e.message}`);
                }
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(jid, {
                text:
                    `✅ *Done*\n\n` +
                    `⬇️ Demoted : ${demoted} admin(s)\n` +
                    `👑 Kept    : ${mainAdmin.attributes.username} (Main Admin)`
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
