import db from '../../lib/database.js';
import { getOwnerName } from '../../lib/menuHelper.js';

const CONFIG_DB_KEY = 'autoreply_config';
const DEFAULT_MESSAGE = 'Hello, WOLFBOT is online';
const COOLDOWN_MS = 60_000;

const DEFAULT_SETTINGS = {
    enabled: false,
    message: DEFAULT_MESSAGE,
};

const replyCache = new Map();

try {
    const _init = db.getConfigSync(CONFIG_DB_KEY, DEFAULT_SETTINGS);
    globalThis._autoreplyEnabled = !!(_init?.enabled);
    globalThis._autoreplyMessage = _init?.message || DEFAULT_MESSAGE;
} catch { globalThis._autoreplyEnabled = false; }

function loadSettings() {
    try {
        return { ...DEFAULT_SETTINGS, ...db.getConfigSync(CONFIG_DB_KEY, DEFAULT_SETTINGS) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings) {
    try {
        db.setConfig(CONFIG_DB_KEY, settings).catch(() => {});
        globalThis._autoreplyEnabled = !!(settings?.enabled);
        globalThis._autoreplyMessage = settings?.message || DEFAULT_MESSAGE;
    } catch (e) {
        console.error('[AUTOREPLY] saveSettings error:', e);
    }
}

let autoreplyActive = false;
let _autoreplyHookedSock = null;

function setupAutoreply(sock) {
    if (autoreplyActive && _autoreplyHookedSock === sock) return;
    if (_autoreplyHookedSock !== sock) autoreplyActive = false;

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const settings = loadSettings();
            if (!settings.enabled) return;

            for (const m of messages) {
                if (m.key.fromMe) continue;
                const jid = m.key.remoteJid;
                if (!jid || jid === 'status@broadcast') continue;
                if (jid.endsWith('@g.us')) continue;

                const now = Date.now();
                const last = replyCache.get(jid) || 0;
                if (now - last < COOLDOWN_MS) continue;
                replyCache.set(jid, now);

                await sock.sendMessage(jid, { text: settings.message });
            }
        } catch {}
    });

    autoreplyActive = true;
    _autoreplyHookedSock = sock;
    console.log('[AUTOREPLY] Event listener registered');
}

export function startAutoreply(sock) {
    if (!autoreplyActive || _autoreplyHookedSock !== sock) {
        setupAutoreply(sock);
    }
}

export default {
    name: 'autoreply',
    aliases: ['ar', 'setreply', 'autoreply'],
    description: 'Auto-reply to incoming DMs with a customizable message',
    category: 'automation',

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;
        const { jidManager } = extra;
        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;

        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(jid, {
                text: '❌ *Owner Only Command!*\n\nOnly the bot owner can manage autoreply.'
            }, { quoted: msg });
        }

        if (!autoreplyActive || _autoreplyHookedSock !== sock) {
            setupAutoreply(sock);
        }

        const sub = args[0]?.toLowerCase();
        const settings = loadSettings();

        if (!sub || sub === 'status') {
            const status = settings.enabled ? '🟢 ON' : '🔴 OFF';
            const preview = settings.message.length > 60
                ? settings.message.substring(0, 60) + '…'
                : settings.message;
            return sock.sendMessage(jid, {
                text: `╭─⌈ 💬 *AUTOREPLY STATUS* ⌋\n│\n│ ◎ *Status:* ${status}\n│ ◎ *Message:*\n│   ${preview}\n│\n╰─⊷ *Usage:*\n   • \`${PREFIX}autoreply on\`\n   • \`${PREFIX}autoreply off\`\n   • \`${PREFIX}autoreply message <text>\`\n   • \`${PREFIX}autoreply reset\``
            }, { quoted: msg });
        }

        if (sub === 'on') {
            settings.enabled = true;
            saveSettings(settings);
            return sock.sendMessage(jid, {
                text: `✅ *Autoreply Enabled!*\n\n📨 *Reply message:*\n${settings.message}\n\n💡 Tip: Use \`${PREFIX}autoreply message <text>\` to set a custom reply.`
            }, { quoted: msg });
        }

        if (sub === 'off') {
            settings.enabled = false;
            saveSettings(settings);
            return sock.sendMessage(jid, {
                text: '❌ *Autoreply Disabled!*\n\nThe bot will no longer auto-reply to incoming DMs.'
            }, { quoted: msg });
        }

        if (sub === 'message' || sub === 'setmsg' || sub === 'msg' || sub === 'set') {
            const newMsg = args.slice(1).join(' ').trim();
            if (!newMsg) {
                return sock.sendMessage(jid, {
                    text: `⚠️ *Please provide a message!*\n\nExample:\n\`${PREFIX}autoreply message Hello! I'll get back to you shortly.\``
                }, { quoted: msg });
            }
            settings.message = newMsg;
            saveSettings(settings);
            return sock.sendMessage(jid, {
                text: `✅ *Autoreply message updated!*\n\n📨 *New message:*\n${newMsg}`
            }, { quoted: msg });
        }

        if (sub === 'reset') {
            settings.message = DEFAULT_MESSAGE;
            saveSettings(settings);
            return sock.sendMessage(jid, {
                text: `✅ *Autoreply message reset to default!*\n\n📨 *Message:*\n${DEFAULT_MESSAGE}`
            }, { quoted: msg });
        }

        return sock.sendMessage(jid, {
            text: `╭─⌈ 💬 *AUTOREPLY HELP* ⌋\n│\n│ • \`${PREFIX}autoreply on\` — Enable autoreply\n│ • \`${PREFIX}autoreply off\` — Disable autoreply\n│ • \`${PREFIX}autoreply message <text>\` — Set custom message\n│ • \`${PREFIX}autoreply reset\` — Reset to default message\n│ • \`${PREFIX}autoreply status\` — View current status\n│\n╰─⊷ *Default reply:* ${DEFAULT_MESSAGE}`
        }, { quoted: msg });
    }
};
