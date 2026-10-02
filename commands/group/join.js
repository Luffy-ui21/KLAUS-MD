import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
export default {
    name: 'join',
    alias: ['joingroup'],
    description: 'Join a group by replying to a group invite link (owner only)',
    category: 'group',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        let linkText = '';

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
            linkText = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || '';
        }

        if (!linkText && args.length > 0) {
            linkText = args.join(' ');
        }

        if (!linkText) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔗 *JOIN GROUP* ⌋\n│\n├─⊷ Reply to a WhatsApp group\n│  └⊷ invite link with *.join*\n├─⊷ Or: *.join [link]*\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const linkMatch = linkText.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/);
        if (!linkMatch) {
            return sock.sendMessage(chatId, {
                text: '❌ No valid WhatsApp group link found.\n\nMake sure the message contains a link like:\nhttps://chat.whatsapp.com/XXXXX'
            }, { quoted: msg });
        }

        const inviteCode = linkMatch[1];

        try {
            await sock.sendMessage(chatId, {
                react: { text: '⏳', key: msg.key }
            });

            const groupId = await sock.groupAcceptInvite(inviteCode);

            await sock.sendMessage(chatId, {
                text: `✅ Successfully joined the group!`
            }, { quoted: msg });

            await sock.sendMessage(chatId, {
                react: { text: '✅', key: msg.key }
            });
        } catch (error) {
            const errMsg = (error.message || '').toLowerCase();
            let userMsg = '❌ Failed to join the group.';

            if (errMsg.includes('already') || errMsg.includes('participant') || errMsg.includes('conflict')) {
                userMsg = 'ℹ️ Already a member of that group.';
            } else if (errMsg.includes('invalid') || errMsg.includes('expired') || errMsg.includes('not-authorized')) {
                userMsg = '❌ The invite link is invalid or has expired.';
            } else if (errMsg.includes('full')) {
                userMsg = '❌ The group is full.';
            }

            await sock.sendMessage(chatId, {
                text: userMsg
            }, { quoted: msg });
        }
    }
};
