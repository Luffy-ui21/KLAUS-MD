import { loadConfig, saveConfig } from '../../lib/cpanel.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name:        'setkey',
    alias:       ['cpanelkey', 'pterokey'],
    category:    'cpanel',
    description: 'Set the Pterodactyl Application API key',
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
            const status = config.apiKey
                ? `✅ Set (${config.apiKey.slice(0, 6)}••••••••)`
                : '❌ Not set';
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔑 *SET API KEY* ⌋\n├─⊷ *${PREFIX}setkey <api-key>*\n│  └⊷ Save your Pterodactyl Application key\n├─⊷ *Status:* ${status}\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const key = args[0].trim();
        if (key.length < 16) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Key too short. Pterodactyl keys are usually 48 characters.`
            }, { quoted: msg });
        }

        config.apiKey = key;
        saveConfig(config);

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(chatId, {
            text: `✅ *API Key saved* — ${key.slice(0, 6)}••••••••\n\n_Next: \`${PREFIX}setlink <panel-url>\`_`
        }, { quoted: msg });
    }
};
