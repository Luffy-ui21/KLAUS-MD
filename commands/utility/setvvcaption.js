import db from '../../lib/database.js';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

let prefsCache = null;
let cacheLoaded = false;

async function loadPreferences() {
    if (cacheLoaded && prefsCache) return prefsCache;
    try {
        const data = await db.getConfig('vv_caption_prefs', {});
        prefsCache = Array.isArray(data) ? data : [];
        cacheLoaded = true;
    } catch {
        if (!prefsCache) prefsCache = [];
    }
    return prefsCache;
}

async function savePreferences(prefs) {
    prefsCache = prefs;
    await db.setConfig('vv_caption_prefs', prefs);
}

export default {
    name: 'setvvcaption',
    alias: ['vvcaption', 'viewoncecaption'],
    category: 'utility',
    description: 'Set custom caption for view-once downloads',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;

        if (!args[0]) {
            const prefs = await loadPreferences();
            const existing = prefs.find(p => p.chatId === chatId);
            const current = existing?.customCaption || `Retrieved by ${getBotName()}`;

            return sock.sendMessage(chatId, {
                text: `╭─⌈ 📝 *VIEW-ONCE CAPTION* ⌋\n│\n│  Current: "${current}"\n│\n├─⊷ *${PREFIX}setvvcaption <text>*\n│  └⊷ Set custom caption\n│\n├─⊷ *${PREFIX}setvvcaption reset*\n│  └⊷ Reset to default\n│\n├─⊷ *${PREFIX}setvvcaption none*\n│  └⊷ Disable caption\n│\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const newCaption = args.join(' ');
        const prefs = await loadPreferences();
        const idx = prefs.findIndex(p => p.chatId === chatId);

        let captionValue = newCaption;
        let displayText = '';

        if (newCaption.toLowerCase() === 'reset') {
            captionValue = `Retrieved by ${getBotName()}`;
            displayText = `Reset to default: "Retrieved by ${getBotName()}"`;
        } else if (newCaption.toLowerCase() === 'none') {
            captionValue = '';
            displayText = 'Caption disabled';
        } else {
            displayText = `Set to: "${captionValue}"`;
        }

        if (idx >= 0) {
            prefs[idx].customCaption = captionValue;
        } else {
            prefs.push({
                chatId,
                customCaption: captionValue,
                showSenderInfo: true,
                showFileInfo: true,
                showOriginalCaption: true
            });
        }

        await savePreferences(prefs);

        await sock.sendMessage(chatId, {
            text: `✅ *VV Caption Updated*\n\n${displayText}\n\nThis will be shown on all downloaded view-once media.`
        }, { quoted: msg });
    }
};
