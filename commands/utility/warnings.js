import { getGroupWarnings, getWarnLimit, getWarnings } from '../../lib/warnings-store.js';

export default {
    name: 'warnings',
    description: 'View warnings for a user or list all warned users',
    category: 'group',
    aliases: ['warnlist', 'checkwarn', 'warninfo'],

    async execute(sock, msg, args, PREFIX, extra) {
        const jid = msg.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return sock.sendMessage(jid, {
                text: '❌ This command only works in groups.'
            }, { quoted: msg });
        }

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyUser = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const targetUser = mentions[0] || replyUser;

        const warnLimit = getWarnLimit(jid);

        if (targetUser) {
            const userWarnings = getWarnings(jid, targetUser);
            const userNum = targetUser.split('@')[0];

            let statusBar = '';
            for (let i = 0; i < warnLimit; i++) {
                statusBar += i < userWarnings ? '🟥' : '⬜';
            }

            return sock.sendMessage(jid, {
                text: `📊 *Warning Status for @${userNum}*\n\n` +
                    `${statusBar}\n` +
                    `⚠️ Warnings: ${userWarnings}/${warnLimit}\n` +
                    `${userWarnings >= warnLimit ? '🔴 LIMIT REACHED - Next warn = KICK' : `💡 ${warnLimit - userWarnings} warning(s) remaining`}`,
                mentions: [targetUser]
            }, { quoted: msg });
        }

        const groupWarnings = getGroupWarnings(jid);

        let response = `📊 *Group Warnings*\n`;
        response += `📝 Limit: ${warnLimit} warnings\n\n`;

        if (groupWarnings.length === 0) {
            response += 'No users have warnings.';
        } else {
            groupWarnings.sort((a, b) => b.count - a.count);

            for (const { userJid, count } of groupWarnings) {
                const userNum = userJid.split('@')[0];
                const bar = count >= warnLimit ? '🔴' : count >= warnLimit - 1 ? '🟡' : '🟢';
                response += `${bar} @${userNum}: ${count}/${warnLimit}\n`;
            }

            response += `\n👥 Total warned: ${groupWarnings.length} user(s)`;
        }

        const mentionedUsers = groupWarnings.map(w => w.userJid);

        await sock.sendMessage(jid, {
            text: response,
            mentions: mentionedUsers
        }, { quoted: msg });
    }
};
