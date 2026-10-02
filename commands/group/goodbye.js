import fs from 'fs';
import axios from 'axios';
import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

(async () => {
    try {
        if (!fs.existsSync('./data/goodbye_data.json') && supabase.isAvailable()) {
            const dbData = await supabase.getConfig('goodbye_data');
            if (dbData && dbData.groups) {
                if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
                fs.writeFileSync('./data/goodbye_data.json', JSON.stringify(dbData, null, 2));
            }
        }
    } catch {}
})();

export default {
    name: 'goodbye',
    alias: ['goodbyemsg', 'setgoodbye', 'bye', 'farewell'],
    category: 'group',
    description: 'Send goodbye messages when members leave the group',
    groupOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const participant = msg.key.participant;
        
        try {
            const metadata = await sock.groupMetadata(chatId);
            const isAdmin = metadata.participants.find(p => p.id === participant)?.admin || false;
            
            if (!isAdmin && !extra?.jidManager?.isOwner(msg)) {
                return sock.sendMessage(chatId, {
                    text: '❌ *Admin Only Command*\nYou need to be admin to use this command.'
                }, { quoted: msg });
            }
        } catch (error) {
            return sock.sendMessage(chatId, {
                text: '❌ Failed to check permissions'
            }, { quoted: msg });
        }
        
        const action = args[0]?.toLowerCase();

        if (!action || action === 'help') {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 👋 *GOODBYE SYSTEM* ⌋\n│\n├─⊷ *${PREFIX}goodbye on*\n│  └⊷ Enable goodbye\n├─⊷ *${PREFIX}goodbye off*\n│  └⊷ Disable goodbye\n├─⊷ *${PREFIX}goodbye set <message>*\n│  └⊷ Set custom message\n├─⊷ *${PREFIX}goodbye reset*\n│  └⊷ Reset to default\n├─⊷ *${PREFIX}goodbye preview*\n│  └⊷ Preview message\n├─⊷ *${PREFIX}goodbye status*\n│  └⊷ Check status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }
        
        const goodbyeData = loadGoodbyeData();
        const groupGoodbye = goodbyeData.groups[chatId] || {
            enabled: false,
            message: "👋 *Goodbye from {group}!*\n\n{mention} has left the group.\nWe're now *{members}* members.\n\nWe'll miss you! 😢",
            lastGoodbye: null
        };
        
        try {
            switch (action) {
                case 'on':
                case 'enable':
                    groupGoodbye.enabled = true;
                    goodbyeData.groups[chatId] = groupGoodbye;
                    saveGoodbyeData(goodbyeData);
                    
                    await sock.sendMessage(chatId, {
                        text: '✅ *Goodbye messages ENABLED*\nMembers who leave will now receive a farewell message!'
                    }, { quoted: msg });
                    break;
                    
                case 'off':
                case 'disable':
                    groupGoodbye.enabled = false;
                    goodbyeData.groups[chatId] = groupGoodbye;
                    saveGoodbyeData(goodbyeData);
                    
                    await sock.sendMessage(chatId, {
                        text: '❌ *Goodbye messages DISABLED*'
                    }, { quoted: msg });
                    break;
                    
                case 'set':
                    if (!args.slice(1).join(' ')) {
                        return sock.sendMessage(chatId, {
                            text: `❌ Please provide a goodbye message!\nExample: \`${PREFIX}goodbye set Goodbye {name}! We'll miss you 😢\``
                        }, { quoted: msg });
                    }
                    
                    const newMessage = args.slice(1).join(' ');
                    groupGoodbye.message = newMessage;
                    goodbyeData.groups[chatId] = groupGoodbye;
                    saveGoodbyeData(goodbyeData);
                    
                    await sock.sendMessage(chatId, {
                        text: `✅ *Goodbye message UPDATED*\n\nNew message:\n"${newMessage}"`
                    }, { quoted: msg });
                    break;
                    
                case 'preview':
                case 'test':
                case 'demo': {
                    const testJid = msg.key.participant || chatId;
                    await sendGoodbyeMessage(sock, chatId, [testJid], groupGoodbye.message);
                    break;
                }
                    
                case 'status': {
                    await sock.sendMessage(chatId, {
                        text: `📊 *GOODBYE SYSTEM STATUS*\n\nEnabled: ${groupGoodbye.enabled ? '✅ YES' : '❌ NO'}\nLast Goodbye: ${groupGoodbye.lastGoodbye ? new Date(groupGoodbye.lastGoodbye).toLocaleString() : 'Never'}\n\nCurrent Message:\n"${groupGoodbye.message.substring(0, 200)}${groupGoodbye.message.length > 200 ? '...' : ''}"`
                    }, { quoted: msg });
                    break;
                }

                case 'reset':
                case 'default': {
                    const defaultMsg = "👋 *Goodbye from {group}!*\n\n{mention} has left the group.\nWe're now *{members}* members.\n\nWe'll miss you! 😢";
                    groupGoodbye.message = defaultMsg;
                    goodbyeData.groups[chatId] = groupGoodbye;
                    saveGoodbyeData(goodbyeData);

                    await sock.sendMessage(chatId, {
                        text: `🔄 *Goodbye message RESET*\n\nMessage has been restored to default:\n"${defaultMsg}"`
                    }, { quoted: msg });
                    break;
                }
                    
                default:
                    await sock.sendMessage(chatId, {
                        text: `╭─⌈ ❌ *GOODBYE* ⌋\n│\n├─⊷ *${PREFIX}goodbye help*\n│  └⊷ View help\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                    }, { quoted: msg });
            }
        } catch (error) {
            console.error('Goodbye command error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
};

function normalizeJid(participant) {
    if (typeof participant === 'string') {
        return participant.includes('@') ? participant : null;
    }
    if (participant && typeof participant === 'object') {
        const jid = participant.jid || participant.id || participant.userJid || participant.participant || participant.user;
        if (typeof jid === 'string' && jid.includes('@')) return jid;
        if (typeof jid === 'string' && /^\d+$/.test(jid)) return `${jid}@s.whatsapp.net`;
        if (typeof jid === 'object' && jid?.user) return `${jid.user}@s.whatsapp.net`;
        const keys = Object.keys(participant);
        for (const key of keys) {
            const val = participant[key];
            if (typeof val === 'string' && val.includes('@s.whatsapp.net')) return val;
        }
        console.log(`[GOODBYE] Unknown participant shape: ${JSON.stringify(participant).substring(0, 200)}`);
        return null;
    }
    return null;
}

export async function sendGoodbyeMessage(sock, groupId, memberJids, customMessage) {
    try {
        let metadata;
        try {
            metadata = await sock.groupMetadata(groupId);
        } catch (err) {
            metadata = { participants: [], subject: 'Our Group' };
        }
        const memberCount = metadata.participants.length;
        const groupName = metadata.subject || "Our Group";
        
        for (const rawJid of memberJids) {
            const userId = normalizeJid(rawJid);
            
            if (!userId || userId === 'undefined' || userId === '[object Object]') {
                console.log(`[GOODBYE] Skipping invalid JID: ${JSON.stringify(rawJid)}`);
                continue;
            }

            try {
                const userName = userId.split('@')[0];
                
                let profilePicBuffer = null;
                try {
                    const ppUrl = await sock.profilePictureUrl(userId, 'image');
                    if (ppUrl) {
                        const response = await axios.get(ppUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 10000 
                        });
                        profilePicBuffer = Buffer.from(response.data);
                    }
                } catch {
                }
                
                const message = customMessage || "👋 *Goodbye from {group}!*\n\n{mention} has left the group.\nWe're now *{members}* members.\n\nWe'll miss you! 😢";
                
                const goodbyeText = message
                    .replace(/{name}/g, userName)
                    .replace(/{group}/g, groupName)
                    .replace(/{members}/g, memberCount.toString())
                    .replace(/{mention}/g, `@${userName}`);
                
                if (profilePicBuffer) {
                    await sock.sendMessage(groupId, {
                        image: profilePicBuffer,
                        caption: goodbyeText,
                        mentions: [userId]
                    });
                } else {
                    await sock.sendMessage(groupId, {
                        text: goodbyeText,
                        mentions: [userId]
                    });
                }
                
                console.log(`[GOODBYE] ✅ Farewell sent for ${userName} in ${groupId.split('@')[0]}`);
                
            } catch (err) {
                console.error(`[GOODBYE] ❌ Error: ${err.message}`);
                try {
                    const fallbackName = typeof userId === 'string' ? userId.split('@')[0] : 'member';
                    await sock.sendMessage(groupId, {
                        text: `👋 Goodbye @${fallbackName}! We'll miss you 😢`,
                        mentions: [userId]
                    });
                } catch {
                }
            }
        }
        
        const goodbyeData = loadGoodbyeData();
        if (goodbyeData.groups[groupId]) {
            goodbyeData.groups[groupId].lastGoodbye = Date.now();
            saveGoodbyeData(goodbyeData);
        }
        
    } catch (error) {
        console.error(`[GOODBYE] ❌ Fatal error: ${error.message}`);
    }
}

export function isGoodbyeEnabled(groupId) {
    try {
        const goodbyeData = loadGoodbyeData();
        return goodbyeData.groups[groupId]?.enabled === true;
    } catch {
        return false;
    }
}

export function getGoodbyeMessage(groupId) {
    try {
        const goodbyeData = loadGoodbyeData();
        return goodbyeData.groups[groupId]?.message || "👋 *Goodbye from {group}!*\n\n{mention} has left the group.\nWe're now *{members}* members.\n\nWe'll miss you! 😢";
    } catch {
        return "👋 *Goodbye from {group}!*\n\n{mention} has left the group.\nWe're now *{members}* members.\n\nWe'll miss you! 😢";
    }
}

function loadGoodbyeData() {
    try {
        if (fs.existsSync('./data/goodbye_data.json')) {
            return JSON.parse(fs.readFileSync('./data/goodbye_data.json', 'utf8'));
        }
    } catch (error) {
        console.error('Error loading goodbye data:', error);
    }
    
    return {
        groups: {},
        version: '1.0',
        created: new Date().toISOString()
    };
}

function saveGoodbyeData(data) {
    try {
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        
        data.updated = new Date().toISOString();
        fs.writeFileSync('./data/goodbye_data.json', JSON.stringify(data, null, 2));
        supabase.setConfig('goodbye_data', data).catch(() => {});
        return true;
    } catch (error) {
        console.error('Error saving goodbye data:', error);
        return false;
    }
}
