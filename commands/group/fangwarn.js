import { getWarnings, addWarning, getWarnLimit, resetWarnings } from '../../lib/warnings-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'warn',
    description: 'Warn a user in the group (reply or mention). Auto-kicks at warn limit.',
    category: 'group',
    aliases: ['fangwarn', 'warning'],

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;

        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups!'
            }, { quoted: msg });
        }

        try {
            const groupMeta = await sock.groupMetadata(jid);
            const senderPart = groupMeta.participants.find(p => p.id === sender);
            const isAdmin = senderPart && (senderPart.admin === 'admin' || senderPart.admin === 'superadmin');
            const isOwner = extra?.jidManager?.isOwner(msg);

            if (!isAdmin && !isOwner) {
                return sock.sendMessage(jid, {
                    text: '❌ Only group admins can warn users!'
                }, { quoted: msg });
            }
        } catch (err) {
            return sock.sendMessage(jid, {
                text: '❌ Failed to verify admin status.'
            }, { quoted: msg });
        }

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyUser = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const targetUser = mentions[0] || replyUser;

        if (!targetUser) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ ⚠️ *WARN* ⌋\n│\n├─⊷ *${PREFIX}warn* (reply)\n│  └⊷ Warn via reply\n├─⊷ *${PREFIX}warn @user*\n│  └⊷ Warn via mention\n├─⊷ *${PREFIX}warn @user spamming*\n│  └⊷ Warn with reason\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        if (targetUser === sock.user?.id?.split(':')[0] + '@s.whatsapp.net') {
            return sock.sendMessage(jid, {
                text: '❌ Cannot warn the bot!'
            }, { quoted: msg });
        }

        const reason = args.filter(a => !a.startsWith('@')).join(' ').trim() || 'No reason given';
        const warnLimit = getWarnLimit(jid);
        const updated = addWarning(jid, targetUser);
        const userNum = targetUser.split('@')[0];

        let response = '';

        if (updated >= warnLimit) {
            try {
                await sock.groupParticipantsUpdate(jid, [targetUser], 'remove');
                resetWarnings(jid, targetUser);
                response = `❌ *@${userNum} KICKED!*\n\n` +
                    `⚠️ Warnings: ${updated}/${warnLimit} (LIMIT REACHED)\n` +
                    `📝 Last reason: ${reason}\n\n` +
                    `User has been removed from the group.`;
            } catch (err) {
                response = `⚠️ @${userNum} warned (${updated}/${warnLimit}) - LIMIT REACHED\n` +
                    `❌ Failed to kick: Bot may not be admin\n` +
                    `📝 Reason: ${reason}`;
            }
        } else {
            response = `⚠️ *@${userNum} WARNED!*\n\n` +
                `📊 Warnings: ${updated}/${warnLimit}\n` +
                `📝 Reason: ${reason}\n\n` +
                `💡 ${warnLimit - updated} warning(s) left before kick.`;
        }

        await sock.sendMessage(jid, {
            text: response,
            mentions: [targetUser]
        }, { quoted: msg });
    }
};
