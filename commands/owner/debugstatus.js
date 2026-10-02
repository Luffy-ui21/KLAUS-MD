export default {
    name: 'debugstatus',
    aliases: ['statusdebug', 'sdebug'],
    category: 'owner',
    description: 'Toggle verbose status debug logging',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, { text: '❌ *Owner Only Command!*' }, { quoted: msg });
        }

        const current = globalThis._debugStatusMode || false;
        globalThis._debugStatusMode = !current;

        const state = globalThis._debugStatusMode ? '✅ ON' : '❌ OFF';

        const onText =
            `*📡 Status Spy Mode: ${state}*\n\n` +
            `Every status@broadcast event will now be captured and sent here — whether posted by your phone or by the bot.\n\n` +
            `*Step 1 — Spy on your phone post:*\n` +
            `1. Open WhatsApp on your phone\n` +
            `2. Post any text status (keep it short)\n` +
            `3. Wait ~5 sec — you will receive a 🔵 PHONE-POSTED dump here\n\n` +
            `*Step 2 — Compare with bot post:*\n` +
            `1. Send *${PREFIX}tostatus hello*\n` +
            `2. Check for a 🟢 BOT-POSTED dump here\n\n` +
            `*What to look for:*\n` +
            `• Does the bot even receive the 🔵 PHONE-POSTED echo?\n` +
            `• Are the message keys/fields the same between phone and bot?\n` +
            `• Does a messages.update receipt arrive after the bot posts?\n\n` +
            `Run *${PREFIX}debugstatus* again to turn off.`;

        await sock.sendMessage(chatId, {
            text: globalThis._debugStatusMode ? onText : `*📡 Status Spy Mode: ${state}*\n\nSpy mode disabled.`
        }, { quoted: msg });
    }
};
