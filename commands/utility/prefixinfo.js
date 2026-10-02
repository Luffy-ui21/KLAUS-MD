import { getBotName } from '../../lib/botname.js';

export default {
    name: 'prefixinfo',
    alias: ['prefix', 'myprefix', 'botprefix'],
    description: 'Check the current bot prefix',
    category: 'info',
    usage: 'prefixinfo',

    async execute(sock, msg, args, PREFIX, extra) {
        if (extra && typeof extra.isOwner === 'function' && !extra.isOwner()) {
            return;
        }

        const { remoteJid } = msg.key;
        const isPrefixless = global.isPrefixless || (!PREFIX || PREFIX.trim() === '');
        const currentPrefix = isPrefixless ? '(none - prefixless mode)' : PREFIX;

        const text = `╭─⌈  *BOT PREFIX* ⌋\n` +
                     `├─⊷ Your prefix: *${currentPrefix}*\n` +
                     `╰───────────────\n` +
                     `> *${getBotName().toUpperCase()}*`;

        await sock.sendMessage(remoteJid, { text }, { quoted: msg });
    }
};