import { setActionSession } from '../../lib/actionSession.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getBotName } from '../../lib/botname.js';

// Tracks sent group lists: messageId → sorted array of { id, name }
// Exposed on globalThis so index.js can route plain-number replies to this handler
const groupListCache = new Map();
globalThis.groupListCache = groupListCache;
const MAX_CACHE = 50;

export default {
    name: 'mygroups',
    alias: ['grouplist', 'listgroups', 'groups'],
    description: 'List all groups the bot is currently in',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || (msg.key.fromMe ? sock.user?.id : chatId);

        // ── Reply-with-number handler ─────────────────────────────────────────
        // If the user replied to a mygroups list message with a plain number,
        // look up that group and show it with Leave / Visit buttons.
        const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const input    = (args[0] || '').trim();

        if (quotedId && groupListCache.has(quotedId) && /^\d+$/.test(input)) {
            const groups = groupListCache.get(quotedId);
            const idx    = parseInt(input) - 1;
            const group  = groups[idx];

            if (!group) {
                return sock.sendMessage(chatId, {
                    text: `❌ No group at position *${input}*. The list has *${groups.length}* groups.`
                }, { quoted: msg });
            }

            // Store the selected group in the action session so mygroupleave /
            // mygroupvisit can retrieve it when the button is tapped
            const sessionKey = `mygroup:${senderJid?.split('@')[0]}`;
            setActionSession(sessionKey, { id: group.id, name: group.name });

            const resultText =
                `╭─⌈ 👥 *GROUP* ⌋\n` +
                `├─⊷ *${group.name}*\n` +
                `╰─⊷ 🆔 \`${group.id}\``;

            // Send native interactive buttons via wolfbtns directly,
            // so the buttons appear regardless of Button Mode.
            try {
                const { createRequire } = await import('module');
                const require = createRequire(import.meta.url);
                const { sendInteractiveMessage } = require('wolfbtns');
                return await sendInteractiveMessage(sock, chatId, {
                    text: resultText,
                    footer: getBotName(),
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy JID',
                                copy_code: group.id
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🚪 Leave Group',
                                id: `${PREFIX}mygroupleave`
                            })
                        }
                    ]
                });
            } catch (btnErr) {
                // Fallback when wolfbtns is unavailable
                return sock.sendMessage(chatId, {
                    text:
                        resultText + '\n' +
                        `📋 Long-press the JID to copy\n` +
                        `🚪 Leave: *${PREFIX}mygroupleave*`
                }, { quoted: msg });
            }
        }

        // ── Main list ─────────────────────────────────────────────────────────
        let groups;
        try {
            groups = await sock.groupFetchAllParticipating();
        } catch (err) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ ❌ *MY GROUPS* ⌋\n│\n├─⊷ Failed to fetch groups.\n├─⊷ ${err.message}\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const entries = Object.values(groups || {});

        if (!entries.length) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 👥 *MY GROUPS* ⌋\n│\n├─⊷ ℹ️ Not in any groups yet.\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        // Resolve best available name: groupFetchAllParticipating → metaCache → direct fetch
        const metaCache = globalThis.groupMetadataCache;

        const resolved = await Promise.all(entries.map(async (g) => {
            let name = (g.subject || '').trim();

            if (!name && metaCache) {
                const cached = metaCache.get(g.id);
                if (cached?.data?.subject) name = cached.data.subject.trim();
            }

            if (!name) {
                try {
                    const meta = await sock.groupMetadata(g.id);
                    if (meta?.subject) name = meta.subject.trim();
                } catch {}
            }

            return { id: g.id, name: name || 'Unnamed Group' };
        }));

        resolved.sort((a, b) => a.name.localeCompare(b.name));

        // Paginate at 20 per page
        const PAGE_SIZE = 20;
        const page       = Math.max(1, parseInt(input) || 1);
        const totalPages = Math.ceil(resolved.length / PAGE_SIZE);
        const pageIndex  = Math.min(page, totalPages) - 1;
        const slice      = resolved.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

        let text = `╭─⌈ 👥 *MY GROUPS* ⌋\n│\n`;
        text += `│  📊 Total: *${resolved.length}* group${resolved.length !== 1 ? 's' : ''}\n`;
        if (totalPages > 1) text += `│  📄 Page: *${pageIndex + 1}/${totalPages}*\n`;
        text += `│\n`;

        slice.forEach((g, i) => {
            text += `├─⊷ *${pageIndex * PAGE_SIZE + i + 1}.* ${g.name}\n`;
        });

        text += `│\n`;
        if (totalPages > 1) {
            text += `├─⊷ Next page: *${PREFIX}mygroups ${pageIndex + 2 <= totalPages ? pageIndex + 2 : 1}*\n`;
            text += `│\n`;
        }
        text += `╰─ Reply with a number to select a group`;

        // Send and store the message ID so reply-with-number works
        const sent = await sock.sendMessage(chatId, { text }, { quoted: msg });
        const sentId = sent?.key?.id;
        if (sentId) {
            groupListCache.set(sentId, resolved);
            // Trim cache to avoid memory growth
            if (groupListCache.size > MAX_CACHE) {
                groupListCache.delete(groupListCache.keys().next().value);
            }
        }
    }
};
