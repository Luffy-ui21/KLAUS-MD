import { isSudoNumber } from '../../lib/sudo-store.js';
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
    name: 'checksudo',
    alias: ['issudo'],
    category: 'owner',
    description: 'Check if a number is a sudo user',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

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
                text: `╭─⌈ 📋 *CHECK SUDO* ⌋\n│\n├─⊷ *${PREFIX}checksudo <number>*\n│  └⊷ Check by number\n├─⊷ *Reply + ${PREFIX}checksudo*\n│  └⊷ Check via reply\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const isSudo = isSudoNumber(targetNumber);

        await sock.sendMessage(chatId, {
            text: `🔍 *Sudo Check*\n\n👤 Number: +${targetNumber}\n🔑 Status: ${isSudo ? '✅ *SUDO USER*' : '❌ *NOT A SUDO USER*'}`
        }, { quoted: msg });
    }
};
