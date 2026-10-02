import fs from 'fs';
import path from 'path';
import { jidNormalizedUser } from 'wolfsocket';
import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const DATA_DIR = './data/antipromote';
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

(async () => {
    try {
        if (!fs.existsSync(CONFIG_FILE) && supabase.isAvailable()) {
            const dbData = await supabase.getConfig('antipromote_config');
            if (dbData && Object.keys(dbData).length > 0) {
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(dbData, null, 2));
            }
        }
    } catch {}
})();

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveConfig(data) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
        supabase.setConfig('antipromote_config', data).catch(() => {});
    } catch (err) {
        console.error('antipromote save error:', err.message);
    }
}

function cleanJid(jid) {
    if (!jid) return jid;
    try { return jidNormalizedUser(jid); } catch {}
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

function resolveRealNumber(jid, groupMeta) {
    if (!jid) return 'Unknown';
    const raw = jid.split('@')[0].split(':')[0];
    if (!jid.includes('@lid')) return raw;
    const cache = globalThis.lidPhoneCache;
    if (cache) {
        const cached = cache.get(raw) || cache.get(jid.split('@')[0]);
        if (cached) return cached;
    }
    if (groupMeta?.participants) {
        for (const p of groupMeta.participants) {
            const pid = p.id || '';
            const plid = p.lid || '';
            const plidNum = plid.split('@')[0].split(':')[0];
            const pidNum = pid.split('@')[0].split(':')[0];
            if (plidNum === raw || pidNum === raw) {
                if (pid && !pid.includes('@lid')) {
                    const phone = pid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    if (phone.length >= 7) {
                        if (cache) cache.set(raw, phone);
                        return phone;
                    }
                }
                if (p.phoneNumber) {
                    const phone = String(p.phoneNumber).replace(/[^0-9]/g, '');
                    if (phone.length >= 7) {
                        if (cache) cache.set(raw, phone);
                        return phone;
                    }
                }
            }
        }
    }
    return raw;
}

function getContactName(jid, groupMeta) {
    const num = resolveRealNumber(jid, groupMeta);
    if (global.contactNames && global.contactNames instanceof Map) {
        return global.contactNames.get(num) || num;
    }
    return num;
}

const recentEvents = new Map();

function isDuplicate(groupId, participants) {
    const key = `${groupId}:promote:${participants.sort().join(',')}`;
    const now = Date.now();
    if (recentEvents.has(key) && (now - recentEvents.get(key)) < 10000) {
        return true;
    }
    recentEvents.set(key, now);
    if (recentEvents.size > 50) {
        const oldest = [...recentEvents.entries()].sort((a, b) => a[1] - b[1])[0];
        if (oldest) recentEvents.delete(oldest[0]);
    }
    return false;
}

const DEFAULT_CONFIG = {
    enabled: false,
    action: 'notify',
    exemptSuperAdmins: true,
    warnings: {}
};

export async function handleAntipromoteEvent(sock, update) {
    const { id: groupId, participants, action, author } = update;

    if (action !== 'promote') return;

    const log = globalThis.originalConsoleMethods?.log || console.log;

    log(`[ANTIPROMOTE] Promote event in ${groupId?.split('@')[0]} | author: ${author} | participants: ${JSON.stringify(participants)}`);

    const participantList = (participants || []).map(p => typeof p === 'string' ? p : '');
    if (isDuplicate(groupId, participantList)) {
        log(`[ANTIPROMOTE] Skipping duplicate promote event`);
        return;
    }

    const config = loadConfig();
    const groupConfig = config[groupId] || { ...DEFAULT_CONFIG };

    if (groupConfig.enabled === false) {
        log(`[ANTIPROMOTE] Disabled for this group, skipping`);
        return;
    }

    const authorJid = author ? cleanJid(author) : null;
    const botJid = cleanJid(sock.user?.id);

    if (authorJid === botJid) return;

    let groupMeta;
    try {
        groupMeta = await sock.groupMetadata(groupId);
    } catch (err) {
        log(`[ANTIPROMOTE] Failed to get group metadata: ${err.message}`);
        return;
    }

    const authorParticipant = authorJid ? groupMeta.participants.find(p => cleanJid(p.id) === authorJid) : null;
    const isAuthorSuperAdmin = authorParticipant?.admin === 'superadmin';

    if (isAuthorSuperAdmin && groupConfig.exemptSuperAdmins) {
        log(`[ANTIPROMOTE] Superadmin exempt, skipping`);
        return;
    }

    const botParticipant = groupMeta.participants.find(p => cleanJid(p.id) === botJid);
    const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

    const authorNum = resolveRealNumber(authorJid, groupMeta);
    const authorName = getContactName(authorJid, groupMeta);
    const groupName = groupMeta.subject || groupId.split('@')[0];

    for (const participantJid of participants) {
        const targetJid = cleanJid(participantJid);
        const targetNum = resolveRealNumber(targetJid, groupMeta);
        const targetName = getContactName(targetJid, groupMeta);
        const timestamp = new Date().toLocaleString();

        const detailBlock = `📢 *ANTI-PROMOTE TRIGGERED*\n\n` +
            `📋 *Event Details:*\n` +
            `• *Action:* Admin Promotion\n` +
            `• *Promoter:* ${authorName} (@${authorNum})\n` +
            `• *Promoted:* ${targetName} (@${targetNum})\n` +
            `• *Group:* ${groupName}\n` +
            `• *Time:* ${timestamp}\n`;

        if (groupConfig.action === 'revert' && botIsAdmin) {
            try {
                await sock.groupParticipantsUpdate(groupId, [targetJid], 'demote');
                await sock.sendMessage(groupId, {
                    text: detailBlock +
                        `\n✅ *Action Taken:* Promotion reversed\n` +
                        `@${targetNum} has been demoted back.\n` +
                        `⚠️ @${authorNum}, unauthorized promotions are not allowed!`,
                    mentions: [authorJid, targetJid]
                });
            } catch (err) {
                await sock.sendMessage(groupId, {
                    text: detailBlock +
                        `\n❌ *Could not revert:* ${err.message}`,
                    mentions: [authorJid, targetJid]
                });
            }
        } else if (groupConfig.action === 'kick' && botIsAdmin) {
            try {
                await sock.groupParticipantsUpdate(groupId, [targetJid], 'demote');
            } catch {}

            if (authorParticipant?.admin === 'superadmin') {
                await sock.sendMessage(groupId, {
                    text: detailBlock +
                        `\n✅ @${targetNum} demoted back\n` +
                        `⚠️ Cannot kick @${authorNum} (is superadmin)`,
                    mentions: [authorJid, targetJid]
                });
            } else {
                try {
                    if (authorParticipant?.admin) {
                        await sock.groupParticipantsUpdate(groupId, [authorJid], 'demote');
                    }
                    await sock.groupParticipantsUpdate(groupId, [authorJid], 'remove');
                    await sock.sendMessage(groupId, {
                        text: detailBlock +
                            `\n⚡ *Action Taken:*\n` +
                            `• @${targetNum} demoted back ✅\n` +
                            `• @${authorNum} removed from group ❌`,
                        mentions: [authorJid, targetJid]
                    });
                } catch (err) {
                    await sock.sendMessage(groupId, {
                        text: detailBlock +
                            `\n❌ *Could not kick offender:* ${err.message}`,
                        mentions: [authorJid, targetJid]
                    });
                }
            }
        } else if (groupConfig.action === 'warn') {
            if (!groupConfig.warnings) groupConfig.warnings = {};
            if (!groupConfig.warnings[authorJid]) groupConfig.warnings[authorJid] = 0;
            groupConfig.warnings[authorJid]++;
            const warnCount = groupConfig.warnings[authorJid];

            await sock.sendMessage(groupId, {
                text: detailBlock +
                    `\n⚠️ @${authorNum}, unauthorized promotions are not allowed!\n` +
                    `_This is warning #${warnCount}_`,
                mentions: [authorJid, targetJid]
            });
        } else {
            await sock.sendMessage(groupId, {
                text: detailBlock,
                mentions: [authorJid, targetJid]
            });
        }
    }

    config[groupId] = groupConfig;
    saveConfig(config);
}

export default {
    name: 'antipromote',
    alias: ['antipm'],
    description: 'Control and monitor admin promotions in groups',
    category: 'group',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: msg });
        }

        let sender = msg.key.participant || msg.key.remoteJid;
        sender = cleanJid(sender);

        let groupMeta;
        try {
            groupMeta = await sock.groupMetadata(chatId);
        } catch {
            return sock.sendMessage(chatId, { text: '❌ Failed to fetch group info.' }, { quoted: msg });
        }

        const senderP = groupMeta.participants.find(p => cleanJid(p.id) === sender);
        const isAdmin = senderP?.admin === 'admin' || senderP?.admin === 'superadmin';
        const isOwner = extra?.jidManager?.isOwner(msg);

        if (!isAdmin && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Admin only command.' }, { quoted: msg });
        }

        const botJid = cleanJid(sock.user?.id);
        const botP = groupMeta.participants.find(p => cleanJid(p.id) === botJid);
        const botIsAdmin = botP?.admin === 'admin' || botP?.admin === 'superadmin';

        const config = loadConfig();
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on') {
            const action = (args[1] || 'notify').toLowerCase();
            if (!['notify', 'warn', 'kick', 'revert'].includes(action)) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 📢 *ANTI-PROMOTE SETUP* ⌋\n│\n├─⊷ *${PREFIX}antipromote on notify*\n│  └⊷ Notify on promotion\n├─⊷ *${PREFIX}antipromote on warn*\n│  └⊷ Warn the promoter\n├─⊷ *${PREFIX}antipromote on kick*\n│  └⊷ Demote + kick promoter\n├─⊷ *${PREFIX}antipromote on revert*\n│  └⊷ Demote promoted user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            if (!botIsAdmin && (action === 'kick' || action === 'revert')) {
                await sock.sendMessage(chatId, {
                    text: '⚠️ I need admin permissions for kick/revert actions to work!'
                }, { quoted: msg });
            }

            config[chatId] = {
                enabled: true,
                action: action,
                exemptSuperAdmins: true,
                warnings: config[chatId]?.warnings || {}
            };
            saveConfig(config);

            const descriptions = {
                notify: 'Notifications sent when someone is promoted',
                warn: 'Warning sent to the promoter',
                kick: 'Promoted user demoted + promoter removed',
                revert: 'Promoted user automatically demoted back'
            };

            await sock.sendMessage(chatId, {
                text: `✅ *Anti-Promote Enabled*\n\nAction: *${action.toUpperCase()}*\n${descriptions[action]}\n\nTo disable: \`${PREFIX}antipromote off\``
            }, { quoted: msg });

        } else if (sub === 'off') {
            config[chatId] = { ...(config[chatId] || DEFAULT_CONFIG), enabled: false };
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '❌ *Anti-Promote Disabled*\nPromotion monitoring is turned off.'
            }, { quoted: msg });

        } else if (sub === 'mode') {
            const action = (args[1] || '').toLowerCase();
            if (!['notify', 'warn', 'kick', 'revert'].includes(action)) {
                const current = config[chatId]?.action || 'notify';
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 📢 *ANTI-PROMOTE MODE* ⌋\n│\n├─⊷ *${PREFIX}antipromote mode notify*\n│  └⊷ Notification only\n├─⊷ *${PREFIX}antipromote mode warn*\n│  └⊷ Warn the promoter\n├─⊷ *${PREFIX}antipromote mode kick*\n│  └⊷ Demote + kick promoter\n├─⊷ *${PREFIX}antipromote mode revert*\n│  └⊷ Demote promoted user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            if (!config[chatId]) config[chatId] = { ...DEFAULT_CONFIG, enabled: true };
            config[chatId].action = action;
            config[chatId].enabled = true;
            saveConfig(config);

            await sock.sendMessage(chatId, {
                text: `✅ *Anti-Promote mode set to ${action.toUpperCase()}*`
            }, { quoted: msg });

        } else if (sub === 'status') {
            const gc = config[chatId];
            const isOn = gc?.enabled === true;
            const action = gc?.action || 'notify';

            let text = `📢 *Anti-Promote Status*\n\n`;
            text += `• Status: ${isOn ? '✅ ENABLED' : '❌ DISABLED'}\n`;
            text += `• Action: *${action.toUpperCase()}*\n`;
            text += `• Superadmins exempt: ${gc?.exemptSuperAdmins !== false ? 'Yes' : 'No'}\n`;
            text += `• Bot is admin: ${botIsAdmin ? '✅' : '❌'}\n`;

            const warnCount = Object.keys(gc?.warnings || {}).length;
            if (warnCount > 0) {
                const totalW = Object.values(gc.warnings).reduce((a, b) => a + b, 0);
                text += `\n• Warned users: ${warnCount}\n`;
                text += `• Total warnings: ${totalW}`;
            }

            text += `\n\n*Detection:* Real-time WhatsApp group events`;
            text += `\n💡 _Disabled by default. Enable with_ \`${PREFIX}antipromote on\``;

            await sock.sendMessage(chatId, { text }, { quoted: msg });

        } else if (sub === 'resetwarns') {
            if (!config[chatId]) config[chatId] = { ...DEFAULT_CONFIG };
            config[chatId].warnings = {};
            saveConfig(config);
            await sock.sendMessage(chatId, { text: '✅ All anti-promote warning counts reset.' }, { quoted: msg });

        } else {
            const gc = config[chatId];
            const isOn = gc?.enabled === true;
            const action = gc?.action || 'notify';

            await sock.sendMessage(chatId, {
                text: `╭─⌈ 📢 *ANTI-PROMOTE* ⌋\n│\n├─⊷ *${PREFIX}antipromote on [notify|warn|kick|revert]*\n│  └⊷ Enable with mode\n├─⊷ *${PREFIX}antipromote off*\n│  └⊷ Disable protection\n├─⊷ *${PREFIX}antipromote mode <notify|warn|kick|revert>*\n│  └⊷ Change mode\n├─⊷ *${PREFIX}antipromote status*\n│  └⊷ View status\n├─⊷ *${PREFIX}antipromote resetwarns*\n│  └⊷ Clear warnings\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }
    }
};
