import fs from 'fs';
import path from 'path';
import { jidNormalizedUser } from 'wolfsocket';
import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const DATA_DIR = './data/antidemote';
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

(async () => {
    try {
        if (!fs.existsSync(CONFIG_FILE) && supabase.isAvailable()) {
            const dbData = await supabase.getConfig('antidemote_config');
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
        supabase.setConfig('antidemote_config', data).catch(() => {});
    } catch (err) {
        console.error('antidemote save error:', err.message);
    }
}

function cleanJid(jid) {
    if (!jid) return jid;
    try { return jidNormalizedUser(jid); } catch {}
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

export function getAntidemoteConfig(groupId) {
    const config = loadConfig();
    return config[groupId] || null;
}

const recentEvents = new Map();

function isDuplicate(groupId, action, participants) {
    const key = `${groupId}:${action}:${participants.sort().join(',')}`;
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
    action: 'warn',
    exemptSuperAdmins: true,
    warnings: {}
};

function resolveRealNumber(jid, groupMeta, sock) {
    if (!jid) return 'Unknown';

    const raw = jid.split('@')[0].split(':')[0];

    // Find full participant object in groupMeta
    const participant = groupMeta?.participants?.find(p =>
        cleanJid(p.id) === jid || cleanJid(p.lid || '') === jid
    );

    // 1. phoneNumber field on participant object
    if (participant?.phoneNumber) {
        const num = String(participant.phoneNumber).replace(/[^0-9]/g, '');
        if (num.length >= 7) return num;
    }

    // 2. Non-LID JID — number is directly in the JID
    if (!jid.includes('@lid')) {
        const num = raw.replace(/[^0-9]/g, '');
        if (num && num.length >= 7) return num;
    }

    const cache = globalThis.lidPhoneCache;

    // 3. lidPhoneCache lookup
    if (cache) {
        const cached = cache.get(raw) || cache.get(jid.split('@')[0]);
        if (cached) return cached;
    }

    // 4. sock.signalRepository.lidMapping (same as getparticipants.js)
    const lidToCheck = participant?.lid || (jid.includes('@lid') ? jid : null);
    if (lidToCheck) {
        try {
            if (sock?.signalRepository?.lidMapping?.getPNForLID) {
                const pn = sock.signalRepository.lidMapping.getPNForLID(lidToCheck);
                if (pn) {
                    const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                    if (num.length >= 7) {
                        if (cache) cache.set(raw, num);
                        return num;
                    }
                }
            }
        } catch {}
    }

    // 5. Cross-match LID in groupMeta participants
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

    return raw || 'Unknown';
}

function getContactName(jid, groupMeta, sock) {
    const num = resolveRealNumber(jid, groupMeta, sock);
    if (global.contactNames && global.contactNames instanceof Map) {
        return global.contactNames.get(num) || num;
    }
    return num;
}

export async function handleAntidemoteEvent(sock, update) {
    const { id: groupId, participants, action, author } = update;

    if (action !== 'demote') return;

    const log = globalThis.originalConsoleMethods?.log || console.log;

    log(`[ANTIDEMOTE] Demote event in ${groupId?.split('@')[0]} | author: ${author} | participants: ${JSON.stringify(participants)}`);

    const participantList = (participants || []).map(p => typeof p === 'string' ? p : '');
    if (isDuplicate(groupId, action, participantList)) {
        log(`[ANTIDEMOTE] Skipping duplicate demote event`);
        return;
    }

    const config = loadConfig();
    const groupConfig = config[groupId] || { ...DEFAULT_CONFIG };

    if (!groupConfig.enabled) {
        log(`[ANTIDEMOTE] Disabled for this group, skipping`);
        return;
    }

    const authorJid = author ? cleanJid(author) : null;
    const botJid = cleanJid(sock.user?.id);

    if (authorJid === botJid) return;

    let groupMeta;
    try {
        groupMeta = await sock.groupMetadata(groupId);
    } catch (err) {
        log(`[ANTIDEMOTE] Failed to get group metadata: ${err.message}`);
        return;
    }

    const authorParticipant = authorJid ? groupMeta.participants.find(p => cleanJid(p.id) === authorJid) : null;
    const isAuthorSuperAdmin = authorParticipant?.admin === 'superadmin';

    if (isAuthorSuperAdmin && groupConfig.exemptSuperAdmins) {
        log(`[ANTIDEMOTE] Superadmin exempt, skipping`);
        return;
    }

    const botParticipant = groupMeta.participants.find(p => cleanJid(p.id) === botJid);
    const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

    const authorNum = resolveRealNumber(authorJid, groupMeta, sock);
    const authorName = getContactName(authorJid, groupMeta, sock);
    const groupName = groupMeta.subject || groupId.split('@')[0];

    for (const participantJid of participants) {
        const targetJid = cleanJid(participantJid);
        const targetNum = resolveRealNumber(targetJid, groupMeta, sock);
        const targetName = getContactName(targetJid, groupMeta, sock);
        const timestamp = new Date().toLocaleString();

        if (!groupConfig.warnings) groupConfig.warnings = {};
        if (!groupConfig.warnings[authorJid]) groupConfig.warnings[authorJid] = 0;
        groupConfig.warnings[authorJid]++;
        const warnCount = groupConfig.warnings[authorJid];

        const detailBlock = `🛡️ *ANTI-DEMOTE TRIGGERED*\n\n` +
            `📋 *Event Details:*\n` +
            `• *Action:* Admin Demotion\n` +
            `• *Demoter:* ${authorName} (@${authorNum})\n` +
            `• *Demoted:* ${targetName} (@${targetNum})\n` +
            `• *Group:* ${groupName}\n` +
            `• *Time:* ${timestamp}\n` +
            `• *Warning:* #${warnCount}\n`;

        if (groupConfig.action === 'revert' && botIsAdmin) {
            try {
                await sock.groupParticipantsUpdate(groupId, [targetJid], 'promote');
                await sock.sendMessage(groupId, {
                    text: detailBlock +
                        `\n✅ *Action Taken:* Role restored\n` +
                        `@${targetNum} has been re-promoted to admin.\n` +
                        `⚠️ @${authorNum}, demoting admins is not allowed!`,
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
                await sock.groupParticipantsUpdate(groupId, [targetJid], 'promote');
            } catch {}

            if (authorParticipant?.admin) {
                await sock.sendMessage(groupId, {
                    text: detailBlock +
                        `\n✅ @${targetNum} re-promoted to admin\n` +
                        `⚠️ Cannot kick @${authorNum} (is admin)`,
                    mentions: [authorJid, targetJid]
                });
            } else {
                try {
                    await sock.groupParticipantsUpdate(groupId, [authorJid], 'remove');
                    await sock.sendMessage(groupId, {
                        text: detailBlock +
                            `\n⚡ *Action Taken:*\n` +
                            `• @${targetNum} re-promoted to admin ✅\n` +
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
        } else {
            await sock.sendMessage(groupId, {
                text: detailBlock +
                    `\n⚠️ @${authorNum}, demoting admins is not allowed in this group!\n` +
                    `_This is warning #${warnCount}_`,
                mentions: [authorJid, targetJid]
            });
        }
    }

    config[groupId] = groupConfig;
    saveConfig(config);
}

export async function handleGroupParticipantUpdate(sock, update) {
    const { action } = update;
    if (action === 'demote') {
        await handleAntidemoteEvent(sock, update);
    }
    if (action === 'promote') {
        const { handleAntipromoteEvent } = await import('./antipromote.js');
        await handleAntipromoteEvent(sock, update);
    }
}

export default {
    name: 'antidemote',
    alias: ['antidm'],
    description: 'Protect admins from being demoted',
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
            const action = (args[1] || 'warn').toLowerCase();
            if (!['warn', 'kick', 'revert'].includes(action)) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🛡️ *ANTI-DEMOTE SETUP* ⌋\n│\n├─⊷ *${PREFIX}antidemote on warn*\n│  └⊷ Warn on demotion\n├─⊷ *${PREFIX}antidemote on kick*\n│  └⊷ Kick offender + restore\n├─⊷ *${PREFIX}antidemote on revert*\n│  └⊷ Restore admin role\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            if (!botIsAdmin && action !== 'warn') {
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
                warn: 'Warnings sent when admins are demoted',
                kick: 'Offender removed + admin role restored',
                revert: 'Demoted admin role automatically restored'
            };

            await sock.sendMessage(chatId, {
                text: `✅ *Anti-Demote Enabled*\n\nAction: *${action.toUpperCase()}*\n${descriptions[action]}\n\nTo disable: \`${PREFIX}antidemote off\``
            }, { quoted: msg });

        } else if (sub === 'off') {
            config[chatId] = { ...(config[chatId] || DEFAULT_CONFIG), enabled: false };
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '❌ *Anti-Demote Disabled*\nAdmins can now be demoted without protection.'
            }, { quoted: msg });

        } else if (sub === 'mode') {
            const action = (args[1] || '').toLowerCase();
            if (!['warn', 'kick', 'revert'].includes(action)) {
                const current = config[chatId]?.action || 'warn';
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🛡️ *ANTI-DEMOTE MODE* ⌋\n│\n├─⊷ *${PREFIX}antidemote mode warn*\n│  └⊷ Warning only\n├─⊷ *${PREFIX}antidemote mode kick*\n│  └⊷ Kick offender + restore\n├─⊷ *${PREFIX}antidemote mode revert*\n│  └⊷ Restore admin role\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            if (!config[chatId]) config[chatId] = { ...DEFAULT_CONFIG };
            config[chatId].action = action;
            config[chatId].enabled = true;
            saveConfig(config);

            await sock.sendMessage(chatId, {
                text: `✅ *Anti-Demote mode set to ${action.toUpperCase()}*`
            }, { quoted: msg });

        } else if (sub === 'status') {
            const gc = config[chatId];
            const isOn = !gc || gc.enabled !== false;
            const action = gc?.action || 'warn';

            let text = `🛡️ *Anti-Demote Status*\n\n`;
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
            text += `\n💡 _Enabled by default in all groups_`;

            await sock.sendMessage(chatId, { text }, { quoted: msg });

        } else if (sub === 'resetwarns') {
            if (!config[chatId]) config[chatId] = { ...DEFAULT_CONFIG };
            config[chatId].warnings = {};
            saveConfig(config);
            await sock.sendMessage(chatId, { text: '✅ All warning counts reset.' }, { quoted: msg });

        } else {
            const gc = config[chatId];
            const isOn = !gc || gc.enabled !== false;
            const action = gc?.action || 'warn';

            await sock.sendMessage(chatId, {
                text: `╭─⌈ 🛡️ *ANTI-DEMOTE* ⌋\n│\n├─⊷ *${PREFIX}antidemote on [warn|kick|revert]*\n│  └⊷ Enable with mode\n├─⊷ *${PREFIX}antidemote off*\n│  └⊷ Disable protection\n├─⊷ *${PREFIX}antidemote mode <warn|kick|revert>*\n│  └⊷ Change mode\n├─⊷ *${PREFIX}antidemote status*\n│  └⊷ View full status\n├─⊷ *${PREFIX}antidemote resetwarns*\n│  └⊷ Clear warnings\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }
    }
};
