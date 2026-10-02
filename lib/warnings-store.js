import db from './database.js';

let warningsCache = {};
let limitsCache = {};

function getBotId() {
    return db.getConfigBotId();
}

export async function initWarnings() {
    if (!db.isAvailable()) return;
    try {
        const botId = getBotId();
        const warnings = await db.getAll('warnings', { bot_id: botId });
        if (warnings) {
            warningsCache = {};
            for (const row of warnings) {
                const key = `${row.group_id}:${row.user_id}`;
                warningsCache[key] = row.count || 0;
            }
        }

        const limits = await db.getAll('warning_limits', { bot_id: botId });
        if (limits) {
            limitsCache = {};
            for (const row of limits) {
                limitsCache[row.group_id] = row.max_warnings || 3;
            }
        }

        console.log(`✅ Warnings: Loaded ${Object.keys(warningsCache).length} warnings, ${Object.keys(limitsCache).length} limits from DB`);
    } catch (err) {
        console.error('⚠️ Warnings: Failed to load from DB:', err.message);
    }
}

export function getWarnLimit(groupJid) {
    return limitsCache[groupJid] || 3;
}

export async function getWarnLimitAsync(groupJid) {
    if (db.isAvailable()) {
        const botId = getBotId();
        const rows = await db.getAll('warning_limits', { group_id: groupJid, bot_id: botId });
        if (rows && rows.length > 0) return rows[0].max_warnings || 3;
    }
    return limitsCache[groupJid] || 3;
}

export function setWarnLimit(groupJid, limit) {
    limitsCache[groupJid] = limit;

    if (db.isAvailable()) {
        const botId = getBotId();
        db.upsert('warning_limits', {
            group_id: groupJid,
            bot_id: botId,
            max_warnings: limit,
            updated_at: new Date().toISOString()
        }, 'group_id,bot_id').catch(() => {});
    }
}

export function getWarnings(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;
    return warningsCache[key] || 0;
}

export async function getWarningsAsync(groupJid, userJid) {
    if (db.isAvailable()) {
        const botId = getBotId();
        const rows = await db.getAll('warnings', { group_id: groupJid, user_id: userJid, bot_id: botId });
        if (rows && rows.length > 0) return rows[0].count || 0;
    }
    return warningsCache[`${groupJid}:${userJid}`] || 0;
}

export function addWarning(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;
    warningsCache[key] = (warningsCache[key] || 0) + 1;

    if (db.isAvailable()) {
        const botId = getBotId();
        db.upsert('warnings', {
            group_id: groupJid,
            user_id: userJid,
            bot_id: botId,
            count: warningsCache[key],
            updated_at: new Date().toISOString()
        }, 'group_id,user_id,bot_id').catch(() => {});

        // Mirror to PostgreSQL async
        if (globalThis.pg?.isReady) {
            globalThis.pg.query(
                `INSERT INTO warnings (bot_id, chat_id, phone, count, updated_at) VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (bot_id, chat_id, phone) DO UPDATE SET count = excluded.count, updated_at = NOW()`,
                [botId, groupJid, userJid, warningsCache[key]]
            ).catch(() => {});
        }
    }

    return warningsCache[key];
}

export function resetWarnings(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;
    const had = warningsCache[key] > 0;
    delete warningsCache[key];

    if (db.isAvailable()) {
        const botId = getBotId();
        db.removeWhere('warnings', { group_id: groupJid, user_id: userJid, bot_id: botId }).catch(() => {});
    }

    return had;
}

export function resetAllGroupWarnings(groupJid) {
    let count = 0;
    for (const key of Object.keys(warningsCache)) {
        if (key.startsWith(groupJid + ':')) {
            delete warningsCache[key];
            count++;
        }
    }

    if (db.isAvailable()) {
        const botId = getBotId();
        db.removeWhere('warnings', { group_id: groupJid, bot_id: botId }).catch(() => {});
    }

    return count;
}

export function getGroupWarnings(groupJid) {
    const result = [];
    for (const [key, count] of Object.entries(warningsCache)) {
        if (key.startsWith(groupJid + ':')) {
            const userJid = key.split(':').slice(1).join(':');
            result.push({ userJid, count });
        }
    }
    return result;
}

export async function getGroupWarningsAsync(groupJid) {
    if (db.isAvailable()) {
        const botId = getBotId();
        const rows = await db.getAll('warnings', { group_id: groupJid, bot_id: botId });
        if (rows && rows.length > 0) {
            return rows.map(r => ({ userJid: r.user_id, count: r.count }));
        }
    }
    return getGroupWarnings(groupJid);
}

export async function getGlobalWarnLimit() {
    return await db.getConfig('global_warn_limit', 3);
}

export async function migrateWarningsToSupabase() {
    if (!db.isAvailable()) return false;
    try {
        const botId = getBotId();
        for (const [key, count] of Object.entries(warningsCache)) {
            const [groupJid, ...userParts] = key.split(':');
            const userJid = userParts.join(':');
            await db.upsert('warnings', {
                group_id: groupJid,
                user_id: userJid,
                bot_id: botId,
                count,
                updated_at: new Date().toISOString()
            }, 'group_id,user_id,bot_id');
        }

        for (const [groupJid, limit] of Object.entries(limitsCache)) {
            await db.upsert('warning_limits', {
                group_id: groupJid,
                bot_id: botId,
                max_warnings: limit,
                updated_at: new Date().toISOString()
            }, 'group_id,bot_id');
        }

        return true;
    } catch (err) {
        console.error('⚠️ Supabase: Warning migration error:', err.message);
        return false;
    }
}
