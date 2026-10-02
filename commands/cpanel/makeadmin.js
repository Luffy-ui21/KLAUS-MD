import {
    getUserByEmail, getUserByUsername, updateUser, isConfigured
} from '../../lib/cpanel.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getBotName }   from '../../lib/botname.js';

export default {
    name:        'makeadmin',
    alias:       ['setadmin', 'panelmakeadmin', 'grantadmin'],
    category:    'cpanel',
    description: 'Make an existing panel user a root admin',
    ownerOnly:   true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const owner  = getOwnerName().toUpperCase();
        const BOT    = getBotName();
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
        }

        const identifier = args[0]?.trim();

        if (!identifier) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 👑 *MAKE ADMIN* ⌋\n` +
                    `├─⊷ *${PREFIX}makeadmin <email or username>*\n` +
                    `│  └⊷ Grants root admin to a panel user\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(chatId, {
                text: `❌ Not configured.\n\nRun \`${PREFIX}setkey\`, \`${PREFIX}setlink\` first.`
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        let user;
        try {
            user = identifier.includes('@')
                ? await getUserByEmail(identifier)
                : await getUserByUsername(identifier);
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: msg });
        }

        if (!user) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: `❌ User *${identifier}* not found.`
            }, { quoted: msg });
        }

        const attr = user.attributes;

        if (attr.root_admin) {
            await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } });
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ⚠️ *ALREADY ADMIN* ⌋\n` +
                    `├─⊷ 👤 User  : ${attr.username} (${attr.email})\n` +
                    `├─⊷ 👑 Role  : Root Admin (already set)\n` +
                    `╰⊷ *Powered by ${BOT}*`
            }, { quoted: msg });
        }

        try {
            await updateUser(attr.id, {
                email:      attr.email,
                username:   attr.username,
                first_name: attr.first_name,
                last_name:  attr.last_name,
                language:   attr.language || 'en',
                root_admin: true
            });
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(chatId, {
            text:
                `╭─⌈ ✅ *ADMIN GRANTED* ⌋\n` +
                `├─⊷ 👤 User  : ${attr.username}\n` +
                `├─⊷ 📧 Email : ${attr.email}\n` +
                `├─⊷ 👑 Role  : Root Admin\n` +
                `╰⊷ *Powered by ${BOT}*`
        }, { quoted: msg });
    }
};
