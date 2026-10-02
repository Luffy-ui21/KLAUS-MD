import { getBotName, saveBotName, clearBotNameCache } from '../../lib/botname.js';

const DEFAULT_NAME = 'WOLFBOT';

export default {
    name: 'resetbotname',
    alias: ['defaultname','dn','rbn', 'clearbotname', 'resettobotname', 'restorebotname', 'resetname', 'defaultbotname', 'clearname', 'removebotname', 'deletename', 'resetbot', 'botreset', 'name-reset', 'botname-reset'],
    category: 'owner',
    description: 'Reset bot name to default (WOLFBOT)',
    ownerOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;
        
        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*\n\nOnly the bot owner can reset the bot name.`
            }, { quoted: msg });
        }
        
        try {
            const senderJid = msg.key.participant || chatId;
            const cleaned = jidManager.cleanJid(senderJid);
            const oldName = getBotName();
            
            saveBotName(DEFAULT_NAME);
            clearBotNameCache();
            process.env.BOT_NAME = DEFAULT_NAME;
            
            let successMsg = `✅ *Bot Name Reset Successfully!*\n`;
            successMsg += `📝 Previous Name: *${oldName}*\n`;
            successMsg += `🔄 New Name: *${DEFAULT_NAME}*\n`;
            
            await sock.sendMessage(chatId, {
                text: successMsg
            }, { quoted: msg });
            
            console.log(`✅ Bot name reset from "${oldName}" to "${DEFAULT_NAME}" by ${cleaned.cleanNumber}`);
            
        } catch (error) {
            console.error('Error resetting bot name:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error resetting bot name: ${error.message}`
            }, { quoted: msg });
        }
    }
};
