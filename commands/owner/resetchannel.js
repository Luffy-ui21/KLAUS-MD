import { setChannelInfo } from '../../lib/channelMode.js';

const DEFAULT_JID = '120363424199376597@newsletter';
const DEFAULT_NAME = 'WOLF TECH';

export default {
    name: 'resetchannel',
    alias: ['rc', 'resetchannel'],
    category: 'owner',
    description: 'Reset channel JID back to default',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra || {};
        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;

        if (!jidManager?.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, { text: `❌ *Owner Only Command!*` }, { quoted: msg });
        }

        setChannelInfo(DEFAULT_JID, DEFAULT_NAME, 'reset');

        return sock.sendMessage(chatId, {
            text: `✅ *Channel reset to default*\n\`${DEFAULT_JID}\``
        }, { quoted: msg });
    }
};
