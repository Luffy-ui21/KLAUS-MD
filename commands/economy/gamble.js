import { getUser, updateUser, getSender, parseAmount, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const MAX_BET = 100000;
const MIN_BET = 10;

export default {
    name: 'gamble',
    aliases: ['bet', 'flip'],
    category: 'economy',
    description: 'Bet coins on a coin flip. Usage: .gamble <amount|all|half>',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const u = getUser(senderJid);

        if (!args[0]) {
            return sock.sendMessage(chatId, {
                text:
                    `❌ Usage: *.gamble <amount|all|half>*\n` +
                    `Min ${COIN} ${MIN_BET} • Max ${COIN} ${fmt(MAX_BET)}\n` +
                    `Wallet: ${COIN} ${fmt(u.wallet)}`
            }, { quoted: m });
        }

        const bet = parseAmount(args[0], u.wallet);
        if (!isFinite(bet) || bet <= 0) {
            return sock.sendMessage(chatId, { text: `❌ Invalid amount.` }, { quoted: m });
        }
        if (bet < MIN_BET) {
            return sock.sendMessage(chatId, { text: `❌ Minimum bet is ${COIN} ${MIN_BET}.` }, { quoted: m });
        }
        if (bet > MAX_BET) {
            return sock.sendMessage(chatId, { text: `❌ Maximum bet is ${COIN} ${fmt(MAX_BET)}.` }, { quoted: m });
        }
        if (bet > u.wallet) {
            return sock.sendMessage(chatId, {
                text: `❌ You only have ${COIN} ${fmt(u.wallet)} in your wallet.`
            }, { quoted: m });
        }

        // 50/50 coin flip — pure house-edge-free for fairness; XP encourages play.
        const won = Math.random() < 0.5;
        const delta = won ? bet : -bet;
        updateUser(senderJid, (user) => {
            user.wallet += delta;
            if (won) user.wins += 1; else user.losses += 1;
            user.xp += 4;
        });
        const fresh = getUser(senderJid);

        const face = won ? '🪙 HEADS' : '🪙 TAILS';
        const verdict = won
            ? `🎉 *YOU WON!*  +${COIN} ${fmt(bet)}`
            : `💀 *YOU LOST!*  -${COIN} ${fmt(bet)}`;

        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🎰 *COIN FLIP* ⌋\n` +
                `├─⊷ Result : ${face}\n` +
                `├─⊷ ${verdict}\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
