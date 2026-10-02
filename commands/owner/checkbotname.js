// File: ./commands/utility/checkbotname.js
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBotName } from '../../lib/botname.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'checkbotname',
    alias: ['botnamedebug', 'namecheck'],
    description: 'Debug bot name loading',
    
    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        
        let debugText = `🔍 *BOT NAME DEBUG INFO*\n\n`;
        
        // Check global variables
        debugText += `📊 *Global Variables:*\n`;
        debugText += `├─ global.BOT_NAME: ${global.BOT_NAME || '❌ Not set'}\n`;
        debugText += `└─ process.env.BOT_NAME: ${process.env.BOT_NAME || '❌ Not set'}\n\n`;
        
        // Check bot_settings.json files
        debugText += `📁 *File Checks:*\n`;
        
        const possiblePaths = [
            { name: 'Root', path: './bot_settings.json' },
            { name: 'Commands dir', path: path.join(__dirname, '../bot_settings.json') },
            { name: 'Owner commands', path: path.join(__dirname, '../owner/bot_settings.json') },
            { name: 'Current dir', path: path.join(__dirname, 'bot_settings.json') },
            { name: 'Menu dir', path: path.join(__dirname, '../../bot_settings.json') },
        ];
        
        for (const pathInfo of possiblePaths) {
            if (existsSync(pathInfo.path)) {
                try {
                    const settingsData = JSON.parse(readFileSync(pathInfo.path, 'utf8'));
                    debugText += `✅ ${pathInfo.name}: ${pathInfo.path}\n`;
                    debugText += `   └─ Bot Name: ${settingsData.botName || '❌ Not found'}\n`;
                    debugText += `   └─ Updated: ${settingsData.updatedAt || 'Unknown'}\n`;
                } catch (error) {
                    debugText += `❌ ${pathInfo.name}: ${pathInfo.path} (Parse error)\n`;
                }
            } else {
                debugText += `❌ ${pathInfo.name}: ${pathInfo.path} (Not found)\n`;
            }
        }
        
        // What menu will show
        const menuBotName = this.getBotNameForMenu();
        debugText += `\n📱 *Menu will show:* "${menuBotName}"`;
        
        await sock.sendMessage(chatId, { text: debugText }, { quoted: msg });
    },
    
    getBotNameForMenu() {
        try {
            const possiblePaths = [
                './bot_settings.json',
                path.join(__dirname, '../../bot_settings.json'),
                path.join(__dirname, '../owner/bot_settings.json'),
            ];
            
            for (const settingsPath of possiblePaths) {
                if (existsSync(settingsPath)) {
                    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                    if (settings.botName && settings.botName.trim() !== '') {
                        return settings.botName.trim();
                    }
                }
            }
            
            return global.BOT_NAME || getBotName();
            
        } catch (error) {
            return 'Error loading';
        }
    }
};