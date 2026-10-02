import { getAllUsers, COIN, fmt } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'rich'],
    category: 'economy',
    description: 'Top 10 richest users (by total wealth: wallet + bank).',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const scopeArg = (args[0] || '').toLowerCase();
        // Default scope: in groups, show only group members; otherwise global.
        const scope = scopeArg === 'global' ? 'global'
                    : scopeArg === 'group'  ? 'group'
                    : (isGroup ? 'group' : 'global');

        let memberIds = null;
        let groupMetaFailed = false;
        if (scope === 'group' && isGroup) {
            try {
                const meta = await sock.groupMetadata(chatId);
                memberIds = new Set(meta.participants.map(p => p.id.split('@')[0].split(':')[0]));
            } catch {
                groupMetaFailed = true;
            }
        }
        // If group scope was requested but membership couldn't be fetched, refuse rather than
        // silently leaking a global leaderboard labeled as "GROUP".
        if (scope === 'group' && groupMetaFailed) {
            return sock.sendMessage(chatId, {
                text: `❌ Could not load group members. Try again, or use *.lb global*.`
            }, { quoted: m });
        }

        const users = getAllUsers();
        let entries = Object.entries(users).map(([id, u]) => ({
            id,
            total: (u.wallet || 0) + (u.bank || 0),
            level: u.level || 1
        }));

        if (memberIds) entries = entries.filter(e => memberIds.has(e.id));
        entries = entries.filter(e => e.total > 0);
        entries.sort((a, b) => b.total - a.total);
        const top = entries.slice(0, 10);

        if (top.length === 0) {
            return sock.sendMessage(chatId, {
                text: `📉 No economy activity yet. Try *.daily* or *.work* to get started.`
            }, { quoted: m });
        }

        const medals = ['🥇', '🥈', '🥉'];
        const lines = top.map((e, i) => {
            const rank = medals[i] || `*${i + 1}.*`;
            return `${rank} @${e.id} — ${COIN} ${fmt(e.total)}  (Lv ${e.level})`;
        });

        const scopeLabel = scope === 'group' ? 'GROUP' : 'GLOBAL';
        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🏆 *LEADERBOARD — ${scopeLabel}* ⌋\n` +
                lines.join('\n') + '\n' +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`,
            mentions: top.map(e => `${e.id}@s.whatsapp.net`)
        }, { quoted: m });
    }
};
