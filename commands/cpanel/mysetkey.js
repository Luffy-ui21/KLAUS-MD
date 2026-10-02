import { createRequire } from 'module';
import { loadConfig, isConfigured } from '../../lib/cpanel.js';
import { getBotName } from '../../lib/botname.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

export default {
    name: 'mysetkey',
    alias: ['showkey', 'mykey', 'getkey', 'cpanelkey'],
    category: 'cpanel',
    desc: 'Show the configured Pterodactyl API key with a copy button',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(jid, {
                text: `❌ No API key set. Run ${PREFIX}setkey <api-key> first.`
            }, { quoted: msg });
        }

        const { apiKey, panelUrl } = loadConfig();
        const BOT = getBotName();

        const text =
            `╭─⌈ 🔑 *PTERODACTYL API KEY* ⌋\n` +
            `├─⊷ Key   : ${apiKey}\n` +
            `├─⊷ Panel : ${panelUrl || '—'}\n` +
            `╰⊷ *Powered by ${BOT}*`;

        if (giftedBtns?.sendInteractiveMessage) {
            try {
                await giftedBtns.sendInteractiveMessage(sock, jid, {
                    text,
                    footer: ` ${BOT}`,
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy API Key',
                                copy_code: apiKey
                            })
                        }
                    ]
                });
                return;
            } catch {}
        }

        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};
