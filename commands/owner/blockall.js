import { delay } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'blockall',
    alias: ['blockeveryone', 'blockcontacts'],
    description: 'Block all known contacts',
    category: 'owner',
    ownerOnly: true,
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;

        const contacts = global.contactNames ? [...global.contactNames.keys()] : [];
        const uniqueJids = new Set();

        for (const key of contacts) {
            if (!key.includes('@') && key.length > 5 && /^\d+$/.test(key)) {
                uniqueJids.add(`${key}@s.whatsapp.net`);
            }
        }

        const ownerId = sock.user?.id?.split(':')[0]?.split('@')[0];
        if (ownerId) uniqueJids.delete(`${ownerId}@s.whatsapp.net`);

        const jidList = [...uniqueJids];

        if (jidList.length === 0) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🚫 *BLOCK ALL* ⌋\n│\n├─⊷ ⚠️ No contacts found to block.\n│  Contacts are loaded as the bot receives\n│  messages. Try again after chatting.\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
            text: `╭─⌈ 🚫 *BLOCK ALL* ⌋\n│\n├─⊷ 🔄 Blocking *${jidList.length}* contacts...\n├─⊷ ⚠️ This may take a moment\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
        }, { quoted: msg });

        let blocked = 0;
        let failed = 0;

        for (const jid of jidList) {
            try {
                await sock.updateBlockStatus(jid, 'block');
                blocked++;
                await delay(500);
            } catch {
                failed++;
            }
        }

        return sock.sendMessage(chatId, {
            text: `╭─⌈ 🚫 *BLOCK ALL - DONE* ⌋\n│\n├─⊷ ✅ Blocked: *${blocked}*\n├─⊷ ❌ Failed: *${failed}*\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
        }, { quoted: msg });
    }
};
