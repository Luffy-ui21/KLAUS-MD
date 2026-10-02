import { createRequire } from 'module';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const _require = createRequire(import.meta.url);

let giftedBtns;
try { giftedBtns = _require('wolfbtns'); } catch {}

// Extract a usable call link URL from whatever createCallLink returns
function extractCallUrl(result, type) {
    const path = type === 'video' ? 'video' : 'voice';

    if (!result) return null;

    // Already a full URL
    if (typeof result === 'string' && result.startsWith('https://')) return result;

    // Plain token string
    if (typeof result === 'string' && result.length > 4)
        return `https://call.whatsapp.com/${path}/${result}`;

    // Object with a url/link/callLink field
    if (typeof result === 'object') {
        const url = result.url || result.link || result.callLink || result.inviteLink;
        if (url && typeof url === 'string') return url;

        // Object with a token/code/callId field
        const token = result.token || result.code || result.callId || result.id;
        if (token && typeof token === 'string')
            return `https://call.whatsapp.com/${path}/${token}`;
    }

    return null;
}

export default {
    name: 'videocall',
    aliases: ['vcall', 'videolink', 'callvideo'],
    description: 'Generate a WhatsApp video call invite link',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const jid    = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const footer = getFooter(sender);

        try {
            await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

            // Generate the call link
            let callUrl = null;
            try {
                const result = await sock.createCallLink('video');
                callUrl = extractCallUrl(result, 'video');
            } catch (e) {
                // Some Baileys builds use a different method name
                try {
                    const result = await sock.createGroupCallLink?.(jid);
                    callUrl = extractCallUrl(result, 'video');
                } catch {}
            }

            if (!callUrl) throw new Error('Unable to generate a call link on this session');

            const caption =
                `╭─⌈ 📹 *VIDEO CALL INVITE* ⌋\n` +
                `│\n` +
                `├─⊷ *Link:*\n` +
                `│  └⊷ ${callUrl}\n` +
                `│\n` +
                `├─⊷ Tap *Join Call* to start the video call\n` +
                `├─⊷ Valid for 90 days\n` +
                `│\n` +
                `╰⊷ ${footer}`;

            const buttons = [
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📹 Join Video Call',
                        url: callUrl,
                        merchant_url: callUrl
                    })
                },
                {
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📋 Copy Link',
                        copy_code: callUrl
                    })
                }
            ];

            let sent = false;
            if (giftedBtns?.sendInteractiveMessage) {
                try {
                    await giftedBtns.sendInteractiveMessage(sock, jid, {
                        text: caption,
                        footer: `📹 ${getOwnerName().toUpperCase()} TECH`,
                        interactiveButtons: buttons
                    });
                    sent = true;
                } catch (btnErr) {
                    console.log('[VIDEOCALL] Button send failed, falling back:', btnErr.message);
                }
            }

            if (!sent) {
                await sock.sendMessage(jid, { text: caption }, { quoted: m });
            }

            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.error('[VIDEOCALL]', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } }).catch(() => {});
            await sock.sendMessage(jid, {
                text: `❌ *Failed to generate video call link*\n\n*Error:* ${err.message}`
            }, { quoted: m });
        }
    }
};
