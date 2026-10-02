import { getFooter } from '../../lib/menuHelper.js';

export default {
    name: 'poll',
    description: 'Create a poll in a WhatsApp group',
    category: 'group',
    aliases: ['createpoll', 'vote'],

    async execute(sock, m, args, PREFIX, extra) {
        const jid = m.key.remoteJid;
        const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m });
        const react  = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: m.key } }).catch(() => {});

        if (!jid.endsWith('@g.us')) {
            return reply('❌ Polls can only be created in groups.');
        }

        const usage =
            `╭─⌈ 📊 *CREATE POLL* ⌋\n│\n` +
            `├─⊷ *Usage:*\n` +
            `│  └⊷ \`${PREFIX}poll Question | Option1 | Option2 ...\`\n│\n` +
            `├─⊷ *Examples:*\n` +
            `│  └⊷ \`${PREFIX}poll Best pet? | Cat | Dog | Fish\`\n` +
            `│  └⊷ \`${PREFIX}poll Favourite day? | Mon | Tue | Wed | Thu | Fri\`\n│\n` +
            `├─⊷ *Rules:*\n` +
            `│  └⊷ Separate with \`|\`\n` +
            `│  └⊷ 2 – 12 options allowed\n` +
            `│  └⊷ Options must be unique\n│\n` +
            `├─⊷ *Tip:* Add \`multi\` at the end to allow multiple choices\n` +
            `│  └⊷ \`${PREFIX}poll Best food? | Pizza | Pasta | Burger | multi\`\n│\n` +
            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

        if (!args.length) return reply(usage);

        const full = args.join(' ');
        const parts = full.split('|').map(s => s.trim()).filter(Boolean);

        if (parts.length < 3) {
            return reply(`❌ You need a question and at least 2 options.\n\n${usage}`);
        }

        // Detect optional "multi" flag at the end
        let multiChoice = false;
        if (parts[parts.length - 1].toLowerCase() === 'multi') {
            multiChoice = true;
            parts.pop();
        }

        const question = parts[0];
        const options  = parts.slice(1);

        if (options.length < 2) {
            return reply(`❌ Please provide at least 2 options.\n\n${usage}`);
        }
        if (options.length > 12) {
            return reply(`❌ Maximum 12 options allowed. You provided *${options.length}*.`);
        }

        // Check for duplicate options (case-insensitive)
        const lowerOptions = options.map(o => o.toLowerCase());
        const uniqueOptions = new Set(lowerOptions);
        if (uniqueOptions.size !== options.length) {
            return reply(`❌ Poll options must be unique. Please remove duplicate entries.`);
        }

        try {
            await react('📊');

            await sock.sendMessage(jid, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: multiChoice ? 0 : 1
                }
            });

            await react('✅');

        } catch (err) {
            await react('❌').catch(() => {});
            console.error('[POLL] Error:', err.message);
            return reply(`❌ Failed to create poll.\n_${err.message || 'Unknown error'}_`);
        }
    }
};
