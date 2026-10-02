import axios from 'axios';
import { createRequire } from 'module';
import { getFooter } from '../../lib/menuHelper.js';
import { getBotName } from '../../lib/botname.js';

const _require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = _require('wolfbtns'); } catch {}

const API_URL   = 'https://ravenn.site/fifastandings';
const CACHE_TTL = 60 * 1000; // 1 minute — always fresh

let _cache   = null;
let _cacheAt = 0;

async function fetchStandings() {
    if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
    const res = await axios.get(API_URL, { timeout: 20000 });
    if (!res.data?.status) throw new Error('API returned failure status');
    _cache   = res.data.result;
    _cacheAt = Date.now();
    return _cache;
}

// True when all teams have played all their group-stage games
function isGroupResolved(group) {
    const rows = group.table?.all ?? [];
    if (!rows.length) return false;
    const maxGamesPerTeam = rows.length - 1; // round-robin: 4 teams → 3 games each
    return rows.every(r => (r.played ?? 0) >= maxGamesPerTeam);
}

function qualEmoji(color) {
    if (!color)              return '🔴';
    if (color === '#2AD572') return '🟢';
    if (color === '#FFD908') return '🟡';
    return '🔴';
}

// Human-readable "X mins ago" / "just now"
function timeAgo(ms) {
    const secs = Math.floor((Date.now() - ms) / 1000);
    if (secs < 10)  return 'just now';
    if (secs < 60)  return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
}

const POS_ICON = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];

function buildGroup(group) {
    const rows     = group.table?.all ?? [];
    const name     = group.leagueName.replace('Grp. ', 'Group ');
    const resolved = isGroupResolved(group);
    const badge    = resolved ? '✅ Final' : '⚡ Live';

    let txt = `╭─ ⚽ *${name}*  ${badge}\n│\n`;
    rows.forEach((r, i) => {
        const q   = qualEmoji(r.qualColor);
        const pos = POS_ICON[i] ?? `${i + 1}.`;
        const gd  = r.goalConDiff > 0 ? `+${r.goalConDiff}` : `${r.goalConDiff}`;
        const rec = `${r.wins}W ${r.draws}D ${r.losses}L`;
        txt += `│ ${pos} ${q} *${r.shortName || r.name}*\n`;
        txt += `│    🏅 *${r.pts}pts*  ·  ${rec}  ·  GD ${gd}\n`;
    });
    txt += `╰${'─'.repeat(24)}`;
    return txt;
}

function parseGroupArg(arg) {
    if (!arg) return null;
    const clean = arg.toLowerCase().replace(/^group\s*/i, '').trim();
    return clean.length === 1 && /[a-l]/.test(clean) ? `Grp. ${clean.toUpperCase()}` : null;
}

// Build single_select sections with live resolve status on each row
function buildMenuSections(tables, PREFIX) {
    const ALL = ['A','B','C','D','E','F','G','H','I','J','K','L'];

    function makeRow(letter) {
        const grp      = tables.find(t => t.leagueName === `Grp. ${letter}`);
        const resolved = grp ? isGroupResolved(grp) : false;
        const icon     = resolved ? '✅' : '⚡';
        const status   = resolved ? 'Final standings' : 'In progress';
        return {
            id:          `${PREFIX}fifastandings ${letter.toLowerCase()}`,
            title:       `${icon} Group ${letter}`,
            description: status
        };
    }

    return [
        {
            title: '📋 Groups A – F',
            rows: ALL.slice(0, 6).map(makeRow)
        },
        {
            title: '📋 Groups G – L',
            rows: ALL.slice(6).map(makeRow)
        },
        {
            title: '📊 Stats & Info',
            rows: [
                { id: `${PREFIX}fifastandings scorers`, title: '🥇 Top Scorers',   description: 'Top goal scorers' },
                { id: `${PREFIX}fifastandings assists`, title: '🎯 Top Assists',   description: 'Top assist providers' },
                { id: `${PREFIX}fifastandings help`,    title: '❓ Help',           description: 'How to use this command' }
            ]
        }
    ];
}

export default {
    name: 'fifastandings',
    aliases: ['fifa', 'wcstandings', 'worldcupstandings', 'fifawc', 'wc2026'],
    category: 'Sports',
    description: 'FIFA World Cup 2026 group standings, top scorers & assists',

    async execute(sock, m, args, PREFIX) {
        const jid    = m.key.remoteJid;
        const sub    = (args[0] || '').toLowerCase();
        const footer = getFooter(m.key.participant || jid);
        const bot    = getBotName();

        // ── No args → fetch live data then show button menu ───────────────────
        if (!sub) {
            let tables = [];
            let fetchedAt = null;
            try {
                const data = await fetchStandings();
                tables    = data.table?.[0]?.data?.tables ?? [];
                fetchedAt = _cacheAt;
            } catch {}

            const resolvedCount = tables
                .filter(t => /^Grp\. [A-L]$/.test(t.leagueName) && isGroupResolved(t))
                .length;
            const totalGroups = 12;
            const stageLabel  = resolvedCount === totalGroups
                ? '✅ Group Stage Complete'
                : resolvedCount === 0
                    ? '⚡ Group Stage In Progress'
                    : `⚡ ${resolvedCount}/${totalGroups} Groups Resolved`;

            const updatedLine = fetchedAt
                ? `\n_Last updated: ${timeAgo(fetchedAt)}_`
                : '';

            if (giftedBtns?.sendInteractiveMessage) {
                try {
                    await giftedBtns.sendInteractiveMessage(sock, jid, {
                        text:
                            `🏆 *FIFA WORLD CUP 2026*\n\n` +
                            `${stageLabel}\n\n` +
                            `Tap *Select Group* to view standings.\n` +
                            `✅ = Final  ·  ⚡ = In Progress` +
                            updatedLine,
                        footer: `⚽ ${bot} • WC 2026`,
                        interactiveButtons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title:    '⚽ Select Group',
                                    sections: buildMenuSections(tables, PREFIX)
                                })
                            }
                        ]
                    });
                    return;
                } catch (err) {
                    console.log('[FIFA] Button send failed:', err.message);
                }
            }

            // Plain-text fallback (includes resolve status per group)
            let grpList = '';
            ['A','B','C','D','E','F','G','H','I','J','K','L'].forEach(g => {
                const grp      = tables.find(t => t.leagueName === `Grp. ${g}`);
                const resolved = grp ? isGroupResolved(grp) : false;
                const icon     = resolved ? '✅' : '⚡';
                grpList += `│  ${icon} ${PREFIX}fifastandings ${g}\n`;
            });

            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 🏆 *FIFA WORLD CUP 2026* ⌋\n` +
                    `│  ${stageLabel}\n│\n` +
                    `├─ 📋 *Group Standings*\n` +
                    grpList +
                    `│\n` +
                    `├─⊷ *${PREFIX}fifastandings scorers* — 🥇 Top Scorers\n` +
                    `├─⊷ *${PREFIX}fifastandings assists* — 🎯 Top Assists\n` +
                    `├─⊷ *${PREFIX}fifastandings help*    — ❓ Full Guide\n│\n` +
                    `├─ ✅ Final  ·  ⚡ In Progress\n` +
                    `├─ 🟢 Qualified  🟡 Possible  🔴 Eliminated\n` +
                    `╰⊷ ${footer}`
            }, { quoted: m });
        }

        // ── Help ──────────────────────────────────────────────────────────────
        if (sub === 'help') {
            const helpText =
                `╭─⌈ 🏆 *FIFA WC 2026 — GUIDE* ⌋\n│\n` +
                `├─⊷ *${PREFIX}fifastandings*\n` +
                `│  └⊷ Opens the live group selection menu\n│\n` +
                `├─⊷ *${PREFIX}fifastandings <A–L>*\n` +
                `│  └⊷ Specific group table\n` +
                `│  └⊷ e.g. ${PREFIX}fifastandings a\n│\n` +
                `├─⊷ *${PREFIX}fifastandings scorers*\n` +
                `│  └⊷ Top goal scorers\n│\n` +
                `├─⊷ *${PREFIX}fifastandings assists*\n` +
                `│  └⊷ Top assist providers\n│\n` +
                `├─ ✅ Final  ·  ⚡ In Progress\n` +
                `├─ 🟢 Qualified  🟡 Possible  🔴 Eliminated\n` +
                `╰⊷ ${footer}`;

            if (giftedBtns?.sendInteractiveMessage) {
                try {
                    await giftedBtns.sendInteractiveMessage(sock, jid, {
                        text:   helpText,
                        footer: `⚽ ${bot} • WC 2026`,
                        interactiveButtons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '⚽ Group Menu',
                                    id: `${PREFIX}fifastandings`
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🥇 Top Scorers',
                                    id: `${PREFIX}fifastandings scorers`
                                })
                            }
                        ]
                    });
                    return;
                } catch {}
            }
            return sock.sendMessage(jid, { text: helpText }, { quoted: m });
        }

        // ── All paths below fetch from API ────────────────────────────────────
        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        try {
            const data   = await fetchStandings();
            const tables = data.table?.[0]?.data?.tables ?? [];
            const ago    = timeAgo(_cacheAt);

            // ── Top Scorers ───────────────────────────────────────────────────
            if (['scorers','topscorers','goals'].includes(sub)) {
                const scorers = data.overview?.topPlayers?.byGoals?.players ?? [];

                let txt = `╭─⌈ 🥇 *FIFA WC 2026 — TOP SCORERS* ⌋\n│\n`;
                if (!scorers.length) {
                    txt += `├─⊷ No data available yet\n`;
                } else {
                    scorers.forEach((p, i) => {
                        const medal = ['🥇','🥈','🥉'][i] ?? `${i+1}.`;
                        txt += `├─⊷ ${medal} *${p.name}*\n`;
                        txt += `│     🏳️ ${p.teamName}  ⚽ *${p.goals} goal${p.goals !== 1 ? 's' : ''}*\n`;
                    });
                }
                txt += `│\n├─ _Updated ${ago}_\n╰⊷ ${footer}`;

                if (giftedBtns?.sendInteractiveMessage) {
                    try {
                        await giftedBtns.sendInteractiveMessage(sock, jid, {
                            text:   txt,
                            footer: `⚽ ${bot} • WC 2026`,
                            interactiveButtons: [
                                {
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({ display_text: '🎯 Top Assists', id: `${PREFIX}fifastandings assists` })
                                },
                                {
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({ display_text: '⚽ Group Menu', id: `${PREFIX}fifastandings` })
                                }
                            ]
                        });
                        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                        return;
                    } catch {}
                }
                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(jid, { text: txt }, { quoted: m });
            }

            // ── Top Assists ───────────────────────────────────────────────────
            if (['assists','assist'].includes(sub)) {
                const assists = data.overview?.topPlayers?.byAssists?.players ?? [];

                let txt = `╭─⌈ 🎯 *FIFA WC 2026 — TOP ASSISTS* ⌋\n│\n`;
                if (!assists.length) {
                    txt += `├─⊷ No data available yet\n`;
                } else {
                    assists.forEach((p, i) => {
                        const medal = ['🥇','🥈','🥉'][i] ?? `${i+1}.`;
                        txt += `├─⊷ ${medal} *${p.name}*\n`;
                        txt += `│     🏳️ ${p.teamName}  🎯 *${p.assists} assist${p.assists !== 1 ? 's' : ''}*\n`;
                    });
                }
                txt += `│\n├─ _Updated ${ago}_\n╰⊷ ${footer}`;

                if (giftedBtns?.sendInteractiveMessage) {
                    try {
                        await giftedBtns.sendInteractiveMessage(sock, jid, {
                            text:   txt,
                            footer: `⚽ ${bot} • WC 2026`,
                            interactiveButtons: [
                                {
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({ display_text: '🥇 Top Scorers', id: `${PREFIX}fifastandings scorers` })
                                },
                                {
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({ display_text: '⚽ Group Menu', id: `${PREFIX}fifastandings` })
                                }
                            ]
                        });
                        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                        return;
                    } catch {}
                }
                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(jid, { text: txt }, { quoted: m });
            }

            // ── Single Group ──────────────────────────────────────────────────
            const groupKey = parseGroupArg(sub);
            if (groupKey) {
                const group = tables.find(t => t.leagueName === groupKey);
                if (!group) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(jid, {
                        text: `❌ Group *${groupKey}* not found.\n\nAvailable: A – L`
                    }, { quoted: m });
                }

                const letter     = groupKey.replace('Grp. ', '');
                const allLetters = ['A','B','C','D','E','F','G','H','I','J','K','L'];
                const idx        = allLetters.indexOf(letter);
                const prev       = allLetters[idx - 1];
                const next       = allLetters[idx + 1];

                const groupText =
                    `🏆 *FIFA WORLD CUP 2026*\n` +
                    `${'─'.repeat(28)}\n` +
                    `${buildGroup(group)}\n\n` +
                    `🟢 Qualified  🟡 Possible  🔴 Eliminated\n` +
                    `_Updated ${ago}_\n\n` +
                    `${footer}`;

                if (giftedBtns?.sendInteractiveMessage) {
                    try {
                        const navBtns = [];
                        if (prev) navBtns.push({
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: `◀ Group ${prev}`,
                                id: `${PREFIX}fifastandings ${prev.toLowerCase()}`
                            })
                        });
                        if (next) navBtns.push({
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: `Group ${next} ▶`,
                                id: `${PREFIX}fifastandings ${next.toLowerCase()}`
                            })
                        });
                        navBtns.push({
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 All Groups',
                                id: `${PREFIX}fifastandings`
                            })
                        });

                        await giftedBtns.sendInteractiveMessage(sock, jid, {
                            text:   groupText,
                            footer: `⚽ ${bot} • WC 2026`,
                            interactiveButtons: navBtns
                        });
                        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                        return;
                    } catch {}
                }

                await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(jid, { text: groupText }, { quoted: m });
            }

            // ── Unknown arg → redirect to menu ────────────────────────────────
            await sock.sendMessage(jid, { react: { text: '❓', key: m.key } });
            return sock.sendMessage(jid, {
                text:
                    `❓ Unknown option *"${args[0]}"*\n\n` +
                    `Type *${PREFIX}fifastandings* for the live group selector menu.`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            const reason = err.response?.status
                ? `API error (HTTP ${err.response.status})`
                : err.message || 'Unknown error';
            await sock.sendMessage(jid, {
                text: `❌ *Failed to fetch FIFA standings*\n\n⚠️ ${reason}\n\n💡 Try again in a moment.`
            }, { quoted: m });
        }
    }
};
