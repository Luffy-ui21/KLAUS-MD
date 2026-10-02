import { clearAllSudo } from '../../lib/sudo-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'clearsudo',
    alias: ['resetallsudo', 'sudoclear'],
    category: 'owner',
    description: 'Remove all sudo users',
    ownerOnly: true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command!*\n\nOnly the bot owner can clear all sudo users.'
            }, { quoted: msg });
        }

        if (args[0] !== 'confirm') {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ ⚠️ *CLEAR SUDO* ⌋\n│\n├─⊷ *${PREFIX}clearsudo confirm*\n│  └⊷ Remove ALL sudo users\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const result = clearAllSudo(extra.OWNER_NUMBER);

        await sock.sendMessage(chatId, {
            text: `✅ *All Sudo Users Cleared*\n\n🗑️ Removed: ${result.removed} user(s)\n👑 Owner access: Unchanged\n\n_All sudo privileges have been revoked._`
        }, { quoted: msg });
    }
};
