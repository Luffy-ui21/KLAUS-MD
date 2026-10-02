import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
// File: ./commands/owner/setprefix.js
export default {
    name: 'setprefix',
    alias: ['setpre', 'changeprefix'],
    category: 'owner',
    description: 'Change bot prefix or enable prefixless mode (saved & persistent)',
    ownerOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager, updatePrefix, getCurrentPrefix, isPrefixless } = extra;
        
        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command*'
            }, { quoted: msg });
        }
        
        if (!args[0]) {
            const currentPrefix = getCurrentPrefix();
            const prefixlessStatus = isPrefixless ? '✅ ENABLED' : '❌ DISABLED';
            
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🔧 *SET PREFIX* ⌋\n│\n│ 📌 Current: "${isPrefixless ? 'none (prefixless)' : currentPrefix}"\n│ Prefixless: ${prefixlessStatus}\n├─⊷ *${PREFIX}setprefix <new_prefix>*\n│  └⊷ Change prefix\n├─⊷ *${PREFIX}setprefix none*\n│  └⊷ Enable prefixless mode\n├─⊷ *${PREFIX}setprefix "."*\n│  └⊷ Set prefix to dot\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }
        
        const newPrefix = args[0].trim();
        const isNone = newPrefix.toLowerCase() === 'none' || newPrefix === '""' || newPrefix === "''" || newPrefix === '';
        
        if (!isNone && newPrefix.length > 5) {
            return sock.sendMessage(chatId, {
                text: '❌ Prefix too long! Maximum 5 characters.'
            }, { quoted: msg });
        }
        
        try {
            const oldPrefix = getCurrentPrefix();
            const oldIsPrefixless = isPrefixless;
            
            // Update prefix immediately in memory AND save to files
            const updateResult = updatePrefix(newPrefix);
            
            if (!updateResult.success) {
                throw new Error('Failed to update prefix');
            }
            
            const oldLabel = oldIsPrefixless ? 'none' : `"${oldPrefix}"`;
            const newLabel = isNone ? 'none (prefixless)' : `"${newPrefix}"`;
            const tryCmd = isNone ? '`ping`' : `\`${newPrefix}ping\``;

            await sock.sendMessage(chatId, {
                text: `✅ *PREFIX UPDATED*\n\n` +
                      `Old Prefix: ${oldLabel}\n` +
                      `New Prefix: ${newLabel}\n\n` +
                      `Try ${tryCmd}`
            }, { quoted: msg });
            
        } catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
};