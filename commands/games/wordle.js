import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const TYPE = 'wordle';
const MAX_GUESSES = 6;

// Curated 5-letter word list. Deliberately avoiding obscure / offensive words.
const WORDS = [
    'apple','crane','plant','beach','sword','flame','ghost','jolly','knife','lemon',
    'mango','noble','ocean','pearl','quiet','river','snake','tiger','umbra','viper',
    'wagon','xenon','yacht','zebra','brave','chess','drink','eagle','fairy','gloom',
    'happy','ivory','joker','knack','laser','melon','nerve','olive','piano','queen',
    'rebel','sugar','tooth','unity','vivid','witch','xylyl','youth','zesty','altar',
    'bloom','crisp','daisy','elite','frost','grape','hover','irate','jumbo','karma',
    'logic','mirth','nudge','onion','prism','quilt','radar','scope','tango','urban',
    'vault','whale','zonal','azure','bingo','candy','demon','ember','fable','globe'
];

function pickWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

// Compare guess against answer → emoji feedback per letter.
// 🟩 right letter & position, 🟨 right letter wrong position, ⬜ not in word.
// Handles duplicate-letter edge case (only marks as 🟨 if remaining count > 0).
function evaluate(guess, answer) {
    const g = guess.toLowerCase().split('');
    const a = answer.toLowerCase().split('');
    const result = Array(5).fill('⬜');
    const counts = {};
    // First pass: greens.
    for (let i = 0; i < 5; i++) {
        if (g[i] === a[i]) result[i] = '🟩';
        else counts[a[i]] = (counts[a[i]] || 0) + 1;
    }
    // Second pass: yellows, decrementing pool so dupes don't double-count.
    for (let i = 0; i < 5; i++) {
        if (result[i] === '🟩') continue;
        if (counts[g[i]]) {
            result[i] = '🟨';
            counts[g[i]] -= 1;
        }
    }
    return result.join('');
}

function renderBoard(history) {
    const lines = [];
    for (let i = 0; i < MAX_GUESSES; i++) {
        if (i < history.length) {
            const { guess, marks } = history[i];
            lines.push(`${marks}  \`${guess.toUpperCase()}\``);
        } else {
            lines.push('⬛⬛⬛⬛⬛  · · · · ·');
        }
    }
    return lines.join('\n');
}

export default {
    name: 'wordle',
    aliases: ['wd'],
    category: 'games',
    description: 'Guess the 5-letter word in 6 tries. Use .wordle <word> to guess, .wordle quit to give up.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'stop' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active wordle in this chat.' }, { quoted: m });
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text: `🏳️ Game ended. The word was *${session.answer.toUpperCase()}*.`
            }, { quoted: m });
        }

        // No active session → start one.
        if (!session) {
            const answer = pickWord();
            session = setSession(chatId, TYPE, { answer, history: [], startedBy: sender });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🟩 *WORDLE STARTED* ⌋\n` +
                    `├─⊷ Guess the *5-letter* word\n` +
                    `├─⊷ You have *${MAX_GUESSES}* tries\n` +
                    `├─⊷ Type *.wordle <word>* to guess\n` +
                    `│\n${renderBoard([])}\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        // Active session — process guess.
        const guess = sub;
        if (!guess) {
            return sock.sendMessage(chatId, {
                text:
                    `🟩 *Wordle in progress* (${session.history.length}/${MAX_GUESSES})\n\n` +
                    renderBoard(session.history) + '\n\n' +
                    `Type *.wordle <word>* to guess, *.wordle quit* to end.`
            }, { quoted: m });
        }
        if (!/^[a-z]{5}$/.test(guess)) {
            return sock.sendMessage(chatId, { text: '❌ Guess must be exactly 5 letters (a-z).' }, { quoted: m });
        }

        const marks = evaluate(guess, session.answer);
        session.history.push({ guess, marks });
        const won = guess === session.answer.toLowerCase();
        const lost = !won && session.history.length >= MAX_GUESSES;

        if (won || lost) clearSession(chatId, TYPE);
        else setSession(chatId, TYPE, session);

        const board = renderBoard(session.history);
        if (won) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🎉 *YOU WON!* ⌋\n` +
                    `├─⊷ Solved in ${session.history.length}/${MAX_GUESSES}\n` +
                    `│\n${board}\n` +
                    `╰⊷ Word was *${session.answer.toUpperCase()}*`
            }, { quoted: m });
        }
        if (lost) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 💀 *OUT OF GUESSES* ⌋\n` +
                    `│\n${board}\n` +
                    `╰⊷ Word was *${session.answer.toUpperCase()}*`
            }, { quoted: m });
        }
        return sock.sendMessage(chatId, {
            text:
                `🟩 *Wordle* — ${session.history.length}/${MAX_GUESSES}\n\n` +
                board + '\n\n' +
                `Keep guessing: *.wordle <word>*`
        }, { quoted: m });
    }
};
