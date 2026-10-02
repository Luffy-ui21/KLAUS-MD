import { createRequire } from 'module';
import { loadPaystackConfig, savePaystackConfig } from '../../lib/paystack.js';
import { getBotName } from '../../lib/botname.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

export default {
    name:        'setpaystackkey',
    alias:       ['spk', 'paystackkey'],
    category:    'paystack',
    description: 'Set your Paystack secret key',
    ownerOnly:   true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;
        const BOT = getBotName();

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        if (!args || !args[0]) {
            const config = loadPaystackConfig();
            const key = config.secretKey;

            const display = key
                ? `${key.slice(0, 10)}${'*'.repeat(Math.max(0, key.length - 14))}${key.slice(-4)}`
                : 'Not set';

            const text =
                `╭─⌈ *🔑 PAYSTACK KEY* ⌋\n` +
                `├─⊷ *Status* : ${key ? '✅ Configured' : '❌ Not set'}\n` +
                `├─⊷ *Key*    : \`${display}\`\n` +
                `├─⊷\n` +
                `├─⊷ *Usage:*\n` +
                `│   ${PREFIX}setpaystackkey sk_live_xxxx\n` +
                `╰⊷ *Powered by ${BOT}*`;

            const buttons = key
                ? [
                    {
                        name: 'cta_copy',
                        buttonParamsJson: JSON.stringify({
                            display_text: '📋 Copy Key',
                            copy_code: key
                        })
                    }
                ]
                : [];

            if (giftedBtns?.sendInteractiveMessage && buttons.length) {
                try {
                    await giftedBtns.sendInteractiveMessage(sock, jid, {
                        text,
                        footer: ` ${BOT}`,
                        interactiveButtons: buttons
                    });
                    return;
                } catch {}
            }

            return sock.sendMessage(jid, { text }, { quoted: msg });
        }

        const newKey = args[0].trim();

        if (!newKey.startsWith('sk_')) {
            return sock.sendMessage(jid, {
                text: `❌ Invalid key. Paystack secret keys start with *sk_live_* or *sk_test_*`
            }, { quoted: msg });
        }

        const config = loadPaystackConfig();
        config.secretKey = newKey;
        savePaystackConfig(config);

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(jid, {
            text:
                `╭─⌈ *🔑 PAYSTACK KEY SAVED* ⌋\n` +
                `├─⊷ ✅ Secret key configured successfully\n` +
                `╰⊷ *Powered by ${BOT}*`
        }, { quoted: msg });
    }
};
