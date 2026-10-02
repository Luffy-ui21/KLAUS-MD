import { resetWarnings, getWarnings, getWarnLimit, resetAllGroupWarnings } from '../../lib/warnings-store.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
    name: 'resetwarn',
    description: 'Reset warnings for a user or all users (admin only)',
    category: 'group',
    aliases: ['clearwarn', 'unwarn', 'delwarn'],

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;

        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.'
            }, { quoted: msg });
        }

        try {
            const groupMeta = await sock.groupMetadata(jid);
            const senderPart = groupMeta.participants.find(p => p.id === sender);
            const isAdmin = senderPart && (senderPart.admin === 'admin' || senderPart.admin === 'superadmin');
            const isOwner = extra?.jidManager?.isOwner(msg);

            if (!isAdmin && !isOwner) {
                return sock.sendMessage(jid, {
                    text: '🛑 Only admins can reset warnings.'
                }, { quoted: msg });
            }
        } catch {
            return sock.sendMessage(jid, {
                text: '❌ Failed to verify permissions.'
            }, { quoted: msg });
        }

        if (args[0]?.toLowerCase() === 'all') {
            const count = resetAllGroupWarnings(jid);
            return sock.sendMessage(jid, {
                text: count > 0
                    ? `✅ Reset warnings for *${count}* user(s) in this group.`
                    : `ℹ️ No warnings to reset in this group.`
            }, { quoted: msg });
        }

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyUser = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const targetUser = mentions[0] || replyUser;

        if (!targetUser) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ ⚠️ *RESET WARNINGS* ⌋\n│\n├─⊷ *${PREFIX}resetwarn*\n│  └⊷ Reply to user to reset their warnings\n│\n├─⊷ *${PREFIX}resetwarn @user*\n│  └⊷ Mention user to reset warnings\n│\n├─⊷ *${PREFIX}resetwarn all*\n│  └⊷ Reset all warnings in group\n│\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const currentWarns = getWarnings(jid, targetUser);
        const hadWarnings = resetWarnings(jid, targetUser);
        const userNum = targetUser.split('@')[0];

        if (hadWarnings) {
            await sock.sendMessage(jid, {
                text: `✅ @${userNum}'s warnings have been reset.\n📊 Previous: ${currentWarns}/${getWarnLimit(jid)}`,
                mentions: [targetUser]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, {
                text: `ℹ️ @${userNum} has no warnings to reset.`,
                mentions: [targetUser]
            }, { quoted: msg });
        }
    }
};
