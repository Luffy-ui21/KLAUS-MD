import { getUser, updateUser, getSender, COIN, fmt, formatCooldown } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_REWARD = 250;
const STREAK_BONUS = 50;     // per consecutive day, capped
const STREAK_CAP = 14;        // max bonus tier
const RESET_AFTER_MS = 48 * 60 * 60 * 1000; // miss >48h → streak resets

export default {
    name: 'daily',
    aliases: ['dailyclaim'],
    category: 'economy',
    description: 'Claim your daily reward (24h cooldown). Streaks pay more.',
    async execute(sock, m) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const u = getUser(senderJid);
        const now = Date.now();
        const elapsed = now - (u.lastDaily || 0);

        if (u.lastDaily && elapsed < DAY_MS) {
            const left = DAY_MS - elapsed;
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ⏳ *DAILY ON COOLDOWN* ⌋\n` +
                    `├─⊷ Come back in *${formatCooldown(left)}*\n` +
                    `├─⊷ Current streak: 🔥 ${u.streak} day(s)\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        // Streak: continued if last claim was within reset window, otherwise reset to 1.
        let streak = u.streak || 0;
        if (!u.lastDaily || elapsed > RESET_AFTER_MS) streak = 1;
        else streak += 1;

        const tier = Math.min(streak, STREAK_CAP);
        const reward = BASE_REWARD + tier * STREAK_BONUS;

        updateUser(senderJid, (user) => {
            user.wallet += reward;
            user.lastDaily = now;
            user.streak = streak;
            user.xp += 5;
        });

        const fresh = getUser(senderJid);
        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🎁 *DAILY REWARD* ⌋\n` +
                `├─⊷ Earned : ${COIN} ${fmt(reward)}\n` +
                `├─⊷ Streak : 🔥 ${streak} day(s)\n` +
                `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
