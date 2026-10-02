import { createRequire } from 'module';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

// ─── LID → phone number resolver (mirrors getjid pattern) ─────────────────────
async function resolveJid(sock, inputJid) {
    if (!inputJid) return inputJid;
    if (inputJid.endsWith('@s.whatsapp.net')) {
        return inputJid.replace(/:\d+@/, '@');
    }
    if (inputJid.endsWith('@newsletter')) return inputJid;

    if (inputJid.endsWith('@lid')) {
        try {
            if (sock.signalRepository?.lidMapping?.getPNForLID) {
                const pn = await sock.signalRepository.lidMapping.getPNForLID(inputJid);
                if (pn) {
                    const num = String(pn).split('@')[0].split(':')[0].replace(/\D/g, '');
                    if (num.length >= 7) return `${num}@s.whatsapp.net`;
                }
            }
        } catch {}

        try {
            if (sock.store?.contacts) {
                for (const [contactJid, contact] of Object.entries(sock.store.contacts)) {
                    if (contact.lid === inputJid || contact.lidJid === inputJid) {
                        const num = contactJid.split('@')[0].replace(/\D/g, '');
                        if (num.length >= 7) return `${num}@s.whatsapp.net`;
                    }
                }
            }
        } catch {}

        return inputJid;
    }

    const number = inputJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    return `${number}@s.whatsapp.net`;
}

// ─── Resolve channel input → newsletter JID ────────────────────────────────────
async function resolveChannelJid(sock, raw, chatJid) {
    if (!raw) {
        // No arg — must already be inside a channel
        if (chatJid?.endsWith('@newsletter')) return chatJid;
        return null;
    }

    // Full JID passed directly
    if (raw.endsWith('@newsletter')) return raw;

    // Channel invite link: https://whatsapp.com/channel/XXXXX
    const channelMatch = raw.match(
        /(?:https?:\/\/)?(?:www\.)?(?:whatsapp\.com\/channel|chat\.whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/i
    );
    if (channelMatch) {
        const meta = await sock.newsletterMetadata('invite', channelMatch[1]);
        if (meta?.id) return meta.id;
    }

    // Bare invite code (no URL)
    if (/^[A-Za-z0-9_-]{10,}$/.test(raw)) {
        try {
            const meta = await sock.newsletterMetadata('invite', raw);
            if (meta?.id) return meta.id;
        } catch {}
    }

    return null;
}

// ─── Admin role label ─────────────────────────────────────────────────────────
function roleLabel(type = '') {
    const t = String(type).toUpperCase();
    if (t.includes('OWNER')) return '👑 Owner';
    if (t.includes('ADMIN')) return '🛡️ Admin';
    return '👤 Member';
}

// ─── Command ──────────────────────────────────────────────────────────────────
export default {
    name: 'getchanneladmins',
    alias: ['channeladmins', 'cadmins', 'channeladmin'],
    description: 'List the JIDs of all admins of a WhatsApp channel',
    category: 'channel',

    async execute(sock, m, args, PREFIX) {
        const chatJid = m.key.remoteJid;
        const raw     = args.join(' ').trim();

        try {
            const channelJid = await resolveChannelJid(sock, raw, chatJid);

            if (!channelJid) {
                return sock.sendMessage(chatJid, {
                    text:
                        `╭─⌈ 📢 *GET CHANNEL ADMINS* ⌋\n│\n` +
                        `├─⊷ *${PREFIX}getchanneladmins <link>*\n│  └⊷ Channel invite link\n` +
                        `├─⊷ *${PREFIX}getchanneladmins <jid>*\n│  └⊷ e.g. 120363...@newsletter\n` +
                        `├─⊷ Run inside a channel chat\n│  └⊷ No argument needed\n` +
                        `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }

            await sock.sendMessage(chatJid, { react: { text: '⏳', key: m.key } });

            const meta = await sock.newsletterMetadata('jid', channelJid);

            // Collect admins from all known response shapes
            const rawAdmins = [];
            if (Array.isArray(meta?.admins))       rawAdmins.push(...meta.admins);
            if (Array.isArray(meta?.subscribers)) {
                for (const s of meta.subscribers) {
                    const role = (s.role || s.type || s.adminType || '').toUpperCase();
                    if (role.includes('ADMIN') || role.includes('OWNER')) rawAdmins.push(s);
                }
            }

            if (rawAdmins.length === 0) {
                await sock.sendMessage(chatJid, { react: { text: '✅', key: m.key } });
                return sock.sendMessage(chatJid, {
                    text: `📢 *${meta?.name || channelJid}*\n\nNo admins found in metadata.\n_(You may not be subscribed to this channel, or the API did not return admin data.)_`
                }, { quoted: m });
            }

            // Resolve each admin JID
            const resolved = await Promise.all(rawAdmins.map(async (a) => {
                const rawJid  = a.id || a.jid || '';
                const role    = a.type || a.adminType || a.role || '';
                const jid     = await resolveJid(sock, rawJid);
                return { jid, role };
            }));

            const channelName = meta?.name || channelJid.split('@')[0];

            // Build reply
            const W = 26;
            const border = '─'.repeat(W);
            let text = `╭─⌈ 📢 *CHANNEL ADMINS* ⌋\n│\n`;
            text += `├ 📛 *${channelName}*\n`;
            text += `├ 🔑 *${resolved.length} Admin${resolved.length !== 1 ? 's' : ''}*\n│\n`;

            for (let i = 0; i < resolved.length; i++) {
                const { jid, role } = resolved[i];
                text += `├─ ${i + 1}. ${roleLabel(role)}\n`;
                text += `│  └⊷ \`${jid}\`\n`;
            }

            text += `│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

            // If wolfbtns available, add a copy button with all JIDs
            if (giftedBtns?.sendInteractiveMessage) {
                try {
                    const allJids = resolved.map(r => r.jid).join('\n');
                    await giftedBtns.sendInteractiveMessage(sock, chatJid, {
                        text,
                        interactiveButtons: [
                            {
                                name: 'cta_copy',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '📋 Copy All JIDs',
                                    copy_code: allJids
                                })
                            }
                        ]
                    });
                    await sock.sendMessage(chatJid, { react: { text: '✅', key: m.key } });
                    return;
                } catch {}
            }

            await sock.sendMessage(chatJid, { text }, { quoted: m });
            await sock.sendMessage(chatJid, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.error('[getchanneladmins]', err.message);
            await sock.sendMessage(chatJid, { react: { text: '❌', key: m.key } }).catch(() => {});
            let msg = `❌ ${err.message}`;
            if (/not found|404/i.test(err.message))          msg = '❌ Channel not found. Check the link or JID.';
            else if (/forbidden|403|unauthorized/i.test(err.message)) msg = '❌ Access denied. Subscribe to the channel first.';
            else if (/timeout/i.test(err.message))            msg = '❌ Request timed out. Try again.';
            await sock.sendMessage(chatJid, { text: msg }, { quoted: m });
        }
    }
};
