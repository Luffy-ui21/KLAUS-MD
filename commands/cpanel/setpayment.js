import { createRequire } from 'module';
import { loadPaymentConfig, savePaymentConfig } from '../../lib/paymentConfig.js';
import { getBotName } from '../../lib/botname.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

export default {
    name:        'setpayment',
    alias:       ['setprice', 'payprice', 'priceset'],
    category:    'cpanel',
    description: 'Set prices for limited, unlimited and admin plans',
    ownerOnly:   true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;
        const BOT = getBotName();

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        const config = loadPaymentConfig();

        // ── No args → show current prices ────────────────────────────────────
        if (!args || !args[0]) {
            const unli  = config.unlimitedPrice;
            const lim   = config.limitedPrice;
            const admin = config.adminPrice;

            const text =
                `╭─⌈ *💰 PAYMENT PRICES* ⌋\n` +
                `├─⊷ ♾️ *Unlimited* : KES ${unli  > 0 ? unli.toLocaleString()  : '❌ Not set'}\n` +
                `├─⊷ 🖥️ *Limited*   : KES ${lim   > 0 ? lim.toLocaleString()   : '❌ Not set'}\n` +
                `├─⊷ 👑 *Admin*     : KES ${admin > 0 ? admin.toLocaleString() : '❌ Not set'}\n` +
                `├─⊷\n` +
                `├─⊷ *Usage:*\n` +
                `│   ${PREFIX}setpayment unli <amount>\n` +
                `│   ${PREFIX}setpayment lim <amount>\n` +
                `│   ${PREFIX}setpayment admin <amount>\n` +
                `╰⊷ *Powered by ${BOT}*`;

            return sock.sendMessage(jid, { text }, { quoted: msg });
        }

        const plan   = args[0]?.toLowerCase();
        const amount = Number(args[1]);

        const isUnli  = ['unli', 'unlimited', 'unlim'].includes(plan);
        const isLim   = ['lim', 'limited', 'limit'].includes(plan);
        const isAdmin = ['admin', 'administrator'].includes(plan);

        if (!isUnli && !isLim && !isAdmin) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 💰 *SET PAYMENT* ⌋\n` +
                    `├─⊷ *${PREFIX}setpayment unli <amount>*\n` +
                    `│  └⊷ Set price for unlimited plan\n` +
                    `├─⊷ *${PREFIX}setpayment lim <amount>*\n` +
                    `│  └⊷ Set price for limited plan\n` +
                    `├─⊷ *${PREFIX}setpayment admin <amount>*\n` +
                    `│  └⊷ Set price for admin plan\n` +
                    `╰⊷ Unknown plan: *${plan}*`
            }, { quoted: msg });
        }

        if (!args[1] || isNaN(amount) || amount <= 0) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 💰 *SET PAYMENT* ⌋\n` +
                    `├─⊷ *${PREFIX}setpayment ${plan} <amount>*\n` +
                    `│  └⊷ Example: ${PREFIX}setpayment ${plan} 500\n` +
                    `╰⊷ Amount must be a number greater than 0`
            }, { quoted: msg });
        }

        if (isUnli)  config.unlimitedPrice = amount;
        if (isLim)   config.limitedPrice   = amount;
        if (isAdmin) config.adminPrice     = amount;
        savePaymentConfig(config);

        const planLabel = isUnli ? '♾️ Unlimited' : isAdmin ? '👑 Admin' : '🖥️ Limited';

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(jid, {
            text:
                `╭─⌈ *💰 PRICE UPDATED* ⌋\n` +
                `├─⊷ ${planLabel} plan set to *KES ${amount.toLocaleString()}*\n` +
                `├─⊷ ♾️ Unlimited : KES ${config.unlimitedPrice > 0 ? config.unlimitedPrice.toLocaleString() : '❌ Not set'}\n` +
                `├─⊷ 🖥️ Limited   : KES ${config.limitedPrice   > 0 ? config.limitedPrice.toLocaleString()   : '❌ Not set'}\n` +
                `├─⊷ 👑 Admin     : KES ${config.adminPrice     > 0 ? config.adminPrice.toLocaleString()     : '❌ Not set'}\n` +
                `╰⊷ *Powered by ${BOT}*`
        }, { quoted: msg });
    }
};
