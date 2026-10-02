import { removeSudo } from '../../lib/sudo-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

function resolveRealNumber(jid, sock) {
    if (!jid) return null;
    if (!jid.includes('@lid')) {
        const raw = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (raw && raw.length >= 7 && raw.length <= 15) return raw;
        return null;
    }
    if (sock) {
        try {
            if (sock.signalRepository?.lidMapping?.getPNForLID) {
                const pn = sock.signalRepository.lidMapping.getPNForLID(jid);
                if (pn) {
                    const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                    if (num.length >= 7) return num;
                }
            }
        } catch {}
    }
    return null;
}

export default {
    name: 'delsudo',
    alias: ['removesudo', 'rmsudo'],
    category: 'owner',
    description: 'Remove a user from the sudo list',
    ownerOnly: true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command!*\n\nOnly the bot owner can remove sudo users.'
            }, { quoted: msg });
        }

        let targetNumber = null;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quoted) {
            targetNumber = resolveRealNumber(quoted, sock);
            if (!targetNumber) {
                targetNumber = quoted.split('@')[0].split(':')[0];
            }
        } else if (args[0]) {
            targetNumber = args[0].replace(/[^0-9]/g, '');
        } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            targetNumber = resolveRealNumber(mentioned, sock);
            if (!targetNumber) {
                targetNumber = mentioned.split('@')[0].split(':')[0];
            }
        }

        if (!targetNumber || targetNumber.length < 7) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 📋 *REMOVE SUDO* ⌋\n│\n├─⊷ *${PREFIX}delsudo <number>*\n│  └⊷ Remove by number\n├─⊷ *Reply + ${PREFIX}delsudo*\n│  └⊷ Remove via reply\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const result = removeSudo(targetNumber);

        if (result.success) {
            await sock.sendMessage(chatId, {
                text: `✅ *Sudo User Removed*\n\n👤 Number: +${result.number}\n🔒 Access: Revoked\n\n_This user can no longer use owner commands._`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `❌ *Failed:* ${result.reason}`
            }, { quoted: msg });
        }
    }
};
