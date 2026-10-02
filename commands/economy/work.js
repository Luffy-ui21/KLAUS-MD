import { getUser, updateUser, getSender, COIN, fmt, formatCooldown } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const WORK_COOLDOWN = 60 * 60 * 1000; // 1 hour

// Each job has a payout range and flavour text. Job is sticky once chosen
// (until user changes it via `.work <jobname>`), so XP/level theme persists.
const JOBS = {
    coder:    { min: 120, max: 380, lines: ['fixed a gnarly bug', 'shipped a feature', 'merged a giant PR', 'crushed a bounty'] },
    farmer:   { min: 80,  max: 260, lines: ['harvested maize', 'sold milk at market', 'ploughed two acres', 'fed the chickens'] },
    driver:   { min: 100, max: 320, lines: ['ran 12 trips', 'caught a long-distance fare', 'beat traffic to the airport', 'tipped well by a tourist'] },
    artist:   { min: 90,  max: 350, lines: ['sold a commission', 'finished a portrait', 'streamed a digital piece', 'designed a logo'] },
    youtuber: { min: 60,  max: 420, lines: ['hit 10k views', 'got an AdSense bump', 'scored a sponsor', 'went mildly viral'] },
    boxer:    { min: 110, max: 360, lines: ['won by KO', 'survived 12 rounds', 'beat a sparring rival', 'won the local belt'] }
};

export default {
    name: 'work',
    aliases: ['job'],
    category: 'economy',
    description: 'Do a random job to earn coins. Use `.work <jobname>` to switch jobs.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const u = getUser(senderJid);
        const now = Date.now();
        const sub = (args[0] || '').toLowerCase();

        // List jobs
        if (sub === 'list' || sub === 'jobs') {
            const lines = Object.keys(JOBS).map(j => `├─⊷ ${j} (${COIN} ${JOBS[j].min}-${JOBS[j].max})`);
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 💼 *AVAILABLE JOBS* ⌋\n` +
                    lines.join('\n') + '\n' +
                    `╰⊷ Set with *.work <job>*`
            }, { quoted: m });
        }

        // Switch job
        if (sub && JOBS[sub]) {
            updateUser(senderJid, (user) => { user.job = sub; });
            return sock.sendMessage(chatId, {
                text: `✅ Job set to *${sub}*. Run *.work* to earn.`
            }, { quoted: m });
        }
        if (sub && !JOBS[sub]) {
            return sock.sendMessage(chatId, {
                text: `❌ Unknown job. Try *.work list*.`
            }, { quoted: m });
        }

        // Cooldown check
        const elapsed = now - (u.lastWork || 0);
        if (u.lastWork && elapsed < WORK_COOLDOWN) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ⏳ *TOO TIRED* ⌋\n` +
                    `├─⊷ Rest for *${formatCooldown(WORK_COOLDOWN - elapsed)}*\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        // Default to a random job if none set yet.
        const jobKey = u.job && JOBS[u.job] ? u.job : 'coder';
        const def = JOBS[jobKey];
        const earn = Math.floor(def.min + Math.random() * (def.max - def.min + 1));
        const flavour = def.lines[Math.floor(Math.random() * def.lines.length)];

        updateUser(senderJid, (user) => {
            user.wallet += earn;
            user.lastWork = now;
            user.job = jobKey;
            user.xp += 8;
        });

        const fresh = getUser(senderJid);
        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 💼 *WORK COMPLETE* ⌋\n` +
                `├─⊷ Job    : ${jobKey}\n` +
                `├─⊷ Result : ${flavour}\n` +
                `├─⊷ Earned : ${COIN} ${fmt(earn)}\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
