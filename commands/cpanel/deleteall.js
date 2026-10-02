import { loadConfig, isConfigured } from '../../lib/cpanel.js';

export default {
    name: 'deleteall',
    alias: ['deleteallpanels', 'deleteallservers', 'nukeall'],
    category: 'cpanel',
    desc: 'Force-delete all servers on the panel',
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
            // Collect all servers across all pages
            let page = 1;
            const allServers = [];

            while (true) {
                const res = await fetch(`${base}/api/application/servers?per_page=100&page=${page}`, { headers });
                const data = await res.json().catch(() => ({}));
                console.log(`[deleteall] page ${page} — HTTP ${res.status} — servers in page: ${data?.data?.length ?? 'N/A'}`);

                const batch = data?.data || [];
                allServers.push(...batch);

                const lastPage = data?.meta?.pagination?.total_pages ?? 1;
                if (page >= lastPage || batch.length < 100) break;
                page++;
            }

            console.log(`[deleteall] Total servers found: ${allServers.length}`);

            let deleted = 0;
            for (const server of allServers) {
                const id = server.attributes.id;
                // Try force delete first — works regardless of server state
                const forceRes = await fetch(`${base}/api/application/servers/${id}/force`, {
                    method: 'DELETE',
                    headers
                });
                if (forceRes.ok || forceRes.status === 204) {
                    deleted++;
                    console.log(`[deleteall] Deleted server ${id} (force) ✅`);
                } else {
                    // Fallback to normal delete
                    const normalRes = await fetch(`${base}/api/application/servers/${id}`, {
                        method: 'DELETE',
                        headers
                    });
                    if (normalRes.ok || normalRes.status === 204) {
                        deleted++;
                        console.log(`[deleteall] Deleted server ${id} (normal) ✅`);
                    } else {
                        const errBody = await normalRes.json().catch(() => ({}));
                        console.log(`[deleteall] Failed server ${id}: ${normalRes.status} — ${JSON.stringify(errBody)}`);
                    }
                }
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(jid, {
                text: `✅ All ${deleted} servers deleted.`
            }, { quoted: msg });

        } catch (err) {
            console.log(`[deleteall] Fatal error: ${err.message}`);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
