import { delay } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'unblockall',
    alias: ['unblockeveryone', 'unblockcontacts'],
    description: 'Unblock all currently blocked contacts',
    category: 'owner',
    ownerOnly: true,
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;

        let blocklist = [];
        try {
            blocklist = await sock.fetchBlocklist();
        } catch {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ ✅ *UNBLOCK ALL* ⌋\n│\n├─⊷ ⚠️ Failed to fetch block list.\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        if (!blocklist || blocklist.length === 0) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ ✅ *UNBLOCK ALL* ⌋\n│\n├─⊷ ✅ No blocked contacts found.\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
            text: `╭─⌈ ✅ *UNBLOCK ALL* ⌋\n│\n├─⊷ 🔄 Unblocking *${blocklist.length}* contacts...\n├─⊷ ⚠️ This may take a moment\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
        }, { quoted: msg });

        let unblocked = 0;
        let failed = 0;

        for (const jid of blocklist) {
            try {
                await sock.updateBlockStatus(jid, 'unblock');
                unblocked++;
                await delay(500);
            } catch {
                failed++;
            }
        }

        return sock.sendMessage(chatId, {
            text: `╭─⌈ ✅ *UNBLOCK ALL - DONE* ⌋\n│\n├─⊷ ✅ Unblocked: *${unblocked}*\n├─⊷ ❌ Failed: *${failed}*\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
        }, { quoted: msg });
    }
};
