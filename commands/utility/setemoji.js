import { getEmoji, setEmoji, resetEmoji } from '../../lib/userEmoji.js';

export default {
    name: 'setemoji',
    description: 'Set your personal emoji shown in AI command footers',
    category: 'utility',
    aliases: ['myemoji', 'emoji'],
    usage: 'setemoji <emoji> | setemoji reset',

    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const current = getEmoji(sender);

        if (!args.length) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 😀 *SET EMOJI* ⌋\n├─⊷ *${PREFIX}setemoji <emoji>*\n│  └⊷ Set your personal emoji\n├─⊷ *${PREFIX}setemoji reset*\n│  └⊷ Reset to default ()\n├─⊷ *Current:* ${current}\n╰⊷ ${current} *Your emoji appears in AI footers*`
            }, { quoted: m });
        }

        const input = args[0].trim();

        if (input.toLowerCase() === 'reset') {
            resetEmoji(sender);
            return sock.sendMessage(jid, {
                text: `✅ *Emoji reset!*\nYour emoji has been reset to the default `
            }, { quoted: m });
        }

        const emojiRegex = /\p{Emoji}/u;
        if (!emojiRegex.test(input)) {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid input*\nPlease send a valid emoji.\n\nExample: *${PREFIX}setemoji 🔥*`
            }, { quoted: m });
        }

        const emoji = [...input].slice(0, 2).join('');
        setEmoji(sender, emoji);

        await sock.sendMessage(jid, {
            text: `✅ *Emoji updated!*\nYour emoji is now: ${emoji}\n\nIt will appear in all AI command footers.`
        }, { quoted: m });
    }
};
