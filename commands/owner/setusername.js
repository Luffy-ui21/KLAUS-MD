import { getOwnerName } from '../../lib/menuHelper.js';
import supabase from '../../lib/database.js';

export default {
    name: 'setusername',
    alias: ['setname', 'username', 'changename'],
    category: 'owner',
    description: 'Change your WhatsApp profile name',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command*'
            }, { quoted: msg });
        }

        if (!args.length) {
            return sock.sendMessage(chatId, {
                text: `📝 *Usage:* ${PREFIX}setusername <name>\n📌 *Example:* ${PREFIX}setusername John Doe`
            }, { quoted: msg });
        }

        const newName = args.join(' ').trim();

        if (newName.length < 1 || newName.length > 50) {
            return sock.sendMessage(chatId, {
                text: '❌ *Name must be between 1-50 characters*'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            // Direct WhatsApp Web mutation - bypasses app state
            await sock.query({
                tag: 'iq',
                attrs: {
                    to: 's.whatsapp.net',
                    type: 'set',
                    xmlns: 'w:profile',
                },
                content: [
                    {
                        tag: 'name',
                        attrs: {},
                        content: newName,
                    },
                ],
            });

            // Save for persistence
            await supabase.setConfig('username_pref', { name: newName }).catch(() => {});

            await sock.sendMessage(chatId, {
                text: `✅ *Name Successfully Changed to* ${newName}`
            }, { quoted: msg });
            
            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[SetUsername] Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Failed:* ${error.message}`
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        }
    }
};