import { getBadWords, getAllScopedWords } from '../../lib/badwords-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'listbadword',
    alias: ['listswear', 'badwords', 'badwordlist'],
    description: 'List bad words for this chat (group or DMs)',
    category: 'group',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const scope = isGroup ? chatId : 'global';
        const scopeLabel = isGroup ? 'this group' : 'DMs';

        // .listbadword all — owner-only overview of all scopes
        if (args[0] === 'all') {
            const allScopes = getAllScopedWords();
            const entries = Object.entries(allScopes).filter(([, w]) => w.length > 0);
            if (entries.length === 0) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🤬 *BAD WORD FILTER* ⌋\n│\n├─⊷ No bad words set anywhere.\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
                }, { quoted: msg });
            }
            let reply = `╭─⌈ 🤬 *ALL BAD WORD SCOPES* ⌋\n│\n`;
            for (const [s, words] of entries) {
                const label = s === 'global' ? '📱 DMs' : `👥 Group: ...${s.slice(-6)}`;
                reply += `├─⊷ ${label} (${words.length}): ${words.map(w => `*${w}*`).join(', ')}\n`;
            }
            reply += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            return sock.sendMessage(chatId, { text: reply }, { quoted: msg });
        }

        const words = getBadWords(scope);

        if (words.length === 0) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🤬 *BAD WORD FILTER* ⌋\n│\n` +
                    `├─⊷ No bad words set for ${scopeLabel}.\n│\n` +
                    `├─⊷ Use *.addbadword <word>* to add\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        const numbered = words.map((w, i) => `│  ${i + 1}. ${w}`).join('\n');
        return sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🤬 *BAD WORD FILTER — ${scopeLabel.toUpperCase()}* ⌋\n│\n` +
                `├─⊷ *Total:* ${words.length} word(s)\n│\n` +
                `${numbered}\n│\n` +
                `├─⊷ Use *.removebadword <word>* to remove\n` +
                `├─⊷ Use *.antibadword on/off* to toggle\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
        }, { quoted: msg });
    }
};
