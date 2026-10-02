import { setGroupConfig, getGroupAction, getFullConfig, getBadWords } from '../../lib/badwords-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'antibadword',
    alias: ['badwordfilter', 'swearfilter'],
    description: 'Toggle bad word detection for this group/chat',
    category: 'group',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const scope = isGroup ? chatId : 'global';

        const sub = (args[0] || '').toLowerCase();
        const action = (args[1] || '').toLowerCase();

        if (!sub || sub === 'status') {
            const config = getFullConfig();
            const cfg = config[scope] || {};
            const enabled = cfg.enabled || false;
            const act = cfg.action || 'warn';
            const scopeWords = getBadWords(scope).length;
            const scopeLabel = isGroup ? 'This group' : 'DMs';

            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🤬 *ANTI BAD WORD* ⌋\n│\n` +
                    `├─⊷ *Scope:* ${scopeLabel}\n` +
                    `├─⊷ *Status:* ${enabled ? '✅ ON' : '❌ OFF'}\n` +
                    `├─⊷ *Action:* ${act}\n` +
                    `├─⊷ *Words here:* ${scopeWords}\n│\n` +
                    `├─⊷ *Usage:*\n` +
                    `│  .antibadword on [warn/kick/block/delete]\n` +
                    `│  .antibadword off\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        if (sub === 'global') {
            const gSub = (args[1] || '').toLowerCase();
            const gAction = (args[2] || 'warn').toLowerCase();
            const validActions = ['warn', 'kick', 'block', 'delete'];
            const finalAction = validActions.includes(gAction) ? gAction : 'warn';

            if (gSub === 'on') {
                setGroupConfig('global', true, finalAction);
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🤬 *ANTI BAD WORD* ⌋\n│\n├─⊷ ✅ *Global detection ON*\n├─⊷ *Action:* ${finalAction}\n├─⊷ Applies to all groups and DMs\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
                }, { quoted: msg });
            } else if (gSub === 'off') {
                setGroupConfig('global', false);
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🤬 *ANTI BAD WORD* ⌋\n│\n├─⊷ ❌ *Global detection OFF*\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
                }, { quoted: msg });
            }
        }

        if (sub === 'on') {
            const validActions = ['warn', 'kick', 'block', 'delete'];
            const finalAction = validActions.includes(action) ? action : 'warn';
            setGroupConfig(scope, true, finalAction);
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🤬 *ANTI BAD WORD* ⌋\n│\n├─⊷ ✅ *Detection ENABLED*\n├─⊷ *Scope:* ${isGroup ? 'This group' : 'All DMs'}\n├─⊷ *Action:* ${finalAction}\n│\n├─⊷ warn → send warning message\n├─⊷ kick → remove from group\n├─⊷ block → block the user\n├─⊷ delete → delete message silently\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        if (sub === 'off') {
            setGroupConfig(scope, false);
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🤬 *ANTI BAD WORD* ⌋\n│\n├─⊷ ❌ *Detection DISABLED*\n├─⊷ *Scope:* ${isGroup ? 'This group' : 'All DMs'}\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        return sock.sendMessage(chatId, {
            text: `╭─⌈ 🤬 *ANTI BAD WORD* ⌋\n│\n├─⊷ *Usage:*\n│  .antibadword on [warn/kick/block]\n│  .antibadword off\n│  .antibadword status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
        }, { quoted: msg });
    }
};
