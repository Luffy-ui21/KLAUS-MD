import { getFooter } from '../../lib/menuHelper.js';

const pendingDeletes = new Map();

export default {
    name: 'deletegroup',
    aliases: ['disbandgroup', 'destroygroup', 'nukgroup'],
    description: 'Delete (disband) a group — removes all members then leaves. Owner only.',
    category: 'group',
    ownerOnly: true,

    async execute(sock, m, args, PREFIX, extra) {
        const jid     = m.key.remoteJid;
        const sender  = m.key.participant || m.key.remoteJid;
        const reply   = (text) => sock.sendMessage(jid, { text }, { quoted: m });
        const react   = (e)    => sock.sendMessage(jid, { react: { text: e, key: m.key } }).catch(() => {});

        if (!jid.endsWith('@g.us')) {
            return reply('❌ This command can only be used inside a group.');
        }

        const confirm = (args[0] || '').toLowerCase() === 'confirm';

        if (!confirm) {
            // Set a 30-second confirmation window
            pendingDeletes.set(jid, { sender, expires: Date.now() + 30_000 });

            return reply(
                `╭─⌈ ⚠️ *DELETE GROUP* ⌋\n│\n` +
                `│ This will kick ALL members and disband the group.\n│ This action *cannot be undone.*\n│\n` +
                `├─⊷ To confirm, send:\n│  └⊷ \`${PREFIX}deletegroup confirm\`\n│\n` +
                `│ ⏳ Confirmation expires in *30 seconds*.\n│\n` +
                `╰⊷ ${getFooter(sender)}`
            );
        }

        // Check confirmation
        const pending = pendingDeletes.get(jid);
        if (!pending) {
            return reply(`❌ No pending delete request.\nRun \`${PREFIX}deletegroup\` first to initiate.`);
        }
        if (Date.now() > pending.expires) {
            pendingDeletes.delete(jid);
            return reply(`⏰ Confirmation expired. Run \`${PREFIX}deletegroup\` again to restart.`);
        }
        pendingDeletes.delete(jid);

        try {
            const groupMetadata = extra?.groupMetadata || await sock.groupMetadata(jid);
            const botJid = sock.user?.id?.replace(/:.*@/, '@') || '';

            // Find all participants except the bot itself
            const others = groupMetadata.participants
                .map(p => p.id)
                .filter(id => {
                    const clean = id.split(':')[0].split('@')[0];
                    const botClean = botJid.split('@')[0];
                    return clean !== botClean;
                });

            await react('⏳');

            await reply(
                `╭─⌈ 💣 *DELETING GROUP* ⌋\n│\n` +
                `│ Removing *${others.length}* member(s)...\n│\n` +
                `╰⊷ ${getFooter(sender)}`
            );

            // Remove all members in batches of 5
            for (let i = 0; i < others.length; i += 5) {
                const batch = others.slice(i, i + 5);
                try {
                    await sock.groupParticipantsUpdate(jid, batch, 'remove');
                } catch {}
                if (i + 5 < others.length) {
                    await new Promise(r => setTimeout(r, 800));
                }
            }

            await new Promise(r => setTimeout(r, 1000));

            await sock.sendMessage(jid, {
                text: `🗑️ Group disbanded. Goodbye everyone! 👋`
            });

            await new Promise(r => setTimeout(r, 1500));

            await sock.groupLeave(jid);

        } catch (err) {
            await react('❌');
            return reply(`❌ Failed to delete group.\n_${err.message || 'Unknown error'}_`);
        }
    }
};
