import { getUser, updateUser, getSender, getMentionTarget, parseAmount, cleanId, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'pay',
    aliases: ['send', 'transfer'],
    category: 'economy',
    description: 'Send coins to another member. Usage: .pay @user <amount>',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const senderId = cleanId(senderJid);

        const targetId = getMentionTarget(m);
        if (!targetId) {
            return sock.sendMessage(chatId, {
                text: `❌ Mention or reply to a user.\nUsage: *.pay @user <amount>*`
            }, { quoted: m });
        }
        if (targetId === senderId) {
            return sock.sendMessage(chatId, { text: `❌ You can't pay yourself.` }, { quoted: m });
        }

        // First non-mention arg is the amount (handles ".pay @x 500" or ".pay 500 @x").
        // Mentions are detected by leading "@" or by full international JIDs (10+ digits).
        // Pure amount tokens look like "500", "1.5k", "2m", "all", "half".
        const numericArg = args.find(a => {
            if (a.startsWith('@')) return false;
            if (/^\d{10,}$/.test(a)) return false;          // raw phone number, not amount
            return /^([\d.]+\s*[kmb]?|all|max|half)$/i.test(a);
        });
        const sender = getUser(senderId);
        const amount = parseAmount(numericArg, sender.wallet);

        if (!isFinite(amount) || amount <= 0) {
            return sock.sendMessage(chatId, { text: `❌ Enter a valid amount.` }, { quoted: m });
        }
        if (amount > sender.wallet) {
            return sock.sendMessage(chatId, {
                text: `❌ You only have ${COIN} ${fmt(sender.wallet)} in your wallet.`
            }, { quoted: m });
        }

        updateUser(senderId, (u) => { u.wallet -= amount; u.xp += 2; });
        updateUser(targetId, (u) => { u.wallet += amount; });

        const fresh = getUser(senderId);
        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 💱 *PAYMENT SENT* ⌋\n` +
                `├─⊷ To     : @${targetId}\n` +
                `├─⊷ Amount : ${COIN} ${fmt(amount)}\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`,
            mentions: [`${targetId}@s.whatsapp.net`]
        }, { quoted: m });
    }
};
