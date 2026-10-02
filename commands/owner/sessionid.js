// commands/owner/sessionid.js
// KLAUS MD — retrieve the portable SESSION_ID string for backup or redeploy.
// Owner-only. Output is sent as a code block + a "copy" interactive button.

import { exportSessionIdString } from '../../lib/authState.js';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';
import { getClient } from '../../lib/database.js';

export default {
    name: 'sessionid',
    alias: ['sessionstring', 'getsession', 'exportsession'],
    category: 'owner',
    ownerOnly: true,
    description: 'Print the portable SESSION_ID (KLAUS MD: format) for backup or redeploy',

    async execute(sock, m, args, PREFIX, extra = {}) {
        const jid = m.key.remoteJid;
        const reply = (text, opts = {}) => sock.sendMessage(jid, { text, ...opts }, { quoted: m });

        try {
            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

            const db = getClient();
            const sessionId = await exportSessionIdString(db, './session');

            if (!sessionId) {
                await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return reply(
                    `❌ *No session found*\n\n` +
                    `Pair WhatsApp first — the bot needs an active session before it can export one.\n\n` +
                    `_Restart the bot and choose Option 1 (Pairing Code Login) to pair._`
                );
            }

            // Truncate for the on-screen preview, but the full string is in the
            // interactive copy button below.
            const preview = sessionId.length > 80
                ? `${sessionId.slice(0, 40)}…${sessionId.slice(-20)}`
                : sessionId;

            const botName = getBotName();
            const ownerName = getOwnerName(m.key.participant || m.key.remoteJid);

            const text =
                `╭─⌈ 🔐 *SESSION ID EXPORT* ⌋\n│\n` +
                `├─⊷ *Bot:*     ${botName}\n` +
                `├─⊷ *Owner:*   ${ownerName || 'Unknown'}\n` +
                `├─⊷ *Prefix:*   KLAUS MD:\n` +
                `├─⊷ *Length:*  ${sessionId.length} chars\n` +
                `├─⊷ *Preview:*  \`${preview}\`\n│\n` +
                `├─⊷ *How to use:*\n` +
                `│  1. Tap the **📋 Copy SESSION_ID** button below\n` +
                `│  2. Paste into your \`.env\` file as:\n` +
                `│     \`SESSION_ID="<paste>"\`\n` +
                `│  3. Or set it as the \`SESSION_ID\` env var on Railway/Render\n` +
                `│  4. Restart the bot — it auto-connects, no pair code needed\n│\n` +
                `├─⊷ ⚠️ Treat this like a password — anyone with it can impersonate your bot.\n` +
                `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

            // Try to send an interactive "copy" button via wolfbtns — fall back to
            // a plain message if wolfbtns isn't available (e.g. older runtime).
            try {
                const { createRequire } = await import('module');
                const require = createRequire(import.meta.url);
                const { sendInteractiveMessage } = require('wolfbtns');
                await sendInteractiveMessage(sock, jid, {
                    text,
                    footer: botName,
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy SESSION_ID',
                                copy_code: sessionId
                            })
                        }
                    ]
                });
            } catch (_) {
                // Fallback: send the full SESSION_ID in a second message so the
                // user can long-press to copy.
                await reply(text);
                await reply(`\`\`\`\nSESSION_ID="${sessionId}"\n\`\`\``);
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        } catch (err) {
            console.error('[SESSIONID] Error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return reply(`❌ *Failed to export SESSION_ID*\n\n_${err.message}_`);
        }
    }
};
