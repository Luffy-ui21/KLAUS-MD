import axios from 'axios';
import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getOwnerName } from '../../lib/menuHelper.js';

const TYPE = 'trivia';
const ANSWER_WINDOW_MS = 60 * 1000; // 60s to answer

// Open Trivia DB category map → friendly aliases.
const CATEGORIES = {
    general:    9,
    books:      10,
    film:       11,
    music:      12,
    tv:         14,
    games:      15,
    science:    17,
    computers:  18,
    math:       19,
    sport:      21,
    geography:  22,
    history:    23,
    politics:   24,
    art:        25,
    animals:    27,
    vehicles:   28,
    anime:      31
};

function decode(s) {
    if (!s) return '';
    // Open Trivia DB returns HTML-encoded text; minimal decode.
    return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&eacute;/g, 'é').replace(/&rsquo;/g, '\u2019');
}

function shuffle(a) {
    const x = [...a];
    for (let i = x.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
}

async function fetchQuestion(catId) {
    const url = `https://opentdb.com/api.php?amount=1&type=multiple${catId ? `&category=${catId}` : ''}`;
    const r = await axios.get(url, { timeout: 8000 });
    const q = r.data?.results?.[0];
    if (!q) throw new Error('No question returned');
    const correct = decode(q.correct_answer);
    const choices = shuffle([correct, ...q.incorrect_answers.map(decode)]);
    return {
        question: decode(q.question),
        choices,
        correctIndex: choices.indexOf(correct),
        category: decode(q.category),
        difficulty: q.difficulty
    };
}

export default {
    name: 'trivia',
    aliases: ['triv'],
    category: 'games',
    description: 'Trivia question. .trivia [category] to start, .trivia <A-D> to answer, .trivia categories.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'stop' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active trivia.' }, { quoted: m });
            const ans = ['A','B','C','D'][session.correctIndex];
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, { text: `🏳️ Trivia ended. Answer was *${ans}*.` }, { quoted: m });
        }

        if (sub === 'categories' || sub === 'cats') {
            return sock.sendMessage(chatId, {
                text:
                    `📚 *Trivia categories*\n\n` +
                    Object.keys(CATEGORIES).map(k => `• ${k}`).join('\n') + `\n\n` +
                    `Usage: *.trivia <category>* or just *.trivia* for random.`
            }, { quoted: m });
        }

        // Active session → treat sub as the answer letter.
        if (session) {
            if (Date.now() - session.startedAt > ANSWER_WINDOW_MS) {
                const ans = ['A','B','C','D'][session.correctIndex];
                clearSession(chatId, TYPE);
                return sock.sendMessage(chatId, {
                    text: `⏰ Time's up! The answer was *${ans}. ${session.choices[session.correctIndex]}*.`
                }, { quoted: m });
            }
            if (!sub || !/^[abcd]$/i.test(sub)) {
                return sock.sendMessage(chatId, {
                    text:
                        `🧠 *Trivia in progress*\n\n` +
                        `*${session.question}*\n\n` +
                        ['A','B','C','D'].map((L, i) => `${L}. ${session.choices[i]}`).join('\n') + `\n\n` +
                        `Answer with *.trivia A* (or B/C/D)`
                }, { quoted: m });
            }
            const guessIdx = ['a','b','c','d'].indexOf(sub.toLowerCase());
            const correct = guessIdx === session.correctIndex;
            const correctLetter = ['A','B','C','D'][session.correctIndex];
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text:
                    correct
                        ? `🎉 *CORRECT!*\nAnswer: *${correctLetter}. ${session.choices[session.correctIndex]}*`
                        : `❌ *Wrong.* You said ${sub.toUpperCase()}.\nCorrect: *${correctLetter}. ${session.choices[session.correctIndex]}*`
            }, { quoted: m });
        }

        // No session → start. sub may name a category.
        let catId = null;
        if (sub) {
            if (!(sub in CATEGORIES)) {
                return sock.sendMessage(chatId, {
                    text: `❌ Unknown category. Try *.trivia categories*.`
                }, { quoted: m });
            }
            catId = CATEGORIES[sub];
        }

        try {
            const q = await fetchQuestion(catId);
            setSession(chatId, TYPE, {
                question: q.question,
                choices: q.choices,
                correctIndex: q.correctIndex,
                startedBy: sender,
                startedAt: Date.now(),
                category: q.category,
                difficulty: q.difficulty
            });
            await sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🧠 *TRIVIA* ⌋\n` +
                    `├─⊷ Category: ${q.category}\n` +
                    `├─⊷ Difficulty: ${q.difficulty}\n` +
                    `├─⊷ Time: ${ANSWER_WINDOW_MS / 1000}s\n` +
                    `│\n` +
                    `*${q.question}*\n\n` +
                    ['A','B','C','D'].map((L, i) => `${L}. ${q.choices[i]}`).join('\n') + `\n\n` +
                    `╰⊷ Answer with *.trivia A/B/C/D*`
            }, { quoted: m });
        } catch (err) {
            console.error('[TRIVIA] Fetch error:', err.message);
            return sock.sendMessage(chatId, {
                text: `❌ Couldn't fetch a question right now. Try again in a moment.`
            }, { quoted: m });
        }
    }
};
