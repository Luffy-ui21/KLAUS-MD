import { loadConfig, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'deleteallusers',
    alias: ['removeusers', 'nukeusers'],
    category: 'cpanel',
    desc: 'Delete all panel users except the main admin',
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

        const { apiKey, panelUrl } = loadConfig();
        const base = panelUrl.replace(/\/+$/, '');
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        try {
            let page = 1;
            const allUsers = [];

            while (true) {
                const res = await fetch(`${base}/api/application/users?per_page=100&page=${page}`, { headers });
                const data = await res.json().catch(() => ({}));
                console.log(`[deleteallusers] page ${page} — HTTP ${res.status} — users: ${data?.data?.length ?? 'N/A'}`);

                const batch = data?.data || [];
                allUsers.push(...batch);

                const lastPage = data?.meta?.pagination?.total_pages ?? 1;
                if (page >= lastPage || batch.length < 100) break;
                page++;
            }

            // Protect the main admin (lowest ID)
            allUsers.sort((a, b) => a.attributes.id - b.attributes.id);
            const mainAdmin = allUsers[0];
            const toDelete = allUsers.slice(1);

            let deleted = 0;
            for (const user of toDelete) {
                const id = user.attributes.id;
                try {
                    const res = await fetch(`${base}/api/application/users/${id}`, {
                        method: 'DELETE',
                        headers
                    });
                    if (res.ok || res.status === 204) {
                        deleted++;
                        console.log(`[deleteallusers] Deleted user ${id} ✅`);
                    } else {
                        console.log(`[deleteallusers] Failed user ${id}: ${res.status}`);
                    }
                } catch (e) {
                    console.log(`[deleteallusers] Error user ${id}: ${e.message}`);
                }
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(jid, {
                text:
                    `✅ *Done*\n\n` +
                    `🗑️ Deleted : ${deleted} user(s)\n` +
                    `👑 Kept    : ${mainAdmin?.attributes?.username ?? '—'} (Main Admin)`
            }, { quoted: msg });

        } catch (err) {
            console.log(`[deleteallusers] Fatal: ${err.message}`);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
