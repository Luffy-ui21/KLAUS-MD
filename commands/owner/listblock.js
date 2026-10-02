import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'listblock',
    description: 'List all blocked WhatsApp contacts',
    category: 'owner',
    aliases: ['blocklist', 'blocked'],
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;

        // React with hourglass instead of sending a "fetching..." text message
        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
        } catch {}

        try {
            let blocklist = [];
            try {
                blocklist = await sock.fetchBlocklist();
            } catch (err) {
                console.error('[LISTBLOCK] fetchBlocklist error:', err?.message);
                try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `❌ Failed to fetch block list.\n\n_Error: ${err?.message || 'Unknown'}_`,
                }, { quoted: msg });
            }

            if (!blocklist || blocklist.length === 0) {
                await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🚫 *BLOCK LIST* ⌋\n│\n├─⊷ *Status:* Empty\n│  └⊷ No contacts are currently blocked.\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
                }, { quoted: msg });
                try { await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }); } catch {}
                return;
            }

            // Resolve any @lid JIDs to real phone numbers in parallel
            const resolveLid = globalThis.resolvePhoneFromLidAsync;
            const resolved = await Promise.all(blocklist.map(async (jid) => {
                try {
                    if (!jid || typeof jid !== 'string') {
                        return { jid: String(jid || ''), num: '', mentionJid: null, isLid: false };
                    }
                    const rawNum = jid.split('@')[0].split(':')[0];

                    // Plain phone-number JID — use as-is
                    if (jid.endsWith('@s.whatsapp.net')) {
                        return { jid, num: rawNum, mentionJid: jid, isLid: false };
                    }

                    // LID — try to resolve to a real phone number
                    if (jid.endsWith('@lid') && typeof resolveLid === 'function') {
                        try {
                            const phone = await resolveLid(jid);
                            if (phone && phone.length >= 7) {
                                // Mention the resolved PN JID so WhatsApp renders the contact pill
                                return { jid, num: phone, mentionJid: `${phone}@s.whatsapp.net`, isLid: false };
                            }
                        } catch {}
                        // Could not resolve — keep raw LID for mention so WA at least groups it
                        return { jid, num: rawNum, mentionJid: jid, isLid: true };
                    }

                    // Unknown JID format — best effort
                    return { jid, num: rawNum, mentionJid: jid, isLid: false };
                } catch {
                    return { jid: String(jid || ''), num: '', mentionJid: null, isLid: false };
                }
            }));

            // Paginate (max 50 per message)
            const PAGE_SIZE = 50;
            const page = Math.max(1, parseInt(args[0]) || 1);
            const total = resolved.length;
            const totalPages = Math.ceil(total / PAGE_SIZE);
            const start = (page - 1) * PAGE_SIZE;
            const slice = resolved.slice(start, start + PAGE_SIZE);

            let text = `╭─⌈ 🚫 *BLOCK LIST* ⌋\n│\n`;
            text += `├─⊷ *Total blocked:* ${total}\n`;
            if (totalPages > 1) text += `├─⊷ *Page:* ${page}/${totalPages}\n`;
            text += `│\n`;

            const mentions = [];
            slice.forEach((entry, i) => {
                let label;
                if (entry.isLid) {
                    // Unresolved LID — show plainly so user knows it's not a real number
                    label = `(unresolved LID: ${entry.num})`;
                } else if (entry.num) {
                    // Render as @<num> so WhatsApp draws the contact pill from `mentions`
                    label = `@${entry.num}`;
                } else {
                    label = '(unknown)';
                }
                text += `├─⊷ ${start + i + 1}. ${label}\n`;
                if (entry.mentionJid) mentions.push(entry.mentionJid);
            });

            if (totalPages > 1 && page < totalPages) {
                text += `│\n├─⊷ More: *listblock ${page + 1}*\n`;
            }

            text += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

            await sock.sendMessage(chatId, { text, mentions }, { quoted: msg });
            try { await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }); } catch {}
        } catch (err) {
            console.error('[LISTBLOCK] unexpected error:', err?.message);
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
            try {
                await sock.sendMessage(chatId, {
                    text: `❌ Failed to display block list.\n\n_Error: ${err?.message || 'Unknown'}_`,
                }, { quoted: msg });
            } catch {}
        }
    },
};
