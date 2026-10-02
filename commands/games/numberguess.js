import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const TYPE = 'numberguess';
const MIN = 1;
const MAX = 100;
const MAX_GUESSES = 7;

export default {
    name: 'numberguess',
    aliases: ['ng', 'guessnumber'],
    category: 'games',
    description: `Guess a number between ${MIN} and ${MAX} in ${MAX_GUESSES} tries. Hot/cold hints.`,
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'stop' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active number guess.' }, { quoted: m });
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, { text: `🏳️ Game ended. The number was *${session.answer}*.` }, { quoted: m });
        }

        if (!session) {
            const answer = MIN + Math.floor(Math.random() * (MAX - MIN + 1));
            session = setSession(chatId, TYPE, { answer, tries: 0, history: [], startedBy: sender });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🎯 *NUMBER GUESS* ⌋\n` +
                    `├─⊷ I'm thinking of a number between *${MIN}* and *${MAX}*\n` +
                    `├─⊷ You have *${MAX_GUESSES}* tries\n` +
                    `├─⊷ Type *.ng <number>* to guess\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        if (!sub) {
            return sock.sendMessage(chatId, {
                text:
                    `🎯 *Number Guess in progress*\n` +
                    `Tries: ${session.tries}/${MAX_GUESSES}\n` +
                    `History: ${session.history.length ? session.history.join(', ') : '(none)'}\n\n` +
                    `Type *.ng <number>*`
            }, { quoted: m });
        }

        const guess = parseInt(sub, 10);
        if (!Number.isFinite(guess) || guess < MIN || guess > MAX) {
            return sock.sendMessage(chatId, {
                text: `❌ Pick a whole number between ${MIN} and ${MAX}.`
            }, { quoted: m });
        }

        session.tries += 1;
        session.history.push(guess);
        const diff = Math.abs(guess - session.answer);

        if (guess === session.answer) {
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🎉 *BULLSEYE!* ⌋\n` +
                    `├─⊷ Number was *${session.answer}*\n` +
                    `├─⊷ Tries used: ${session.tries}/${MAX_GUESSES}\n` +
                    `╰⊷ Type *.ng* to play again`
            }, { quoted: m });
        }

        if (session.tries >= MAX_GUESSES) {
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text: `💀 *OUT OF TRIES!*\nNumber was *${session.answer}*.\nGuesses: ${session.history.join(', ')}`
            }, { quoted: m });
        }

        // Hot/cold scale (relative to range size).
        let hint;
        if (diff <= 2)       hint = '🔥 *BURNING HOT*';
        else if (diff <= 5)  hint = '🌶️ *Very Hot*';
        else if (diff <= 10) hint = '☀️ *Warm*';
        else if (diff <= 20) hint = '🌤️ *Cool*';
        else if (diff <= 40) hint = '❄️ *Cold*';
        else                 hint = '🧊 *Freezing*';

        const direction = guess < session.answer ? '⬆️ higher' : '⬇️ lower';
        setSession(chatId, TYPE, session);
        return sock.sendMessage(chatId, {
            text:
                `${hint}  —  go ${direction}\n` +
                `Try ${session.tries}/${MAX_GUESSES} • last guess: ${guess}`
        }, { quoted: m });
    }
};
