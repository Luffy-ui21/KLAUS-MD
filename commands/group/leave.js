export default {
    name: 'leave',
    alias: ['exit', 'bye', 'out'],
    description: 'Leave the current group (owner only)',
    category: 'group',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, {
                text: '❌ This command only works in groups.'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, {
                text: '👋 Goodbye everyone!'
            }, { quoted: msg });

            await new Promise(resolve => setTimeout(resolve, 1500));

            await sock.groupLeave(chatId);
        } catch (error) {
            console.error('leave error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to leave: ${error.message}`
            }, { quoted: msg });
        }
    }
};
