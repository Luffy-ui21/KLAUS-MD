import { addBadWord, getBadWords } from '../../lib/badwords-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'addbadword',
    alias: ['addswear', 'banword'],
    description: 'Add a word to the bad word filter list for this chat',
    category: 'group',
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const scope = isGroup ? chatId : 'global';
        const scopeLabel = isGroup ? 'this group' : 'DMs';

        if (!args || args.length === 0) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🤬 *ADD BAD WORD* ⌋\n│\n` +
                    `├─⊷ *Usage:* .addbadword <word>\n` +
                    `├─⊷ *Example:* .addbadword badterm\n│\n` +
                    `├─⊷ Add multiple: .addbadword word1 word2\n` +
                    `├─⊷ *Scope:* ${scopeLabel} only\n│\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        const added = [];
        const existing = [];

        for (const word of args) {
            const clean = word.toLowerCase().trim();
            if (!clean) continue;
            if (addBadWord(clean, scope)) {
                added.push(clean);
            } else {
                existing.push(clean);
            }
        }

        const total = getBadWords(scope).length;
        let reply = `╭─⌈ 🤬 *BAD WORD FILTER* ⌋\n│\n`;
        if (added.length > 0)    reply += `├─⊷ ✅ Added: ${added.map(w => `*${w}*`).join(', ')}\n`;
        if (existing.length > 0) reply += `├─⊷ ⚠️ Already exists: ${existing.map(w => `*${w}*`).join(', ')}\n`;
        reply += `├─⊷ 📋 Words in ${scopeLabel}: *${total}*\n`;
        reply += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

        return sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    }
};
