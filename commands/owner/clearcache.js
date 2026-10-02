import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';
export default {
    name: 'clearcache',
    alias: ['cc', 'cacheclear', 'flushcache', 'resetcache'],
    category: 'owner',
    description: 'Clear all bot caches to free memory and refresh data',
    ownerOnly: true,
    usage: 'clearcache [all|messages|contacts|groups|viewonce|config|retry]',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const isOwner = extra?.isOwner?.() || false;

        if (!isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ This command is owner-only.'
            }, { quoted: msg });
        }

        const target = (args[0] || 'all').toLowerCase();
        const validTargets = ['all', 'messages', 'contacts', 'groups', 'config', 'retry', 'lid'];

        if (!validTargets.includes(target)) {
            return await sock.sendMessage(chatId, {
                text: `╭─⌈ 🗑️ *CLEAR CACHE* ⌋\n│\n├─⊷ *${PREFIX}clearcache [target]*\n│\n├─⊷ *Targets:*\n│  └⊷ all — Clear everything\n│  └⊷ messages — Message store\n│  └⊷ contacts — Contact names\n│  └⊷ groups — Group metadata\n│  └⊷ config — Config caches (reloads from DB)\n│  └⊷ retry — Message retry counters\n│  └⊷ lid — LID-to-phone mappings\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}clearcache\n│  └⊷ ${PREFIX}cc messages\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        const results = [];
        let totalFreed = 0;

        try {
            if (target === 'all' || target === 'messages') {
                const store = extra?.store;
                if (store) {
                    const msgCount = store.messages?.size || 0;
                    const sentCount = store.sentMessages?.size || 0;
                    if (store.messages) store.messages.clear();
                    if (store.sentMessages) store.sentMessages.clear();
                    totalFreed += msgCount + sentCount;
                    results.push(`✅ Messages: ${msgCount} cleared`);
                    results.push(`✅ Sent messages: ${sentCount} cleared`);
                } else {
                    results.push(`⚠️ Message store not available`);
                }
            }

            if (target === 'all' || target === 'contacts') {
                const contactCount = global.contactNames?.size || 0;
                if (global.contactNames) global.contactNames.clear();
                totalFreed += contactCount;
                results.push(`✅ Contacts: ${contactCount} cleared`);
            }

            if (target === 'all' || target === 'groups') {
                const groupCount = globalThis.groupMetadataCache?.size || 0;
                if (globalThis.groupMetadataCache) globalThis.groupMetadataCache.clear();
                totalFreed += groupCount;
                results.push(`✅ Group metadata: ${groupCount} cleared`);
            }


            if (target === 'all' || target === 'retry') {
                const retryCache = globalThis.msgRetryCounterCache_ref;
                if (retryCache) {
                    const keys = retryCache.keys();
                    const retryCount = keys.length;
                    retryCache.flushAll();
                    totalFreed += retryCount;
                    results.push(`✅ Retry counters: ${retryCount} cleared`);
                } else {
                    results.push(`⚠️ Retry cache not available`);
                }
            }

            if (target === 'all' || target === 'lid') {
                const lidCount = globalThis.lidPhoneCache?.size || 0;
                const phoneCount = globalThis.phoneLidCache?.size || 0;
                if (globalThis.lidPhoneCache) globalThis.lidPhoneCache.clear();
                if (globalThis.phoneLidCache) globalThis.phoneLidCache.clear();
                totalFreed += lidCount + phoneCount;
                results.push(`✅ LID mappings: ${lidCount} cleared`);
            }

            if (target === 'all' || target === 'config') {
                if (globalThis.reloadConfigCaches) {
                    await globalThis.reloadConfigCaches();
                    results.push(`✅ Config caches: reloaded from database`);
                } else {
                    results.push(`⚠️ Config reload not available`);
                }
            }

            const memBefore = process.memoryUsage();
            if (global.gc) {
                global.gc();
            }
            const memAfter = process.memoryUsage();
            const heapMB = (memAfter.heapUsed / 1024 / 1024).toFixed(1);
            const rssMB = (memAfter.rss / 1024 / 1024).toFixed(1);

            let output = `╭─⌈ 🗑️ *CACHE CLEARED* ⌋\n│\n`;
            output += `├─⊷ *Target:* ${target.toUpperCase()}\n│\n`;
            results.forEach(r => { output += `├─⊷ ${r}\n`; });
            output += `│\n├─⊷ *Total entries cleared:* ${totalFreed}\n`;
            output += `├─⊷ *Memory:* ${heapMB}MB heap / ${rssMB}MB RSS\n`;
            output += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

            await sock.sendMessage(chatId, { text: output }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatId, {
                text: `❌ Cache clear error: ${err.message}`
            }, { quoted: msg });
        }
    }
};
