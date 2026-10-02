import { getButtonCommandList } from '../../lib/commandButtons.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

// Try to import menu media, but don't fail if it doesn't exist
let getMenuMedia;
try {
    const menuMedia = await import('../../lib/menuMedia.js');
    getMenuMedia = menuMedia.getMenuMedia;
    globalThis._wolfSysStats = globalThis._wolfSysStats || {};
    globalThis._wolfSysStats.menuMedia = true;
} catch (error) {
    globalThis._wolfSysStats = globalThis._wolfSysStats || {};
    globalThis._wolfSysStats.menuMedia = false;
    getMenuMedia = () => null;
}

export default {
    name: 'buttonmenu',
    alias: ['menubutton', 'btnmenu', 'menubtn', 'buttonlist', 'btnlist'],
    category: 'Menu',
    desc: 'List all commands with interactive button support',
    usage: '.buttonmenu [category]',

    async execute(sock, m, args, PREFIX) {
        try {
            const chatId = m.key.remoteJid;
            const prefix = PREFIX || '.';
            
            // Check if command lists are available
            let allCmds = [];
            try {
                allCmds = getButtonCommandList() || [];
            } catch (error) {
                console.error('Error getting button command list:', error);
            }
            
            const buttonStatus = isButtonModeEnabled ? (isButtonModeEnabled() ? '🟢 ACTIVE' : '🔴 INACTIVE') : '⚪ UNKNOWN';
            const botName = getBotName ? getBotName() : 'WOLFBOT';
            await sock.sendMessage(chatId, { text: `buttonmenu loading...` }, { quoted: m });
            await new Promise(resolve => setTimeout(resolve, 800));

            const categoryMap = {
                'ai': ['chatgpt', 'gpt', 'gemini', 'gemma', 'bard', 'claude', 'claudeai', 'copilot', 'bing', 'blackbox', 'cohere', 'llama', 'mistral', 'perplexity', 'venice', 'wormgpt', 'kimi', 'glm', 'deepseekv4', 'analyze', 'flux', 'imagine', 'vision', 'art', 'real', 'imagegen', 'remini', 'logo', 'brandlogo', 'companylogo', 'textlogo', 'wolf'],
                'group': ['kick', 'remove', 'promote', 'demote', 'mute', 'unmute', 'ban', 'unban', 'warn', 'antilink', 'antispam', 'antibug', 'welcome', 'goodbye', 'setdesc', 'setname', 'invite', 'revoke', 'tagall', 'tagadmin', 'groupinfo', 'creategroup', 'approveall'],
                'utility': ['ping', 'translate', 'weather', 'screenshot', 'shorturl', 'qrencode', 'define', 'wiki', 'news', 'covid', 'time', 'alive', 'uptime', 'prefix', 'fetch', 'npm', 'take', 'quoted', 'save', 'vcf'],
                'media': ['8d', 'bassboost', 'bass', 'boost', 'deepbass', 'superboost', 'treble', 'trebleboost', 'vocalboost', 'nightcore', 'reverb', 'echo', 'slow', 'fast', 'speed', 'reverse', 'baby', 'demon', 'robot', 'jarvis', 'monster', 'radio', 'telephone', 'underwater', 'karaoke', 'tts', 'toaudio', 'tovideo', 'togif', 'toimage', 'tosticker', 'tovoice'],
                'fun': ['rps', 'coinflip', 'roll', 'dice', 'quiz', 'trivia', 'ttt', 'slot', 'truth', 'dare', 'ship', 'rate', 'insult', 'advice', 'gaymeter', 'roast', 'joke', 'meme', 'fact', 'quote', 'waifu', 'neko', 'hug', 'kiss', 'pat', 'slap', 'bonk', 'wink', 'wave', 'bite', 'bully', 'yeet', 'cuddle', 'poke', 'awoo', 'trap'],
                'owner': ['mode', 'block', 'unblock', 'setprefix', 'setbotname', 'restart', 'shutdown', 'clearcache', 'anticall', 'antidelete', 'antiedit', 'autorec', 'autoread', 'autotyping', 'autorecording', 'autoreact', 'autoviewstatus', 'autobio', 'blockdetect', 'silent', 'online', 'repo', 'owner', 'disk', 'start', 'setpp', 'pair'],
                'sports': ['football', 'basketball', 'cricket', 'tennis', 'f1', 'baseball', 'hockey', 'mma', 'nfl', 'golf'],
            };

            if (args && args[0]) {
                const cat = args[0].toLowerCase();
                const catNames = Object.keys(categoryMap);

                if (!categoryMap[cat]) {
                    await sock.sendMessage(chatId, {
                        text: `╭─⌈ ❌ *UNKNOWN CATEGORY* ⌋\n│\n├─⊷ Available: ${catNames.join(', ')}\n├─⊷ Usage: *${prefix}buttonmenu ${catNames[0]}*\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                    }, { quoted: m });
                    return;
                }

                const catCmds = allCmds.filter(c => categoryMap[cat].includes(c.name));
                let text = `╭─⌈ 🔘 *BUTTON COMMANDS: ${cat.toUpperCase()}* ⌋\n│\n`;
                catCmds.forEach(cmd => {
                    text += `├─⊷ *${prefix}${cmd.name}*`;
                    if (cmd.aliases && cmd.aliases.length > 0) text += ` (${cmd.aliases.join(', ')})`;
                    text += `\n│  └⊷ ${cmd.btnLabels || 'No description'}\n`;
                });
                text += `│\n├─⊷ *${catCmds.length}* commands in ${cat}\n├─⊷ Button Mode: ${buttonStatus}\n╰───`;

                await sock.sendMessage(chatId, { text }, { quoted: m });
                return;
            }

            let totalMain = allCmds.length;
            let totalAliases = 0;
            allCmds.forEach(c => totalAliases += (c.aliases ? c.aliases.length : 0));

            // ========== BUILD MENU TEXT ==========
            let text = `┌──⌈ 🔘 *${botName} BUTTON MENU* ⌋ 〘SW〙\n\n`;
            text += `┌────────────────\n`;
            text += `│ Button Mode: ${buttonStatus}\n`;
            text += `│ Total Commands: *${totalMain}* (+${totalAliases} aliases)\n`;
            text += `└────────────────\n\n`;

            for (const [catName, catCmdNames] of Object.entries(categoryMap)) {
                const catCmds = allCmds.filter(c => catCmdNames.includes(c.name));
                if (catCmds.length === 0) continue;
                
                const icon = catName === 'downloaders' ? '⬇️' : 
                            catName === 'ai' ? '🤖' : 
                            catName === 'group' ? '🏠' : 
                            catName === 'utility' ? '🔧' : 
                            catName === 'media' ? '🎵' : 
                            catName === 'fun' ? '🎮' : 
                            catName === 'owner' ? '👑' : 
                            catName === 'sports' ? '🏆' : '🕵️';
                
                text += `┌──⌈ ${icon} *${catName.toUpperCase()}* (${catCmds.length}) ⌋\n`;
                catCmds.forEach(cmd => {
                    text += `│ • ${prefix}${cmd.name}`;
                    if (cmd.aliases && cmd.aliases.length > 0) text += ` [${cmd.aliases.join(',')}]`;
                    text += `\n`;
                });
                text += `└───────────────\n\n`;
            }

            const categorizedNames = new Set(Object.values(categoryMap).flat());
            const uncategorized = allCmds.filter(c => !categorizedNames.has(c.name));
            if (uncategorized.length > 0) {
                text += `┌──⌈ 📦 *OTHER* (${uncategorized.length}) ⌋\n`;
                uncategorized.forEach(cmd => {
                    text += `│ • ${prefix}${cmd.name}\n`;
                });
                text += `└───────────────\n\n`;
            }

            text += `┌────────────────\n`;
            text += `│ Use *${prefix}buttonmenu <category>*\n`;
            text += `│ to see button details per category\n`;
            text += `│\n`;
            text += `│ Toggle: *${prefix}mode buttons* / *${prefix}mode default*\n`;
            text += `└────────────────\n`;
            text += `${getFooter(m.key.participant || m.key.remoteJid)}`;

            // ========== SEND WITH MENU IMAGE (WITH FALLBACK) ==========
            try {
                const media = getMenuMedia ? await getMenuMedia() : null;
                
                if (media && media.buffer) {
                    if (media.type === 'gif' && media.mp4Buffer) {
                        await sock.sendMessage(chatId, { 
                            video: media.mp4Buffer, 
                            gifPlayback: true, 
                            caption: text, 
                            mimetype: "video/mp4" 
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(chatId, { 
                            image: media.buffer, 
                            caption: text, 
                            mimetype: "image/jpeg" 
                        }, { quoted: m });
                    }
                } else {
                    // Fallback to text-only if no media
                    await sock.sendMessage(chatId, { text }, { quoted: m });
                }
            } catch (mediaError) {
                console.log('Error sending menu with media, using text fallback:', mediaError);
                await sock.sendMessage(chatId, { text }, { quoted: m });
            }
            
            console.log(`✅ ${botName} button menu sent`);
            
        } catch (error) {
            console.error('Button menu error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Error loading button menu: ${error.message}` 
            }, { quoted: m });
        }
    }
};
