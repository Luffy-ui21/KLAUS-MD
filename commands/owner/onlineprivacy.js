import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'onlineprivacy',
    alias: ['onlinevisibility', 'setonline', 'onlinestatus'],
    category: 'owner',
    description: 'Control who can see your Online status on WhatsApp',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command*'
            }, { quoted: msg });
        }

        const action = args[0]?.toLowerCase();

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            if (action === 'everyone' || action === 'all') {
                await sock.updateOnlinePrivacy('all');
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🟢 *ONLINE PRIVACY* ⌋\n│\n├─⊷ *Set:* 🌍 Everyone\n│  └⊷ Anyone can see when you're Online\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '🌍', key: msg.key } }); } catch {}

            } else if (action === 'match' || action === 'matchlastseen' || action === 'same') {
                await sock.updateOnlinePrivacy('match_last_seen');
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🟢 *ONLINE PRIVACY* ⌋\n│\n├─⊷ *Set:* 🔄 Match Last Seen\n│  └⊷ Online visibility follows your Last Seen setting\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '🔄', key: msg.key } }); } catch {}

            } else {
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🟢 *ONLINE PRIVACY* ⌋\n` +
                          `├─⊷ *${PREFIX}onlineprivacy everyone* — 🌍 All users\n` +
                          `├─⊷ *${PREFIX}onlineprivacy match* — 🔄 Match Last Seen\n` +
                          `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '📋', key: msg.key } }); } catch {}
            }

        } catch (error) {
            console.error('[OnlinePrivacy] Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Failed to update online privacy*\n\n${error.message}`
            }, { quoted: msg });
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
        }
    }
};
