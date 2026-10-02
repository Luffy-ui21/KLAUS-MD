// File: ./commands/owner/resetowner.js
import { writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'resetowner',
    alias: ['defaultowner', 'clearowner', 'restoreowner'],
    category: 'owner',
    description: 'Reset owner display name to original',
    ownerOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;
        
        // Owner check
        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*`
            }, { quoted: msg });
        }
        
        try {
            // Get current user info
            const senderJid = msg.key.participant || chatId;
            const cleaned = jidManager.cleanJid(senderJid);
            
            // Get original owner
            const originalOwner = this.getOriginalOwner();
            const currentDisplay = this.getCurrentOwnerName();
            
            // If already showing original, no need to reset
            if (currentDisplay === originalOwner) {
                return sock.sendMessage(chatId, {
                    text: `ℹ️ *Already Using Original*\n\nCurrent display name is already the original owner: *${originalOwner}*`
                }, { quoted: msg });
            }
            
            // Load existing settings
            const settingsPath = path.join(__dirname, 'bot_settings.json');
            let settings = {};
            
            if (existsSync(settingsPath)) {
                try {
                    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                } catch (error) {
                    console.error('Error reading settings:', error);
                }
            }
            
            // Remove custom owner name
            delete settings.ownerName;
            delete settings.ownerSetBy;
            delete settings.ownerSetAt;
            
            // Save settings
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            
            // Also save to root directory
            const rootSettingsPath = './bot_settings.json';
            writeFileSync(rootSettingsPath, JSON.stringify(settings, null, 2));
            
            // Clear global variable
            if (typeof global !== 'undefined') {
                delete global.OWNER_NAME;
            }
            
            let successMsg = `✅ *Owner Display Name Reset!*\n\n`;
            successMsg += `📝 Previous Display: *${currentDisplay}*\n`;
            successMsg += `🔄 Reset to Original: *${originalOwner}*\n\n`;
            successMsg += `✅ Custom display name removed.\n\n`;
            successMsg += `💡 Menu will now show the original owner from owner.json.`;
            
            await sock.sendMessage(chatId, {
                text: successMsg
            }, { quoted: msg });
            
            console.log(`✅ Owner display name reset from "${currentDisplay}" to "${originalOwner}" by ${cleaned.cleanNumber}`);
            
        } catch (error) {
            console.error('Error resetting owner name:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error resetting owner name: ${error.message}`
            }, { quoted: msg });
        }
    },
    
    // Helper functions (same as setowner.js)
    getCurrentOwnerName() {
        try {
            const settingsPaths = [
                path.join(__dirname, 'bot_settings.json'),
                './bot_settings.json',
            ];
            
            for (const settingsPath of settingsPaths) {
                if (existsSync(settingsPath)) {
                    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
                    if (settings.ownerName && settings.ownerName.trim() !== '') {
                        return settings.ownerName.trim();
                    }
                }
            }
            
            return this.getOriginalOwner();
            
        } catch (error) {
            return this.getOriginalOwner();
        }
    },
    
    getOriginalOwner() {
        try {
            const ownerPath = path.join(__dirname, 'owner.json');
            if (existsSync(ownerPath)) {
                const ownerData = JSON.parse(readFileSync(ownerPath, 'utf8'));
                
                if (ownerData.owner && ownerData.owner.trim() !== '') {
                    return ownerData.owner.trim();
                } else if (ownerData.number && ownerData.number.trim() !== '') {
                    return ownerData.number.trim();
                }
            }
            
            return global.owner || "Unknown";
            
        } catch (error) {
            return global.owner || "Unknown";
        }
    }
};