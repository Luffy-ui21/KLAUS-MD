import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const BRAND = () => getOwnerName().toUpperCase();

// ─── Config helpers (mirror antibot.js pattern) ──────────────────────────────
function loadConfig() {
    if (typeof globalThis._antidispConfig === 'object' && globalThis._antidispConfig !== null) {
        return globalThis._antidispConfig;
    }
    return { enabled: false };
}

function saveConfig(data) {
    globalThis._antidispConfig = data;
    if (typeof globalThis._saveAntidispConfig === 'function') {
        globalThis._saveAntidispConfig(data);
    }
}

export function isEnabled() {
    return loadConfig().enabled === true;
}

// ─── Reversal logic ──────────────────────────────────────────────────────────
// Called by the messages.upsert hook in index.js whenever a chat toggles
// disappearing messages. Silently turns it back off in that chat.
export async function handleEphemeralChange(sock, chatJid, newDuration, changedByJid, fromMe = false) {
    if (!isEnabled()) return;
    if (!chatJid || !sock) return;
    if (!newDuration || newDuration === 0) return; // already off → nothing to do

    // Authoritative self-check — never reverse a change the bot itself made
    if (fromMe === true) return;

    const isGroup = chatJid.endsWith('@g.us');
    const isDM = chatJid.endsWith('@s.whatsapp.net') || chatJid.endsWith('@lid');
    if (!isGroup && !isDM) return;

    // Secondary self-check by JID (covers groups where fromMe may be unset on stub messages)
    try {
        const botPn = sock.user?.id?.split(':')[0]?.split('@')[0];
        const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
        const changerNum = (changedByJid || '').split('@')[0].split(':')[0];
        if (changerNum && (changerNum === botPn || changerNum === botLid)) return;
    } catch {}

    try {
        if (isGroup) {
            // Need admin rights to toggle group ephemeral
            let botIsAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatJid);
                const botPn = sock.user?.id?.split(':')[0]?.split('@')[0];
                const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
                botIsAdmin = meta.participants.some(p => {
                    const pn = (p.id || '').split(':')[0].split('@')[0];
                    const pLid = (p.lid || '').split(':')[0].split('@')[0];
                    const isBot = (botPn && (pn === botPn || pLid === botPn))
                               || (botLid && (pn === botLid || pLid === botLid));
                    return isBot && (p.admin === 'admin' || p.admin === 'superadmin');
                });
            } catch {}

            if (!botIsAdmin) {
                console.log(`[ANTIDISP] ⚠️  Cannot reverse — bot is not admin in ${chatJid}`);
                return;
            }

            await sock.groupToggleEphemeral(chatJid, 0);
        } else {
            // ── DM path ────────────────────────────────────────────────────
            // Baileys 7.0.0-rc.9's `sendMessage(jid, { disappearingMessagesInChat })`
            // silently fails for DMs because:
            //   1. messages-send.js only routes the option through groupToggleEphemeral
            //      when isJidGroup(jid) is true.
            //   2. The fallback path via generateWAMessage builds a protocolMessage but
            //      omits `ephemeralSettingTimestamp`, so WhatsApp treats our toggle-OFF
            //      as stale (older than the just-applied toggle-ON) and drops it.
            // Fix: relay the protocolMessage directly with a fresh timestamp.
            await sock.relayMessage(chatJid, {
                protocolMessage: {
                    type: 3, // EPHEMERAL_SETTING
                    ephemeralExpiration: 0,
                    ephemeralSettingTimestamp: Math.floor(Date.now() / 1000).toString()
                }
            }, {});
        }

        const shortChat = chatJid.split('@')[0].slice(-6);
        console.log(`[ANTIDISP] ✓ Reversed disappearing-messages timer in …${shortChat}`);

        // Friendly notification in the chat
        await sock.sendMessage(chatJid, {
            text:
                `╭─⌈ 🛡️ *ANTI-DISAPPEARING* ⌋\n` +
                `├─⊷ Disappearing messages were turned on.\n` +
                `├─⊷ I have reverted the chat back to *OFF*.\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        });
    } catch (err) {
        console.log(`[ANTIDISP] ❌ Reverse failed: ${err?.message || err}`);
    }
}

// ─── Command ─────────────────────────────────────────────────────────────────
export default {
    name: 'antidisp',
    alias: ['antidisappear', 'antiephemeral', 'antidisappearing'],
    description: 'Auto-revert any chat that turns disappearing messages on.',
    category: 'owner',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const sub = (args[0] || '').toLowerCase();
        const cfg = loadConfig();

        if (!sub || sub === 'status') {
            const stateIcon = cfg.enabled ? '✅ ON' : '❌ OFF';
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🛡️ *ANTI-DISAPPEARING* ⌋\n` +
                    `├─⊷ Status : *${stateIcon}*\n` +
                    `├─⊷ When ON, any chat (DM or group) that turns\n` +
                    `│   disappearing messages on is auto-reverted to OFF.\n` +
                    `│\n` +
                    `├─⊷ *${PREFIX}antidisp on*  → enable\n` +
                    `├─⊷ *${PREFIX}antidisp off* → disable\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'on' || sub === 'enable') {
            saveConfig({ enabled: true });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🛡️ *ANTI-DISAPPEARING* ⌋\n` +
                    `├─⊷ ✅ Enabled — disappearing-messages timers\n` +
                    `│   will be reverted to *OFF* automatically.\n` +
                    `├─⊷ Note: in groups the bot must be admin.\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'off' || sub === 'disable') {
            saveConfig({ enabled: false });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🛡️ *ANTI-DISAPPEARING* ⌋\n` +
                    `├─⊷ ❌ Disabled — disappearing-messages timers\n` +
                    `│   set by other people will be left alone.\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        return sock.sendMessage(chatId, {
            text: `❌ Unknown option *${sub}*. Use: *${PREFIX}antidisp on / off / status*`
        }, { quoted: msg });
    }
};
