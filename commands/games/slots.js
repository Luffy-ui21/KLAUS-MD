import { getSender } from './_sessions.js';
import { getUser, updateUser, parseAmount, COIN, fmt } from '../economy/_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

// Reel symbols ordered by rarity (left = common). Payouts scale by rarity.
// Three-of-a-kind multipliers below; two-of-a-kind pays a smaller bonus.
const REELS = ['🍒','🍋','🍊','🍇','🔔','⭐','💎','7️⃣'];
const TRIPLE_PAYOUT = {
    '🍒': 3,    '🍋': 4,    '🍊': 5,    '🍇': 8,
    '🔔': 12,   '⭐': 20,   '💎': 50,   '7️⃣': 100
};
const PAIR_PAYOUT = 1.5;        // matches return 1.5× bet

const MIN_BET = 10;
const MAX_BET = 50000;

function spin() {
    return [
        REELS[Math.floor(Math.random() * REELS.length)],
        REELS[Math.floor(Math.random() * REELS.length)],
        REELS[Math.floor(Math.random() * REELS.length)]
    ];
}

export default {
    name: 'slots',
    aliases: ['slot', 'spin'],
    category: 'games',
    description: 'Spin the slot machine. Wired to economy wallet. Usage: .slots <amount|all|half>',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const u = getUser(sender);

        if (!args[0]) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🎰 *SLOTS* ⌋\n` +
                    `├─⊷ Usage: *.slots <amount|all|half>*\n` +
                    `├─⊷ Min ${COIN} ${MIN_BET} • Max ${COIN} ${fmt(MAX_BET)}\n` +
                    `├─⊷ Wallet: ${COIN} ${fmt(u.wallet)}\n` +
                    `│\n` +
                    `├─⊷ *Payouts (3 of a kind)*\n` +
                    Object.entries(TRIPLE_PAYOUT).map(([s, x]) => `│  ${s}${s}${s} → ${x}×`).join('\n') + '\n' +
                    `├─⊷ *Any pair* → ${PAIR_PAYOUT}×\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        const bet = parseAmount(args[0], u.wallet);
        if (!isFinite(bet) || bet <= 0) {
            return sock.sendMessage(chatId, { text: '❌ Invalid amount.' }, { quoted: m });
        }
        if (bet < MIN_BET) return sock.sendMessage(chatId, { text: `❌ Minimum bet is ${COIN} ${MIN_BET}.` }, { quoted: m });
        if (bet > MAX_BET) return sock.sendMessage(chatId, { text: `❌ Maximum bet is ${COIN} ${fmt(MAX_BET)}.` }, { quoted: m });
        if (bet > u.wallet) {
            return sock.sendMessage(chatId, {
                text: `❌ You only have ${COIN} ${fmt(u.wallet)} in your wallet.`
            }, { quoted: m });
        }

        const reels = spin();
        const [a, b, c] = reels;
        let payout = 0;
        let verdict = '';

        if (a === b && b === c) {
            const mult = TRIPLE_PAYOUT[a];
            payout = bet * mult;
            verdict = `🎉 *JACKPOT!* ${a}${a}${a} pays *${mult}×*`;
        } else if (a === b || b === c || a === c) {
            payout = Math.floor(bet * PAIR_PAYOUT);
            verdict = `✨ *PAIR!* pays ${PAIR_PAYOUT}×`;
        } else {
            verdict = `💀 No match — bet lost`;
        }

        // Net delta = payout - bet (payout includes return of stake when winning).
        const net = payout - bet;
        updateUser(sender, (user) => {
            user.wallet += net;
            if (net > 0) user.wins += 1; else user.losses += 1;
            user.xp += 4;
        });
        const fresh = getUser(sender);

        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🎰 *SLOTS* ⌋\n` +
                `├─⊷  ${a}  |  ${b}  |  ${c}\n` +
                `├─⊷ ${verdict}\n` +
                `├─⊷ Bet    : ${COIN} ${fmt(bet)}\n` +
                `├─⊷ Won    : ${COIN} ${fmt(payout)}\n` +
                `├─⊷ Net    : ${net >= 0 ? '+' : ''}${COIN} ${fmt(net)}\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
