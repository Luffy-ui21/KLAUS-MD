import fs from 'fs';
import { getConfigBotId } from '../../lib/database.js';

const DB_PATH = './data/bot.sqlite';

function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function safeParseVal(raw) {
    try { return JSON.parse(raw); } catch { return raw; }
}

async function readTable(table) {
    try {
        const { default: Database } = await import('better-sqlite3');
        const sqlite = new Database(DB_PATH, { readonly: true });
        const rows = sqlite.prepare(`SELECT * FROM ${table} ORDER BY bot_id, key`).all();
        sqlite.close();
        return rows;
    } catch {
        return null;
    }
}

function safeReadJSON(file) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return null;
}

export default {
    name: 'dbcheck',
    aliases: ['db', 'dbstatus'],
    category: 'owner',
    ownerOnly: true,
    desc: 'Show all settings stored in SQLite and JSON fallback files',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const P = PREFIX || '/';

        const currentBotId = (() => { try { return getConfigBotId() || 'unknown'; } catch { return 'unknown'; } })();

        // ── 1. DB overview ────────────────────────────────────────────────────────
        let dbSize = 'not found';
        try { dbSize = fmtSize(fs.statSync(DB_PATH).size); } catch {}

        const overview = {
            file: DB_PATH,
            size: dbSize,
            active_bot_id: currentBotId
        };

        // ── 2. bot_configs  ───────────────────────────────────────────────────────
        const botConfigsRaw = await readTable('bot_configs');
        const botConfigs = {};
        if (botConfigsRaw) {
            for (const r of botConfigsRaw) {
                if (!botConfigs[r.bot_id]) botConfigs[r.bot_id] = {};
                botConfigs[r.bot_id][r.key] = safeParseVal(r.value);
            }
        }

        // ── 3. auto_configs ───────────────────────────────────────────────────────
        const autoConfigsRaw = await readTable('auto_configs');
        const autoConfigs = {};
        if (autoConfigsRaw) {
            for (const r of autoConfigsRaw) {
                if (!autoConfigs[r.bot_id]) autoConfigs[r.bot_id] = {};
                autoConfigs[r.bot_id][r.key] = safeParseVal(r.value);
            }
        }

        // ── 4. JSON fallback files ────────────────────────────────────────────────
        const jsonFiles = {
            'prefix_config.json':   safeReadJSON('prefix_config.json'),
            'bot_mode.json':        safeReadJSON('bot_mode.json'),
            'bot_settings.json':    safeReadJSON('bot_settings.json'),
            'last_bot_id.json':     safeReadJSON('last_bot_id.json'),
            'owner.json':           safeReadJSON('owner.json'),
        };
        // Mark missing files
        for (const [k, v] of Object.entries(jsonFiles)) {
            if (v === null) jsonFiles[k] = 'MISSING';
        }

        // ── 5. data/ JSON-only files ──────────────────────────────────────────────
        const dataFiles = {};
        const dataFileList = [
            'data/autotyping/config.json',
            'data/autorecording/config.json',
            'data/groupqueue.json',
            'data/exportqueue.json',
        ];
        for (const f of dataFileList) {
            const val = safeReadJSON(f);
            dataFiles[f] = val !== null ? val : 'NOT_CREATED';
        }

        // ── 6. Prefix health ──────────────────────────────────────────────────────
        let prefixInDb = null;
        try {
            const { default: Database } = await import('better-sqlite3');
            const s = new Database(DB_PATH, { readonly: true });
            const r = s.prepare(`SELECT value FROM bot_configs WHERE key='prefix_config' AND bot_id=?`).get(currentBotId);
            s.close();
            if (r) prefixInDb = safeParseVal(r.value)?.prefix ?? null;
        } catch {}

        const prefixInFile  = safeReadJSON('prefix_config.json')?.prefix ?? null;
        const prefixInMem   = global.prefix ?? global.CURRENT_PREFIX ?? null;
        const prefixSynced  = prefixInDb !== null && prefixInDb === prefixInFile && prefixInFile === prefixInMem;

        const health = {
            prefix: {
                db:     prefixInDb   ?? 'NOT_FOUND',
                file:   prefixInFile ?? 'NOT_FOUND',
                memory: prefixInMem  ?? 'NOT_FOUND',
                synced: prefixSynced
            }
        };

        // ── Build full report object ──────────────────────────────────────────────
        const report = {
            db:          overview,
            bot_configs: botConfigsRaw === null ? 'ERROR' : botConfigs,
            auto_configs: autoConfigsRaw === null ? 'ERROR' : (Object.keys(autoConfigs).length ? autoConfigs : {}),
            json_files:  jsonFiles,
            data_files:  dataFiles,
            health
        };

        // ── Send as two messages (db+health short, configs full) ──────────────────
        const shortReport = {
            db:       report.db,
            health:   report.health,
            json_files: report.json_files,
            data_files: report.data_files,
        };

        const configReport = {
            bot_configs:  report.bot_configs,
            auto_configs: report.auto_configs,
        };

        const short = JSON.stringify(shortReport, null, 2);
        const full  = JSON.stringify(configReport, null, 2);

        // WhatsApp monospace block
        await sock.sendMessage(chatId, {
            text: `*🗄️ WOLFBOT — DB Check*\n\`\`\`\n${short}\n\`\`\``
        }, { quoted: msg });

        // Second message: full configs (may be long)
        await sock.sendMessage(chatId, {
            text: `*📋 Stored Configs*\n\`\`\`\n${full}\n\`\`\`\n\n_Use ${P}getsettings for a user-friendly overview_`
        }, { quoted: msg });
    }
};
