import * as supabaseDb from '../../lib/database.js';

export default {
    name: 'cleardb',
    alias: ['clearsupabase', 'clearsupa', 'clearcloud', 'wipesupa', 'wipesupabase', 'clearmedia', 'wipemedia', 'wipedb', 'cleardata'],
    category: 'owner',
    description: 'Clear all data from the local SQLite database',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        if (!supabaseDb.isAvailable()) {
            await sock.sendMessage(chatId, {
                text: `❌ Database is not initialized. Cannot clear data.`
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `⏳ Clearing all data from the database...\n\n⚠️ This will wipe ALL tables. Please wait...`
        }, { quoted: msg });

        const startTime = Date.now();

        const results = await supabaseDb.wipeAllTables();

        const fs = await import('fs/promises');
        const path = await import('path');
        let localCleaned = 0;

        const localDirs = [
            './data/antidelete/media',
            './data/antidelete/status/media'
        ];
        for (const dir of localDirs) {
            try {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    await fs.unlink(path.join(dir, file)).catch(() => {});
                    localCleaned++;
                }
            } catch {}
        }

        const localFiles = [
            './data/antidelete/antidelete.json',
            './data/antidelete/status/status_cache.json'
        ];
        for (const file of localFiles) {
            try {
                await fs.writeFile(file, '{}');
                localCleaned++;
            } catch {}
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        let statusText = `🗑️ *DATABASE FULL WIPE COMPLETE*\n\n`;
        statusText += `⏱️ Time: ${elapsed}s\n`;
        statusText += `📊 Total rows deleted: ${results.totalRows}\n\n`;
        statusText += `*Table Breakdown:*\n`;

        for (const [table, count] of Object.entries(results.tables)) {
            statusText += `├─ ${table}: ${count} rows\n`;
        }

        statusText += `\n🧹 Local files cleaned: ${localCleaned}\n`;

        if (results.errors.length > 0) {
            statusText += `\n⚠️ Errors:\n`;
            for (const err of results.errors) {
                statusText += `├─ ${err}\n`;
            }
        }

        statusText += `\n✅ All database data wiped successfully!\n`;
        statusText += `_Bot will rebuild data as new activity occurs._`;

        await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
        console.log(`🗑️ [CLEARDB] Wiped ${results.totalRows} rows from ${Object.keys(results.tables).length} tables in ${elapsed}s`);
    }
};
