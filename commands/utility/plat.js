import { getPlatformInfo } from '../../lib/platformDetect.js';
import { getBotName } from '../../lib/botname.js';

export default {
    name:        'plat',
    alias:       ['platform2', 'whererun', 'myplatform'],
    category:    'utility',
    description: 'Show the platform the bot is running on',

    async execute(sock, msg, args, PREFIX) {
        const { name, icon } = getPlatformInfo();
        const botName = getBotName();

        const text =
            `╭─⌈ ${icon} *PLATFORM* ⌋\n` +
            `│ Running on: *${name}* ${icon}\n` +
            `╰⊷ *${botName}*`;

        await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
    }
};
