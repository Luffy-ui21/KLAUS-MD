import { Chess } from 'chess.js';
import { getSession, setSession, clearSession, getSender } from './_sessions.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const TYPE = 'chess';

// Map piece chars to display emojis. Uppercase = white, lowercase = black.
const PIECE_EMOJI = {
    'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♕','K':'♔',
    'p':'♟','n':'♞','b':'♝','r':'♜','q':'♛','k':'♚'
};

// Pretty board with file/rank labels. White at bottom.
function renderBoard(fen) {
    const board = new Chess(fen).board(); // 8 rows top→bottom (rank 8..1)
    const rows = [];
    rows.push('   a b c d e f g h');
    for (let r = 0; r < 8; r++) {
        const rank = 8 - r;
        const cells = board[r].map(sq => sq ? PIECE_EMOJI[sq.color === 'w' ? sq.type.toUpperCase() : sq.type] : '·');
        rows.push(`${rank}  ${cells.join(' ')}`);
    }
    rows.push('   a b c d e f g h');
    return '```\n' + rows.join('\n') + '\n```';
}

function turnLabel(chess) { return chess.turn() === 'w' ? '⚪ White' : '⚫ Black'; }

export default {
    name: 'chess',
    aliases: ['ch'],
    category: 'games',
    description: 'Two-player chess. .chess new | move <e2e4> | board | resign',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = getSender(m);
        const sub = (args[0] || '').toLowerCase();
        let session = getSession(chatId, TYPE);

        if (sub === 'quit' || sub === 'resign' || sub === 'end') {
            if (!session) return sock.sendMessage(chatId, { text: '❌ No active chess game.' }, { quoted: m });
            // Only the two players in the match may resign or end it — protects the game from kibitzers.
            if (sender !== session.white && sender !== session.black) {
                return sock.sendMessage(chatId, {
                    text: `⛔ Only the players in this match can resign it.`
                }, { quoted: m });
            }
            const winner = session.white === sender ? '⚫ Black' : '⚪ White';
            clearSession(chatId, TYPE);
            return sock.sendMessage(chatId, { text: `🏳️ Resigned. *${winner}* wins.` }, { quoted: m });
        }

        if (sub === 'new' || sub === 'start' || (!session && !sub)) {
            const chess = new Chess();
            session = setSession(chatId, TYPE, {
                fen: chess.fen(),
                white: sender,
                black: null,
                startedAt: Date.now()
            });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ♟️ *CHESS — NEW GAME* ⌋\n` +
                    `├─⊷ ⚪ White: @${sender.split('@')[0]}\n` +
                    `├─⊷ ⚫ Black: (waiting — type *.chess join*)\n` +
                    `├─⊷ Move with *.chess move <from><to>* e.g. *.chess move e2e4*\n` +
                    `│\n${renderBoard(chess.fen())}\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`,
                mentions: [sender]
            }, { quoted: m });
        }

        if (!session) {
            return sock.sendMessage(chatId, {
                text: `❌ No active chess game. Start one with *.chess new*.`
            }, { quoted: m });
        }

        if (sub === 'join') {
            if (session.black) {
                return sock.sendMessage(chatId, { text: '❌ Game already has both players.' }, { quoted: m });
            }
            if (session.white === sender) {
                return sock.sendMessage(chatId, { text: '❌ You are White — wait for an opponent.' }, { quoted: m });
            }
            session.black = sender;
            setSession(chatId, TYPE, session);
            return sock.sendMessage(chatId, {
                text:
                    `♟️ *Game on!*\n` +
                    `⚪ White: @${session.white.split('@')[0]}\n` +
                    `⚫ Black: @${session.black.split('@')[0]}\n\n` +
                    `${renderBoard(session.fen)}\n\n` +
                    `${turnLabel(new Chess(session.fen))} to move — *.chess move e2e4*`,
                mentions: [session.white, session.black]
            }, { quoted: m });
        }

        if (sub === 'board' || sub === 'show') {
            const chess = new Chess(session.fen);
            return sock.sendMessage(chatId, {
                text:
                    `${renderBoard(session.fen)}\n` +
                    `${turnLabel(chess)} to move`
            }, { quoted: m });
        }

        if (sub === 'move' || sub === 'm') {
            if (!session.black) {
                return sock.sendMessage(chatId, { text: '⏳ Waiting for Black to *.chess join*.' }, { quoted: m });
            }
            const moveStr = (args[1] || '').toLowerCase();
            if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveStr)) {
                return sock.sendMessage(chatId, {
                    text: '❌ Move format: *e2e4* (or *e7e8q* to promote).'
                }, { quoted: m });
            }
            const chess = new Chess(session.fen);
            const turn = chess.turn();
            const expected = turn === 'w' ? session.white : session.black;
            if (sender !== expected) {
                return sock.sendMessage(chatId, {
                    text: `⛔ Not your turn — it's ${turnLabel(chess)}.`
                }, { quoted: m });
            }
            const from = moveStr.slice(0, 2);
            const to = moveStr.slice(2, 4);
            const promo = moveStr.length === 5 ? moveStr[4] : undefined;
            let result;
            try {
                result = chess.move({ from, to, promotion: promo });
            } catch {
                return sock.sendMessage(chatId, { text: `❌ Illegal move: \`${moveStr}\`.` }, { quoted: m });
            }
            if (!result) {
                return sock.sendMessage(chatId, { text: `❌ Illegal move: \`${moveStr}\`.` }, { quoted: m });
            }

            session.fen = chess.fen();

            if (chess.isGameOver()) {
                let outcome;
                if (chess.isCheckmate()) {
                    const winner = turn === 'w' ? '⚪ White' : '⚫ Black';
                    outcome = `🏆 *Checkmate!* ${winner} wins.`;
                } else if (chess.isStalemate()) outcome = '🤝 *Stalemate* — draw.';
                else if (chess.isThreefoldRepetition()) outcome = '🔁 *Threefold repetition* — draw.';
                else if (chess.isInsufficientMaterial()) outcome = '⚖️ *Insufficient material* — draw.';
                else if (chess.isDraw()) outcome = '🤝 *Draw*.';
                else outcome = '🏁 Game over.';

                clearSession(chatId, TYPE);
                return sock.sendMessage(chatId, {
                    text: `${renderBoard(session.fen)}\nMove: *${result.san}*\n\n${outcome}`
                }, { quoted: m });
            }

            setSession(chatId, TYPE, session);
            return sock.sendMessage(chatId, {
                text:
                    `${renderBoard(session.fen)}\n` +
                    `Move: *${result.san}*\n` +
                    (chess.inCheck() ? '⚠️ *Check!*\n' : '') +
                    `${turnLabel(chess)} to move`
            }, { quoted: m });
        }

        return sock.sendMessage(chatId, {
            text:
                `♟️ *Chess help*\n` +
                `• *.chess new*    — start a game (you = White)\n` +
                `• *.chess join*   — join as Black\n` +
                `• *.chess move <e2e4>* — make a move\n` +
                `• *.chess board*  — show current board\n` +
                `• *.chess resign* — give up`
        }, { quoted: m });
    }
};
