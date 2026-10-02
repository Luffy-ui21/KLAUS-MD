import { getUser, getAllUsers, getSender, getMentionTarget, cleanId, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

function rankOf(targetId) {
    const all = Object.entries(getAllUsers())
        .map(([id, u]) => ({ id, total: (u.wallet || 0) + (u.bank || 0) }))
        .filter(e => e.total > 0)
        .sort((a, b) => b.total - a.total);
    const idx = all.findIndex(e => e.id === targetId);
    return idx === -1 ? null : { rank: idx + 1, total: all.length };
}

export default {
    name: 'profile',
    aliases: ['me', 'stats'],
    category: 'economy',
    description: 'Show your level, coins, job, streak and rank.',
    async execute(sock, m) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const targetId = getMentionTarget(m) || cleanId(senderJid);
        const u = getUser(targetId);
        const total = u.wallet + u.bank;
        const r = rankOf(targetId);
        const rankStr = r ? `#${r.rank} of ${r.total}` : 'unranked';
        const xpNeed = 100 * u.level;
        const winrate = (u.wins + u.losses) > 0
            ? Math.round((u.wins / (u.wins + u.losses)) * 100) + '%'
            : '—';

        const text =
            `╭─⌈ 👤 *PROFILE* ⌋\n` +
            `├─⊷ User    : @${targetId}\n` +
            `├─⊷ Level   : ${u.level}\n` +
            `├─⊷ XP      : ${u.xp}/${xpNeed}\n` +
            `├─⊷ Job     : ${u.job || '— (run .work list)'}\n` +
            `├─⊷ Streak  : 🔥 ${u.streak} day(s)\n` +
            `├─⊷ Wallet  : ${COIN} ${fmt(u.wallet)}\n` +
            `├─⊷ Bank    : ${COIN} ${fmt(u.bank)}/${fmt(u.bankCap)}\n` +
            `├─⊷ Total   : ${COIN} ${fmt(total)}\n` +
            `├─⊷ Wins/L  : ${u.wins}/${u.losses}  (winrate ${winrate})\n` +
            `├─⊷ Rank    : ${rankStr}\n` +
            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

        await sock.sendMessage(chatId, {
            text,
            mentions: [`${targetId}@s.whatsapp.net`]
        }, { quoted: m });
    }
};
