import { getUser, updateUser, getSender, parseAmount, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'withdraw',
    aliases: ['wd'],
    category: 'economy',
    description: 'Move coins from bank → wallet. Usage: .withdraw <amount|all|half>',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const u = getUser(senderJid);

        if (!args[0]) {
            return sock.sendMessage(chatId, {
                text: `❌ Usage: *.withdraw <amount|all|half>*\nWallet: ${COIN} ${fmt(u.wallet)} • Bank: ${COIN} ${fmt(u.bank)}/${fmt(u.bankCap)}`
            }, { quoted: m });
        }

        const amount = parseAmount(args[0], u.bank);
        if (!isFinite(amount) || amount <= 0) {
            return sock.sendMessage(chatId, { text: `❌ Invalid amount.` }, { quoted: m });
        }
        if (amount > u.bank) {
            // Common confusion: user has money in wallet but tries to withdraw.
            // Point them to .deposit so the workflow makes sense.
            const hint = u.wallet > 0
                ? `\n\n💡 Your *wallet* has ${COIN} ${fmt(u.wallet)} — that's already spendable.\nUse *.deposit* to move it into the bank for safekeeping.`
                : '';
            return sock.sendMessage(chatId, {
                text: `❌ Bank only has ${COIN} ${fmt(u.bank)}.${hint}`
            }, { quoted: m });
        }

        updateUser(senderJid, (user) => {
            user.bank   -= amount;
            user.wallet += amount;
            user.xp    += 1;
        });
        const fresh = getUser(senderJid);

        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 💸 *WITHDRAW* ⌋\n` +
                `├─⊷ Moved  : ${COIN} ${fmt(amount)}\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `├─⊷ Bank   : ${COIN} ${fmt(fresh.bank)}/${fmt(fresh.bankCap)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
