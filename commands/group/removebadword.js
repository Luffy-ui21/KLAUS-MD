import { removeBadWord, getBadWords } from '../../lib/badwords-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'removebadword',
    alias: ['delbadword', 'deleteswear', 'unbanword'],
    description: 'Remove a word from the bad word filter list for this chat',
    category: 'group',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const scope = isGroup ? chatId : 'global';
        const scopeLabel = isGroup ? 'this group' : 'DMs';

        if (!args || args.length === 0) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🤬 *REMOVE BAD WORD* ⌋\n│\n` +
                    `├─⊷ *Usage:* .removebadword <word>\n` +
                    `├─⊷ *Example:* .removebadword badterm\n│\n` +
                    `├─⊷ Use *.listbadword* to view words for ${scopeLabel}\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        const removed = [];
        const notFound = [];

        for (const word of args) {
            const clean = word.toLowerCase().trim();
            if (!clean) continue;
            if (removeBadWord(clean, scope)) {
                removed.push(clean);
            } else {
                notFound.push(clean);
            }
        }

        const total = getBadWords(scope).length;
        let reply = `╭─⌈ 🤬 *BAD WORD FILTER* ⌋\n│\n`;
        if (removed.length > 0)  reply += `├─⊷ ✅ Removed: ${removed.map(w => `*${w}*`).join(', ')}\n`;
        if (notFound.length > 0) reply += `├─⊷ ⚠️ Not found in ${scopeLabel}: ${notFound.map(w => `*${w}*`).join(', ')}\n`;
        reply += `├─⊷ 📋 Remaining in ${scopeLabel}: *${total}*\n`;
        reply += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

        return sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    }
};
