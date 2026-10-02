import { createRequire } from 'module';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const _requireAl = createRequire(import.meta.url);
let giftedBtnsAl;
try { giftedBtnsAl = _requireAl('wolfbtns'); } catch (e) {}

const URL_PATTERNS = [
    /https?:\/\/[^\s<>]+/gi,
    /www\.[^\s<>]+\.[a-zA-Z]{2,}/gi,
    /t\.me\/[^\s<>]+/gi,
    /instagram\.com\/[^\s<>]+/gi,
    /facebook\.com\/[^\s<>]+/gi,
    /fb\.com\/[^\s<>]+/gi,
    /twitter\.com\/[^\s<>]+/gi,
    /x\.com\/[^\s<>]+/gi,
    /youtube\.com\/[^\s<>]+/gi,
    /youtu\.be\/[^\s<>]+/gi,
    /whatsapp\.com\/[^\s<>]+/gi,
    /chat\.whatsapp\.com\/[^\s<>]+/gi,
    /discord\.gg\/[^\s<>]+/gi,
    /discord\.com\/[^\s<>]+/gi,
    /snapchat\.com\/[^\s<>]+/gi,
    /tiktok\.com\/[^\s<>]+/gi,
    /reddit\.com\/[^\s<>]+/gi,
    /linkedin\.com\/[^\s<>]+/gi,
    /github\.com\/[^\s<>]+/gi,
    /bit\.ly\/[^\s<>]+/gi,
    /tinyurl\.com\/[^\s<>]+/gi,
    /goo\.gl\/[^\s<>]+/gi,
    /ow\.ly\/[^\s<>]+/gi,
    /is\.gd\/[^\s<>]+/gi,
    /v\.gd\/[^\s<>]+/gi,
    /cutt\.ly\/[^\s<>]+/gi,
    /shorturl\.at\/[^\s<>]+/gi,
    /wa\.me\/[^\s<>]+/gi,
    /vm\.tiktok\.com\/[^\s<>]+/gi,
    /pin\.it\/[^\s<>]+/gi,
    /open\.spotify\.com\/[^\s<>]+/gi,
    /spotify\.link\/[^\s<>]+/gi,
];

const BARE_DOMAIN_PATTERN = /\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(com|net|org|io|co|me|info|biz|xyz|dev|app|gg|tv|cc|ly|to|link|shop|store|site|online|live|club|pro|tech|space|fun|one|world|top|click|buzz|win|website)\b/gi;

function extractMessageText(message) {
    if (!message) return '';

    const parts = [];

    if (message.conversation) parts.push(message.conversation);
    if (message.extendedTextMessage?.text) parts.push(message.extendedTextMessage.text);
    if (message.imageMessage?.caption) parts.push(message.imageMessage.caption);
    if (message.videoMessage?.caption) parts.push(message.videoMessage.caption);
    if (message.documentMessage?.caption) parts.push(message.documentMessage.caption);
    if (message.documentMessage?.fileName) parts.push(message.documentMessage.fileName);
    if (message.contactMessage?.displayName) parts.push(message.contactMessage.displayName);
    if (message.contactMessage?.vcard) parts.push(message.contactMessage.vcard);
    if (message.listMessage?.title) parts.push(message.listMessage.title);
    if (message.listMessage?.description) parts.push(message.listMessage.description);
    if (message.buttonsMessage?.contentText) parts.push(message.buttonsMessage.contentText);
    if (message.buttonsMessage?.headerText) parts.push(message.buttonsMessage.headerText);
    if (message.templateMessage?.hydratedTemplate?.hydratedContentText) {
        parts.push(message.templateMessage.hydratedTemplate.hydratedContentText);
    }
    if (message.pollCreationMessage?.name) parts.push(message.pollCreationMessage.name);

    if (message.contactsArrayMessage?.contacts) {
        for (const c of message.contactsArrayMessage.contacts) {
            if (c.displayName) parts.push(c.displayName);
            if (c.vcard) parts.push(c.vcard);
        }
    }

    if (message.extendedTextMessage?.matchedText) {
        parts.push(message.extendedTextMessage.matchedText);
    }

    if (message.extendedTextMessage?.canonicalUrl) {
        parts.push(message.extendedTextMessage.canonicalUrl);
    }

    return parts.join(' ');
}

function containsLink(text) {
    if (!text || typeof text !== 'string') return false;

    const cleanText = text.replace(/[*_~`|]/g, '');

    for (const pattern of URL_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(cleanText)) return true;
    }

    BARE_DOMAIN_PATTERN.lastIndex = 0;
    if (BARE_DOMAIN_PATTERN.test(cleanText)) return true;

    return false;
}

function extractLinks(text) {
    if (!text || typeof text !== 'string') return [];

    const links = new Set();
    const cleanText = text.replace(/[*_~`|]/g, '');

    for (const pattern of URL_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = cleanText.match(pattern);
        if (matches) {
            for (let link of matches) {
                link = link.trim().replace(/[.,;:!?]+$/, '');
                if (link.startsWith('www.') && !link.startsWith('https://')) {
                    link = 'https://' + link;
                }
                links.add(link);
            }
        }
    }

    BARE_DOMAIN_PATTERN.lastIndex = 0;
    const bareMatches = cleanText.match(BARE_DOMAIN_PATTERN);
    if (bareMatches) {
        for (const m of bareMatches) {
            links.add(m.trim());
        }
    }

    return [...links];
}

function cleanJid(jid) {
    if (!jid) return jid;
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

function loadConfig() {
    if (typeof globalThis._antilinkConfig === 'object' && globalThis._antilinkConfig !== null) {
        return globalThis._antilinkConfig;
    }
    return {};
}

function saveConfig(data) {
    globalThis._antilinkConfig = data;
    if (typeof globalThis._saveAntilinkConfig === 'function') {
        globalThis._saveAntilinkConfig(data);
    }
}

function isEnabled(chatJid) {
    const config = loadConfig();
    return config[chatJid]?.enabled || false;
}

function getMode(chatJid) {
    const config = loadConfig();
    return config[chatJid]?.mode || 'delete';
}

function getGroupConfig(chatJid) {
    const config = loadConfig();
    return config[chatJid] || null;
}

function checkMessageForLinks(msg) {
    if (!msg.message) return { hasLink: false, links: [], text: '' };
    const text = extractMessageText(msg.message);
    const hasLink = containsLink(text);
    const links = hasLink ? extractLinks(text) : [];
    return { hasLink, links, text };
}

function isLinkExempt(links, exemptLinks) {
    if (!exemptLinks || exemptLinks.length === 0) return false;
    return links.some(link => {
        const cleanLink = link.replace(/^https?:\/\//, '').toLowerCase();
        return exemptLinks.some(exempt => cleanLink.includes(exempt) || exempt.includes(cleanLink));
    });
}

// ── Link-type classification ───────────────────────────────────────────────
const LINK_TYPE_PATTERNS = {
    grouplinks: [/chat\.whatsapp\.com/i, /wa\.me\//i],
    instagram:  [/instagram\.com/i],
    facebook:   [/facebook\.com/i, /fb\.com/i],
    twitter:    [/twitter\.com/i, /x\.com\//i],
    youtube:    [/youtube\.com/i, /youtu\.be/i],
    tiktok:     [/tiktok\.com/i, /vm\.tiktok\.com/i],
    telegram:   [/t\.me\//i],
    discord:    [/discord\.gg/i, /discord\.com\/invite/i],
    shortened:  [/bit\.ly\//i, /tinyurl\.com/i, /goo\.gl\//i, /ow\.ly\//i, /is\.gd\//i,
                 /v\.gd\//i, /cutt\.ly\//i, /shorturl\.at\//i, /pin\.it\//i, /spotify\.link\//i],
};

const VALID_EXCLUDE_TYPES = Object.keys(LINK_TYPE_PATTERNS);

function getLinkType(link) {
    const lower = link.toLowerCase();
    for (const [type, patterns] of Object.entries(LINK_TYPE_PATTERNS)) {
        if (patterns.some(p => p.test(lower))) return type;
    }
    return 'other';
}

function isExcludedType(links, excludeTypes) {
    if (!excludeTypes || excludeTypes.length === 0) return false;
    return links.some(link => {
        const t = getLinkType(link);
        return excludeTypes.includes(t);
    });
}

function getExcludeTypes(chatJid) {
    const config = loadConfig();
    return config[chatJid]?.excludeTypes || [];
}

function getCustomMessage(chatJid) {
    const config = loadConfig();
    return config[chatJid]?.customMessage || '';
}

// Replace placeholders in a custom message template.
// Supported placeholders: {user}, {group}, {warns}, {limit}, {mode}, {link}, {links}
function formatCustomMessage(template, vars) {
    if (!template || typeof template !== 'string') return '';
    return template.replace(/\{(\w+)\}/g, (_, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
    );
}

export default {
    name: 'antilink',
    description: 'Control link sharing in the group with different actions',
    category: 'group',

    checkMessageForLinks,
    isEnabled,
    getMode,
    getGroupConfig,
    isLinkExempt,
    isExcludedType,
    getExcludeTypes,
    getCustomMessage,
    formatCustomMessage,
    containsLink,
    extractLinks,
    extractMessageText,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(chatId, {
                text: '❌ This command can only be used in groups.'
            }, { quoted: msg });
        }

        let sender = msg.key.participant || (msg.key.fromMe ? sock.user.id : chatId);
        sender = cleanJid(sender);

        let isAdmin = false;

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const cleanSender = cleanJid(sender);

            const participant = groupMetadata.participants.find(p => cleanJid(p.id) === cleanSender);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch {
            return sock.sendMessage(chatId, {
                text: '❌ Failed to fetch group information.'
            }, { quoted: msg });
        }

        const isOwner = extra?.isOwner ? extra.isOwner() : false;
        const isSudo = extra?.isSudo ? extra.isSudo() : false;

        if (!isAdmin && !isOwner && !isSudo) {
            return sock.sendMessage(chatId, {
                text: '❌ Only group admins can use this command!'
            }, { quoted: msg });
        }

        const config = loadConfig();
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on') {
            const mode = (args[1] || '').toLowerCase();
            if (!mode || !['warn', 'delete', 'kick'].includes(mode)) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ ⚙️ *ANTI-LINK SETUP* ⌋\n│\n├─⊷ *${PREFIX}antilink on warn*\n│  └⊷ Warn senders\n├─⊷ *${PREFIX}antilink on delete*\n│  └⊷ Auto-delete links\n├─⊷ *${PREFIX}antilink on kick*\n│  └⊷ Kick senders\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            config[chatId] = {
                enabled: true,
                mode,
                exemptAdmins: config[chatId]?.exemptAdmins ?? true,
                exemptLinks: config[chatId]?.exemptLinks || [],
                excludeTypes: config[chatId]?.excludeTypes || [],
                warningCount: config[chatId]?.warningCount || {},
                customMessage: config[chatId]?.customMessage || ''
            };
            saveConfig(config);

            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔗 *ANTI-LINK ENABLED* ⌋\n│\n├─⊷ *Mode:* ${mode.toUpperCase()}\n├─⊷ *Admins exempt:* ${config[chatId].exemptAdmins ? 'Yes' : 'No'}\n├─⊷ *Detection:* All message types\n│  └⊷ Text, captions, links in media\n│  └⊷ Bare domains (example.com)\n│  └⊷ Shortened URLs\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'off') {
            if (config[chatId]) {
                config[chatId].enabled = false;
                saveConfig(config);
            }
            return sock.sendMessage(chatId, {
                text: '❌ *Anti-link disabled!*\n\nEveryone can now share links in this group.'
            }, { quoted: msg });
        }

        if (sub === 'status') {
            const gc = config[chatId];
            if (gc?.enabled) {
                const excludeList = gc.excludeTypes?.length ? gc.excludeTypes.join(', ') : 'none';
                let statusText = `╭─⌈ 🔗 *ANTI-LINK STATUS* ⌋\n│\n`;
                statusText += `├─⊷ *Status:* ✅ ENABLED\n`;
                statusText += `├─⊷ *Mode:* ${gc.mode.toUpperCase()}\n`;
                statusText += `├─⊷ *Admins exempt:* ${gc.exemptAdmins ? 'Yes' : 'No'}\n`;
                statusText += `├─⊷ *Allowed links:* ${gc.exemptLinks?.length || 0}\n`;
                statusText += `├─⊷ *Excluded types:* ${excludeList}\n`;
                statusText += `├─⊷ *Custom message:* ${gc.customMessage ? '✅ set' : '❌ default'}\n`;
                if (gc.customMessage) {
                    statusText += `│  └⊷ ${gc.customMessage.length > 50 ? gc.customMessage.slice(0, 50) + '…' : gc.customMessage}\n`;
                }
                statusText += `├─⊷ *Detection:* All message types\n`;
                statusText += `╰───`;
                return sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
            }
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔗 *ANTI-LINK STATUS* ⌋\n│\n├─⊷ *Status:* ❌ DISABLED\n├─⊷ Enable: *${PREFIX}antilink on [mode]*\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (sub === 'allow') {
            const linkToAllow = args.slice(1).join(' ').trim();
            if (!linkToAllow) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🔗 *ALLOW LINK* ⌋\n│\n├─⊷ *${PREFIX}antilink allow [link]*\n│  └⊷ e.g. ${PREFIX}antilink allow youtube.com\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            if (!config[chatId]) config[chatId] = { enabled: false, mode: 'delete', exemptAdmins: true, exemptLinks: [], warningCount: {} };
            if (!config[chatId].exemptLinks) config[chatId].exemptLinks = [];

            const cleanLink = linkToAllow.replace(/^https?:\/\//, '').toLowerCase();
            if (config[chatId].exemptLinks.includes(cleanLink)) {
                return sock.sendMessage(chatId, { text: `✅ Already allowed: \`${cleanLink}\`` }, { quoted: msg });
            }

            config[chatId].exemptLinks.push(cleanLink);
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `✅ Link allowed: \`${cleanLink}\`\n\nThis link can now be shared freely.`
            }, { quoted: msg });
        }

        if (sub === 'disallow' || sub === 'remove') {
            const linkToRemove = args.slice(1).join(' ').trim();
            if (!linkToRemove) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🔗 *DISALLOW LINK* ⌋\n│\n├─⊷ *${PREFIX}antilink disallow [link]*\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }

            if (!config[chatId]?.exemptLinks?.length) {
                return sock.sendMessage(chatId, { text: '❌ No allowed links to remove.' }, { quoted: msg });
            }

            const cleanLink = linkToRemove.replace(/^https?:\/\//, '').toLowerCase();
            const idx = config[chatId].exemptLinks.indexOf(cleanLink);
            if (idx === -1) {
                return sock.sendMessage(chatId, { text: `❌ Link not in allowed list: \`${cleanLink}\`` }, { quoted: msg });
            }

            config[chatId].exemptLinks.splice(idx, 1);
            saveConfig(config);
            return sock.sendMessage(chatId, { text: `✅ Link removed from allowed list: \`${cleanLink}\`` }, { quoted: msg });
        }

        if (sub === 'listallowed' || sub === 'list') {
            const exemptLinks = config[chatId]?.exemptLinks || [];
            if (exemptLinks.length === 0) {
                return sock.sendMessage(chatId, { text: '📋 *Allowed Links*\n\nNo links are currently allowed.' }, { quoted: msg });
            }
            let listText = '📋 *Allowed Links*\n\n';
            exemptLinks.forEach((link, i) => { listText += `${i + 1}. \`${link}\`\n`; });
            listText += `\nTotal: ${exemptLinks.length}`;
            return sock.sendMessage(chatId, { text: listText }, { quoted: msg });
        }

        if (sub === 'exemptadmins') {
            const toggle = (args[1] || '').toLowerCase();
            if (!config[chatId]) config[chatId] = { enabled: false, mode: 'delete', exemptAdmins: true, exemptLinks: [], warningCount: {} };
            if (toggle === 'on') {
                config[chatId].exemptAdmins = true;
                saveConfig(config);
                return sock.sendMessage(chatId, { text: '⚙️ *Admin exemption enabled* — Admins can share links freely.' }, { quoted: msg });
            }
            if (toggle === 'off') {
                config[chatId].exemptAdmins = false;
                saveConfig(config);
                return sock.sendMessage(chatId, { text: '⚙️ *Admin exemption disabled* — Admins are subject to anti-link rules.' }, { quoted: msg });
            }
            const current = config[chatId].exemptAdmins !== false ? 'enabled' : 'disabled';
            return sock.sendMessage(chatId, {
                text: `⚙️ *Admin Exemption:* ${current}\n\nUse: *${PREFIX}antilink exemptadmins on/off*`
            }, { quoted: msg });
        }

        if (sub === 'exclude' || sub === 'addexclude') {
            const typeName = (args[1] || '').toLowerCase();
            if (!typeName || !VALID_EXCLUDE_TYPES.includes(typeName)) {
                const typeList = VALID_EXCLUDE_TYPES.join(', ');
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🚫 *EXCLUDE LINK TYPE* ⌋\n│\n├─⊷ *Usage:* \`${PREFIX}antilink exclude <type>\`\n│\n├─⊷ *Available types:*\n│  └⊷ ${typeList}\n│\n├─⊷ *Example:*\n│  └⊷ \`${PREFIX}antilink exclude grouplinks\`\n│  └⊷ \`${PREFIX}antilink exclude instagram\`\n│\n├─⊷ Excluded types are *always* actioned\n│  └⊷ even if the domain is in allow list\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }
            if (!config[chatId]) config[chatId] = { enabled: false, mode: 'delete', exemptAdmins: true, exemptLinks: [], warningCount: {}, excludeTypes: [] };
            if (!config[chatId].excludeTypes) config[chatId].excludeTypes = [];
            if (config[chatId].excludeTypes.includes(typeName)) {
                return sock.sendMessage(chatId, { text: `⚠️ \`${typeName}\` is already in the exclude list.` }, { quoted: msg });
            }
            config[chatId].excludeTypes.push(typeName);
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `✅ *Excluded:* \`${typeName}\`\n\nLinks of this type will always be actioned (${getMode(chatId).toUpperCase()} mode), even if their domain is in the allow list.`
            }, { quoted: msg });
        }

        if (sub === 'removeexclude' || sub === 'unexclude') {
            const typeName = (args[1] || '').toLowerCase();
            if (!typeName) {
                return sock.sendMessage(chatId, {
                    text: `❌ Usage: \`${PREFIX}antilink removeexclude <type>\``
                }, { quoted: msg });
            }
            const excludeTypes = config[chatId]?.excludeTypes || [];
            const idx = excludeTypes.indexOf(typeName);
            if (idx === -1) {
                return sock.sendMessage(chatId, { text: `❌ \`${typeName}\` is not in the exclude list.` }, { quoted: msg });
            }
            config[chatId].excludeTypes.splice(idx, 1);
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `✅ Removed \`${typeName}\` from exclude list. This type now follows normal allow/deny rules.`
            }, { quoted: msg });
        }

        if (sub === 'listexclude' || sub === 'excludes') {
            const excludeTypes = config[chatId]?.excludeTypes || [];
            if (excludeTypes.length === 0) {
                return sock.sendMessage(chatId, {
                    text: `📋 *Excluded Types*\n\nNo types currently excluded.\nUse \`${PREFIX}antilink exclude <type>\` to add one.\n\nAvailable: ${VALID_EXCLUDE_TYPES.join(', ')}`
                }, { quoted: msg });
            }
            const list = excludeTypes.map((t, i) => `${i + 1}. \`${t}\``).join('\n');
            return sock.sendMessage(chatId, {
                text: `📋 *Excluded Link Types*\n\n${list}\n\nTotal: ${excludeTypes.length}\nThese types are always actioned regardless of allow list.\n\nRemove: \`${PREFIX}antilink removeexclude <type>\``
            }, { quoted: msg });
        }

        if (sub === 'set') {
            const customText = args.slice(1).join(' ').trim();
            if (!customText) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ ✏️ *SET CUSTOM MESSAGE* ⌋\n│\n├─⊷ Usage: *${PREFIX}antilink set <text>*\n│\n├─⊷ Placeholders:\n│  └⊷ {user}  - mention the sender\n│  └⊷ {group} - group name\n│  └⊷ {warns} - current warning count\n│  └⊷ {limit} - max warning count\n│  └⊷ {mode}  - mode (warn/delete/kick)\n│  └⊷ {link}  - first detected link\n│  └⊷ {links} - all detected links\n│\n├─⊷ Example:\n│  └⊷ ${PREFIX}antilink set No links {user}! ({warns}/{limit})\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }
            if (!config[chatId]) {
                config[chatId] = { enabled: false, mode: 'delete', exemptAdmins: true, exemptLinks: [], warningCount: {} };
            }
            config[chatId].customMessage = customText;
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: `✅ *Custom Anti-Link message saved.*\n\n📝 Preview:\n${customText}`
            }, { quoted: msg });
        }

        if (sub === 'reset' || sub === 'resetmsg' || sub === 'cleartext') {
            if (!config[chatId]?.customMessage) {
                return sock.sendMessage(chatId, {
                    text: 'ℹ️ No custom Anti-Link message is set — already using the default.'
                }, { quoted: msg });
            }
            config[chatId].customMessage = '';
            saveConfig(config);
            return sock.sendMessage(chatId, {
                text: '✅ Custom Anti-Link message cleared. Default messages will be used.'
            }, { quoted: msg });
        }

        if (sub === 'test') {
            const testText = args.slice(1).join(' ') || 'Test message with https://example.com and youtube.com/watch?v=abc';
            const hasLink = containsLink(testText);
            const extracted = extractLinks(testText);

            let result = `🔍 *Link Detection Test*\n\n`;
            result += `Text: ${testText}\n\n`;
            result += `Contains link: ${hasLink ? '✅ Yes' : '❌ No'}\n`;
            if (hasLink && extracted.length > 0) {
                result += `\nExtracted links:\n`;
                extracted.forEach((link, i) => { result += `${i + 1}. \`${link}\`\n`; });
            }

            return sock.sendMessage(chatId, { text: result }, { quoted: msg });
        }

        const gc = config[chatId];
        const currentStatus = gc?.enabled ? `✅ ${gc.mode.toUpperCase()}` : '❌ OFF';
        const helpText = `╭─⌈ 🔗 *ANTI-LINK* ⌋\n├─⊷ *Status:* ${currentStatus}\n│\n├─⊷ *${PREFIX}antilink on [mode]*\n│  └⊷ warn / delete / kick\n├─⊷ *${PREFIX}antilink off*\n│  └⊷ Disable protection\n├─⊷ *${PREFIX}antilink status*\n│  └⊷ View current settings\n├─⊷ *${PREFIX}antilink allow [link]*\n│  └⊷ Whitelist a domain/link\n├─⊷ *${PREFIX}antilink disallow [link]*\n│  └⊷ Remove from whitelist\n├─⊷ *${PREFIX}antilink listallowed*\n│  └⊷ Show whitelisted links\n├─⊷ *${PREFIX}antilink exclude [type]*\n│  └⊷ Always action a link type\n│  └⊷ types: grouplinks, instagram,\n│  └⊷ facebook, twitter, youtube,\n│  └⊷ tiktok, telegram, discord, shortened\n├─⊷ *${PREFIX}antilink removeexclude [type]*\n│  └⊷ Remove from exclude list\n├─⊷ *${PREFIX}antilink listexclude*\n│  └⊷ Show excluded types\n├─⊷ *${PREFIX}antilink set <text>*\n│  └⊷ Custom warning text\n│  └⊷ {user} {group} {warns} {limit} {mode} {link} {links}\n├─⊷ *${PREFIX}antilink reset*\n│  └⊷ Restore default text\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
        if (isButtonModeEnabled() && giftedBtnsAl?.sendInteractiveMessage) {
            try {
                await giftedBtnsAl.sendInteractiveMessage(sock, chatId, {
                    body: { text: helpText },
                    footer: { text: `Status: ${currentStatus}` },
                    interactiveButtons: [
                        { type: 'quick_reply', display_text: '⚠️ Warn Mode', id: `${PREFIX}antilink on warn` },
                        { type: 'quick_reply', display_text: '🗑️ Delete Mode', id: `${PREFIX}antilink on delete` },
                        { type: 'quick_reply', display_text: '👢 Kick Mode', id: `${PREFIX}antilink on kick` }
                    ]
                }, { quoted: msg });
                return;
            } catch (e) {}
        }
        return sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
    }
};

export { checkMessageForLinks, isEnabled, getMode, getGroupConfig, isLinkExempt, isExcludedType, getExcludeTypes, getCustomMessage, formatCustomMessage, containsLink, extractLinks, extractMessageText };
