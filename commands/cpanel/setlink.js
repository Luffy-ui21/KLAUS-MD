import { loadConfig, saveConfig } from '../../lib/cpanel.js';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
    name:        'setlink',
    alias:       ['panellink', 'cpanelurl', 'pterolink'],
    category:    'cpanel',
    description: 'Set the Pterodactyl panel URL',
    ownerOnly:   true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const owner  = getOwnerName().toUpperCase();
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
        }

        const config = loadConfig();

        if (!args[0]) {
            const display = config.panelUrl || '❌ Not set';
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔗 *SET PANEL LINK* ⌋\n├─⊷ *${PREFIX}setlink <url>*\n│  └⊷ e.g. \`${PREFIX}setlink https://panel.myhost.com\`\n├─⊷ *Current:* ${display}\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        let url = args[0].trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        url = url.replace(/\/+$/, '');

        config.panelUrl = url;
        saveConfig(config);

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(chatId, {
            text: `✅ *Panel URL saved* — ${url}\n\n_Next: \`${PREFIX}nestconfig\` to set egg & location._`
        }, { quoted: msg });
    }
};
