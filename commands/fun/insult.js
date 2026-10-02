import axios from 'axios';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const FALLBACK_INSULTS = [
    "You're the reason the gene pool needs a lifeguard.",
    "I'd agree with you, but then we'd both be wrong.",
    "If laughter is the best medicine, your face must be curing the world.",
    "You bring everyone so much joy when you leave the room.",
    "I'd explain it to you, but I left my crayons at home.",
    "You're proof that evolution can go in reverse.",
    "Light travels faster than sound, which is why you appeared bright until you spoke.",
    "Two wrongs don't make a right, but you're a fine example of how three lefts can.",
    "I'm not saying I hate you, but I'd unplug your life support to charge my phone.",
    "Some drink from the fountain of knowledge — you only gargled.",
    "If brains were dynamite, you wouldn't have enough to blow your nose.",
    "You're like a cloud — when you disappear, it's a beautiful day.",
    "I was going to give you a nasty look, but you already have one.",
    "Your secrets are always safe with me — I never even listen when you tell them.",
    "You're not stupid; you just have bad luck thinking.",
    "I would call you a tool, but even tools serve a purpose.",
    "If ignorance is bliss, you must be the happiest soul alive.",
    "You're the human equivalent of a participation trophy.",
    "Mirrors can't talk. Lucky for you, they can't laugh either.",
    "You have something on your chin… no, the third one down."
];

async function fetchInsult() {
    // Primary: evilinsult.com (free, no auth)
    try {
        const r = await axios.get('https://evilinsult.com/generate_insult.php?lang=en&type=json', {
            timeout: 6000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const text = r.data?.insult;
        if (text && typeof text === 'string' && text.trim().length > 0) {
            // Decode HTML entities the API sometimes returns
            return text
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#039;/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();
        }
    } catch {}

    // Fallback: local list
    return FALLBACK_INSULTS[Math.floor(Math.random() * FALLBACK_INSULTS.length)];
}

export default {
    name: 'insult',
    alias: ['roast', 'burn', 'diss'],
    desc: 'Insult someone — mention, reply, or fire it at the whole group',
    category: 'Fun',
    usage: '.insult @user  |  reply to a message with .insult  |  .insult (in group, no target = everyone)',

    async execute(sock, m, args, PREFIX) {
        const chatId   = m.key.remoteJid;
        const isGroup  = chatId.endsWith('@g.us');
        const senderJid = m.key.participant || (m.key.fromMe ? sock.user?.id : chatId);

        // ── Resolve target(s) ─────────────────────────────────────────────
        const ctx       = m.message?.extendedTextMessage?.contextInfo;
        const mentioned = ctx?.mentionedJid || [];
        const replyJid  = ctx?.participant;

        let targets = [];
        let mode    = 'self';

        if (mentioned.length > 0) {
            targets = mentioned;
            mode = 'mention';
        } else if (replyJid) {
            targets = [replyJid];
            mode = 'reply';
        } else if (isGroup) {
            // No specific target in a group → insult EVERYONE
            try {
                const meta = await sock.groupMetadata(chatId);
                targets = (meta?.participants || [])
                    .map(p => p.id)
                    .filter(id => id && id !== sock.user?.id?.replace(/:\d+@/, '@'));
                mode = 'group';
            } catch {
                return sock.sendMessage(chatId, {
                    text: '❌ Could not fetch group members.'
                }, { quoted: m });
            }
        } else {
            // DM with no target — insult the sender (it's their own fault for asking)
            targets = [senderJid];
            mode = 'self';
        }

        if (!targets.length) {
            return sock.sendMessage(chatId, {
                text: `❌ No one to insult.\n\nUsage:\n• ${PREFIX}insult @user\n• Reply to a message with ${PREFIX}insult\n• ${PREFIX}insult (in a group, hits everyone)`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '🔥', key: m.key } });

        try {
            if (mode === 'group') {
                // One insult per member, sent as a single mass-mention message
                let text = `╭─⌈ 🔥 *MASS ROAST* ⌋\n│\n`;
                for (const jid of targets.slice(0, 50)) {
                    const insult = await fetchInsult();
                    const tag    = `@${jid.split('@')[0]}`;
                    text += `├─⊷ ${tag}\n│  ${insult}\n│\n`;
                }
                text += `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

                return sock.sendMessage(chatId, {
                    text,
                    mentions: targets.slice(0, 50)
                }, { quoted: m });
            }

            // Single target (mention / reply / self)
            const insult = await fetchInsult();
            const tag    = `@${targets[0].split('@')[0]}`;
            const header = mode === 'self'
                ? '🔥 *Self-Inflicted Burn*'
                : '🔥 *ROAST*';

            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ${header} ⌋\n` +
                    `├─⊷ ${tag}\n` +
                    `│  ${insult}\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`,
                mentions: targets
            }, { quoted: m });

        } catch (err) {
            console.error('[INSULT] Error:', err);
            return sock.sendMessage(chatId, {
                text: `❌ Failed: ${err.message}`
            }, { quoted: m });
        }
    }
};
