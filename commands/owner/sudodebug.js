import { isSudoNumber, isSudoJid, isSudoByLid, getPhoneFromLid, getSudoList } from '../../lib/sudo-store.js';

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
    name: 'sudodebug',
    alias: ['debugsudo'],
    category: 'owner',
    description: 'Debug sudo detection - shows JID format and sudo check results',
    ownerOnly: true,
    sudoAllowed: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isGroup = chatId.includes('@g.us');
        const senderJid = msg.key.participant || chatId;

        let targetJid = senderJid;
        let targetLabel = 'You (sender)';

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quoted) {
            targetJid = quoted;
            targetLabel = 'Quoted user';
        }

        const rawNum = targetJid.split('@')[0].split(':')[0];
        const cleaned = jidManager.cleanJid(targetJid);
        const isLid = targetJid.includes('@lid');

        const signalResolved = resolveRealNumber(targetJid, sock);
        const lidMapResolved = getPhoneFromLid(rawNum);

        let asyncSudo = false;
        try {
            if (jidManager.isSudoAsync) {
                asyncSudo = await jidManager.isSudoAsync(msg, sock);
            }
        } catch {}

        const checks = {
            isSudoJid: isSudoJid(targetJid),
            isSudoNumber: isSudoNumber(cleaned.cleanNumber),
            isSudoRawNum: isSudoNumber(rawNum),
            isSudoByLid: isSudoByLid(rawNum),
            signalResolved: signalResolved,
            signalIsSudo: signalResolved ? isSudoNumber(signalResolved) : false,
            lidMapResolved: lidMapResolved,
            isSudoFinal: jidManager.isSudo(msg),
            isSudoAsync: asyncSudo,
            isOwner: jidManager.isOwner(msg),
        };

        const { sudoers } = getSudoList();

        let debugInfo = `🔍 *SUDO DEBUG INFO*\n\n`;
        debugInfo += `📋 *Target:* ${targetLabel}\n`;
        debugInfo += `📱 *Full JID:* ${targetJid}\n`;
        debugInfo += `🔢 *Raw Number:* ${rawNum}\n`;
        debugInfo += `🧹 *Clean Number:* ${cleaned.cleanNumber}\n`;
        debugInfo += `🏷️ *Is LID:* ${isLid ? 'YES ⚠️' : 'NO ✅'}\n`;
        debugInfo += `📍 *Chat:* ${isGroup ? 'Group' : 'DM'}\n\n`;

        debugInfo += `🔑 *RESOLUTION:*\n`;
        debugInfo += `├ Signal LID→Phone: ${checks.signalResolved || '❌ not available'}\n`;
        debugInfo += `├ LID Map→Phone: ${checks.lidMapResolved || '❌ not mapped'}\n`;
        debugInfo += `└ Signal is sudo: ${checks.signalIsSudo ? '✅' : '❌'}\n\n`;

        debugInfo += `🔑 *SUDO CHECKS:*\n`;
        debugInfo += `├ isSudoJid: ${checks.isSudoJid ? '✅' : '❌'}\n`;
        debugInfo += `├ isSudoNumber(clean): ${checks.isSudoNumber ? '✅' : '❌'}\n`;
        debugInfo += `├ isSudoNumber(raw): ${checks.isSudoRawNum ? '✅' : '❌'}\n`;
        debugInfo += `├ isSudoByLid: ${checks.isSudoByLid ? '✅' : '❌'}\n`;
        debugInfo += `├ isSudo (sync): ${checks.isSudoFinal ? '✅ YES' : '❌ NO'}\n`;
        debugInfo += `├ isSudo (async): ${checks.isSudoAsync ? '✅ YES' : '❌ NO'}\n`;
        debugInfo += `└ isOwner: ${checks.isOwner ? '✅' : '❌'}\n\n`;

        debugInfo += `📋 *Registered Sudos:* ${sudoers.join(', ') || 'none'}\n`;
        debugInfo += `🔗 *Signal API:* ${sock?.signalRepository?.lidMapping?.getPNForLID ? '✅ Available' : '❌ Not available'}\n`;

        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const participants = metadata.participants || [];

                debugInfo += `\n👥 *Group Sample (first 5):*\n`;
                for (let i = 0; i < Math.min(5, participants.length); i++) {
                    const p = participants[i];
                    const resolved = resolveRealNumber(p.id, sock);
                    const pIdShort = p.id.split('@')[0].split(':')[0].substring(0, 10);
                    const isSudo = resolved ? isSudoNumber(resolved) : false;
                    debugInfo += `${i + 1}. ${pIdShort}... → ${resolved || '?'} ${isSudo ? '🔑SUDO' : ''}\n`;
                }
            } catch (err) {
                debugInfo += `\n❌ Group metadata error: ${err.message}\n`;
            }
        }

        if (!checks.isSudoFinal && isLid) {
            debugInfo += `\n💡 *Fix:* Reply to their msg → \`${PREFIX}addsudo <phone>\``;
        }

        await sock.sendMessage(chatId, { text: debugInfo }, { quoted: msg });
    }
};
