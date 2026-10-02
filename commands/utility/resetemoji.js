import { getEmoji, resetEmoji } from '../../lib/userEmoji.js';
import { getFooter } from '../../lib/menuHelper.js';

export default {
    name: 'resetemoji',
    description: 'Reset your personal emoji back to the default ',
    category: 'utility',
    aliases: ['emojidefault', 'defaultemoji'],
    usage: 'resetemoji',

    async execute(sock, m, args, PREFIX) {
        const jid    = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const before = getEmoji(sender);

        resetEmoji(sender);

        await sock.sendMessage(jid, {
            text:
                `╭─⌈  *EMOJI RESET* ⌋\n` +
                `│\n` +
                `├─⊷ *Previous:* ${before}\n` +
                `├─⊷ *Restored:* \n` +
                `│\n` +
                `├─⊷ Your footer emoji is back to default\n` +
                `├─⊷ Use *${PREFIX}setemoji <emoji>* to set a new one\n` +
                `│\n` +
                `╰⊷ ${getFooter(sender)}`
        }, { quoted: m });
    }
};
