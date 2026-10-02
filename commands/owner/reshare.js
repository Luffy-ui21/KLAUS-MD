import {
    postPersonalStatus,
    processQuotedForStatus,
    buildStatusJidList
} from '../../lib/statusHelper.js';

// Detect if a string is a single emoji (or emoji sequence)
const EMOJI_RE = /^\p{Emoji_Presentation}[\p{Emoji}\u{FE0F}\u{20E3}]*$/u;

function parseEmoji(str) {
    if (!str) return null;
    return EMOJI_RE.test(str.trim()) ? str.trim() : null;
}

export default {
    name: 'reshare',
    alias: ['repost', 'rs'],
    category: 'owner',
    description: 'Reshare a WhatsApp status to your own status. Reply to a status with .reshare [emoji]',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, { text: '❌ *Owner Only Command!*' }, { quoted: msg });
        }

        // Must be a reply — quoted message carries the status content
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;
        const isStatusReply = contextInfo?.remoteJid === 'status@broadcast';

        if (!quotedMsg) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 📤 *RESHARE STATUS* ⌋\n│\n` +
                    `├─⊷ *How to use:*\n` +
                    `│  Reply to someone's status,\n` +
                    `│  then type:\n│\n` +
                    `├─⊷ *${PREFIX}reshare*\n` +
                    `│  └⊷ Reshares with 🔄\n` +
                    `├─⊷ *${PREFIX}reshare 🔥*\n` +
                    `│  └⊷ Reshares with your emoji\n│\n` +
                    `╰⊷ Your original message edits to the emoji after posting`
            }, { quoted: msg });
        }

        // Pick emoji — first arg if it's an emoji, else default 🔄
        const emoji = parseEmoji(args[0]) || '🔄';

        try {
            // React with hourglass while working
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            // Parse the quoted status content
            const { content, mediaType } = await processQuotedForStatus(quotedMsg, '');

            if (!content) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return sock.sendMessage(chatId, { text: '❌ Could not read the status content.' }, { quoted: msg });
            }

            // Build recipient list & post
            const statusJidList = await buildStatusJidList(sock);
            console.log(`📤 [reshare] Reposting ${mediaType} to ${statusJidList.length} contacts`);

            const extraOpts = mediaType === 'Text' ? { backgroundColor: '#1b5e20', font: 0 } : {};
            const result = await postPersonalStatus(sock, content, statusJidList, extraOpts);

            console.log(`✅ [reshare] ${mediaType} reshared — msgId: ${result?.key?.id}`);

            // ── Edit the original ".reshare" message to just the emoji ────────
            // Works because bot runs on the same account as the owner (fromMe)
            try {
                await sock.sendMessage(chatId, { text: emoji, edit: msg.key });
            } catch (editErr) {
                // Edit not critical — fall back to a reaction
                console.log(`📤 [reshare] Edit failed (non-fatal): ${editErr.message}`);
                await sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } }).catch(() => {});
            }

        } catch (err) {
            console.error('❌ [reshare] Error:', err.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }).catch(() => {});

            let errMsg = `❌ Reshare failed: ${err.message}`;
            if (/connection closed/i.test(err.message))    errMsg = '❌ Connection dropped. Try again in a moment.';
            else if (/timed?[\s-]?out/i.test(err.message)) errMsg = '❌ Timed out. Try a smaller file.';
            else if (/media/i.test(err.message))            errMsg = '❌ Media upload failed. File may be too large.';

            await sock.sendMessage(chatId, { text: errMsg }, { quoted: msg });
        }
    }
};
