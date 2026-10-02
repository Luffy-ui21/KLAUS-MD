import { isPaystackConfigured, initiateCharge, verifyCharge } from '../../lib/paystack.js';
import { getPlanPrice } from '../../lib/paymentConfig.js';
import { isConfigured, getUserByEmail, createUser, createServer, updateUser, usernameFromEmail, generatePassword } from '../../lib/cpanel.js';
import { getBotName } from '../../lib/botname.js';

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

export default {
    name:        'prompt',
    alias:       ['stkpush', 'payprompt', 'mpesa'],
    category:    'paystack',
    description: 'Send an M-Pesa STK push — manual or auto-provision a server on payment',
    ownerOnly:   true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;
        const BOT = getBotName();

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        if (!isPaystackConfigured()) {
            return sock.sendMessage(jid, {
                text: `❌ Paystack not configured.\nRun *${PREFIX}setpaystackkey sk_live_xxxx* first.`
            }, { quoted: msg });
        }

        const phone = args?.[0];
        if (!phone) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 💳 *PROMPT* ⌋\n` +
                    `├─⊷ *${PREFIX}prompt <phone> <amount>*\n` +
                    `│  └⊷ Manual STK push for any amount\n` +
                    `├─⊷ *${PREFIX}prompt <phone> <email> unlimited*\n` +
                    `│  └⊷ Pay → create user + unlimited server\n` +
                    `├─⊷ *${PREFIX}prompt <phone> <email> limited*\n` +
                    `│  └⊷ Pay → create user + limited server\n` +
                    `├─⊷ *${PREFIX}prompt <phone> <email> admin*\n` +
                    `│  └⊷ Pay → create user + grant admin access\n` +
                    `╰⊷ *Powered by ${BOT}*`
            }, { quoted: msg });
        }

        // ── Detect mode: provisioning if args[1] contains '@' ────────────────
        const isProvisioning = args?.[1]?.includes('@');

        if (isProvisioning) {
            return handleProvisioning(sock, msg, args, PREFIX, BOT, jid, phone);
        } else {
            return handleManual(sock, msg, args, PREFIX, BOT, jid, phone);
        }
    }
};

// ── Manual flow: prompt <phone> <amount> ──────────────────────────────────────
async function handleManual(sock, msg, args, PREFIX, BOT, jid, phone) {
    const amount = args?.[1];

    if (!amount || isNaN(Number(amount))) {
        return sock.sendMessage(jid, {
            text:
                `╭─⌈ 💳 *PROMPT* ⌋\n` +
                `├─⊷ *${PREFIX}prompt <phone> <amount>*\n` +
                `│  └⊷ Example: ${PREFIX}prompt 254713046497 100\n` +
                `╰⊷ Phone formats: 254..., +254..., or 07...`
        }, { quoted: msg });
    }

    if (Number(amount) <= 0) {
        return sock.sendMessage(jid, { text: '❌ Amount must be greater than 0.' }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
    await sock.sendMessage(jid, {
        text:
            `╭─⌈ *💳 STK PUSH SENT* ⌋\n` +
            `├─⊷ 📱 *Phone*  : ${phone}\n` +
            `├─⊷ 💰 *Amount* : KES ${Number(amount).toLocaleString()}\n` +
            `├─⊷ ⏳ Waiting for payment confirmation...\n` +
            `╰⊷ *Powered by ${BOT}*`
    }, { quoted: msg });

    const { reference, error: chargeErr } = await sendCharge(phone, amount);
    if (chargeErr) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, { text: `❌ Failed to send STK push:\n${chargeErr}` }, { quoted: msg });
    }

    const result = await pollPayment(reference);

    if (result === 'success') {
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        return sock.sendMessage(jid, {
            text:
                `╭─⌈ *✅ PAYMENT RECEIVED* ⌋\n` +
                `├─⊷ 📱 *Phone*     : ${phone}\n` +
                `├─⊷ 💰 *Amount*    : KES ${Number(amount).toLocaleString()}\n` +
                `├─⊷ 🔖 *Reference* : ${reference}\n` +
                `├─⊷ 🕐 *Time*      : ${new Date().toLocaleTimeString()}\n` +
                `╰⊷ *Powered by ${BOT}*`
        }, { quoted: msg });
    }

    await sendPaymentResult(sock, msg, jid, BOT, result, phone, amount, reference);
}

// ── Provisioning flow: prompt <phone> <email> unlimited|limited|admin ─────────
async function handleProvisioning(sock, msg, args, PREFIX, BOT, jid, phone) {
    const email = args[1];
    const planRaw = (args[2] || 'limited').toLowerCase();
    const isAdminPlan = ['admin', 'administrator'].includes(planRaw);
    const plan = isAdminPlan ? 'admin'
               : ['unli', 'unlimited', 'unlim'].includes(planRaw) ? 'unlimited'
               : 'limited';
    const planLabel = plan === 'unlimited' ? '♾️ Unlimited'
                    : plan === 'admin'     ? '👑 Admin'
                    : '🖥️ Limited';

    if (!isConfigured()) {
        return sock.sendMessage(jid, {
            text: `❌ Pterodactyl not configured.\nRun *${PREFIX}setkey*, *${PREFIX}setlink*, and *${PREFIX}nestconfig* first.`
        }, { quoted: msg });
    }

    const price = getPlanPrice(plan);
    if (price <= 0) {
        const planKey = plan === 'unlimited' ? 'unli' : plan === 'admin' ? 'admin' : 'lim';
        return sock.sendMessage(jid, {
            text:
                `❌ No price set for *${planLabel}* plan.\n\n` +
                `Set it first:\n  ${PREFIX}setpayment ${planKey} <amount>`
        }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
    await sock.sendMessage(jid, {
        text:
            `╭─⌈ *💳 STK PUSH SENT* ⌋\n` +
            `├─⊷ 📱 *Phone*   : ${phone}\n` +
            `├─⊷ 📧 *Email*   : ${email}\n` +
            `├─⊷ 📦 *Plan*    : ${planLabel}\n` +
            `├─⊷ 💰 *Amount*  : KES ${price.toLocaleString()}\n` +
            `├─⊷ ⏳ Waiting for payment confirmation...\n` +
            `╰⊷ *Powered by ${BOT}*`
    }, { quoted: msg });

    const { reference, error: chargeErr } = await sendCharge(phone, price);
    if (chargeErr) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, { text: `❌ Failed to send STK push:\n${chargeErr}` }, { quoted: msg });
    }

    const result = await pollPayment(reference);

    if (result !== 'success') {
        return sendPaymentResult(sock, msg, jid, BOT, result, phone, price, reference);
    }

    // ── Payment confirmed — provision account ─────────────────────────────────
    await sock.sendMessage(jid, {
        text: `✅ *Payment confirmed!* Now provisioning ${planLabel} account for *${email}*...`
    }, { quoted: msg });

    // Resolve or create user
    let user;
    let isNewUser = false;
    try {
        user = await getUserByEmail(email);
    } catch {}

    let password = null;
    let username = null;

    if (!user) {
        password = generatePassword();
        username = usernameFromEmail(email);
        const firstName = username.split(/[._-]/)[0] || 'Panel';
        try {
            const created = await createUser(email, username, password, firstName, 'User');
            user = created;
            isNewUser = true;
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text:
                    `⚠️ *Payment received but user creation failed!*\n` +
                    `├─⊷ 🔖 Ref     : ${reference}\n` +
                    `├─⊷ 💰 Amount  : KES ${price.toLocaleString()}\n` +
                    `├─⊷ ❌ Error   : ${err.message}\n` +
                    `╰⊷ Please create the user manually with *${PREFIX}createuser*`
            }, { quoted: msg });
        }
    } else {
        username = user.attributes?.username;
    }

    const attr   = user?.attributes ?? user;
    const userId = attr?.id;

    // ── Admin plan: grant root_admin ──────────────────────────────────────────
    if (plan === 'admin') {
        try {
            await updateUser(userId, {
                email:      attr.email,
                username:   attr.username,
                first_name: attr.first_name,
                last_name:  attr.last_name,
                language:   attr.language || 'en',
                root_admin: true
            });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text:
                    `⚠️ *Payment received, user created, but admin grant failed!*\n` +
                    `├─⊷ 🔖 Ref     : ${reference}\n` +
                    `├─⊷ 👤 User    : ${username} (${email})\n` +
                    `├─⊷ ❌ Error   : ${err.message}\n` +
                    `╰⊷ Grant manually with *${PREFIX}makeadmin ${email}*`
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        return sock.sendMessage(jid, {
            text:
                `╭─⌈ *✅ ADMIN PROVISIONED* ⌋\n` +
                `├─⊷ 📦 *Plan*      : ${planLabel}\n` +
                `├─⊷ 💰 *Paid*      : KES ${price.toLocaleString()}\n` +
                `├─⊷ 🔖 *Ref*       : ${reference}\n` +
                `├─⊷\n` +
                `├─⊷ 👤 *Username*  : ${username}\n` +
                `├─⊷ 📧 *Email*     : ${email}\n` +
                (isNewUser ? `├─⊷ 🔑 *Password*  : ${password}\n` : '') +
                `├─⊷ 👑 *Role*      : Root Admin\n` +
                `╰⊷ *Powered by ${BOT}*`
        }, { quoted: msg });
    }

    // ── Server plan: create server ────────────────────────────────────────────
    const serverName = `${username}'s Server`;
    let server;
    try {
        const overrides = plan === 'unlimited' ? { cpu: 0, memory: 0, disk: 0 } : {};
        server = await createServer(userId, serverName, overrides);
    } catch (err) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, {
            text:
                `⚠️ *Payment received, user created, but server creation failed!*\n` +
                `├─⊷ 🔖 Ref     : ${reference}\n` +
                `├─⊷ 👤 User    : ${username} (${email})\n` +
                `├─⊷ ❌ Error   : ${err.message}\n` +
                `╰⊷ Create server manually with *${PREFIX}create${plan === 'unlimited' ? 'unlimited' : 'panel'} ${email}*`
        }, { quoted: msg });
    }

    const serverId = server?.attributes?.id;
    const shortId  = server?.attributes?.identifier;
    const port     = server?.attributes?.allocation?.default ?? '—';

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    await sock.sendMessage(jid, {
        text:
            `╭─⌈ *✅ SERVER PROVISIONED* ⌋\n` +
            `├─⊷ 📦 *Plan*      : ${planLabel}\n` +
            `├─⊷ 💰 *Paid*      : KES ${price.toLocaleString()}\n` +
            `├─⊷ 🔖 *Ref*       : ${reference}\n` +
            `├─⊷\n` +
            `├─⊷ 👤 *Username*  : ${username}\n` +
            `├─⊷ 📧 *Email*     : ${email}\n` +
            (isNewUser ? `├─⊷ 🔑 *Password*  : ${password}\n` : '') +
            `├─⊷\n` +
            `├─⊷ 🖥️ *Server*    : ${serverName}\n` +
            `├─⊷ 🆔 *ID*        : ${serverId ?? '—'}\n` +
            `├─⊷ 🔑 *Short ID*  : ${shortId ?? '—'}\n` +
            `├─⊷ 🌐 *Port*      : ${port}\n` +
            `╰⊷ *Powered by ${BOT}*`
    }, { quoted: msg });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sendCharge(phone, amount) {
    try {
        const charge = await initiateCharge(phone, amount);
        const reference = charge?.reference;
        console.log(`[prompt] Charge initiated — ref: ${reference}`);
        if (!reference) return { error: 'No reference returned from Paystack.' };
        return { reference };
    } catch (err) {
        console.log(`[prompt] Charge error: ${err.message}`);
        return { error: err.message };
    }
}

async function pollPayment(reference) {
    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        try {
            const tx = await verifyCharge(reference);
            const status = tx?.status;
            console.log(`[prompt] Poll ${i + 1}/${MAX_POLLS} — status: ${status}`);
            if (status === 'success') return 'success';
            if (status === 'failed' || status === 'reversed') return status;
        } catch (err) {
            console.log(`[prompt] Poll error: ${err.message}`);
        }
    }
    return 'timeout';
}

async function sendPaymentResult(sock, msg, jid, BOT, result, phone, amount, reference) {
    if (result === 'timeout') {
        await sock.sendMessage(jid, { react: { text: '⌛', key: msg.key } });
        return sock.sendMessage(jid, {
            text:
                `╭─⌈ *⌛ PAYMENT TIMEOUT* ⌋\n` +
                `├─⊷ 📱 *Phone*     : ${phone}\n` +
                `├─⊷ 💰 *Amount*    : KES ${Number(amount).toLocaleString()}\n` +
                `├─⊷ 🔖 *Reference* : ${reference}\n` +
                `├─⊷ ⚠️ No confirmation received after 2 minutes\n` +
                `╰⊷ *Powered by ${BOT}*`
        }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    return sock.sendMessage(jid, {
        text:
            `╭─⌈ *❌ PAYMENT FAILED* ⌋\n` +
            `├─⊷ 📱 *Phone*  : ${phone}\n` +
            `├─⊷ 💰 *Amount* : KES ${Number(amount).toLocaleString()}\n` +
            `├─⊷ ❌ *Status* : ${result}\n` +
            `╰⊷ *Powered by ${BOT}*`
    }, { quoted: msg });
}
