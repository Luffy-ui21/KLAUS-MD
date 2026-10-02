import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getUser, updateUser, parseAmount, COIN, fmt } from '../economy/_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const TYPE = 'blackjack';
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const MIN_BET = 10;
const MAX_BET = 50000;

function buildDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Best blackjack score: counts aces as 11 first, downgrades to 1 as needed to avoid bust.
function score(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
        if (c.rank === 'A') { total += 11; aces += 1; }
        else if (['J','Q','K'].includes(c.rank)) total += 10;
        else total += parseInt(c.rank, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
    return total;
}

function fmtHand(hand, hideHole = false) {
    return hand.map((c, i) =>
        hideHole && i === 1 ? '`?? `' : `\`${c.rank}${c.suit}\``
    ).join(' ');
}

function render(session, dealerHidden) {
    const dealerScore = dealerHidden ? '?' : score(session.dealer);
    return (
        `🎩 *Dealer:* ${fmtHand(session.dealer, dealerHidden)}  (${dealerScore})\n` +
        `🧑 *You:*    ${fmtHand(session.player)}  (${score(session.player)})`
    );
}

function payoutMultiplier(playerScore, dealerScore, blackjack) {
    if (playerScore > 21) return 0;                                  // bust
    if (blackjack && dealerScore !== 21) return 2.5;                 // natural BJ pays 3:2 (=stake*1.5 profit, total 2.5x)
    if (dealerScore > 21) return 2;                                  // dealer bust
    if (playerScore > dealerScore) return 2;                         // win
    if (playerScore === dealerScore) return 1;                       // push
    return 0;                                                         // loss
}

async function settle(sock, chatId, m, session, doubled = false) {
    // Dealer reveals + draws to 17.
    while (score(session.dealer) < 17) session.dealer.push(session.deck.pop());

    const ps = score(session.player);
    const ds = score(session.dealer);
    const isBJ = session.player.length === 2 && ps === 21;
    const mult = payoutMultiplier(ps, ds, isBJ);
    const totalBet = doubled ? session.bet * 2 : session.bet;
    const payout = Math.floor(totalBet * mult);
    const net = payout - totalBet;

    updateUser(session.startedBy, (user) => {
        user.wallet += payout;                         // bet was deducted on start; payout returns winnings (incl stake on win)
        if (net > 0) user.wins += 1;
        else if (net < 0) user.losses += 1;
        user.xp += 6;
    });
    const fresh = getUser(session.startedBy);

    let verdict;
    if (mult === 0)         verdict = '💀 *DEALER WINS*';
    else if (mult === 1)    verdict = '🤝 *PUSH* (bet returned)';
    else if (mult === 2.5)  verdict = '🃏 *BLACKJACK!* (3:2)';
    else                    verdict = '🎉 *YOU WIN!*';

    clearSession(chatId, TYPE);
    await sock.sendMessage(chatId, {
        text:
            `╭─⌈ 🃏 *BLACKJACK — RESULT* ⌋\n` +
            `${render(session, false)}\n` +
            `├─⊷ ${verdict}\n` +
            `├─⊷ Bet    : ${COIN} ${fmt(totalBet)}${doubled ? '  (doubled)' : ''}\n` +
            `├─⊷ Payout : ${COIN} ${fmt(payout)}\n` +
            `├─⊷ Net    : ${net >= 0 ? '+' : ''}${COIN} ${fmt(net)}\n` +
            `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
    }, { quoted: m });
}

export default {
    name: 'blackjack',
    aliases: ['bj', '21'],
    category: 'games',
    description: 'Blackjack vs dealer. .bj <bet> to start, then .bj hit | stand | double.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'stop' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active blackjack.' }, { quoted: m });
            // Only the player whose money is on the line can forfeit their own hand.
            if (session.startedBy !== sender) {
                return sock.sendMessage(chatId, {
                    text: `⛔ Only the player with the active hand can quit it.`
                }, { quoted: m });
            }
            // Forfeit: bet was already deducted on start, dealer keeps it.
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, { text: '🏳️ Hand forfeited. Bet lost.' }, { quoted: m });
        }

        // ─── Active hand: handle hit / stand / double ──────────────────────
        if (session) {
            if (session.startedBy !== sender) {
                return sock.sendMessage(chatId, { text: `⛔ This hand belongs to another player. Wait for it to finish.` }, { quoted: m });
            }
            if (sub === 'hit' || sub === 'h') {
                session.player.push(session.deck.pop());
                if (score(session.player) > 21) {
                    return settle(sock, chatId, m, session);
                }
                setSession(chatId, TYPE, session);
                return sock.sendMessage(chatId, {
                    text: `${render(session, true)}\n\n*.bj hit*  •  *.bj stand*`
                }, { quoted: m });
            }
            if (sub === 'stand' || sub === 's') {
                return settle(sock, chatId, m, session);
            }
            if (sub === 'double' || sub === 'dd') {
                if (session.player.length !== 2) {
                    return sock.sendMessage(chatId, { text: '❌ Can only double on your first move.' }, { quoted: m });
                }
                const u = getUser(sender);
                if (u.wallet < session.bet) {
                    return sock.sendMessage(chatId, {
                        text: `❌ Not enough to double — need ${COIN} ${fmt(session.bet)} more.`
                    }, { quoted: m });
                }
                updateUser(sender, (user) => { user.wallet -= session.bet; });
                session.player.push(session.deck.pop());
                return settle(sock, chatId, m, session, true);
            }
            return sock.sendMessage(chatId, {
                text:
                    `🃏 *Blackjack — your move*\n\n${render(session, true)}\n\n` +
                    `*.bj hit*  •  *.bj stand*  •  *.bj double*`
            }, { quoted: m });
        }

        // ─── No active hand: start one ─────────────────────────────────────
        if (!sub) {
            return sock.sendMessage(chatId, {
                text: `❌ Usage: *.bj <bet>* (min ${COIN} ${MIN_BET}, max ${COIN} ${fmt(MAX_BET)}).`
            }, { quoted: m });
        }
        const u = getUser(sender);
        const bet = parseAmount(sub, u.wallet);
        if (!isFinite(bet) || bet <= 0) {
            return sock.sendMessage(chatId, { text: '❌ Invalid amount.' }, { quoted: m });
        }
        if (bet < MIN_BET) return sock.sendMessage(chatId, { text: `❌ Min bet ${COIN} ${MIN_BET}.` }, { quoted: m });
        if (bet > MAX_BET) return sock.sendMessage(chatId, { text: `❌ Max bet ${COIN} ${fmt(MAX_BET)}.` }, { quoted: m });
        if (bet > u.wallet) {
            return sock.sendMessage(chatId, {
                text: `❌ Wallet only has ${COIN} ${fmt(u.wallet)}.`
            }, { quoted: m });
        }

        // Lock bet immediately so user can't spend it elsewhere mid-hand.
        updateUser(sender, (user) => { user.wallet -= bet; });

        const deck = buildDeck();
        const player = [deck.pop(), deck.pop()];
        const dealer = [deck.pop(), deck.pop()];
        session = setSession(chatId, TYPE, { deck, player, dealer, bet, startedBy: sender });

        // Auto-settle on natural blackjack so user doesn't have to type.
        if (score(player) === 21) {
            return settle(sock, chatId, m, session);
        }

        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🃏 *BLACKJACK — DEALT* ⌋\n` +
                `├─⊷ Bet: ${COIN} ${fmt(bet)}\n` +
                `│\n${render(session, true)}\n` +
                `│\n├─⊷ *.bj hit*  •  *.bj stand*  •  *.bj double*\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
