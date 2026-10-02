import { getUser, updateUser, getSender, parseAmount, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'deposit',
    aliases: ['dep'],
    category: 'economy',
    description: 'Move coins from wallet → bank (safe from rob). Usage: .deposit <amount|all|half>',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const u = getUser(senderJid);

        if (!args[0]) {
            return sock.sendMessage(chatId, {
                text: `❌ Usage: *.deposit <amount|all|half>*\nWallet: ${COIN} ${fmt(u.wallet)} • Bank: ${COIN} ${fmt(u.bank)}/${fmt(u.bankCap)}`
            }, { quoted: m });
        }

        const space = u.bankCap - u.bank;
        if (space <= 0) {
            return sock.sendMessage(chatId, {
                text: `❌ Bank is full (${fmt(u.bank)}/${fmt(u.bankCap)}). Level up to expand it.`
            }, { quoted: m });
        }

        // Cap deposit by both wallet balance and remaining bank space.
        const ceiling = Math.min(u.wallet, space);
        const amount = parseAmount(args[0], ceiling);

        if (!isFinite(amount) || amount <= 0) {
            return sock.sendMessage(chatId, { text: `❌ Invalid amount.` }, { quoted: m });
        }
        if (amount > u.wallet) {
            // Mirror of the withdraw hint: maybe their coins are sitting in the bank.
            const hint = u.bank > 0
                ? `\n\n💡 Your *bank* has ${COIN} ${fmt(u.bank)}.\nUse *.withdraw* to bring them back to your wallet.`
                : '';
            return sock.sendMessage(chatId, {
                text: `❌ You only have ${COIN} ${fmt(u.wallet)} in your wallet.${hint}`
            }, { quoted: m });
        }
        if (amount > space) {
            return sock.sendMessage(chatId, {
                text: `❌ Bank can only hold ${COIN} ${fmt(space)} more.`
            }, { quoted: m });
        }

        updateUser(senderJid, (user) => {
            user.wallet -= amount;
            user.bank   += amount;
            user.xp    += 1;
        });
        const fresh = getUser(senderJid);

        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🏦 *DEPOSIT* ⌋\n` +
                `├─⊷ Moved  : ${COIN} ${fmt(amount)}\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `├─⊷ Bank   : ${COIN} ${fmt(fresh.bank)}/${fmt(fresh.bankCap)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
