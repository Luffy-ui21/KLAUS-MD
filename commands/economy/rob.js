import { getUser, updateUser, getSender, getMentionTarget, cleanId, COIN, fmt, formatCooldown } from './_store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const ROB_COOLDOWN = 30 * 60 * 1000; // 30 min
const MIN_TARGET_WALLET = 200;
const SUCCESS_RATE = 0.45;             // 45% chance
const FINE_FRACTION = 0.20;            // lose 20% of wallet on fail

export default {
    name: 'rob',
    aliases: ['steal'],
    category: 'economy',
    description: 'Try to rob another user. Risky — 45% success rate, fine on failure.',
    async execute(sock, m) {
        const chatId = m.key.remoteJid;
        const senderJid = getSender(m);
        const senderId = cleanId(senderJid);
        const targetId = getMentionTarget(m);

        if (!targetId) {
            return sock.sendMessage(chatId, {
                text: `❌ Mention or reply to your target.\nUsage: *.rob @user*`
            }, { quoted: m });
        }
        if (targetId === senderId) {
            return sock.sendMessage(chatId, { text: `❌ You can't rob yourself.` }, { quoted: m });
        }

        const robber = getUser(senderId);
        const victim = getUser(targetId);
        const now = Date.now();
        const elapsed = now - (robber.lastRob || 0);

        if (robber.lastRob && elapsed < ROB_COOLDOWN) {
            return sock.sendMessage(chatId, {
                text: `⏳ Lay low for *${formatCooldown(ROB_COOLDOWN - elapsed)}* before your next heist.`
            }, { quoted: m });
        }
        if (victim.wallet < MIN_TARGET_WALLET) {
            return sock.sendMessage(chatId, {
                text: `❌ @${targetId} has too little to rob (need ≥ ${COIN} ${fmt(MIN_TARGET_WALLET)}).`,
                mentions: [`${targetId}@s.whatsapp.net`]
            }, { quoted: m });
        }
        if (robber.wallet < 100) {
            return sock.sendMessage(chatId, {
                text: `❌ Need at least ${COIN} 100 in your wallet to attempt a heist (bail money).`
            }, { quoted: m });
        }

        const success = Math.random() < SUCCESS_RATE;

        if (success) {
            // Steal 10–30% of victim's wallet.
            const pct = 0.10 + Math.random() * 0.20;
            const stolen = Math.max(1, Math.floor(victim.wallet * pct));
            updateUser(senderId, (u) => { u.wallet += stolen; u.lastRob = now; u.wins += 1; u.xp += 10; });
            updateUser(targetId, (u) => { u.wallet = Math.max(0, u.wallet - stolen); });

            const fresh = getUser(senderId);
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🦹 *HEIST SUCCESS* ⌋\n` +
                    `├─⊷ Victim : @${targetId}\n` +
                    `├─⊷ Stolen : ${COIN} ${fmt(stolen)}\n` +
                    `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`,
                mentions: [`${targetId}@s.whatsapp.net`]
            }, { quoted: m });
        } else {
            const fine = Math.max(50, Math.floor(robber.wallet * FINE_FRACTION));
            updateUser(senderId, (u) => {
                u.wallet = Math.max(0, u.wallet - fine);
                u.lastRob = now;
                u.losses += 1;
                u.xp += 3;
            });
            const fresh = getUser(senderId);
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🚓 *HEIST FAILED* ⌋\n` +
                    `├─⊷ Caught trying to rob @${targetId}\n` +
                    `├─⊷ Fine   : ${COIN} ${fmt(fine)}\n` +
                    `├─⊷ Wallet : ${COIN} ${fmt(fresh.wallet)}\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`,
                mentions: [`${targetId}@s.whatsapp.net`]
            }, { quoted: m });
        }
    }
};
