import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configFile = path.join(__dirname, '../../data/antichat/config.json');

function ensureDir() {
    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadConfig() {
    try {
        if (fs.existsSync(configFile)) return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch {}
    return {};
}

function saveConfig(data) {
    ensureDir();
    fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
}

function cleanJid(jid) {
    if (!jid) return jid;
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

export function isAntiChatEnabled(groupJid) {
    return loadConfig()[groupJid]?.enabled || false;
}

// ── Auto-enforcement handler (wired in index.js) ─────────────────────────────
// When antichat is ON: any non-admin message is acted upon
export async function handleAntiChat(sock, msg) {
    try {
        if (!msg.message || msg.key?.fromMe) return;

        const chatJid = msg.key.remoteJid;
        if (!chatJid?.endsWith('@g.us')) return;

        const config = loadConfig();
        const gc = config[chatJid];
        if (!gc?.enabled) return;

        const senderJid = cleanJid(msg.key.participant || chatJid);
        const userName  = senderJid.split('@')[0];
        const action    = gc.action || 'delete';

        // Fetch metadata to check if sender is admin — admins are always exempt
        try {
            const metadata = await sock.groupMetadata(chatJid);
            const member   = metadata.participants.find(p => cleanJid(p.id) === senderJid);
            const isAdmin  = member?.admin === 'admin' || member?.admin === 'superadmin';
            if (isAdmin) return;
        } catch { return; }

        // Delete the message
        try { await sock.sendMessage(chatJid, { delete: msg.key }); } catch {}

        switch (action) {
            case 'delete': {
                await sock.sendMessage(chatJid, {
                    text: `🚫 @${userName}, chatting is disabled in this group.`,
                    mentions: [senderJid]
                });
                break;
            }
            case 'warn': {
                if (!gc.warnings) gc.warnings = {};
                gc.warnings[senderJid] = (gc.warnings[senderJid] || 0) + 1;
                config[chatJid] = gc;
                saveConfig(config);
                await sock.sendMessage(chatJid, {
                    text: `⚠️ @${userName}, chatting is not allowed here. Warning *${gc.warnings[senderJid]}*.`,
                    mentions: [senderJid]
                });
                break;
            }
            case 'kick': {
                try {
                    await sock.sendMessage(chatJid, {
                        text: `🚨 @${userName} has been removed for chatting while antichat is active.`,
                        mentions: [senderJid]
                    });
                    await sock.groupParticipantsUpdate(chatJid, [senderJid], 'remove');
                } catch {
                    await sock.sendMessage(chatJid, {
                        text: `❌ Failed to remove @${userName}. Make sure I have admin permissions.`,
                        mentions: [senderJid]
                    });
                }
                break;
            }
        }
    } catch (err) {
        console.error('[ANTICHAT] Handler error:', err.message);
    }
}

// ── Command ──────────────────────────────────────────────────────────────────
export default {
    name:        'antichat',
    alias:       ['nochat', 'chatblock', 'lockgroup'],
    description: 'Prevent non-admins from chatting in the group — delete, warn, or kick',
    category:    'group',
    groupOnly:   true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const owner  = getOwnerName().toUpperCase();
        const { jidManager } = extra;

        try {
            const groupMeta = await sock.groupMetadata(chatId);
            const sender    = cleanJid(msg.key.participant || chatId);
            const member    = groupMeta.participants.find(p => cleanJid(p.id) === sender);
            const isAdmin   = member?.admin === 'admin' || member?.admin === 'superadmin';
            if (!isAdmin && !jidManager.isOwner(msg)) {
                return sock.sendMessage(chatId, { text: '❌ *Admin Only Command*' }, { quoted: msg });
            }
        } catch {
            return sock.sendMessage(chatId, { text: '❌ Failed to check permissions.' }, { quoted: msg });
        }

        const config = loadConfig();
        const sub    = (args[0] || '').toLowerCase();

        // ── Default: brief menu ───────────────────────────────────────────────
        if (!sub) {
            const gc     = config[chatId];
            const status = gc?.enabled ? `✅ ON (${(gc.action || 'delete').toUpperCase()})` : '❌ OFF';
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 💬 *ANTI-CHAT* ⌋\n` +
                    `├⊷ Status: ${status}\n` +
                    `\n` +
                    `├⊷ antichat on\n` +
                    `├⊷ antichat off\n` +
                    `├⊷ antichat action delete/warn/kick\n` +
                    `├⊷ antichat status\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'on' || sub === 'enable') {
            config[chatId] = {
                ...config[chatId],
                enabled:  true,
                action:   config[chatId]?.action || 'delete',
                warnings: config[chatId]?.warnings || {}
            };
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `🔒 *Anti-Chat ON* — Action: *${config[chatId].action.toUpperCase()}*\nNon-admins cannot send messages.`
            }, { quoted: msg });
        }

        if (sub === 'off' || sub === 'disable') {
            config[chatId] = { ...config[chatId], enabled: false };
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: '🔓 *Anti-Chat OFF*\nMembers can chat freely.'
            }, { quoted: msg });
        }

        if (sub === 'action') {
            const action = args[1]?.toLowerCase();
            if (!['delete', 'warn', 'kick'].includes(action)) {
                return sock.sendMessage(chatId, {
                    text: `❌ Specify action: *delete*, *warn*, or *kick*\nExample: ${PREFIX}antichat action warn`
                }, { quoted: msg });
            }
            config[chatId] = { ...config[chatId], action };
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `✅ *Action set to: ${action.toUpperCase()}*`
            }, { quoted: msg });
        }

        if (sub === 'status' || sub === 'settings') {
            const gc     = config[chatId];
            const status = gc?.enabled ? '✅ ON' : '❌ OFF';
            return sock.sendMessage(chatId, {
                text:
                    `📊 *ANTI-CHAT STATUS*\n\n` +
                    `Enabled: ${status}\n` +
                    `Action : ${(gc?.action || 'delete').toUpperCase()}`
            }, { quoted: msg });
        }

        return sock.sendMessage(chatId, {
            text: `❌ Unknown option. Use \`${PREFIX}antichat\` to see commands.`
        }, { quoted: msg });
    }
};
