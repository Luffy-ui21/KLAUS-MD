import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const RANK = [
    { max: 10,  label: 'Straighter than a ruler',  emoji: '📏' },
    { max: 25,  label: 'Mostly straight',          emoji: '🧍' },
    { max: 40,  label: 'A little curious',         emoji: '🤔' },
    { max: 55,  label: 'Bi-curious vibes',         emoji: '👀' },
    { max: 70,  label: 'Pretty gay, ngl',          emoji: '🌈' },
    { max: 85,  label: 'Very gay',                 emoji: '🏳️‍🌈' },
    { max: 95,  label: 'Extremely gay',            emoji: '✨🏳️‍🌈' },
    { max: 100, label: 'MAXIMUM GAY OVERLOAD',     emoji: '💖🌈💖' }
];

function rankFor(pct) {
    return RANK.find(r => pct <= r.max) || RANK[RANK.length - 1];
}

// Deterministic per-user-per-day score so the same person gets the same %
// for ~24h (feels real), but rerolls daily.
function scoreFor(jid) {
    const day = Math.floor(Date.now() / 86_400_000);
    const seed = `${jid}|${day}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 101; // 0..100
}

export default {
    name: 'gaymeter',
    alias: ['gayrate', 'howgay'],
    desc: 'Measures how gay someone is — for the lols',
    category: 'Fun',
    usage: '.gaymeter  |  .gaymeter @user  |  reply to someone with .gaymeter',

    async execute(sock, m, args, PREFIX) {
        const chatId    = m.key.remoteJid;
        const senderJid = m.key.participant || (m.key.fromMe ? sock.user?.id : chatId);

        const ctx       = m.message?.extendedTextMessage?.contextInfo;
        const mentioned = ctx?.mentionedJid || [];
        const replyJid  = ctx?.participant;

        let target;
        if (mentioned.length > 0)      target = mentioned[0];
        else if (replyJid)             target = replyJid;
        else                           target = senderJid;

        if (!target) {
            return sock.sendMessage(chatId, {
                text: `❌ No target. Try:\n• ${PREFIX}gaymeter @user\n• Reply to someone with ${PREFIX}gaymeter`
            }, { quoted: m });
        }

        const pct    = scoreFor(target);
        const filled = Math.round(pct / 10);
        const bar    = '█'.repeat(filled) + '▒'.repeat(10 - filled);
        const r      = rankFor(pct);
        const tag    = `@${target.split('@')[0]}`;

        await sock.sendMessage(chatId, { react: { text: '🏳️‍🌈', key: m.key } });

        const text =
            `╭─⌈ 🏳️‍🌈 *GAY METER* ⌋\n` +
            `├─⊷ ${tag}\n` +
            `│ ${pct}% [${bar}]\n` +
            `│ ${r.emoji} ${r.label}\n` +
            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

        return sock.sendMessage(chatId, {
            text,
            mentions: [target]
        }, { quoted: m });
    }
};
