import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const TYPE = 'hangman';
const MAX_WRONG = 6;

const WORDS = [
    'whatsapp','baileys','wolftech','silentwolf','keyboard','elephant','volcano',
    'pyramid','python','javascript','algorithm','encryption','firewall','gateway',
    'kenya','nairobi','mombasa','safari','cheetah','giraffe','crocodile','rhinoceros',
    'football','basketball','marathon','olympic','melody','rhythm','symphony','guitar',
    'pancake','pineapple','strawberry','chocolate','cinnamon','vanilla','espresso',
    'planet','galaxy','asteroid','satellite','telescope','astronaut','meteor',
    'umbrella','rainbow','thunder','blizzard','typhoon','sunrise','horizon'
];

// Six progressive ASCII frames — one for each wrong guess.
const STAGES = [
    '```\n  ┌───┐\n  │   \n  │   \n  │   \n  │   \n──┴──\n```',
    '```\n  ┌───┐\n  │   O\n  │   \n  │   \n  │   \n──┴──\n```',
    '```\n  ┌───┐\n  │   O\n  │   |\n  │   \n  │   \n──┴──\n```',
    '```\n  ┌───┐\n  │   O\n  │  /|\n  │   \n  │   \n──┴──\n```',
    '```\n  ┌───┐\n  │   O\n  │  /|\\\n  │   \n  │   \n──┴──\n```',
    '```\n  ┌───┐\n  │   O\n  │  /|\\\n  │  /\n  │   \n──┴──\n```',
    '```\n  ┌───┐\n  │   O\n  │  /|\\\n  │  / \\\n  │   \n──┴──\n```'
];

function maskWord(word, guessed) {
    return word.split('').map(c => guessed.includes(c) ? c.toUpperCase() : '_').join(' ');
}

function pickWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

export default {
    name: 'hangman',
    aliases: ['hm'],
    category: 'games',
    description: 'Guess the word letter-by-letter before the man hangs. .hangman <letter|word> to guess.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'stop' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active hangman.' }, { quoted: m });
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, { text: `🏳️ Game ended. Word was *${session.answer.toUpperCase()}*.` }, { quoted: m });
        }

        if (!session) {
            const answer = pickWord();
            session = setSession(chatId, TYPE, { answer, guessed: [], wrong: 0, startedBy: sender });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🪢 *HANGMAN STARTED* ⌋\n` +
                    `├─⊷ Word length: *${answer.length}*\n` +
                    `├─⊷ Lives: *${MAX_WRONG}*\n` +
                    `├─⊷ Type *.hangman <letter>* or *.hangman <word>*\n` +
                    `│\n${STAGES[0]}\n\n` +
                    `\`${maskWord(answer, [])}\`\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        if (!sub) {
            return sock.sendMessage(chatId, {
                text:
                    `🪢 *Hangman in progress*\n\n` +
                    `${STAGES[session.wrong]}\n\n` +
                    `Word: \`${maskWord(session.answer, session.guessed)}\`\n` +
                    `Tried: ${session.guessed.length ? session.guessed.join(', ') : '(none)'}\n` +
                    `Lives: ${MAX_WRONG - session.wrong}/${MAX_WRONG}`
            }, { quoted: m });
        }

        // Validate input — single letter OR full-word guess.
        if (!/^[a-z]+$/.test(sub)) {
            return sock.sendMessage(chatId, { text: '❌ Letters only (a-z).' }, { quoted: m });
        }

        // Full-word attempt
        if (sub.length > 1) {
            if (sub === session.answer) {
                clearSession(chatId, TYPE);
                return sock.sendMessage(chatId, {
                    text: `🎉 *YOU WON!*\nWord was *${session.answer.toUpperCase()}*.\nLives left: ${MAX_WRONG - session.wrong}`
                }, { quoted: m });
            } else {
                session.wrong += 1;
                if (session.wrong >= MAX_WRONG) {
                    clearSession(chatId, TYPE);
                    return sock.sendMessage(chatId, {
                        text: `💀 *YOU LOST!*\n${STAGES[MAX_WRONG]}\nWord was *${session.answer.toUpperCase()}*.`
                    }, { quoted: m });
                }
                setSession(chatId, TYPE, session);
                return sock.sendMessage(chatId, {
                    text: `❌ Wrong word.\n\n${STAGES[session.wrong]}\n\nLives: ${MAX_WRONG - session.wrong}/${MAX_WRONG}`
                }, { quoted: m });
            }
        }

        // Single letter
        if (session.guessed.includes(sub)) {
            return sock.sendMessage(chatId, { text: `❌ "${sub}" already tried.` }, { quoted: m });
        }
        session.guessed.push(sub);
        const hit = session.answer.includes(sub);
        if (!hit) session.wrong += 1;

        const masked = maskWord(session.answer, session.guessed);
        const won = !masked.includes('_');
        const lost = session.wrong >= MAX_WRONG;

        if (won) {
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text: `🎉 *YOU WON!*\nWord was *${session.answer.toUpperCase()}*.\nLives left: ${MAX_WRONG - session.wrong}`
            }, { quoted: m });
        }
        if (lost) {
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text: `💀 *YOU LOST!*\n${STAGES[MAX_WRONG]}\nWord was *${session.answer.toUpperCase()}*.`
            }, { quoted: m });
        }
        setSession(chatId, TYPE, session);
        return sock.sendMessage(chatId, {
            text:
                `${hit ? '✅ Hit!' : '❌ Miss.'}\n\n` +
                `${STAGES[session.wrong]}\n\n` +
                `Word: \`${masked}\`\n` +
                `Tried: ${session.guessed.join(', ')}\n` +
                `Lives: ${MAX_WRONG - session.wrong}/${MAX_WRONG}`
        }, { quoted: m });
    }
};
