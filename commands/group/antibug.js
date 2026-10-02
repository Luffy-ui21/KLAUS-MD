import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
const BUG_PATTERNS = [
    { pattern: /\u200E{10,}/, type: 'lrm_crash', label: 'LRM overflow' },
    { pattern: /\u200F{10,}/, type: 'rlm_crash', label: 'RLM overflow' },
    { pattern: /\u200B{10,}/, type: 'zwsp_crash', label: 'Zero-width space flood' },
    { pattern: /\u2060{5,}/, type: 'wj_crash', label: 'Word joiner flood' },
    { pattern: /\uFEFF{5,}/, type: 'bom_crash', label: 'BOM overflow' },
    { pattern: /\u00AD{10,}/, type: 'shy_crash', label: 'Soft hyphen flood' },
    { pattern: /\u200D{20,}/, type: 'zwj_crash', label: 'ZWJ overflow' },
    { pattern: /[\u0300-\u036F]{20,}/, type: 'diacritics_crash', label: 'Diacritics bomb' },
    { pattern: /[\u0489]{5,}/, type: 'combining_crash', label: 'Combining char bomb' },
    { pattern: /[\u20E3]{5,}/, type: 'enclosing_crash', label: 'Enclosing keycap bomb' },
    { pattern: /(.)\1{500,}/, type: 'repeat_crash', label: 'Character repeat bomb' },
    { pattern: /[\u2066\u2067\u2068\u2069]{5,}/, type: 'bidi_isolate_crash', label: 'Bidi isolate bomb' },
    { pattern: /[\u202A-\u202E]{5,}/, type: 'bidi_embed_crash', label: 'Bidi embed bomb' },
    { pattern: /\u034F{10,}/, type: 'cgj_crash', label: 'CGJ overflow' },
    { pattern: /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{20,}/, type: 'thai_crash', label: 'Thai combining bomb' },
    { pattern: /[\u0300-\u036F\u0489\u20E3\u0E31\u0E34-\u0E3A]{30,}/, type: 'multi_combining', label: 'Multi combining bomb' },
    { pattern: /[\u0600-\u0605\u06DD\u070F\u0890\u0891\u08E2]{5,}/, type: 'arabic_crash', label: 'Arabic format bomb' },
    { pattern: /[\u200C\u200D]{50,}/, type: 'zwnj_zwj_crash', label: 'ZWNJ/ZWJ flood' },
    { pattern: /[\uFFF9-\uFFFC]{3,}/, type: 'interlinear_crash', label: 'Interlinear annotation bomb' },
    { pattern: /[\u0DC0-\u0DFF]{30,}/, type: 'sinhala_crash', label: 'Sinhala combining bomb' },
    { pattern: /[\u1AB0-\u1AFF]{20,}/, type: 'ext_combining_crash', label: 'Extended combining bomb' },
    { pattern: /[\u1DC0-\u1DFF]{20,}/, type: 'supplement_combining', label: 'Supplement combining bomb' },
    { pattern: /[\uFE20-\uFE2F]{10,}/, type: 'half_mark_crash', label: 'Combining half mark bomb' },
    { pattern: /(.{1,5})\1{200,}/, type: 'pattern_repeat_crash', label: 'Pattern repeat bomb' },
    { pattern: /[\u2028\u2029]{10,}/, type: 'line_separator_crash', label: 'Line separator bomb' },
    { pattern: /\u0000{3,}/, type: 'null_crash', label: 'Null byte injection' },
];

function isBugMessage(msg) {
    const result = { isBug: false, type: null, label: null, severity: 'none' };

    const text = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.documentMessage?.caption || '';

    for (const { pattern, type, label } of BUG_PATTERNS) {
        if (pattern.test(text)) {
            return { isBug: true, type, label, severity: 'high' };
        }
    }

    if (text.length > 50000) {
        return { isBug: true, type: 'text_flood', label: 'Massive text flood', severity: 'high' };
    }

    if (text.length > 20000) {
        return { isBug: true, type: 'text_spam', label: 'Large text spam', severity: 'medium' };
    }

    const contactsArrayMsg = msg.message?.contactsArrayMessage;
    if (contactsArrayMsg && contactsArrayMsg.contacts?.length > 50) {
        return { isBug: true, type: 'vcf_bomb', label: `VCF bomb (${contactsArrayMsg.contacts.length} contacts)`, severity: 'critical' };
    }

    if (msg.message?.protocolMessage?.type === 14) {
        return { isBug: true, type: 'protocol_crash', label: 'Protocol crash exploit', severity: 'critical' };
    }

    if (msg.message?.protocolMessage?.type === 5) {
        return { isBug: true, type: 'protocol_revoke_crash', label: 'Protocol revoke exploit', severity: 'high' };
    }

    if (msg.message?.buttonsMessage?.buttons?.length > 20 ||
        msg.message?.listMessage?.sections?.length > 20 ||
        msg.message?.templateMessage?.hydratedTemplate?.hydratedButtons?.length > 20) {
        return { isBug: true, type: 'button_crash', label: 'Button/list overflow', severity: 'high' };
    }

    const knownCrashTypes = [
        'bcallMessage', 'callLogMessage', 'interactiveResponseMessage',
        'pollCreationMessageV3', 'scheduledCallEditMessage',
        'groupMentionedMessage', 'pinInChatMessage', 'encReactionMessage',
        'editedMessage', 'lottieStickerMessage'
    ];

    for (const crashType of knownCrashTypes) {
        if (msg.message?.[crashType] !== undefined) {
            const innerKeys = Object.keys(msg.message[crashType] || {});
            if (innerKeys.length === 0 || (msg.message[crashType] === null)) {
                return { isBug: true, type: 'empty_crash_msg', label: `Empty ${crashType} exploit`, severity: 'critical' };
            }
        }
    }

    if (msg.message?.documentMessage) {
        const doc = msg.message.documentMessage;
        const fileName = (doc.fileName || '').toLowerCase();
        const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.js', '.wsh', '.ps1'];
        if (dangerousExts.some(ext => fileName.endsWith(ext))) {
            return { isBug: true, type: 'malicious_file', label: `Dangerous file: ${fileName}`, severity: 'high' };
        }
        if (doc.fileLength && Number(doc.fileLength) > 100 * 1024 * 1024) {
            return { isBug: true, type: 'large_file', label: 'Oversized file (>100MB)', severity: 'medium' };
        }
    }

    if (msg.message?.stickerMessage) {
        const sticker = msg.message.stickerMessage;
        if (sticker.fileLength && Number(sticker.fileLength) > 5 * 1024 * 1024) {
            return { isBug: true, type: 'sticker_bomb', label: 'Oversized sticker', severity: 'medium' };
        }
    }

    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 50) {
        return { isBug: true, type: 'mention_bomb', label: 'Mass mention bomb', severity: 'high' };
    }

    return result;
}

function loadConfig() {
    if (typeof globalThis._antibugConfig === 'object' && globalThis._antibugConfig !== null) {
        return globalThis._antibugConfig;
    }
    return {};
}

function saveConfig(data) {
    globalThis._antibugConfig = data;
    if (typeof globalThis._saveAntibugConfig === 'function') {
        globalThis._saveAntibugConfig(data);
    }
}

function isEnabled(chatJid) {
    const config = loadConfig();
    if (config['global']?.enabled) return true;
    return config[chatJid]?.enabled || false;
}

function getAction(chatJid) {
    const config = loadConfig();
    return config[chatJid]?.action || config['global']?.action || 'delete';
}

export default {
    name: 'antibug',
    alias: ['bugdetect', 'anticrash', 'bugprotect'],
    description: 'Detect and block bug/crash attacks in groups and DMs',
    category: 'group',
    ownerOnly: true,

    isBugMessage,
    isEnabled,
    getAction,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        const config = loadConfig();
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on' || sub === 'enable') {
            const target = (args[1] || '').toLowerCase() === 'global' ? 'global' : chatId;
            config[target] = { enabled: true, action: config[target]?.action || 'delete' };
            saveConfig(config);
            const scope = target === 'global' ? 'ALL CHATS (Global)' : (isGroup ? 'this group' : 'this DM');
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🛡️ *ANTI-BUG ENABLED* ⌋\n│\n├─⊷ *Scope:* ${scope}\n├─⊷ *Action:* ${config[target].action.toUpperCase()}\n│\n├─⊷ Bug bots will be detected and handled\n│  └⊷ Crash messages auto-deleted\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'off' || sub === 'disable') {
            const target = (args[1] || '').toLowerCase() === 'global' ? 'global' : chatId;
            config[target] = { ...config[target], enabled: false };
            saveConfig(config);
            const scope = target === 'global' ? 'Global' : (isGroup ? 'This group' : 'This DM');
            return sock.sendMessage(chatId, {
                text: `🛡️ *Anti-Bug DISABLED* for ${scope}`
            }, { quoted: msg });
        }

        if (sub === 'action' && args[1]) {
            const action = args[1].toLowerCase();
            const validActions = ['block', 'kick', 'delete', 'warn'];
            if (!validActions.includes(action)) {
                return sock.sendMessage(chatId, {
                    text: `❌ Invalid action! Use: ${validActions.join(', ')}`
                }, { quoted: msg });
            }
            const target = (args[2] || '').toLowerCase() === 'global' ? 'global' : chatId;
            config[target] = { ...config[target], enabled: config[target]?.enabled ?? true, action };
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `🛡️ *Anti-Bug Action:* ${action.toUpperCase()}`
            }, { quoted: msg });
        }

        if (sub === 'status') {
            const globalEnabled = config['global']?.enabled || false;
            const globalAction = config['global']?.action || 'delete';
            const localEnabled = config[chatId]?.enabled || false;
            const localAction = config[chatId]?.action || 'delete';

            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🛡️ *ANTI-BUG STATUS* ⌋\n│\n├─⊷ *Global:* ${globalEnabled ? '✅ ON' : '❌ OFF'} (${globalAction})\n├─⊷ *This chat:* ${localEnabled ? '✅ ON' : '❌ OFF'} (${localAction})\n├─⊷ *Active:* ${globalEnabled || localEnabled ? '✅ YES' : '❌ NO'}\n├─⊷ *Patterns:* ${BUG_PATTERNS.length + 10} detection rules\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'test') {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🛡️ *ANTI-BUG TEST* ⌋\n│\n├─⊷ Detection engine: ✅ Active\n├─⊷ Patterns loaded: ${BUG_PATTERNS.length} text + 10 structural\n├─⊷ Scope: Groups + DMs\n│\n├─⊷ *Detects:*\n│  ├⊷ Text crash bombs (ZWJ, diacritics, bidi)\n│  ├⊷ VCF contact bombs\n│  ├⊷ Protocol exploits\n│  ├⊷ Button/list overflow\n│  ├⊷ Empty message exploits\n│  ├⊷ Malicious files\n│  ├⊷ Oversized stickers\n│  ├⊷ Mass mention bombs\n│  └⊷ Text flood attacks\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        return sock.sendMessage(chatId, {
            text: `╭─⌈ 🛡️ *ANTI-BUG* ⌋\n│\n├─⊷ *${PREFIX}antibug on [global]*\n│  └⊷ Enable (optionally for all chats)\n├─⊷ *${PREFIX}antibug off [global]*\n│  └⊷ Disable protection\n├─⊷ *${PREFIX}antibug action <mode>*\n│  └⊷ block / kick / delete / warn\n├─⊷ *${PREFIX}antibug status*\n│  └⊷ Check current status\n├─⊷ *${PREFIX}antibug test*\n│  └⊷ Test detection engine\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        }, { quoted: msg });
    }
};

export { isBugMessage, isEnabled, getAction };
