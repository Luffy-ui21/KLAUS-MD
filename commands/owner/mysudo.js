import { isSudoNumber, isSudoJid, getSudoList } from '../../lib/sudo-store.js';

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
    name: 'mysudo',
    alias: ['amisudo', 'sudostatus'],
    category: 'owner',
    description: 'Check your own sudo status',
    ownerOnly: false,
    sudoAllowed: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        
        let senderNumber = resolveRealNumber(senderJid, sock);
        if (!senderNumber) {
            senderNumber = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        }

        const isSudo = isSudoNumber(senderNumber) || isSudoJid(senderJid);

        const { jidManager } = extra;
        const isOwner = jidManager?.isOwner(msg);

        let statusText = `🔍 *Your Sudo Status*\n\n`;
        statusText += `👤 Number: +${senderNumber}\n`;

        if (isOwner) {
            statusText += `👑 Role: *BOT OWNER*\n`;
            statusText += `🔑 Access: Full (all commands)\n`;
        } else if (isSudo) {
            statusText += `🔑 Role: *SUDO USER*\n`;
            statusText += `🔓 Access: Owner-level commands\n`;
            
            const { addedAt } = getSudoList();
            if (addedAt[senderNumber]) {
                statusText += `📅 Added: ${new Date(addedAt[senderNumber]).toLocaleDateString()}\n`;
            }
        } else {
            statusText += `🔒 Role: *Regular User*\n`;
            statusText += `❌ Access: Standard commands only\n`;
        }

        statusText += `\n💡 _Contact the bot owner to request sudo access._`;

        await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
    }
};
