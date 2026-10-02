import fs from 'fs';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const DATA_FILE = './data/antigroupstatus.json';

function loadSettings() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveSettings(data) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        globalThis._printSystemBox?.({ tag: 'ANTI-GROUP STATUS', color: 'red', icon: '❌', message: 'Save error', fields: { Error: e.message } });
    }
}

function cleanJid(jid) {
    if (!jid) return jid;
    return jid.split(':')[0] + (jid.includes('@') ? '@' + jid.split('@')[1] : '@s.whatsapp.net');
}

function isGroupStatusMessage(msg) {
    const message = msg?.message;
    if (!message) return false;

    const keys = Object.keys(message);

    // Direct group status message types
    if (
        message.groupStatusMessageV2 ||
        message.groupMentionedMessage ||
        message.statusMentionMessage ||
        message.groupStatusMessage
    ) return true;

    // Key name contains groupStatus
    if (keys.some(k => k.toLowerCase().includes('groupstatus') || k.toLowerCase().includes('statusmention'))) return true;

    // Forwarded from a status (classic method)
    const ctx = message.extendedTextMessage?.contextInfo
             || message.imageMessage?.contextInfo
             || message.videoMessage?.contextInfo
             || message.documentMessage?.contextInfo
             || message.audioMessage?.contextInfo;

    if (ctx?.isForwarded && ctx?.forwardingScore > 0 && ctx?.stanzaId?.startsWith('status')) return true;

    // WhatsApp group status posts often arrive with a pinned or special attribute
    if (msg.messageStubType === 74 || msg.messageStubType === 75) return true; // GROUP_STATUS_MESSAGE stubs

    return false;
}

let listenerAttached = false;

export function setupAntiGroupStatusListener(sock) {
    if (listenerAttached) return;
    listenerAttached = true;

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg?.key?.remoteJid?.endsWith('@g.us')) continue;
            if (msg.key.fromMe) continue;
            if (!isGroupStatusMessage(msg)) continue;

            const chatId = msg.key.remoteJid;
            const settings = loadSettings();
            const gs = settings[chatId];
            if (!gs?.enabled) continue;

            const senderJid   = msg.key.participant || msg.key.remoteJid;
            const cleanSender = cleanJid(senderJid);
            const senderNum   = cleanSender.split('@')[0];

            try {
                const meta = await sock.groupMetadata(chatId);

                const senderParticipant = meta.participants.find(p => cleanJid(p.id) === cleanSender);
                const senderIsAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
                if (senderIsAdmin && gs.exemptAdmins !== false) continue;

                const botJid        = cleanJid(sock.user?.id);
                const botParticipant = meta.participants.find(p => cleanJid(p.id) === botJid);
                const botIsAdmin    = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

                if (!gs.warnings) gs.warnings = {};
                if (!gs.warnings[cleanSender]) gs.warnings[cleanSender] = 0;

                switch (gs.mode) {
                    case 'warn': {
                        gs.warnings[cleanSender]++;
                        settings[chatId] = gs;
                        saveSettings(settings);
                        await sock.sendMessage(chatId, {
                            text: `⚠️ *Anti-Group Status* @${senderNum}\n\nPosting to group status is not allowed!\n📛 Warning *${gs.warnings[cleanSender]}*`,
                            mentions: [cleanSender]
                        });
                        break;
                    }
                    case 'delete': {
                        if (botIsAdmin) {
                            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}
                        }
                        await sock.sendMessage(chatId, {
                            text: `🚫 *Anti-Group Status* @${senderNum}\n\nGroup status posts are not allowed here. Message removed.`,
                            mentions: [cleanSender]
                        });
                        break;
                    }
                    case 'kick': {
                        if (botIsAdmin) {
                            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}
                            await sock.sendMessage(chatId, {
                                text: `🚫 *Anti-Group Status* @${senderNum}\n\nGroup status posts are not allowed. You have been removed.`,
                                mentions: [cleanSender]
                            });
                            try { await sock.groupParticipantsUpdate(chatId, [cleanSender], 'remove'); } catch {}
                        } else {
                            await sock.sendMessage(chatId, {
                                text: `⚠️ *Anti-Group Status* @${senderNum}\n\nGroup status posts are not allowed!\n_(Make me admin to enable auto-kick)_`,
                                mentions: [cleanSender]
                            });
                        }
                        break;
                    }
                }
            } catch (e) {
                globalThis._printSystemBox?.({ tag: 'ANTI-GROUP STATUS', color: 'red', icon: '❌', message: 'Listener error', fields: { Error: e.message } });
            }
        }
    });
}

export default {
    name: 'antigroupstatus',
    aliases: ['antigs', 'antigrpstatus', 'nogrpstatus'],
    description: 'Prevent members from posting to group status (warn/delete/kick)',
    category: 'group',
    adminOnly: true,

    async execute(sock, m, args, PREFIX, extras) {
        const chatId  = m.key.remoteJid;
        const reply   = (text) => sock.sendMessage(chatId, { text }, { quoted: m });
        const isOwner = extras?.jidManager?.isOwner(m) || false;

        if (!chatId.endsWith('@g.us')) return reply('❌ This command only works in groups!');

        const senderJid   = m.key.participant || m.key.remoteJid;
        const cleanSender = cleanJid(senderJid);

        let isAdmin = false;
        let botIsAdmin = false;

        try {
            const meta  = await sock.groupMetadata(chatId);
            const senderP = meta.participants.find(p => cleanJid(p.id) === cleanSender);
            isAdmin     = isOwner || senderP?.admin === 'admin' || senderP?.admin === 'superadmin';
            const botJid = cleanJid(sock.user?.id);
            const botP   = meta.participants.find(p => cleanJid(p.id) === botJid);
            botIsAdmin   = botP?.admin === 'admin' || botP?.admin === 'superadmin';
        } catch {
            return reply('❌ Could not verify group info.');
        }

        if (!isAdmin) return reply('❌ Only group admins can use this command!');

        const settings = loadSettings();
        const gs  = settings[chatId] || {};
        const sub = args[0]?.toLowerCase();

        if (sub === 'on') {
            const mode = args[1]?.toLowerCase();
            if (!mode || !['warn', 'delete', 'kick'].includes(mode)) {
                return reply(
                    `╭─⌈ 🚫 *ANTI-GROUP STATUS* ⌋\n│\n` +
                    `├─⊷ *${PREFIX}antigroupstatus on warn*\n│  └⊷ Warn users who post\n` +
                    `├─⊷ *${PREFIX}antigroupstatus on delete*\n│  └⊷ Auto-delete their post\n` +
                    `├─⊷ *${PREFIX}antigroupstatus on kick*\n│  └⊷ Remove them from group\n│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                );
            }

            if ((mode === 'delete' || mode === 'kick') && !botIsAdmin) {
                await reply(`⚠️ Make me a group admin for *${mode}* mode to work!`);
            }

            settings[chatId] = {
                ...gs,
                enabled:      true,
                mode,
                exemptAdmins: gs.exemptAdmins !== false,
                warnings:     gs.warnings || {}
            };
            saveSettings(settings);
            setupAntiGroupStatusListener(sock);

            await reply(
                `✅ *Anti-Group Status enabled!*\n\n` +
                `Mode: *${mode.toUpperCase()}*\n` +
                `Admins exempt: *${settings[chatId].exemptAdmins ? 'Yes' : 'No'}*`
            );

        } else if (sub === 'off') {
            settings[chatId] = { ...gs, enabled: false };
            saveSettings(settings);
            await reply('❌ *Anti-Group Status disabled.*');

        } else if (sub === 'exemptadmins') {
            const toggle = args[1]?.toLowerCase();
            if (toggle === 'on') {
                settings[chatId] = { ...gs, exemptAdmins: true };
                saveSettings(settings);
                await reply('✅ Admins are now *exempt* from anti-group status.');
            } else if (toggle === 'off') {
                settings[chatId] = { ...gs, exemptAdmins: false };
                saveSettings(settings);
                await reply('✅ Admins are now *subject* to anti-group status rules.');
            } else {
                await reply(`⚙️ *Admin Exemption:* ${gs.exemptAdmins !== false ? 'ON' : 'OFF'}\n\nChange: *${PREFIX}antigroupstatus exemptadmins on/off*`);
            }

        } else if (sub === 'reset') {
            settings[chatId] = { ...gs, warnings: {} };
            saveSettings(settings);
            await reply('🔄 All warning counts reset.');

        } else if (sub === 'status') {
            if (gs.enabled) {
                await reply(
                    `📊 *Anti-Group Status*\n\n` +
                    `• Status: ✅ ENABLED\n` +
                    `• Mode: *${(gs.mode || 'warn').toUpperCase()}*\n` +
                    `• Admins exempt: *${gs.exemptAdmins !== false ? 'Yes' : 'No'}*\n` +
                    `• Bot admin: ${botIsAdmin ? '✅' : '❌'}\n` +
                    `• Users warned: *${Object.keys(gs.warnings || {}).length}*`
                );
            } else {
                await reply(`📊 *Anti-Group Status:* ❌ DISABLED\n\nEnable: *${PREFIX}antigroupstatus on <warn|delete|kick>*`);
            }

        } else {
            await reply(
                `╭─⌈ 🚫 *ANTI-GROUP STATUS* ⌋\n│\n` +
                `├─⊷ *${PREFIX}antigroupstatus on warn*\n│  └⊷ Warn users who post\n` +
                `├─⊷ *${PREFIX}antigroupstatus on delete*\n│  └⊷ Auto-delete posts\n` +
                `├─⊷ *${PREFIX}antigroupstatus on kick*\n│  └⊷ Remove poster\n` +
                `├─⊷ *${PREFIX}antigroupstatus off*\n│  └⊷ Disable\n` +
                `├─⊷ *${PREFIX}antigroupstatus exemptadmins on/off*\n│  └⊷ Toggle admin exemption\n` +
                `├─⊷ *${PREFIX}antigroupstatus reset*\n│  └⊷ Clear warning counts\n` +
                `├─⊷ *${PREFIX}antigroupstatus status*\n│  └⊷ View settings\n│\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            );
        }
    }
};
