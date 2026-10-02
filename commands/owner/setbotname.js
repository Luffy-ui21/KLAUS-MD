import { getBotName, saveBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'setbotname',
    alias: ['botname','sbn','bn', 'changebotname', 'cbn','setname'],
    category: 'owner',
    description: 'Change the bot display name',
    ownerOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;
        
        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*\n\nOnly the bot owner can change the bot name.`
            }, { quoted: msg });
        }
        
        if (!args[0]) {
            const currentName = getBotName();
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🤖 *SET BOT NAME* ⌋\n│\n│ 📝 Current: *${currentName}*\n├─⊷ *${PREFIX}setbotname <new_name>*\n│  └⊷ Change bot name\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }
        
        const newBotName = args.join(' ').trim();
        
        if (newBotName.length < 2) {
            return sock.sendMessage(chatId, {
                text: `❌ Name too short! Bot name must be at least 2 characters.`
            }, { quoted: msg });
        }
        
        if (newBotName.length > 50) {
            return sock.sendMessage(chatId, {
                text: `❌ Name too long! Bot name must be less than 50 characters.`
            }, { quoted: msg });
        }
        
        try {
            const senderJid = msg.key.participant || chatId;
            const cleaned = jidManager.cleanJid(senderJid);

            const previousName = getBotName();

            // 1. Write to bot_name.json + .env + in-memory cache + global.BOT_NAME
            saveBotName(newBotName);

            // 2. Also update the module-level BOT_NAME variable inside index.js so
            //    the banner and any direct usages reflect the change immediately.
            if (typeof globalThis._updateBotName === 'function') {
                globalThis._updateBotName(newBotName);
            }

            // 3. Keep process.env in sync for any code that reads it directly.
            process.env.BOT_NAME = newBotName;

            // 4. Persist to DB (awaited so the name is safe even if the bot restarts
            //    within the next few seconds).
            if (typeof globalThis._saveConfigCache === 'function') {
                globalThis._saveConfigCache('bot_name', { name: newBotName, setAt: new Date().toISOString() });
            }
            
            await sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🤖 *BOTNAME* ⌋\n` +
                    `├─⊷ Previous : *${previousName}*\n` +
                    `├─⊷ New name : *${newBotName}*\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
            
            console.log(`✅ Bot name changed: "${previousName}" → "${newBotName}" by ${cleaned.cleanNumber}`);
            
        } catch (error) {
            console.error('Error saving bot name:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error saving bot name: ${error.message}\n\nPlease check file permissions.`
            }, { quoted: msg });
        }
    }
};
