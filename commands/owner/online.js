import fs from 'fs';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const PRESENCE_FILE = './data/presence/config.json';

// How often (in ms) to re-assert 'available' when online mode is ON.
const ONLINE_INTERVAL_MS  = 2 * 60 * 1000;   // 2 minutes

// How often (in ms) to re-assert 'unavailable' when online mode is OFF.
// Needs to be more frequent than Baileys' own internal presence pings so
// we consistently override any accidental 'available' leaks.
const OFFLINE_INTERVAL_MS = 30 * 1000;        // 30 seconds

function ensureDir() {
    if (!fs.existsSync('./data/presence')) {
        fs.mkdirSync('./data/presence', { recursive: true });
    }
}

function loadConfig() {
    ensureDir();
    try {
        if (fs.existsSync(PRESENCE_FILE)) {
            return JSON.parse(fs.readFileSync(PRESENCE_FILE, 'utf8'));
        }
    } catch {}
    return { enabled: false, mode: 'available', interval: 2 };
}

function saveConfig(config) {
    ensureDir();
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(config, null, 2));
}

// Start the "always online" interval — sends 'available' every 2 minutes.
function startOnlineInterval(sock, config) {
    stopAllPresenceIntervals();
    global.PRESENCE_INTERVAL = setInterval(async () => {
        try { await sock.sendPresenceUpdate('available'); } catch {}
    }, ONLINE_INTERVAL_MS);
    // Send immediately so the user appears online right away
    sock.sendPresenceUpdate('available').catch(() => {});
}

// Start the "keep offline" counter-interval — sends 'unavailable' every
// 30 seconds to override any internal Baileys presence leaks.
// Without this, Baileys' own connection keepalives reset the user to
// 'Online' even after a one-shot 'unavailable' call.
function startOfflineInterval(sock) {
    stopAllPresenceIntervals();
    global.PRESENCE_OFF_INTERVAL = setInterval(async () => {
        try { await sock.sendPresenceUpdate('unavailable'); } catch {}
    }, OFFLINE_INTERVAL_MS);
    // Send immediately
    sock.sendPresenceUpdate('unavailable').catch(() => {});
}

// Clear both intervals so no stale timers run after a toggle.
function stopAllPresenceIntervals() {
    if (global.PRESENCE_INTERVAL) {
        clearInterval(global.PRESENCE_INTERVAL);
        global.PRESENCE_INTERVAL = null;
    }
    if (global.PRESENCE_OFF_INTERVAL) {
        clearInterval(global.PRESENCE_OFF_INTERVAL);
        global.PRESENCE_OFF_INTERVAL = null;
    }
}

// Called on every connection open to restore the correct presence interval
export function initPresence(sock) {
    const config = loadConfig();
    if (config.enabled) {
        startOnlineInterval(sock, config);
    } else {
        startOfflineInterval(sock);
    }
}

export default {
    name: 'online',
    alias: ['ghost', 'presence', 'fakeonline', 'alwaysonline'],
    category: 'owner',
    description: 'Toggle always-online presence (hides last seen)',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command*'
            }, { quoted: msg });
        }

        const command = args[0]?.toLowerCase() || 'toggle';
        let config = loadConfig();

        switch (command) {
            case 'on':
            case 'enable':
            case 'start': {
                config.enabled = true;
                config.startedAt = new Date().toISOString();
                saveConfig(config);

                startOnlineInterval(sock, config);

                await sock.sendMessage(chatId, {
                    text:
                        `╭─⌈ 🟢 *ALWAYS ONLINE* ⌋\n` +
                        `│\n` +
                        `│ ✧ *Status:* ✅ ENABLED\n` +
                        `│ ✧ *Mode:* Always Online\n` +
                        `│ ✧ *Interval:* Every ${config.interval || 2} min\n` +
                        `│\n` +
                        `│ 👁️ Others will always see\n` +
                        `│ you as "Online"\n` +
                        `│ 🔒 Last seen is hidden\n` +
                        `│\n` +
                        `│ • \`${PREFIX}online off\` - Disable\n` +
                        `│ • \`${PREFIX}privacy\` - View all settings\n` +
                        `│\n` +
                        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }

            case 'off':
            case 'disable':
            case 'stop': {
                config.enabled = false;
                saveConfig(config);

                // Start the counter-interval so offline status is actively maintained.
                // A single 'unavailable' call is not enough — Baileys' internal keepalives
                // can reset you to 'Online' within seconds. The interval keeps asserting
                // 'unavailable' every 30 seconds to stay truly offline.
                startOfflineInterval(sock);

                await sock.sendMessage(chatId, {
                    text:
                        `╭─⌈ 🔴 *ALWAYS ONLINE* ⌋\n` +
                        `│\n` +
                        `│ ✧ *Status:* ❌ DISABLED\n` +
                        `│\n` +
                        `│ Normal presence restored\n` +
                        `│ Last seen will show normally\n` +
                        `│\n` +
                        `│ • \`${PREFIX}online on\` - Re-enable\n` +
                        `│ • \`${PREFIX}privacy\` - View all settings\n` +
                        `│\n` +
                        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }

            default: {
                // No arg — toggle current state
                config.enabled = !config.enabled;
                saveConfig(config);

                if (config.enabled) {
                    startOnlineInterval(sock, config);
                } else {
                    startOfflineInterval(sock);
                }

                const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
                const emoji  = config.enabled ? '🟢' : '🔴';

                await sock.sendMessage(chatId, {
                    text:
                        `╭─⌈ ${emoji} *ALWAYS ONLINE* ⌋\n` +
                        `│\n` +
                        `│ ✧ *Status:* ${status}\n` +
                        `│\n` +
                        `│ ${config.enabled
                            ? '👁️ You appear always online\n│ 🔒 Last seen is hidden'
                            : '📱 Normal presence restored'}\n` +
                        `│\n` +
                        `│ • \`${PREFIX}online ${config.enabled ? 'off' : 'on'}\` - Toggle\n` +
                        `│ • \`${PREFIX}privacy\` - View all settings\n` +
                        `│\n` +
                        `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                break;
            }
        }
    }
};
