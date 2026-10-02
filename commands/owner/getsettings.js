import fs from 'fs';
import { getBotName } from '../../lib/botname.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWarnLimit as getPerGroupLimit } from '../../lib/warnings-store.js';
import db from '../../lib/database.js';
import { getStatusAntideleteInfo } from './antideletestatus.js';
import { getAntieditInfo } from './antiedit.js';
import { detectPlatform } from '../../lib/platformDetect.js';
import { isMusicModeEnabled } from '../../lib/musicMode.js';
import {
    createFadedEffect,
    createReadMoreEffect,
    getMenuImageBuffer,
    sendLoadingMessage,
    getRAMUsage,
    formatUptime as menuFormatUptime,
    getBotVersion,, getFooter} from '../../lib/menuHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function safeReadJSON(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch {}
    return null;
}

function getPrefix() {
    if (global.prefix) return global.prefix;
    if (global.CURRENT_PREFIX) return global.CURRENT_PREFIX;
    if (process.env.PREFIX) return process.env.PREFIX;
    return '?';
}

function getPrefixlessStatus() {
    const cfg = safeReadJSON(path.join(__dirname, '../../data/prefix.json'));
    return cfg?.isPrefixless || false;
}

function getBotMode() {
    const data = safeReadJSON(path.join(__dirname, '../../bot_mode.json'));
    return data?.mode || 'public';
}

function getMenuStyle() {
    const data = safeReadJSON(path.join(__dirname, '../menus/current_style.json'));
    return data?.current || '1';
}

function getMenuLocalFile() {
    const candidates = [
        path.join(process.cwd(), 'data', 'wolfbot_menu_custom.gif'),
        path.join(process.cwd(), 'data', 'wolfbot_menu_custom.jpg'),
        path.join(__dirname, '../menus/media/wolfbot.gif'),
        path.join(__dirname, '../menus/media/wolfbot.jpg'),
        path.join(__dirname, '../media/wolfbot.gif'),
        path.join(__dirname, '../media/wolfbot.jpg'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function _readMenuImageConfig() {
    const configPaths = [
        path.join(__dirname, '../../data/menuimage.json'),
        path.join(__dirname, '../../data/menu_image.json'),
    ];
    for (const p of configPaths) {
        const data = safeReadJSON(p);
        if (data) return data;
    }
    return null;
}

function getMenuImageStatus() {
    const data = _readMenuImageConfig();
    const localFile = getMenuLocalFile();
    const fileName = localFile ? path.basename(localFile) : null;
    const isCustomFile = localFile &&
        (localFile.includes('wolfbot_menu_custom.jpg') || localFile.includes('wolfbot_menu_custom.gif'));

    if (!data) {
        if (!localFile || !isCustomFile) return 'Default';
        return `Custom (no source info) • ${fileName}`;
    }

    // New format: { source, url, updatedAt }
    // Old format: { url (label or actual URL), updatedAt }
    let source = data.source;
    if (!source) {
        // Old format — url field may be a label or a real URL
        const rawUrl = data.url || '';
        source = rawUrl.startsWith('http') ? 'URL' : (rawUrl || 'unknown');
    }

    const date = data.updatedAt
        ? new Date(data.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;

    const fileTag = localFile ? ` • ${fileName} ✅` : ' • ⚠️ file missing';
    const dateTag = date ? ` [${date}]` : '';

    return `Custom (${source})${fileTag}${dateTag}`;
}

function getMenuImageUrlOnly() {
    const data = _readMenuImageConfig();
    if (!data) return null;
    // New format: explicit url field (null when not a URL source)
    if (data.url && data.url.startsWith('http')) return data.url;
    // Old format: url field could have been the actual URL
    if (!data.source && data.url && data.url.startsWith('http')) return data.url;
    return null;
}

function getFooter() {
    const data = safeReadJSON(path.join(__dirname, '../../data/footer.json'));
    return data?.footer || `${getBotName()} is the ALPHA`;
}

function getAutotypingState() {
    const dbData = db.getConfigSync?.('autotyping_config', null);
    const data = (dbData && Object.keys(dbData).length > 0) ? dbData
        : safeReadJSON(path.join(__dirname, '../../data/autotyping/config.json'));
    if (!data || !data.mode || data.mode === 'off') return 'OFF';
    return `ON (${data.mode})`;
}

function getAutorecordingState() {
    const dbData = db.getConfigSync?.('autorecording_config', null);
    const data = (dbData && Object.keys(dbData).length > 0) ? dbData
        : safeReadJSON(path.join(__dirname, '../../data/autorecording/config.json'));
    if (!data || !data.mode || data.mode === 'off') return 'OFF';
    return `ON (${data.mode})`;
}

function getAutoreadState() {
    const dbData = db.getConfigSync?.('autoread_config', null);
    const data = (dbData && Object.keys(dbData).length > 0) ? dbData
        : safeReadJSON(path.join(__dirname, '../../autoread_settings.json'));
    if (!data || !data.enabled) return 'OFF';
    return `ON (${data.mode || 'both'})`;
}

function getAutoViewStatusState() {
    const dbData = db.getConfigSync?.('autoview_config', null);
    const data = (dbData && Object.keys(dbData).length > 0) ? dbData
        : safeReadJSON(path.join(__dirname, '../../data/autoViewConfig.json'));
    if (!data) return 'OFF';
    return data.enabled ? 'ON' : 'OFF';
}

function getAutoDownloadStatusState() {
    const dbData = db.getConfigSync?.('autodownloadstatus_config', null);
    const data = (dbData && Object.keys(dbData).length > 0) ? dbData
        : safeReadJSON(path.join(__dirname, '../../data/autoDownloadStatusConfig.json'));
    if (!data || !data.enabled) return 'OFF';
    return `ON (${data.mode || 'private'})`;
}

function getAutoreplyState() {
    const data = db.getConfigSync?.('autoreply_config', null);
    if (!data || !data.enabled) return 'OFF';
    const msg = data.message || 'Hello, WOLFBOT is online';
    const preview = msg.length > 35 ? msg.substring(0, 35) + '…' : msg;
    return `ON — "${preview}"`;
}

function getAutoreactStatusState() {
    const mgr = globalThis._autoReactManager;
    const data = mgr ? mgr.config
        : (() => {
            const dbData = db.getConfigSync?.('autoreact_config', null);
            return (dbData && Object.keys(dbData).length > 0) ? dbData
                : safeReadJSON(path.join(__dirname, '../../data/autoReactConfig.json'));
        })();
    if (!data || !data.enabled) return 'OFF';
    const mode = data.mode || 'fixed';
    if (mode === 'random') return 'ON (random)';
    const emoji = data.fixedEmoji || data.emoji || '';
    return `ON (fixed${emoji ? ' ' + emoji : ''})`;
}

function getAnticallState() {
    const data = safeReadJSON(path.join(__dirname, '../../anticall.json'));
    if (!data) return 'OFF';
    const settings = data.settings || {};
    const first = Object.values(settings).find(s => s?.enabled);
    if (!first) return 'OFF';
    return `ON (${first.mode || 'decline'})`;
}

function getAnticallMessage() {
    const data = safeReadJSON(path.join(__dirname, '../../anticall.json'));
    if (!data) return '—';
    const settings = data.settings || {};
    const first = Object.values(settings).find(s => s?.enabled);
    if (!first?.autoMessage || !first?.message) return 'None';
    const msg = first.message;
    return msg.length > 38 ? msg.substring(0, 38) + '…' : msg;
}


function getAntibugState() {
    const cfg = globalThis._antibugConfig;
    if (!cfg || typeof cfg !== 'object') return 'Not configured';
    const enabled = Object.values(cfg).filter(v => v?.enabled);
    if (enabled.length === 0) return 'OFF';
    return `${enabled.length} group(s)`;
}

function getAntilinkState() {
    const cfg = globalThis._antilinkConfig;
    if (!cfg || typeof cfg !== 'object') return 'Not configured';
    const enabled = Object.values(cfg).filter(v => v?.enabled);
    if (enabled.length === 0) return 'OFF';
    return `${enabled.length} group(s)`;
}

function getAntispamState() {
    const cfg = globalThis._antispamConfig;
    if (!cfg || typeof cfg !== 'object') return 'Not configured';
    const enabled = Object.values(cfg).filter(v => v?.enabled);
    if (enabled.length === 0) return 'OFF';
    return `${enabled.length} group(s)`;
}

function getAntiforwardState() {
    const cfg = globalThis._antiforwardConfig;
    if (!cfg || typeof cfg !== 'object') return 'Not configured';
    const entries = Object.values(cfg).filter(v => v?.enabled);
    if (entries.length === 0) return 'OFF';
    const modes = [...new Set(entries.map(v => (v.mode || 'warn').toUpperCase()))];
    return `ON — ${entries.length} group(s) (${modes.join('/')})`;
}

function getOnlinePresenceState() {
    const data = safeReadJSON(path.join(__dirname, '../../data/presence/config.json'));
    if (!data || !data.enabled) return 'OFF';
    return `ON (${data.mode || 'online'})`;
}

function getMusicModeState() {
    const data = safeReadJSON(path.join(__dirname, '../../data/musicmode.json'));
    const enabled = (global.MUSIC_MODE === true) || (data?.enabled === true);
    if (!enabled) return 'OFF';
    const songCount = (data?.songs?.length || 0);
    return `ON (${songCount} song${songCount !== 1 ? 's' : ''} in pool)`;
}

function getChatbotState() {
    const dataDir = path.join(__dirname, '../../data/chatbot');
    try {
        if (!fs.existsSync(dataDir)) return 'OFF';
        const ownerNum = global.OWNER_CLEAN_NUMBER || global.OWNER_NUMBER || '';
        let cfgPath = null;
        if (ownerNum) cfgPath = path.join(dataDir, `chatbot_config_${ownerNum}.json`);
        if (!cfgPath || !fs.existsSync(cfgPath)) {
            const files = fs.readdirSync(dataDir).filter(f => f.startsWith('chatbot_config_') && f.endsWith('.json'));
            if (files.length) cfgPath = path.join(dataDir, files[0]);
        }
        if (!cfgPath || !fs.existsSync(cfgPath)) return 'OFF';
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        const mode = cfg.mode || 'off';
        if (mode === 'off') return 'OFF';
        const name = cfg.chatbotName || 'W.O.L.F';
        const model = cfg.preferredModel || 'gpt';
        const dmCount = (cfg.allowedDMs || []).length;
        const gcCount = (cfg.allowedGroups || []).length;
        const wl = [];
        if (dmCount) wl.push(`${dmCount} DM${dmCount !== 1 ? 's' : ''}`);
        if (gcCount) wl.push(`${gcCount} group${gcCount !== 1 ? 's' : ''}`);
        return `${mode.toUpperCase()} | ${name} | ${model}${wl.length ? ` | ${wl.join(', ')}` : ''}`;
    } catch {
        return 'Error reading config';
    }
}

function getDispState() {
    const data = safeReadJSON(path.join(__dirname, '../../disp_settings.json'));
    if (!data) return 'OFF';
    const groups = Object.keys(data).filter(k => k.endsWith('@g.us') && data[k]?.enabled);
    const dms    = Object.keys(data).filter(k => !k.endsWith('@g.us') && data[k]?.enabled);
    const parts  = [];
    if (groups.length) parts.push(`${groups.length} group(s)`);
    if (dms.length)    parts.push(`${dms.length} DM(s)`);
    return parts.length ? parts.join(' + ') : 'OFF';
}

async function getWelcomeStatus() {
    try {
        const data = await db.getConfig('welcome_data', {});
        // data is { groups: {...}, version, created, updated } — must look inside data.groups
        const groups = data?.groups || {};
        const count = Object.values(groups).filter(g => g?.enabled === true).length;
        return count ? `${count} group(s)` : 'OFF';
    } catch {}
    return 'OFF';
}

async function getGoodbyeStatus() {
    try {
        const data = await db.getConfig('goodbye_data', {});
        // data is { groups: {...}, version, created, updated } — must look inside data.groups
        const groups = data?.groups || {};
        const count = Object.values(groups).filter(g => g?.enabled === true).length;
        return count ? `${count} group(s)` : 'OFF';
    } catch {}
    return 'OFF';
}

async function getJoinApprovalState() {
    try {
        const data = await db.getConfig('joinapproval_data', {});
        if (!data || !data.groups) return 'OFF';
        const enabled = Object.values(data.groups).filter(g => g?.enabled === true);
        return enabled.length ? `${enabled.length} group(s)` : 'OFF';
    } catch {}
    return 'OFF';
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (min > 0) parts.push(`${min}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

function countCommands(dir) {
    let count = 0;
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) count += countCommands(full);
            else if (item.endsWith('.js')) count++;
        }
    } catch {}
    return count;
}

export default {
    name: 'getsettings',
    alias: ['settings', 'config', 'botconfig', 'showconfig'],
    description: 'View all bot settings and configuration',
    category: 'owner',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command!*\n\nOnly the bot owner can view settings.'
            }, { quoted: msg });
        }

        try {
            // ── Loading indicator ─────────────────────────────────────────
            const fkontak = await sendLoadingMessage(sock, chatId, 'settings', msg);

            // ── Gather all settings ───────────────────────────────────────
            const botName      = getBotName();
            const version      = getBotVersion();
            const ownerNumber  = global.OWNER_CLEAN_NUMBER || global.OWNER_NUMBER || sock.user?.id?.split('@')[0] || 'Unknown';
            const isPrefixless = getPrefixlessStatus();
            const prefix       = isPrefixless ? 'none' : getPrefix();
            const mode         = getBotMode();
            const menuStyle    = getMenuStyle();
            const menuImageStatus = getMenuImageStatus();
            const menuImageUrl    = getMenuImageUrlOnly();
            const footer       = getFooter();
            const ram          = getRAMUsage();
            const uptime       = menuFormatUptime(process.uptime());
            const totalCmds    = globalThis._loadedCommandCount || countCommands(path.join(__dirname, '../../commands'));
            const platform     = detectPlatform();

            const autotyping         = getAutotypingState();
            const autorecording      = getAutorecordingState();
            const autoread           = getAutoreadState();
            const autoViewStatus     = getAutoViewStatusState();
            const autoDownloadStatus = getAutoDownloadStatusState();
            const autoreactStatus    = getAutoreactStatusState();
            const autoreply          = getAutoreplyState();
            const musicMode          = getMusicModeState();
            const chatbotState       = getChatbotState();

            const anticall      = getAnticallState();
            const anticallMsg   = getAnticallMessage();
            const antibug       = getAntibugState();
            const antilink      = getAntilinkState();
            const antispam      = getAntispamState();
            const antiforward   = getAntiforwardState();
            const onlinePresence = getOnlinePresenceState();
            const dispState     = getDispState();

            const warnLimit        = getPerGroupLimit('default');
            const welcomeStatus    = await getWelcomeStatus();
            const goodbyeStatus    = await getGoodbyeStatus();
            const joinApproval     = await getJoinApprovalState();

            let antidelete = 'OFF';
            try {
                const adCfg = await db.getConfig('antidelete_settings', null);
                if (adCfg?.enabled === true) antidelete = (adCfg.mode || 'private').toUpperCase();
            } catch {}

            let antidemote = 'OFF';
            try {
                const adm = await db.getConfig('antidemote_config', null);
                if (adm && typeof adm === 'object') {
                    const en = Object.values(adm).filter(v => v?.enabled);
                    if (en.length) antidemote = `${en.length} group(s)`;
                }
            } catch {}

            let antipromote = 'OFF';
            try {
                const apm = safeReadJSON(path.join(__dirname, '../../data/antipromote/config.json'))
                    || await db.getConfig('antipromote_config', null);
                if (apm && typeof apm === 'object') {
                    const en = Object.values(apm).filter(v => v?.enabled);
                    if (en.length) antipromote = `${en.length} group(s)`;
                }
            } catch {}

            let antideleteStatus = 'OFF';
            try {
                const adsInfo = getStatusAntideleteInfo();
                if (adsInfo.enabled) antideleteStatus = (adsInfo.mode || 'private').toUpperCase();
            } catch {}

            let antieditDisplay = 'OFF';
            try {
                const aeInfo = getAntieditInfo();
                if (aeInfo.gc.enabled || aeInfo.pm.enabled) {
                    const gcMode = aeInfo.gc.enabled ? aeInfo.gc.mode.toUpperCase() : 'OFF';
                    const pmMode = aeInfo.pm.enabled ? aeInfo.pm.mode.toUpperCase() : 'OFF';
                    antieditDisplay = `GC: ${gcMode} | PM: ${pmMode}`;
                }
            } catch {}

            let readReceipts = 'Not set';
            try {
                const rrPref = await db.getConfig('read_receipts_pref', null);
                if (rrPref?.mode === 'all') readReceipts = 'ON';
                else if (rrPref?.mode === 'none') readReceipts = 'OFF';
            } catch {}

            // ── Faded header (visible before "Read more") ─────────────────
            const headerText =
`╭──⌈ ⚙️ ${botName} — Settings ⌋
┃ ◆ Owner: ${ownerNumber}
┃ ◆ Mode: ${mode.toUpperCase()}
┃ ◆ Prefix: [ ${prefix} ]${isPrefixless ? ' + prefixless' : ''}
┃ ◆ Version: ${version}
┃ ◆ Platform: ${platform}
┃ ◆ Uptime: ${uptime}
┃ ◆ RAM: ${ram.bar} ${ram.percent}%
┃ ◆ Memory: ${ram.usedMB}MB / ${ram.totalMB}MB
┃ ◆ Commands: ${totalCmds} loaded
╰────────────────`;

            const fadedHeader = createFadedEffect(headerText);

            // ── Settings body (hidden behind "Read more") ──────────────────
            let body = '';

            // ── BOT CORE ──
            body += `╭─⊷ *⚙️ BOT CORE*\n`;
            body += `│ ◎ *Bot Name:* ${botName}\n`;
            body += `│ ◎ *Owner:* ${ownerNumber}\n`;
            body += `│ ◎ *Prefix:* ${prefix}${isPrefixless ? '  *(+ prefixless ON)*' : ''}\n`;
            body += `│ ◎ *Mode:* ${mode.toUpperCase()}\n`;
            body += `│ ◎ *Menu Style:* ${menuStyle}\n`;
            body += `│ ◎ *Menu Image:* ${menuImageStatus}\n`;
            if (menuImageUrl) {
                const short = menuImageUrl.length > 50 ? menuImageUrl.substring(0, 50) + '…' : menuImageUrl;
                body += `│ ◎ *Menu Image URL:* ${short}\n`;
            }
            body += `│ ◎ *Footer:* ${footer.length > 45 ? footer.substring(0, 45) + '…' : footer}\n`;
            body += `│ ◎ *Timezone:* ${globalThis._timezone || 'UTC'}\n`;
            body += `│ ◎ *Read Receipts:* ${readReceipts}\n`;
            body += `│ ◎ *Online Presence:* ${onlinePresence}\n`;
            body += `│ ◎ *Disappearing Msgs:* ${dispState}\n`;
            body += `╰──────────────\n\n`;

            // ── AUTOMATION ──
            body += `╭─⊷ *🎵 AUTOMATION*\n`;
            body += `│ ◎ *Autotyping:* ${autotyping}\n`;
            body += `│ ◎ *Autorecording:* ${autorecording}\n`;
            body += `│ ◎ *Autoread:* ${autoread}\n`;
            body += `│ ◎ *Auto View Status:* ${autoViewStatus}\n`;
            body += `│ ◎ *Auto Download Status:* ${autoDownloadStatus}\n`;
            body += `│ ◎ *Autoreact Status:* ${autoreactStatus}\n`;
            body += `│ ◎ *Autoreply:* ${autoreply}\n`;
            body += `│ ◎ *Music Mode:* ${musicMode}\n`;
            body += `╰──────────────\n\n`;

            // ── AI / CHATBOT ──
            body += `╭─⊷ *🤖 AI / CHATBOT*\n`;
            body += `│ ◎ *Chatbot:* ${chatbotState}\n`;
            body += `╰──────────────\n\n`;

            // ── PROTECTION ──
            body += `╭─⊷ *🛡️ PROTECTION*\n`;
            body += `│ ◎ *Anticall:* ${anticall}\n`;
            body += `│ ◎ *Anticall Msg:* ${anticallMsg}\n`;
            body += `│ ◎ *Antidelete:* ${antidelete}\n`;
            body += `│ ◎ *Antidelete Status:* ${antideleteStatus}\n`;
            body += `│ ◎ *Antiedit:* ${antieditDisplay}\n`;
            body += `│ ◎ *Antilink:* ${antilink}\n`;
            body += `│ ◎ *Antispam:* ${antispam}\n`;
            body += `│ ◎ *Antiforward:* ${antiforward}\n`;
            body += `│ ◎ *Antibug:* ${antibug}\n`;
            body += `│ ◎ *Antidemote:* ${antidemote}\n`;
            body += `│ ◎ *Antipromote:* ${antipromote}\n`;
            body += `│ ◎ *Warn Limit:* ${warnLimit}\n`;
            body += `╰──────────────\n\n`;

            // ── GROUP FEATURES ──
            body += `╭─⊷ *👥 GROUP FEATURES*\n`;
            body += `│ ◎ *Welcome:* ${welcomeStatus}\n`;
            body += `│ ◎ *Goodbye:* ${goodbyeStatus}\n`;
            body += `│ ◎ *Join Approval:* ${joinApproval}\n`;
            body += `╰──────────────\n\n`;

            // ── BOT STATS ──
            body += `╭─⊷ *📊 BOT STATS*\n`;
            body += `│ ◎ *Uptime:* ${uptime}\n`;
            body += `│ ◎ *RAM:* ${ram.usedMB}MB / ${ram.totalMB}MB (${ram.percent}%)\n`;
            body += `│ ◎ *Commands:* ${totalCmds}\n`;
            body += `│ ◎ *Node:* ${process.version}\n`;
            body += `│ ◎ *Platform:* ${platform}\n`;
            body += `│ ◎ *OS:* ${process.platform} ${process.arch}\n`;
            body += `╰──────────────\n`;

            body += `\n🕒 *Updated:* ${new Date().toLocaleString()}\n`;
            body += `\n${getFooter(msg.key.participant || msg.key.remoteJid)}`;

            // ── Combine and send ──────────────────────────────────────────
            const fullText = createReadMoreEffect(fadedHeader, body);
            const media = await getMenuImageBuffer();

            if (media) {
                if (media.type === 'gif' && media.mp4Buffer) {
                    await sock.sendMessage(chatId, {
                        video: media.mp4Buffer,
                        gifPlayback: true,
                        caption: fullText,
                        mimetype: 'video/mp4'
                    }, { quoted: fkontak });
                } else {
                    await sock.sendMessage(chatId, {
                        image: media.buffer,
                        caption: fullText,
                        mimetype: 'image/jpeg'
                    }, { quoted: fkontak });
                }
            } else {
                await sock.sendMessage(chatId, { text: fullText }, { quoted: fkontak });
            }

        } catch (error) {
            console.error('[GetSettings] Error:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to load settings: ' + error.message
            }, { quoted: msg });
        }
    }
};
