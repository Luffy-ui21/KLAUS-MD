import fs from 'fs';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const antiMentionFile = './antimention.json';

// Ensure JSON file exists
if (!fs.existsSync(antiMentionFile)) {
    fs.writeFileSync(antiMentionFile, JSON.stringify([], null, 2));
}

// Load settings
function loadAntiMention() {
    try {
        if (!fs.existsSync(antiMentionFile)) return [];
        const data = fs.readFileSync(antiMentionFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading anti-mention settings:', error);
        return [];
    }
}

// Save settings
function saveAntiMention(data) {
    try {
        fs.writeFileSync(antiMentionFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving anti-mention settings:', error);
    }
}

// Utility function to clean JID
function cleanJid(jid) {
    if (!jid) return jid;
    // Remove device suffix and ensure proper format
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

// Check if message contains mentions
function containsMentions(message) {
    if (!message) return false;
    
    // Check for mentions in different message types
    if (message.extendedTextMessage) {
        const extMsg = message.extendedTextMessage;
        if (extMsg.contextInfo?.mentionedJid && extMsg.contextInfo.mentionedJid.length > 0) {
            return true;
        }
    }
    
    if (message.imageMessage?.contextInfo?.mentionedJid && 
        message.imageMessage.contextInfo.mentionedJid.length > 0) {
        return true;
    }
    
    if (message.videoMessage?.contextInfo?.mentionedJid && 
        message.videoMessage.contextInfo.mentionedJid.length > 0) {
        return true;
    }
    
    if (message.documentMessage?.contextInfo?.mentionedJid && 
        message.documentMessage.contextInfo.mentionedJid.length > 0) {
        return true;
    }
    
    if (message.audioMessage?.contextInfo?.mentionedJid && 
        message.audioMessage.contextInfo.mentionedJid.length > 0) {
        return true;
    }
    
    if (message.stickerMessage?.contextInfo?.mentionedJid && 
        message.stickerMessage.contextInfo.mentionedJid.length > 0) {
        return true;
    }
    
    // Check for @mentions in text (for manual @ mentions)
    const text = extractMessageText(message);
    if (text && text.includes('@')) {
        // Check if it's a phone number mention (e.g., @1234567890)
        const phoneMentions = text.match(/@\d{6,}/g);
        if (phoneMentions && phoneMentions.length > 0) {
            return true;
        }
    }
    
    return false;
}

// Extract mentioned JIDs from message
function extractMentions(message) {
    const mentions = [];
    
    if (!message) return mentions;
    
    // Check for structured mentions
    let mentionedJids = [];
    
    if (message.extendedTextMessage?.contextInfo?.mentionedJid) {
        mentionedJids = message.extendedTextMessage.contextInfo.mentionedJid;
    } else if (message.imageMessage?.contextInfo?.mentionedJid) {
        mentionedJids = message.imageMessage.contextInfo.mentionedJid;
    } else if (message.videoMessage?.contextInfo?.mentionedJid) {
        mentionedJids = message.videoMessage.contextInfo.mentionedJid;
    } else if (message.documentMessage?.contextInfo?.mentionedJid) {
        mentionedJids = message.documentMessage.contextInfo.mentionedJid;
    } else if (message.audioMessage?.contextInfo?.mentionedJid) {
        mentionedJids = message.audioMessage.contextInfo.mentionedJid;
    }
    
    // Add structured mentions
    mentionedJids.forEach(jid => {
        if (jid && !mentions.includes(jid)) {
            mentions.push(jid);
        }
    });
    
    return mentions;
}

// Extract text from any message type
function extractMessageText(message) {
    if (!message) return '';
    
    if (message.conversation) {
        return message.conversation;
    }
    
    if (message.extendedTextMessage) {
        return message.extendedTextMessage.text || '';
    }
    
    if (message.imageMessage) {
        return message.imageMessage.caption || '';
    }
    
    if (message.videoMessage) {
        return message.videoMessage.caption || '';
    }
    
    if (message.documentMessage) {
        return message.documentMessage.caption || '';
    }
    
    if (message.audioMessage) {
        return message.audioMessage.caption || '';
    }
    
    if (message.stickerMessage) {
        return '';
    }
    
    return '';
}

// Setup listener once globally
let antiMentionListenerAttached = false;

// Replace placeholders in a custom message template.
// Supported placeholders: {user}, {group}, {warns}, {limit}, {mode}, {type}
function formatCustomMessage(template, vars) {
    if (!template || typeof template !== 'string') return '';
    return template.replace(/\{(\w+)\}/g, (_, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
    );
}

export default {
    name: 'antimention',
    description: 'Control user mentions in the group',
    category: 'group',
    async execute(sock, msg, args, metadata) {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        if (!isGroup) {
            return sock.sendMessage(chatId, { 
                text: '❌ This command can only be used in groups.' 
            }, { quoted: msg });
        }

        // Get sender's JID
        let sender = msg.key.participant || (msg.key.fromMe ? sock.user.id : msg.key.remoteJid);
        sender = cleanJid(sender);

        // Check if user is admin
        let isAdmin = false;
        let botIsAdmin = false;
        let botIsSuperAdmin = false;
        
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const cleanSender = cleanJid(sender);
            
            // Check if sender is admin
            const participant = groupMetadata.participants.find(p => {
                const cleanParticipantJid = cleanJid(p.id);
                return cleanParticipantJid === cleanSender;
            });
            
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
            // Check if bot is admin
            const botJid = cleanJid(sock.user?.id);
            const botParticipant = groupMetadata.participants.find(p => {
                const cleanParticipantJid = cleanJid(p.id);
                return cleanParticipantJid === botJid;
            });
            botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
            botIsSuperAdmin = botParticipant?.admin === 'superadmin';
            
        } catch (error) {
            console.error('Error fetching group metadata:', error);
            return sock.sendMessage(chatId, { 
                text: '❌ Failed to fetch group information. Please try again.' 
            }, { quoted: msg });
        }

        // ONLY admins can use the command
        if (!isAdmin) {
            return sock.sendMessage(chatId, { 
                text: '❌ Only group admins can use this command!' 
            }, { quoted: msg });
        }

        const settings = loadAntiMention();
        const groupIndex = settings.findIndex(g => g.chatId === chatId);
        const currentGroupSettings = groupIndex !== -1 ? settings[groupIndex] : null;

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'on') {
            const mode = args[1]?.toLowerCase();
            
            if (!mode || !['warn', 'delete', 'kick'].includes(mode)) {
                return sock.sendMessage(chatId, { 
                    text: '╭─⌈ ⚙️ *ANTI-MENTION SETUP* ⌋\n│\n├─⊷ *.antimention on warn*\n│  └⊷ Warn senders\n├─⊷ *.antimention on delete*\n│  └⊷ Auto-delete mentions\n├─⊷ *.antimention on kick*\n│  └⊷ Kick senders\n╰───' 
                }, { quoted: msg });
            }

            // Parse mention types if specified
            const mentionTypes = args.slice(2).map(t => t.toLowerCase()) || [];
            const defaultTypes = ['all']; // Default to all mention types
            const validTypes = ['all', 'admin', 'member', 'everyone'];
            
            let selectedTypes = [];
            if (mentionTypes.length > 0) {
                selectedTypes = mentionTypes.filter(type => validTypes.includes(type));
            }
            if (selectedTypes.length === 0) {
                selectedTypes = defaultTypes;
            }

            // // Warn if bot is not admin for certain modes
            // if (!botIsAdmin && (mode === 'delete' || mode === 'kick')) {
            //     await sock.sendMessage(chatId, { 
            //         text: '⚠️ *Warning:* I need admin permissions for delete/kick modes!\n\nPlease make me an admin for these features to work properly.' 
            //     }, { quoted: msg });
            // }

            // Warn if bot is not superadmin for kick mode
            if (!botIsSuperAdmin && mode === 'kick') {
                await sock.sendMessage(chatId, { 
                    text: '⚠️ *Important:* I need *superadmin* permissions to kick members!\n\nPlease make me a superadmin for kick mode to work.' 
                }, { quoted: msg });
            }

            const newSettings = {
                chatId,
                enabled: true,
                mode: mode,
                mentionTypes: selectedTypes,
                exemptAdmins: true,
                warningCount: {}, // Track warnings per user
                customMessage: currentGroupSettings?.customMessage || '' // Preserve custom message on re-enable
            };

            if (groupIndex !== -1) {
                settings[groupIndex] = newSettings;
            } else {
                settings.push(newSettings);
            }

            saveAntiMention(settings);
            
            // Attach listener if not already attached
            if (!antiMentionListenerAttached) {
                setupAntiMentionListener(sock);
                antiMentionListenerAttached = true;
            }

            const modeDescriptions = {
                'warn': 'Users will receive warnings when mentioning others',
                'delete': 'Messages with mentions will be deleted',
                'kick': 'Users will be kicked for mentioning others'
            };

            const typesText = selectedTypes.map(t => {
                if (t === 'all') return '• All mentions (any user)';
                if (t === 'admin') return '• Admin mentions only';
                if (t === 'member') return '• Member mentions only';
                if (t === 'everyone') return '• @everyone mentions';
                return `• ${t.charAt(0).toUpperCase() + t.slice(1)}`;
            }).join('\n');

            await sock.sendMessage(chatId, { 
                text: `✅ *Anti-Mention enabled!*\n\nMode: *${mode.toUpperCase()}*\n` 
            }, { quoted: msg });

        } 
        else if (subCommand === 'off') {
            if (groupIndex !== -1) {
                // Disable but preserve config (especially customMessage) so re-enabling
                // restores the user's saved preferences.
                settings[groupIndex].enabled = false;
                saveAntiMention(settings);
                await sock.sendMessage(chatId, { 
                    text: '❌ *Anti-Mention disabled!*\n\nEveryone can now mention others in this group.' 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'ℹ️ Anti-Mention is already disabled in this group.\nEveryone can mention others.' 
                }, { quoted: msg });
            }
        } 
        else if (subCommand === 'exemptadmins') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Mention is not enabled in this group.\nEnable it first with `.antimention on [mode]`' 
                }, { quoted: msg });
            }

            const toggle = args[1]?.toLowerCase();
            if (toggle === 'off') {
                currentGroupSettings.exemptAdmins = false;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption disabled*\n\nAdmins will now be subject to anti-mention rules.' 
                }, { quoted: msg });
            } else if (toggle === 'on') {
                currentGroupSettings.exemptAdmins = true;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption enabled*\n\nAdmins can now mention others freely.' 
                }, { quoted: msg });
            } else {
                const currentStatus = currentGroupSettings.exemptAdmins ? 'enabled' : 'disabled';
                await sock.sendMessage(chatId, { 
                    text: `⚙️ *Admin Exemption Status*\n\nCurrently: *${currentStatus}*\n\nTo change:\n\`.antimention exemptadmins on\` - Enable\n\`.antimention exemptadmins off\` - Disable` 
                }, { quoted: msg });
            }
            
            settings[groupIndex] = currentGroupSettings;
            saveAntiMention(settings);
        }
        else if (subCommand === 'types') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Mention is not enabled in this group.\nEnable it first with `.antimention on [mode]`' 
                }, { quoted: msg });
            }

            const action = args[1]?.toLowerCase();
            
            if (action === 'add') {
                const typesToAdd = args.slice(2).map(t => t.toLowerCase()).filter(t => 
                    ['all', 'admin', 'member', 'everyone'].includes(t)
                );
                
                if (typesToAdd.length === 0) {
                    return sock.sendMessage(chatId, { 
                        text: '╭─⌈ 👥 *ANTI-MENTION TYPES* ⌋\n│\n├─⊷ *.antimention types add all*\n│  └⊷ All mentions\n├─⊷ *.antimention types add admin*\n│  └⊷ Admin mentions only\n├─⊷ *.antimention types add member*\n│  └⊷ Member mentions only\n├─⊷ *.antimention types add everyone*\n│  └⊷ @everyone mentions\n╰───' 
                    }, { quoted: msg });
                }
                
                const addedTypes = [];
                typesToAdd.forEach(type => {
                    if (!currentGroupSettings.mentionTypes.includes(type)) {
                        currentGroupSettings.mentionTypes.push(type);
                        addedTypes.push(type);
                    }
                });
                
                if (addedTypes.length > 0) {
                    settings[groupIndex] = currentGroupSettings;
                    saveAntiMention(settings);
                    const typesDisplay = addedTypes.map(t => {
                        if (t === 'all') return 'All mentions';
                        if (t === 'admin') return 'Admin mentions';
                        if (t === 'member') return 'Member mentions';
                        if (t === 'everyone') return '@everyone mentions';
                        return t;
                    });
                    await sock.sendMessage(chatId, { 
                        text: `✅ Added mention types:\n${typesDisplay.map(t => `• ${t}`).join('\n')}\n\nNow blocking ${currentGroupSettings.mentionTypes.length} mention types.` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '⚠️ All specified types are already being blocked.' 
                    }, { quoted: msg });
                }
            }
            else if (action === 'remove') {
                const typesToRemove = args.slice(2).map(t => t.toLowerCase());
                
                if (typesToRemove.length === 0) {
                    return sock.sendMessage(chatId, { 
                        text: '╭─⌈ 👥 *ANTI-MENTION TYPES REMOVE* ⌋\n│\n├─⊷ *.antimention types remove [type]*\n│  └⊷ Remove mention type\n╰───' 
                    }, { quoted: msg });
                }
                
                const removedTypes = [];
                typesToRemove.forEach(type => {
                    const index = currentGroupSettings.mentionTypes.indexOf(type);
                    if (index > -1) {
                        currentGroupSettings.mentionTypes.splice(index, 1);
                        removedTypes.push(type);
                    }
                });
                
                if (removedTypes.length > 0) {
                    settings[groupIndex] = currentGroupSettings;
                    saveAntiMention(settings);
                    const typesDisplay = removedTypes.map(t => {
                        if (t === 'all') return 'All mentions';
                        if (t === 'admin') return 'Admin mentions';
                        if (t === 'member') return 'Member mentions';
                        if (t === 'everyone') return '@everyone mentions';
                        return t;
                    });
                    await sock.sendMessage(chatId, { 
                        text: `✅ Removed mention types:\n${typesDisplay.map(t => `• ${t}`).join('\n')}\n\nNow blocking ${currentGroupSettings.mentionTypes.length} mention types.` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '❌ None of the specified types were being blocked.' 
                    }, { quoted: msg });
                }
            }
            else if (action === 'list') {
                const currentTypes = currentGroupSettings.mentionTypes || [];
                if (currentTypes.length === 0) {
                    await sock.sendMessage(chatId, { 
                        text: '📋 *Blocked Mention Types*\n\nNo mention types are currently blocked.\n\nAdd types with:\n`.antimention types add [type]`' 
                    }, { quoted: msg });
                } else {
                    let listText = '📋 *Blocked Mention Types*\n\n';
                    currentTypes.forEach((type, index) => {
                        const displayName = type === 'all' ? 'All mentions' :
                                          type === 'admin' ? 'Admin mentions' :
                                          type === 'member' ? 'Member mentions' :
                                          type === 'everyone' ? '@everyone mentions' : type;
                        listText += `${index + 1}. ${displayName}\n`;
                    });
                    listText += `\nTotal: ${currentTypes.length} types\n\nRemove types with:\n\`.antimention types remove [type]\``;
                    await sock.sendMessage(chatId, { text: listText }, { quoted: msg });
                }
            }
            else {
                await sock.sendMessage(chatId, { 
                    text: '╭─⌈ 📋 *ANTI-MENTION TYPES* ⌋\n│\n├─⊷ *.antimention types add [type]*\n│  └⊷ Add mention type\n├─⊷ *.antimention types remove [type]*\n│  └⊷ Remove mention type\n├─⊷ *.antimention types list*\n│  └⊷ View blocked types\n╰───' 
                }, { quoted: msg });
            }
        }
        else if (subCommand === 'set') {
            const customText = args.slice(1).join(' ').trim();
            if (!customText) {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ ✏️ *SET CUSTOM MESSAGE* ⌋\n│\n├─⊷ Usage: *.antimention set <text>*\n│\n├─⊷ Placeholders:\n│  └⊷ {user}  - mention the sender\n│  └⊷ {group} - group name\n│  └⊷ {warns} - current warning count\n│  └⊷ {limit} - max warning count\n│  └⊷ {mode}  - mode (warn/delete/kick)\n│  └⊷ {type}  - blocked mention type\n│\n├─⊷ Example:\n│  └⊷ .antimention set Hey {user}, no mentions!\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }
            const target = currentGroupSettings || {
                chatId,
                enabled: false,
                mode: 'warn',
                mentionTypes: ['all'],
                exemptAdmins: true,
                warningCount: {}
            };
            target.customMessage = customText;
            if (groupIndex !== -1) {
                settings[groupIndex] = target;
            } else {
                settings.push(target);
            }
            saveAntiMention(settings);
            return sock.sendMessage(chatId, {
                text: `✅ *Custom Anti-Mention message saved.*\n\n📝 Preview:\n${customText}`
            }, { quoted: msg });
        }
        else if (subCommand === 'reset') {
            if (!currentGroupSettings || !currentGroupSettings.customMessage) {
                return sock.sendMessage(chatId, {
                    text: 'ℹ️ No custom Anti-Mention message is set — already using the default.'
                }, { quoted: msg });
            }
            currentGroupSettings.customMessage = '';
            settings[groupIndex] = currentGroupSettings;
            saveAntiMention(settings);
            return sock.sendMessage(chatId, {
                text: '✅ Custom Anti-Mention message cleared. Default messages will be used.'
            }, { quoted: msg });
        }
        else if (subCommand === 'status') {
            if (currentGroupSettings) {
                const status = currentGroupSettings.enabled ? 
                    `✅ ENABLED (${currentGroupSettings.mode.toUpperCase()} mode)` : 
                    '❌ DISABLED';
                
                const botStatus = botIsAdmin ? '✅ I am admin' : '❌ I am NOT admin';
                const botSuperStatus = botIsSuperAdmin ? '✅ I am superadmin' : '❌ I am NOT superadmin';
                
                let statusText = `📊 *Anti-Mention Status*\n\n`;
                statusText += `• Feature: ${status}\n`;
                statusText += `• Bot admin: ${botStatus}\n`;
                statusText += `• Bot superadmin: ${botSuperStatus}\n\n`;
                
                if (currentGroupSettings.enabled) {
                    const mentionTypesCount = currentGroupSettings.mentionTypes?.length || 0;
                    const mentionTypesText = currentGroupSettings.mentionTypes?.map(t => {
                        if (t === 'all') return 'All mentions';
                        if (t === 'admin') return 'Admin';
                        if (t === 'member') return 'Member';
                        if (t === 'everyone') return '@everyone';
                        return t;
                    }).join(', ') || 'None';
                    statusText += `• Blocked mention types: ${mentionTypesCount}\n`;
                    statusText += `• Types: ${mentionTypesText}\n`;
                    statusText += `• Admins exempt: ${currentGroupSettings.exemptAdmins ? 'Yes' : 'No'}\n`;
                    
                    // Show warning counts if any
                    if (currentGroupSettings.warningCount && Object.keys(currentGroupSettings.warningCount).length > 0) {
                        statusText += `• Users warned: ${Object.keys(currentGroupSettings.warningCount).length}\n`;
                    }
                }

                statusText += `• Custom message: ${currentGroupSettings.customMessage ? '✅ set' : '❌ default'}\n`;
                if (currentGroupSettings.customMessage) {
                    statusText += `\n📝 Custom text:\n${currentGroupSettings.customMessage}\n`;
                }

                statusText += `\n*Detection:*\n• @mentions in messages\n• Mentions in media captions\n• @everyone mentions\n• Manual @phone mentions`;
                
                await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `📊 *Anti-Mention Status*\n\n❌ DISABLED\nEveryone can mention others.\n\n*To enable:*\n\`.antimention on [mode]\`\n\nModes: warn, delete, kick\n\nExample: \`.antimention on delete\`` 
                }, { quoted: msg });
            }
        }
        else if (subCommand === 'test') {
            // Test if a message contains mentions
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const testMessage = quotedMsg || msg.message;
            
            const hasMentions = containsMentions(testMessage);
            const extractedMentions = extractMentions(testMessage);
            
            let testResult = `🔍 *Mention Detection Test*\n\n`;
            
            if (quotedMsg) {
                testResult += `Testing quoted message:\n`;
            }
            
            const text = extractMessageText(testMessage);
            if (text) {
                testResult += `Text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n\n`;
            }
            
            testResult += `Contains mentions: ${hasMentions ? '✅ Yes' : '❌ No'}\n`;
            
            if (hasMentions) {
                testResult += `Number of mentions: ${extractedMentions.length}\n`;
                
                if (extractedMentions.length > 0) {
                    testResult += `\nMentioned users:\n`;
                    extractedMentions.forEach((jid, i) => {
                        const number = jid.split('@')[0];
                        testResult += `${i + 1}. @${number}\n`;
                    });
                }
            }
            
            await sock.sendMessage(chatId, { 
                text: testResult,
                mentions: extractedMentions.slice(0, 10) // Mention up to 10 users
            }, { quoted: msg });
        }
        else {
            // Show help
            const helpText = `╭─⌈ 👥 *ANTI-MENTION* ⌋\n│\n├─⊷ *.antimention on <warn|delete|kick>*\n│  └⊷ Enable with mode\n├─⊷ *.antimention off*\n│  └⊷ Disable protection\n├─⊷ *.antimention types [add/remove/list]*\n│  └⊷ Manage mention types\n├─⊷ *.antimention exemptadmins [on/off]*\n│  └⊷ Toggle admin exemption\n├─⊷ *.antimention set <text>*\n│  └⊷ Custom warning text\n│  └⊷ {user} {group} {warns} {limit} {mode} {type}\n├─⊷ *.antimention reset*\n│  └⊷ Restore default text\n├─⊷ *.antimention status*\n│  └⊷ View current status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        }
    }
};

function setupAntiMentionListener(sock) {
    console.log('🔧 Setting up anti-mention listener...');
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const newMsg = messages[0];
        
        // Skip if no message or not a group message
        if (!newMsg || !newMsg.key.remoteJid?.endsWith('@g.us')) return;
        
        // Skip bot's own messages
        if (newMsg.key.fromMe) return;
        
        const chatId = newMsg.key.remoteJid;
        
        // Load current settings
        const settings = loadAntiMention();
        const groupSettings = settings.find(g => g.chatId === chatId);
        
        // Skip if anti-mention not enabled for this group
        if (!groupSettings || !groupSettings.enabled) return;
        
        // Check if message contains mentions
        const message = newMsg.message;
        const hasMentions = containsMentions(message);
        
        // Skip if no mentions
        if (!hasMentions) return;
        
        // Get sender
        const messageSender = newMsg.key.participant || newMsg.key.remoteJid;
        const cleanMessageSender = cleanJid(messageSender);
        const senderNumber = cleanMessageSender.split('@')[0];
        
        try {
            // Fetch group metadata
            const groupMetadata = await sock.groupMetadata(chatId);
            
            // Check if sender is admin
            let isSenderAdmin = false;
            const senderParticipant = groupMetadata.participants.find(p => {
                const cleanParticipantJid = cleanJid(p.id);
                return cleanParticipantJid === cleanMessageSender;
            });
            
            isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
            
            // Skip if sender is admin and exemptAdmins is true
            if (isSenderAdmin && groupSettings.exemptAdmins) {
                console.log(`Skipping admin ${cleanMessageSender} for mentions in ${chatId}`);
                return;
            }
            
            // Extract all mentioned JIDs
            const mentionedJids = extractMentions(message);
            
            // Check if any mentioned users are admins
            let containsAdminMention = false;
            let containsMemberMention = false;
            let containsEveryone = false;
            
            // Check text for @everyone
            const text = extractMessageText(message);
            if (text && (text.includes('@everyone') || text.toLowerCase().includes('everyone'))) {
                containsEveryone = true;
            }
            
            // Check each mentioned user
            for (const mentionedJid of mentionedJids) {
                const cleanMentionedJid = cleanJid(mentionedJid);
                const mentionedParticipant = groupMetadata.participants.find(p => {
                    const cleanParticipantJid = cleanJid(p.id);
                    return cleanParticipantJid === cleanMentionedJid;
                });
                
                if (mentionedParticipant) {
                    const isMentionedAdmin = mentionedParticipant.admin === 'admin' || mentionedParticipant.admin === 'superadmin';
                    
                    if (isMentionedAdmin) {
                        containsAdminMention = true;
                    } else {
                        containsMemberMention = true;
                    }
                }
            }
            
            // Check if the mention type is blocked
            let isBlocked = false;
            let blockedType = '';
            
            if (groupSettings.mentionTypes.includes('all')) {
                isBlocked = true;
                blockedType = 'any mention';
            } else if (containsEveryone && groupSettings.mentionTypes.includes('everyone')) {
                isBlocked = true;
                blockedType = '@everyone mention';
            } else if (containsAdminMention && groupSettings.mentionTypes.includes('admin')) {
                isBlocked = true;
                blockedType = 'admin mention';
            } else if (containsMemberMention && groupSettings.mentionTypes.includes('member')) {
                isBlocked = true;
                blockedType = 'member mention';
            }
            
            // Skip if not blocked
            if (!isBlocked) {
                console.log(`Mention detected but type not blocked: ${blockedType}`);
                return;
            }
            
            console.log(`${blockedType} detected from ${cleanMessageSender} in ${chatId}`);
            
            // Initialize warning count for user if not exists
            if (!groupSettings.warningCount) {
                groupSettings.warningCount = {};
            }
            
            const userId = cleanMessageSender;
            if (!groupSettings.warningCount[userId]) {
                groupSettings.warningCount[userId] = 0;
            }
            
            // Build placeholder vars (used for both default and custom messages)
            const _amGroupName = groupMetadata?.subject || 'this group';
            const _amCustom = groupSettings.customMessage || '';
            const _amVars = {
                user: `@${senderNumber}`,
                group: _amGroupName,
                warns: groupSettings.warningCount[userId] || 0,
                limit: groupSettings.maxWarnings || 3,
                mode: groupSettings.mode,
                type: blockedType
            };

            // Handle based on mode
            switch (groupSettings.mode) {
                case 'warn':
                    groupSettings.warningCount[userId]++;
                    const warnings = groupSettings.warningCount[userId];
                    _amVars.warns = warnings;

                    await sock.sendMessage(chatId, {
                        text: _amCustom
                            ? formatCustomMessage(_amCustom, _amVars)
                            : `⚠️ *Mention Warning* @${senderNumber}\n\nMentioning others is not allowed in this group!\nWarning #${warnings}\n\nBlocked: ${blockedType}\n\nRepeated violations may result in stricter actions.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Update settings with warning count
                    const warnSettingsIndex = settings.findIndex(g => g.chatId === chatId);
                    if (warnSettingsIndex !== -1) {
                        settings[warnSettingsIndex] = groupSettings;
                        saveAntiMention(settings);
                    }
                    break;
                    
                case 'delete':
                    // Send warning
                    await sock.sendMessage(chatId, {
                        text: _amCustom
                            ? formatCustomMessage(_amCustom, _amVars)
                            : `🚫 *Message Deleted* @${senderNumber}\n\nMentioning others is not allowed in this group!\nYour message with ${blockedType} has been removed.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Try to delete the message
                    try {
                        await sock.sendMessage(chatId, { 
                            delete: {
                                id: newMsg.key.id,
                                participant: messageSender,
                                remoteJid: chatId,
                                fromMe: false
                            }
                        });
                        console.log(`Deleted message with ${blockedType} from ${cleanMessageSender} in ${chatId}`);
                    } catch (deleteError) {
                        console.error('Failed to delete message:', deleteError);
                    }
                    break;
                    
                case 'kick':
                    // Check if bot is superadmin
                    const botJid = cleanJid(sock.user?.id);
                    const botParticipant = groupMetadata.participants.find(p => {
                        const cleanParticipantJid = cleanJid(p.id);
                        return cleanParticipantJid === botJid;
                    });
                    const botIsSuperAdmin = botParticipant?.admin === 'superadmin';
                    
                    if (!botIsSuperAdmin) {
                        await sock.sendMessage(chatId, { 
                            text: `⚠️ *Cannot Kick*\n\nI need superadmin permissions to kick members.\n\nUser @${senderNumber} mentioned others but I cannot kick them.`,
                            mentions: [cleanMessageSender]
                        });
                        return;
                    }
                    
                    // Send warning before kick
                    await sock.sendMessage(chatId, {
                        text: _amCustom
                            ? formatCustomMessage(_amCustom, _amVars)
                            : `🚫 *Violation Detected* @${senderNumber}\n\nMentioning others is not allowed in this group!\nYou will be kicked for ${blockedType}.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Wait a moment then kick
                    setTimeout(async () => {
                        try {
                            await sock.groupParticipantsUpdate(chatId, [cleanMessageSender], 'remove');
                            await sock.sendMessage(chatId, { 
                                text: `👢 *User Kicked*\n\n@${senderNumber} was removed for mentioning others.`
                            });
                        } catch (kickError) {
                            console.error('Failed to kick user:', kickError);
                            await sock.sendMessage(chatId, { 
                                text: `❌ *Failed to kick user*\n\nCould not remove @${senderNumber}. Please check my permissions.`,
                                mentions: [cleanMessageSender]
                            });
                        }
                    }, 2000);
                    break;
            }
            
        } catch (error) {
            console.error('Error handling mention detection:', error);
        }
    });
    
    console.log('✅ Anti-mention listener attached');
}