import { createRequire } from 'module';
import { listUsers, isConfigured } from '../../lib/cpanel.js';
import { getBotName } from '../../lib/botname.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

export default {
    name: 'listadminusers',
    alias: ['paneladmins', 'getadmins', 'adminusers'],
    category: 'cpanel',
    desc: 'List all panel admin users',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;

        if (!extra?.jidManager?.isOwner(msg)) {
            return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
        }

        if (!isConfigured()) {
            return sock.sendMessage(jid, {
                text: `❌ Not configured. Run ${PREFIX}setkey and ${PREFIX}setlink first.`
            }, { quoted: msg });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        try {
            const allUsers = await listUsers();
            const admins = allUsers
                .filter(u => u.attributes.root_admin)
                .sort((a, b) => a.attributes.id - b.attributes.id);

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

            if (!admins.length) {
                return sock.sendMessage(jid, {
                    text: '📭 No admin users found on the panel.'
                }, { quoted: msg });
            }

            const mainAdminId = admins[0].attributes.id;

            const lines = admins.map((u, i) => {
                const a = u.attributes;
                const tag = a.id === mainAdminId ? ' 👑 *Main*' : '';
                return `${i + 1}. *${a.username}* (ID: ${a.id})${tag}\n   📧 ${a.email}`;
            });

            const BOT = getBotName();
            const text =
                `╭─⌈ 👑 *PANEL ADMINS (${admins.length})* ⌋\n` +
                `│\n` +
                `${lines.map(l => `├─⊷ ${l}`).join('\n│\n')}\n` +
                `│\n` +
                `╰⊷ *Powered by ${BOT}*`;

            if (giftedBtns?.sendInteractiveMessage) {
                try {
                    await giftedBtns.sendInteractiveMessage(sock, jid, {
                        text,
                        footer: ` ${BOT}`,
                        interactiveButtons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '⬇️ DemoteAdminUsers',
                                    id: `${PREFIX}demoteadminusers`
                                })
                            }
                        ]
                    });
                    return;
                } catch {}
            }

            await sock.sendMessage(jid, {
                text: `${text}\n\n⬇️ *Demote all* → ${PREFIX}demoteadminusers`
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { text: `❌ ${err.message}` }, { quoted: msg });
        }
    }
};
