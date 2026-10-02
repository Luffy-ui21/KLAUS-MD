import { getUser, getMentionTarget, getSender, cleanId, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'balance',
    aliases: ['bal', 'wallet', 'cash'],
    category: 'economy',
    description: 'Check your wallet & bank balance.',
    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const targetId = getMentionTarget(m) || cleanId(senderJid);
        const isSelf = targetId === cleanId(senderJid);

        const u = getUser(targetId);
        const total = u.wallet + u.bank;
        const mentions = isSelf ? [] : [`${targetId}@s.whatsapp.net`];
        const tag = isSelf ? '*Your*' : `@${targetId}`;

        const text =
            `╭─⌈ ${COIN} *BALANCE* ⌋\n` +
            `├─⊷ ${tag}\n` +
            `├─⊷ Wallet : ${COIN} ${fmt(u.wallet)}\n` +
            `├─⊷ Bank   : ${COIN} ${fmt(u.bank)} / ${fmt(u.bankCap)}\n` +
            `├─⊷ Total  : ${COIN} ${fmt(total)}\n` +
            `├─⊷ Level  : ${u.level}  (XP ${u.xp}/${100 * u.level})\n` +
            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

        await sock.sendMessage(chatId, { text, mentions }, { quoted: m });
    }
};
