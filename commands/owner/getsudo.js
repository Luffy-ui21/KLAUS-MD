import { getSudoList } from '../../lib/sudo-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'getsudo',
    alias: ['sudojid', 'sudoids'],
    category: 'owner',
    description: 'Get the real WhatsApp JIDs of all sudo users',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const { sudoers, addedAt, jidMap } = getSudoList();

        if (sudoers.length === 0) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔍 *SUDO JIDs* ⌋\n│\n├─⊷ No sudo users found\n│  └⊷ Use *${PREFIX}addsudo* to add one\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        let text = `┌─── 🔍 *SUDO JIDs* ───\n│\n`;

        sudoers.forEach((num, i) => {
            const rawJids = (jidMap && jidMap[num]) || [];
            const date = addedAt[num]
                ? new Date(addedAt[num]).toLocaleDateString('en-GB')
                : 'Unknown';

            text += `├─ *${i + 1}. +${num}*\n`;
            text += `│  📅 Added: ${date}\n`;

            if (rawJids.length === 0) {
                text += `│  📛 JID: _Not yet seen in chat_\n`;
            } else {
                rawJids.forEach((raw, j) => {
                    const domain = raw.includes('@') ? '' : '@s.whatsapp.net';
                    text += `│  ${j === 0 ? '🆔' : '   '} JID${rawJids.length > 1 ? ` ${j + 1}` : ''}: \`${raw}${domain}\`\n`;
                });
            }

            text += `│\n`;
        });

        text += `├─── *TOTAL: ${sudoers.length} sudo user(s)*\n`;
        text += `└──────────────`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    }
};
