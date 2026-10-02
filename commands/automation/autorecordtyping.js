import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const CONFIG_DB_KEY = 'autorecordtyping_config';

const cfg = {
    mode: 'off',
    duration: 15,
    switchEvery: 4,
    targetJid: null,
    activeSessions: new Map(),
    botSock: null,
    isHooked: false
};

function loadConfig() {
    try {
        const data = supabase.getConfigSync(CONFIG_DB_KEY, {
            mode: 'off',
            duration: 15,
            switchEvery: 4,
            targetJid: null
        });
        cfg.mode       = data.mode       || 'off';
        cfg.duration   = data.duration   || 15;
        cfg.switchEvery = data.switchEvery || 4;
        cfg.targetJid  = data.targetJid  || null;
    } catch {}
}

function saveConfig() {
    try {
        supabase.setConfig(CONFIG_DB_KEY, {
            mode: cfg.mode,
            duration: cfg.duration,
            switchEvery: cfg.switchEvery,
            targetJid: cfg.targetJid || null
        }).catch(() => {});
    } catch {}
}

function normalizeToJid(input) {
    const cleaned = input.replace(/[^0-9]/g, '');
    if (cleaned.length >= 7) return `${cleaned}@s.whatsapp.net`;
    return null;
}

loadConfig();

function shouldActInChat(chatJid) {
    if (cfg.mode === 'off') return false;
    if (cfg.mode === 'single') return chatJid === cfg.targetJid;
    const isGroup = chatJid.endsWith('@g.us');
    if (cfg.mode === 'both') return true;
    if (cfg.mode === 'groups' && isGroup) return true;
    if (cfg.mode === 'dm' && !isGroup) return true;
    return false;
}

class AutoRecordTypingManager {
    static initialize(sock) {
        if (sock && cfg.botSock && cfg.botSock !== sock) {
            cfg.isHooked = false;
        }
        if (!cfg.isHooked && sock) {
            cfg.botSock = sock;
            this.hookIntoBot();
            cfg.isHooked = true;
        }
    }

    static hookIntoBot() {
        if (!cfg.botSock?.ev) return;
        cfg.botSock.ev.on('messages.upsert', async (data) => {
            await this.handleIncomingMessage(data);
        });
    }

    static async handleIncomingMessage(data) {
        try {
            if (!data?.messages?.length) return;
            const m = data.messages[0];
            const sock = cfg.botSock;
            if (!m?.key || m.key.fromMe || cfg.mode === 'off') return;

            const text = m.message?.conversation ||
                m.message?.extendedTextMessage?.text ||
                m.message?.imageMessage?.caption || '';
            if (text.trim().startsWith('.')) return;

            const chatJid = m.key.remoteJid;
            if (!chatJid || !shouldActInChat(chatJid)) return;

            const now = Date.now();

            if (cfg.activeSessions.has(chatJid)) {
                const sess = cfg.activeSessions.get(chatJid);
                if (sess.stopTimeout) clearTimeout(sess.stopTimeout);
                sess.lastMessageTime = now;
                sess.stopTimeout = setTimeout(() => this.stopSession(chatJid, sock), cfg.duration * 1000);
                return;
            }

            await this.startSession(chatJid, sock);

        } catch (err) {
            console.error('[AutoRecordTyping] handler error:', err.message);
        }
    }

    static async startSession(chatJid, sock) {
        try {
            let useRecording = false;

            await sock.sendPresenceUpdate('composing', chatJid);

            const switchInterval = setInterval(async () => {
                try {
                    if (!cfg.activeSessions.has(chatJid)) return;
                    useRecording = !useRecording;
                    await sock.sendPresenceUpdate(useRecording ? 'recording' : 'composing', chatJid);
                } catch {}
            }, cfg.switchEvery * 1000);

            const stopTimeout = setTimeout(() => this.stopSession(chatJid, sock), cfg.duration * 1000);

            cfg.activeSessions.set(chatJid, {
                switchInterval,
                stopTimeout,
                startTime: Date.now(),
                lastMessageTime: Date.now()
            });
        } catch (err) {
            console.error('[AutoRecordTyping] startSession error:', err.message);
        }
    }

    static async stopSession(chatJid, sock) {
        if (!cfg.activeSessions.has(chatJid)) return;
        const sess = cfg.activeSessions.get(chatJid);
        clearInterval(sess.switchInterval);
        if (sess.stopTimeout) clearTimeout(sess.stopTimeout);
        cfg.activeSessions.delete(chatJid);
        try {
            await (sock || cfg.botSock).sendPresenceUpdate('paused', chatJid);
        } catch {}
    }

    static clearAllSessions() {
        cfg.activeSessions.forEach((sess) => {
            clearInterval(sess.switchInterval);
            if (sess.stopTimeout) clearTimeout(sess.stopTimeout);
        });
        cfg.activeSessions.clear();
    }
}

export default {
    name: 'autorecordtyping',
    alias: ['art', 'recordtype', 'typingrecord', 'comborec', 'fakecombo', 'rtsim'],
    desc: 'Alternates between typing and recording indicators on incoming messages',
    category: 'Owner',
    usage: '.autorecordtyping [dm|groups|both|off|status|<number>|switch <secs>|<1-120>]',

    async execute(sock, m, args, PREFIX, extra) {
        try {
            const chatJid = m.key.remoteJid;

            if (!cfg.isHooked) {
                cfg.botSock = sock;
                AutoRecordTypingManager.hookIntoBot();
                cfg.isHooked = true;
            }

            const isOwner = extra?.jidManager?.isOwner(m) || m.key.fromMe;
            if (!isOwner) {
                return sock.sendMessage(chatJid, { text: '❌ *Owner Only Command*' }, { quoted: m });
            }

            const sub  = (args[0] || '').toLowerCase().trim();
            const sub2 = (args[1] || '').toLowerCase().trim();

            const modeLabels = {
                off:    '❌ OFF',
                dm:     '💬 DMs only',
                groups: '👥 Groups only',
                both:   '🌐 DMs + Groups',
                single: `🎯 Single: ${cfg.targetJid || 'none'}`
            };

            if (!sub || sub === 'status' || sub === 'info') {
                return sock.sendMessage(chatJid, {
                    text:
                        `╭─⌈ 🔀 *AUTO RECORD+TYPING* ⌋\n` +
                        `│\n` +
                        `│ Mode     : ${modeLabels[cfg.mode] || cfg.mode}\n` +
                        `│ Duration : ${cfg.duration}s\n` +
                        `│ Switches : every ${cfg.switchEvery}s\n` +
                        `│ Active   : ${cfg.activeSessions.size} chat(s)\n` +
                        `│\n` +
                        `├─⊷ *${PREFIX}autorecordtyping dm*\n` +
                        `│  └⊷ All DMs\n` +
                        `├─⊷ *${PREFIX}autorecordtyping groups*\n` +
                        `│  └⊷ All groups\n` +
                        `├─⊷ *${PREFIX}autorecordtyping both*\n` +
                        `│  └⊷ DMs + Groups\n` +
                        `├─⊷ *${PREFIX}autorecordtyping <number>*\n` +
                        `│  └⊷ Single target chat\n` +
                        `├─⊷ *${PREFIX}autorecordtyping off*\n` +
                        `│  └⊷ Disable\n` +
                        `├─⊷ *${PREFIX}autorecordtyping <1-120>*\n` +
                        `│  └⊷ Set total duration\n` +
                        `├─⊷ *${PREFIX}autorecordtyping switch <1-30>*\n` +
                        `│  └⊷ Set how often it switches\n` +
                        `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            if (sub === 'switch') {
                const secs = parseInt(sub2);
                if (!isNaN(secs) && secs >= 1 && secs <= 30) {
                    cfg.switchEvery = secs;
                    saveConfig();
                    return sock.sendMessage(chatJid, {
                        text: `✅ *Switch interval set to ${secs}s*\n\nThe indicator will now alternate every *${secs} seconds*.`
                    }, { quoted: m });
                }
                return sock.sendMessage(chatJid, {
                    text: `❌ Please provide a value between 1–30.\nExample: \`${PREFIX}autorecordtyping switch 5\``
                }, { quoted: m });
            }

            if (['dm', 'dms', 'private'].includes(sub)) {
                cfg.mode = 'dm';
                cfg.targetJid = null;
                saveConfig();
                AutoRecordTypingManager.clearAllSessions();
                return sock.sendMessage(chatJid, {
                    text: `✅ *Combo Sim: DMs Only*\n\nWill alternate typing ↔ recording in all private chats.\nDuration: ${cfg.duration}s  |  Switch: every ${cfg.switchEvery}s`
                }, { quoted: m });
            }

            if (['groups', 'group', 'gc'].includes(sub)) {
                cfg.mode = 'groups';
                cfg.targetJid = null;
                saveConfig();
                AutoRecordTypingManager.clearAllSessions();
                return sock.sendMessage(chatJid, {
                    text: `✅ *Combo Sim: Groups Only*\n\nWill alternate typing ↔ recording in all group chats.\nDuration: ${cfg.duration}s  |  Switch: every ${cfg.switchEvery}s`
                }, { quoted: m });
            }

            if (['both', 'all', 'on', 'enable'].includes(sub)) {
                cfg.mode = 'both';
                cfg.targetJid = null;
                saveConfig();
                return sock.sendMessage(chatJid, {
                    text: `✅ *Combo Sim: DMs + Groups*\n\nWill alternate typing ↔ recording in all chats.\nDuration: ${cfg.duration}s  |  Switch: every ${cfg.switchEvery}s`
                }, { quoted: m });
            }

            if (['off', 'disable', 'stop'].includes(sub)) {
                cfg.mode = 'off';
                cfg.targetJid = null;
                saveConfig();
                AutoRecordTypingManager.clearAllSessions();
                return sock.sendMessage(chatJid, {
                    text: `❌ *Combo Sim Disabled*\n\nRecording + Typing simulation is now off.`
                }, { quoted: m });
            }

            const duration = parseInt(sub);
            if (!isNaN(duration) && duration >= 1 && duration <= 120) {
                cfg.duration = duration;
                saveConfig();
                return sock.sendMessage(chatJid, {
                    text: `✅ *Duration set to ${duration}s*\n\nCurrent mode: ${cfg.mode}${cfg.targetJid ? `\nTarget: ${cfg.targetJid}` : ''}\nSwitch: every ${cfg.switchEvery}s`
                }, { quoted: m });
            }

            const inputJid = args[0].includes('@') ? args[0].trim() : normalizeToJid(args[0]);
            if (inputJid) {
                cfg.mode = 'single';
                cfg.targetJid = inputJid;
                saveConfig();
                AutoRecordTypingManager.clearAllSessions();
                const displayNum = inputJid.split('@')[0];
                return sock.sendMessage(chatJid, {
                    text:
                        `✅ *Combo Sim: Single Chat*\n\n` +
                        `🎯 Target: *+${displayNum}*\n` +
                        `⏱️ Duration: ${cfg.duration}s\n` +
                        `🔀 Switch: every ${cfg.switchEvery}s\n\n` +
                        `Typing ↔ Recording will alternate only in that person's DM.\n\n` +
                        `• Change: \`${PREFIX}autorecordtyping <new_number>\`\n` +
                        `• Disable: \`${PREFIX}autorecordtyping off\``
                }, { quoted: m });
            }

            return sock.sendMessage(chatJid, {
                text:
                    `╭─⌈ 🔀 *AUTO RECORD+TYPING* ⌋\n` +
                    `│\n` +
                    `├─⊷ *${PREFIX}autorecordtyping dm*  — DMs only\n` +
                    `├─⊷ *${PREFIX}autorecordtyping groups*  — Groups only\n` +
                    `├─⊷ *${PREFIX}autorecordtyping both*  — All chats\n` +
                    `├─⊷ *${PREFIX}autorecordtyping <number>*  — One person\n` +
                    `├─⊷ *${PREFIX}autorecordtyping off*  — Stop\n` +
                    `├─⊷ *${PREFIX}autorecordtyping <1-120>*  — Set duration\n` +
                    `├─⊷ *${PREFIX}autorecordtyping switch <1-30>*  — Switch speed\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });

        } catch (err) {
            console.error('[AutoRecordTyping] execute error:', err);
            await sock.sendMessage(m.key.remoteJid, {
                text: `❌ AutoRecordTyping error: ${err.message}`
            }, { quoted: m });
        }
    }
};

globalThis._autoRecordTypingInit = (sock) => {
    loadConfig();
    if (cfg.mode !== 'off') {
        AutoRecordTypingManager.initialize(sock);
    }
};
