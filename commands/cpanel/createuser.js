import {
    createUser, usernameFromEmail, generatePassword, isConfigured
} from '../../lib/cpanel.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getBotName }   from '../../lib/botname.js';

export default {
    name:        'createuser',
    alias:       ['addpaneluser', 'newpaneluser', 'cpanelcreateuser'],
    category:    'cpanel',
    description: 'Create a Pterodactyl panel user and get their credentials',
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

        const email = args[0]?.trim();

        if (!email || !email.includes('@')) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 👤 *CREATE USER* ⌋\n├─⊷ *${PREFIX}createuser <email>*\n│  └⊷ Creates a panel user and returns credentials\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(chatId, {
                text: `❌ Not configured.\n\nRun \`${PREFIX}setkey\` and \`${PREFIX}setlink\` first.`
            }, { quoted: msg });
        }

        const username = usernameFromEmail(email);
        const password = generatePassword();

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        let userId;
        try {
            const result = await createUser(email, username, password);
            userId = result?.attributes?.id;
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: msg });
        }

        const credText =
            `╭─⌈ ✅ *USER CREATED* ⌋\n` +
            `├─⊷ Email    : ${email}\n` +
            `├─⊷ Username : ${username}\n` +
            `├─⊷ Password : ${password}\n` +
            `├─⊷ User ID  : ${userId ?? '—'}\n` +
            `╰⊷ *Powered by ${BOT}*`;

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

        // Send with copy buttons when wolfbtns is available
        const btns = globalThis._giftedBtns;
        if (btns?.sendInteractiveMessage) {
            try {
                await btns.sendInteractiveMessage(sock, chatId, {
                    text:   credText,
                    footer: ` ${BOT}`,
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy Username',
                                copy_code:    username
                            })
                        },
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🔑 Copy Password',
                                copy_code:    password
                            })
                        }
                    ]
                });
                return;
            } catch {}
        }

        // Fallback — plain text
        await sock.sendMessage(chatId, { text: credText }, { quoted: msg });
    }
};
