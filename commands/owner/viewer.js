import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
export default {
    name: 'viewer',
    alias: ['statusviewer', 'statusview', 'statusprivacy', 'viewstatus'],
    category: 'owner',
    description: 'Toggle who can view your WhatsApp status',
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
                await sock.updateStatusPrivacy('all');
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 📊 *STATUS VIEWER PRIVACY* ⌋\n│\n├─⊷ *Set:* 🌍 Everyone\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '🌍', key: msg.key } }); } catch {}

            } else if (action === 'contacts') {
                await sock.updateStatusPrivacy('contacts');
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 📊 *STATUS VIEWER PRIVACY* ⌋\n│\n├─⊷ *Set:* 👥 Contacts Only\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '👥', key: msg.key } }); } catch {}

            } else if (action === 'except') {
                await sock.updateStatusPrivacy('contact_blacklist');
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 📊 *STATUS VIEWER PRIVACY* ⌋\n│\n├─⊷ *Set:* 🚫 Contacts Except\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '🚫', key: msg.key } }); } catch {}

            } else if (action === 'none' || action === 'nobody') {
                await sock.updateStatusPrivacy('none');
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 📊 *STATUS VIEWER PRIVACY* ⌋\n│\n├─⊷ *Set:* 🔒 Nobody\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '🔒', key: msg.key } }); } catch {}

            } else {
                let currentStatus = 'Unknown';
                try {
                    const privacy = await sock.fetchPrivacySettings(true);
                    const sp = privacy.status || privacy.statusPrivacy;
                    if (sp === 'all') currentStatus = '🌍 Everyone';
                    else if (sp === 'contacts') currentStatus = '👥 Contacts';
                    else if (sp === 'contact_blacklist') currentStatus = '🚫 Contacts Except...';
                    else if (sp === 'none') currentStatus = '🔒 Nobody';
                    else currentStatus = sp || 'Unknown';
                } catch {}

                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 📊 *STATUS VIEWER PRIVACY* ⌋\n│\n├─⊷ *${PREFIX}viewer everyone*\n│  └⊷ Everyone sees\n├─⊷ *${PREFIX}viewer contacts*\n│  └⊷ Contacts only\n├─⊷ *${PREFIX}viewer except*\n│  └⊷ Contacts except\n├─⊷ *${PREFIX}viewer nobody*\n│  └⊷ No one sees\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '📋', key: msg.key } }); } catch {}
            }

        } catch (error) {
            console.error('[Viewer] Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Failed to update status privacy*\n\n${error.message}`
            }, { quoted: msg });
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
        }
    }
};
