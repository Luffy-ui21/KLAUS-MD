import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CONFIG_DB_KEY = 'autorecording_config';

const autoRecordingConfig = {
    mode: 'off',
    duration: 10,
    targetJid: null,
    activeRecorders: new Map(),
    botSock: null,
    isHooked: false
};

function loadConfig() {
    try {
        const data = supabase.getConfigSync(CONFIG_DB_KEY, { mode: 'off', duration: 10, targetJid: null });
        autoRecordingConfig.mode = data.mode || 'off';
        autoRecordingConfig.duration = data.duration || 10;
        autoRecordingConfig.targetJid = data.targetJid || null;
    } catch {}
}

function saveConfig() {
    try {
        const cfg = {
            mode: autoRecordingConfig.mode,
            duration: autoRecordingConfig.duration,
            targetJid: autoRecordingConfig.targetJid || null
        };
        supabase.setConfig(CONFIG_DB_KEY, cfg).catch(() => {});
    } catch {}
}

function normalizeToJid(input) {
    const cleaned = input.replace(/[^0-9]/g, '');
    if (cleaned.length >= 7) return `${cleaned}@s.whatsapp.net`;
    return null;
}

loadConfig();

function shouldRecordInChat(chatJid) {
    const mode = autoRecordingConfig.mode;
    if (mode === 'off') return false;
    if (mode === 'single') return chatJid === autoRecordingConfig.targetJid;
    const isGroup = chatJid.endsWith('@g.us');
    if (mode === 'both') return true;
    if (mode === 'groups' && isGroup) return true;
    if (mode === 'dm' && !isGroup) return true;
    return false;
}

class AutoRecordingManager {
    static initialize(sock) {
        if (sock && autoRecordingConfig.botSock && autoRecordingConfig.botSock !== sock) {
            autoRecordingConfig.isHooked = false;
        }
        if (!autoRecordingConfig.isHooked && sock) {
            autoRecordingConfig.botSock = sock;
            this.hookIntoBot();
            autoRecordingConfig.isHooked = true;
        }
    }

    static hookIntoBot() {
        if (!autoRecordingConfig.botSock?.ev) return;
        autoRecordingConfig.botSock.ev.on('messages.upsert', async (data) => {
            await this.handleIncomingMessage(data);
        });
    }

    static async handleIncomingMessage(data) {
        try {
            if (!data?.messages?.length) return;
            const m = data.messages[0];
            const sock = autoRecordingConfig.botSock;
            if (!m?.key || m.key.fromMe || autoRecordingConfig.mode === 'off') return;

            const messageText = m.message?.conversation ||
                m.message?.extendedTextMessage?.text ||
                m.message?.imageMessage?.caption || '';
            if (messageText.trim().startsWith('.')) return;

            const chatJid = m.key.remoteJid;
            if (!chatJid || !shouldRecordInChat(chatJid)) return;

            const now = Date.now();

            if (autoRecordingConfig.activeRecorders.has(chatJid)) {
                const recorderData = autoRecordingConfig.activeRecorders.get(chatJid);
                if (recorderData.timeoutId) clearTimeout(recorderData.timeoutId);
                recorderData.lastMessageTime = now;
                recorderData.timeoutId = setTimeout(async () => {
                    await this.stopRecording(chatJid, sock);
                }, autoRecordingConfig.duration * 1000);
                return;
            }

            await this.startRecording(chatJid, sock);

        } catch (err) {
            console.error("Auto-recording handler error:", err.message);
        }
    }

    static async startRecording(chatJid, sock) {
        try {
            await sock.sendPresenceUpdate('recording', chatJid);

            const keepAlive = setInterval(async () => {
                try {
                    if (autoRecordingConfig.activeRecorders.has(chatJid)) {
                        await sock.sendPresenceUpdate('recording', chatJid);
                    }
                } catch {}
            }, 2000);

            const timeoutId = setTimeout(async () => {
                await this.stopRecording(chatJid, sock);
            }, autoRecordingConfig.duration * 1000);

            autoRecordingConfig.activeRecorders.set(chatJid, {
                intervalId: keepAlive,
                timeoutId,
                startTime: Date.now(),
                lastMessageTime: Date.now()
            });
        } catch (err) {
            console.error("Start recording error:", err.message);
        }
    }

    static async stopRecording(chatJid, sock) {
        if (!autoRecordingConfig.activeRecorders.has(chatJid)) return;
        const recorderData = autoRecordingConfig.activeRecorders.get(chatJid);
        clearInterval(recorderData.intervalId);
        if (recorderData.timeoutId) clearTimeout(recorderData.timeoutId);
        autoRecordingConfig.activeRecorders.delete(chatJid);
        try {
            const s = sock || autoRecordingConfig.botSock;
            await s.sendPresenceUpdate('paused', chatJid);
        } catch {}
    }

    static clearAllRecorders() {
        autoRecordingConfig.activeRecorders.forEach((recorderData) => {
            clearInterval(recorderData.intervalId);
            if (recorderData.timeoutId) clearTimeout(recorderData.timeoutId);
        });
        autoRecordingConfig.activeRecorders.clear();
    }
}

export default {
    name: "autorecording",
    alias: ["record", "recording", "voicerec", "audiorec", "rec", "recsim"],
    desc: "Toggle auto fake recording indicator — can target a specific chat",
    category: "Owner",
    usage: ".autorecording [dm|groups|both|off|status|<number>|<jid>]",

    async execute(sock, m, args, PREFIX, extra) {
        try {
            const targetJid = m.key.remoteJid;

            if (!autoRecordingConfig.isHooked) {
                autoRecordingConfig.botSock = sock;
                AutoRecordingManager.hookIntoBot();
                autoRecordingConfig.isHooked = true;
            }

            const isOwner = extra?.jidManager?.isOwner(m) || m.key.fromMe;
            if (!isOwner) {
                return sock.sendMessage(targetJid, {
                    text: '❌ *Owner Only Command*'
                }, { quoted: m });
            }

            const sub = (args[0] || '').toLowerCase().trim();

            if (!sub || sub === 'status' || sub === 'info') {
                const modeLabels = {
                    off: '❌ OFF',
                    dm: '💬 DMs only',
                    groups: '👥 Groups only',
                    both: '🌐 DMs + Groups',
                    single: `🎯 Single chat: ${autoRecordingConfig.targetJid || 'none'}`
                };

                return sock.sendMessage(targetJid, {
                    text: `╭─⌈ 🎤 *AUTO-RECORDING* ⌋\n│\n│ Mode: ${modeLabels[autoRecordingConfig.mode] || autoRecordingConfig.mode}\n│ Duration: ${autoRecordingConfig.duration}s\n│ Active: ${autoRecordingConfig.activeRecorders.size}\n│\n├─⊷ *${PREFIX}autorecording <number>*\n│  └⊷ Record only in that person's DM\n│  └⊷ e.g. ${PREFIX}autorecording 254703397679\n├─⊷ *${PREFIX}autorecording dm*\n│  └⊷ All DMs\n├─⊷ *${PREFIX}autorecording groups*\n│  └⊷ All groups\n├─⊷ *${PREFIX}autorecording both*\n│  └⊷ DMs + Groups\n├─⊷ *${PREFIX}autorecording off*\n│  └⊷ Disable\n├─⊷ *${PREFIX}autorecording <1-120>*\n│  └⊷ Set duration\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            if (['dm', 'dms', 'private'].includes(sub)) {
                autoRecordingConfig.mode = 'dm';
                autoRecordingConfig.targetJid = null;
                saveConfig();
                AutoRecordingManager.clearAllRecorders();
                return sock.sendMessage(targetJid, {
                    text: `✅ *Auto-Recording: DMs Only*\n\nRecording indicator will show in all private chats.\nDuration: ${autoRecordingConfig.duration}s`
                }, { quoted: m });
            }

            if (['groups', 'group', 'gc'].includes(sub)) {
                autoRecordingConfig.mode = 'groups';
                autoRecordingConfig.targetJid = null;
                saveConfig();
                AutoRecordingManager.clearAllRecorders();
                return sock.sendMessage(targetJid, {
                    text: `✅ *Auto-Recording: Groups Only*\n\nRecording indicator will show in all group chats.\nDuration: ${autoRecordingConfig.duration}s`
                }, { quoted: m });
            }

            if (['both', 'all', 'on', 'enable'].includes(sub)) {
                autoRecordingConfig.mode = 'both';
                autoRecordingConfig.targetJid = null;
                saveConfig();
                return sock.sendMessage(targetJid, {
                    text: `✅ *Auto-Recording: DMs + Groups*\n\nRecording indicator will show in all chats.\nDuration: ${autoRecordingConfig.duration}s`
                }, { quoted: m });
            }

            if (['off', 'disable', 'stop'].includes(sub)) {
                autoRecordingConfig.mode = 'off';
                autoRecordingConfig.targetJid = null;
                saveConfig();
                AutoRecordingManager.clearAllRecorders();
                return sock.sendMessage(targetJid, {
                    text: `❌ *Auto-Recording Disabled*\n\nRecording indicator is now off for all chats.`
                }, { quoted: m });
            }

            const duration = parseInt(sub);
            if (!isNaN(duration) && duration >= 1 && duration <= 120) {
                autoRecordingConfig.duration = duration;
                saveConfig();
                return sock.sendMessage(targetJid, {
                    text: `✅ *Duration set to ${duration}s*\n\nCurrent mode: ${autoRecordingConfig.mode}${autoRecordingConfig.targetJid ? `\nTarget: ${autoRecordingConfig.targetJid}` : ''}`
                }, { quoted: m });
            }

            const inputJid = args[0].includes('@') ? args[0].trim() : normalizeToJid(args[0]);
            if (inputJid) {
                autoRecordingConfig.mode = 'single';
                autoRecordingConfig.targetJid = inputJid;
                saveConfig();
                AutoRecordingManager.clearAllRecorders();
                const displayNum = inputJid.split('@')[0];
                return sock.sendMessage(targetJid, {
                    text: `✅ *Auto-Recording: Single Chat*\n\n🎯 Target: *+${displayNum}*\n⏱️ Duration: ${autoRecordingConfig.duration}s\n\nRecording will only be simulated in that person's DM.\n\n• Change target: \`${PREFIX}autorecording <new_number>\`\n• Disable: \`${PREFIX}autorecording off\``
                }, { quoted: m });
            }

            return sock.sendMessage(targetJid, {
                text: `╭─⌈ 🎤 *AUTO-RECORDING* ⌋\n│\n├─⊷ *${PREFIX}autorecording <number>*\n│  └⊷ Target one specific chat\n│  └⊷ e.g. ${PREFIX}autorecording 254703397679\n├─⊷ *${PREFIX}autorecording dm*\n│  └⊷ All DMs\n├─⊷ *${PREFIX}autorecording groups*\n│  └⊷ All groups\n├─⊷ *${PREFIX}autorecording both*\n│  └⊷ DMs + Groups\n├─⊷ *${PREFIX}autorecording off*\n│  └⊷ Disable\n├─⊷ *${PREFIX}autorecording <1-120>*\n│  └⊷ Set duration\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });

        } catch (err) {
            console.error("AutoRecording error:", err);
            await sock.sendMessage(m.key.remoteJid, {
                text: `❌ AutoRecording error: ${err.message}`
            }, { quoted: m });
        }
    }
};

globalThis._autoRecordingInit = (sock) => {
    loadConfig();
    if (autoRecordingConfig.mode !== 'off') {
        AutoRecordingManager.initialize(sock);
    }
};
