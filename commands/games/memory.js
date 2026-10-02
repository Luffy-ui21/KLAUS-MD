import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const TYPE = 'memory';
const COLS = 4;
const ROWS = 4;            // 4×4 = 16 tiles → 8 pairs
const SYMBOLS = ['🍎','🍌','🍒','🍇','🥝','🍑','🍍','🥥'];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildBoard() {
    const tiles = shuffle([...SYMBOLS, ...SYMBOLS]);
    return tiles.map((sym, idx) => ({ sym, idx, matched: false }));
}

// Render board with hidden tiles shown as their 1-16 number, matched tiles shown as the
// symbol, and any tiles in `revealed[]` shown face-up too (for the in-flight pair).
function render(board, revealed = []) {
    const lines = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            const t = board[r * COLS + c];
            if (t.matched || revealed.includes(t.idx)) {
                row.push(t.sym);
            } else {
                // Pad numbers so columns align visually.
                const n = String(t.idx + 1).padStart(2, '0');
                row.push(`\`${n}\``);
            }
        }
        lines.push(row.join(' '));
    }
    return lines.join('\n');
}

export default {
    name: 'memory',
    aliases: ['mm', 'match'],
    category: 'games',
    description: 'Memory match — flip 2 tiles by number to find pairs. Use .memory <a> <b>.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'stop' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active memory game.' }, { quoted: m });
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, { text: '🏳️ Memory game ended.' }, { quoted: m });
        }

        if (!session) {
            const board = buildBoard();
            session = setSession(chatId, TYPE, { board, moves: 0, matches: 0, startedBy: sender });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🧠 *MEMORY MATCH* ⌋\n` +
                    `├─⊷ Find all *${SYMBOLS.length}* pairs\n` +
                    `├─⊷ Flip with *.memory <a> <b>* (1-16)\n` +
                    `│\n${render(board)}\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        if (!sub) {
            return sock.sendMessage(chatId, {
                text:
                    `🧠 *Memory* — moves ${session.moves}, pairs ${session.matches}/${SYMBOLS.length}\n\n` +
                    render(session.board) + `\n\n` +
                    `Flip: *.memory <a> <b>*`
            }, { quoted: m });
        }

        const a = parseInt(args[0], 10);
        const b = parseInt(args[1], 10);
        const total = ROWS * COLS;
        if (!Number.isFinite(a) || !Number.isFinite(b) ||
            a < 1 || b < 1 || a > total || b > total || a === b) {
            return sock.sendMessage(chatId, {
                text: `❌ Pick two distinct tile numbers between 1 and ${total}.\nUsage: *.memory 3 11*`
            }, { quoted: m });
        }

        const ai = a - 1, bi = b - 1;
        const t1 = session.board[ai];
        const t2 = session.board[bi];
        if (t1.matched || t2.matched) {
            return sock.sendMessage(chatId, { text: '❌ One of those tiles is already matched.' }, { quoted: m });
        }

        session.moves += 1;
        const matched = t1.sym === t2.sym;
        if (matched) {
            t1.matched = true;
            t2.matched = true;
            session.matches += 1;
        }

        const won = session.matches === SYMBOLS.length;
        if (won) {
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🎉 *YOU WON!* ⌋\n` +
                    `├─⊷ Cleared in *${session.moves}* moves\n` +
                    `│\n${render(session.board)}\n` +
                    `╰⊷ Type *.memory* to play again`
            }, { quoted: m });
        }

        // Show the flipped pair, then on next message they'll see only matched ones.
        setSession(chatId, TYPE, session);
        const verdict = matched
            ? `✨ *MATCH!* ${t1.sym} ${t2.sym}`
            : `❌ No match — ${t1.sym} ≠ ${t2.sym}`;

        return sock.sendMessage(chatId, {
            text:
                `${verdict}\n` +
                `Moves: ${session.moves} • Pairs: ${session.matches}/${SYMBOLS.length}\n\n` +
                render(session.board, matched ? [] : [ai, bi])
        }, { quoted: m });
    }
};
