import fs from 'fs';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const antiAudioFile = './antiaudio.json';

// Ensure JSON file exists
if (!fs.existsSync(antiAudioFile)) {
    fs.writeFileSync(antiAudioFile, JSON.stringify([], null, 2));
}

// Load settings
function loadAntiAudio() {
    try {
        if (!fs.existsSync(antiAudioFile)) return [];
        const data = fs.readFileSync(antiAudioFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading anti-audio settings:', error);
        return [];
    }
}

// Save settings
function saveAntiAudio(data) {
    try {
        fs.writeFileSync(antiAudioFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving anti-audio settings:', error);
    }
}

// Utility function to clean JID
function cleanJid(jid) {
    if (!jid) return jid;
    // Remove device suffix and ensure proper format
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

// Setup listener once globally
let antiAudioListenerAttached = false;

export default {
    name: 'antiaudio',
    description: 'Control audio/voice message sharing in the group',
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

        const settings = loadAntiAudio();
        const groupIndex = settings.findIndex(g => g.chatId === chatId);
        const currentGroupSettings = groupIndex !== -1 ? settings[groupIndex] : null;

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'on') {
            const mode = args[1]?.toLowerCase();
            
            if (!mode || !['warn', 'delete', 'kick'].includes(mode)) {
                return sock.sendMessage(chatId, { 
                    text: '╭─⌈ ⚙️ *ANTI-AUDIO SETUP* ⌋\n│\n├─⊷ *.antiaudio on warn*\n│  └⊷ Warn senders\n├─⊷ *.antiaudio on delete*\n│  └⊷ Auto-delete audio\n├─⊷ *.antiaudio on kick*\n│  └⊷ Kick senders\n╰───' 
                }, { quoted: msg });
            }

            // Parse audio types if specified
            const audioTypes = args.slice(2).map(t => t.toLowerCase()) || [];
            const defaultTypes = ['audio']; // Default to all audio
            const validTypes = ['audio', 'voice', 'music'];
            
            let selectedTypes = [];
            if (audioTypes.length > 0) {
                selectedTypes = audioTypes.filter(type => validTypes.includes(type));
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
                audioTypes: selectedTypes,
                exemptAdmins: true,
                warningCount: {} // Track warnings per user
            };

            if (groupIndex !== -1) {
                settings[groupIndex] = newSettings;
            } else {
                settings.push(newSettings);
            }

            saveAntiAudio(settings);
            
            // Attach listener if not already attached
            if (!antiAudioListenerAttached) {
                setupAntiAudioListener(sock);
                antiAudioListenerAttached = true;
            }

            const modeDescriptions = {
                'warn': 'Users will receive warnings when sharing audio',
                'delete': 'Audio will be automatically deleted',
                'kick': 'Users will be kicked for sharing audio'
            };

            const typesText = selectedTypes.map(t => {
                if (t === 'audio') return '• All audio messages';
                if (t === 'voice') return '• Voice notes only';
                if (t === 'music') return '• Music files only';
                return `• ${t.charAt(0).toUpperCase() + t.slice(1)}`;
            }).join('\n');

            await sock.sendMessage(chatId, { 
                text: `✅ *Anti-Audio enabled!*\n\nMode: *${mode.toUpperCase()}*\n` 
            }, { quoted: msg });

        } 
        else if (subCommand === 'off') {
            if (groupIndex !== -1) {
                settings.splice(groupIndex, 1);
                saveAntiAudio(settings);
                await sock.sendMessage(chatId, { 
                    text: '❌ *Anti-Audio disabled!*\n\nEveryone can now share audio in this group.' 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'ℹ️ Anti-Audio is already disabled in this group.\nEveryone can share audio.' 
                }, { quoted: msg });
            }
        } 
        else if (subCommand === 'exemptadmins') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Audio is not enabled in this group.\nEnable it first with `.antiaudio on [mode]`' 
                }, { quoted: msg });
            }

            const toggle = args[1]?.toLowerCase();
            if (toggle === 'off') {
                currentGroupSettings.exemptAdmins = false;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption disabled*\n\nAdmins will now be subject to anti-audio rules.' 
                }, { quoted: msg });
            } else if (toggle === 'on') {
                currentGroupSettings.exemptAdmins = true;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption enabled*\n\nAdmins can now share audio freely.' 
                }, { quoted: msg });
            } else {
                const currentStatus = currentGroupSettings.exemptAdmins ? 'enabled' : 'disabled';
                await sock.sendMessage(chatId, { 
                    text: `⚙️ *Admin Exemption Status*\n\nCurrently: *${currentStatus}*\n\nTo change:\n\`.antiaudio exemptadmins on\` - Enable\n\`.antiaudio exemptadmins off\` - Disable` 
                }, { quoted: msg });
            }
            
            settings[groupIndex] = currentGroupSettings;
            saveAntiAudio(settings);
        }
        else if (subCommand === 'types') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Audio is not enabled in this group.\nEnable it first with `.antiaudio on [mode]`' 
                }, { quoted: msg });
            }

            const action = args[1]?.toLowerCase();
            
            if (action === 'add') {
                const typesToAdd = args.slice(2).map(t => t.toLowerCase()).filter(t => 
                    ['audio', 'voice', 'music'].includes(t)
                );
                
                if (typesToAdd.length === 0) {
                    return sock.sendMessage(chatId, { 
                        text: '╭─⌈ 🎵 *ANTI-AUDIO TYPES* ⌋\n│\n├─⊷ *.antiaudio types add audio*\n│  └⊷ All audio messages\n├─⊷ *.antiaudio types add voice*\n│  └⊷ Voice notes only\n├─⊷ *.antiaudio types add music*\n│  └⊷ Music files only\n╰───' 
                    }, { quoted: msg });
                }
                
                const addedTypes = [];
                typesToAdd.forEach(type => {
                    if (!currentGroupSettings.audioTypes.includes(type)) {
                        currentGroupSettings.audioTypes.push(type);
                        addedTypes.push(type);
                    }
                });
                
                if (addedTypes.length > 0) {
                    settings[groupIndex] = currentGroupSettings;
                    saveAntiAudio(settings);
                    const typesDisplay = addedTypes.map(t => {
                        if (t === 'audio') return 'All audio messages';
                        if (t === 'voice') return 'Voice notes';
                        if (t === 'music') return 'Music files';
                        return t;
                    });
                    await sock.sendMessage(chatId, { 
                        text: `✅ Added audio types:\n${typesDisplay.map(t => `• ${t}`).join('\n')}\n\nNow blocking ${currentGroupSettings.audioTypes.length} audio types.` 
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
                        text: '╭─⌈ 🎵 *ANTI-AUDIO TYPES REMOVE* ⌋\n│\n├─⊷ *.antiaudio types remove [type]*\n│  └⊷ Remove audio type\n╰───' 
                    }, { quoted: msg });
                }
                
                const removedTypes = [];
                typesToRemove.forEach(type => {
                    const index = currentGroupSettings.audioTypes.indexOf(type);
                    if (index > -1) {
                        currentGroupSettings.audioTypes.splice(index, 1);
                        removedTypes.push(type);
                    }
                });
                
                if (removedTypes.length > 0) {
                    settings[groupIndex] = currentGroupSettings;
                    saveAntiAudio(settings);
                    const typesDisplay = removedTypes.map(t => {
                        if (t === 'audio') return 'All audio messages';
                        if (t === 'voice') return 'Voice notes';
                        if (t === 'music') return 'Music files';
                        return t;
                    });
                    await sock.sendMessage(chatId, { 
                        text: `✅ Removed audio types:\n${typesDisplay.map(t => `• ${t}`).join('\n')}\n\nNow blocking ${currentGroupSettings.audioTypes.length} audio types.` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '❌ None of the specified types were being blocked.' 
                    }, { quoted: msg });
                }
            }
            else if (action === 'list') {
                const currentTypes = currentGroupSettings.audioTypes || [];
                if (currentTypes.length === 0) {
                    await sock.sendMessage(chatId, { 
                        text: '📋 *Blocked Audio Types*\n\nNo audio types are currently blocked.\n\nAdd types with:\n`.antiaudio types add [type]`' 
                    }, { quoted: msg });
                } else {
                    let listText = '📋 *Blocked Audio Types*\n\n';
                    currentTypes.forEach((type, index) => {
                        const displayName = type === 'audio' ? 'All audio messages' :
                                          type === 'voice' ? 'Voice notes' :
                                          type === 'music' ? 'Music files' : type;
                        listText += `${index + 1}. ${displayName}\n`;
                    });
                    listText += `\nTotal: ${currentTypes.length} types\n\nRemove types with:\n\`.antiaudio types remove [type]\``;
                    await sock.sendMessage(chatId, { text: listText }, { quoted: msg });
                }
            }
            else {
                await sock.sendMessage(chatId, { 
                    text: '╭─⌈ 📋 *ANTI-AUDIO TYPES* ⌋\n│\n├─⊷ *.antiaudio types add [type]*\n│  └⊷ Add audio type\n├─⊷ *.antiaudio types remove [type]*\n│  └⊷ Remove audio type\n├─⊷ *.antiaudio types list*\n│  └⊷ View blocked types\n╰───' 
                }, { quoted: msg });
            }
        }
        else if (subCommand === 'status') {
            if (currentGroupSettings) {
                const status = currentGroupSettings.enabled ? 
                    `✅ ENABLED (${currentGroupSettings.mode.toUpperCase()} mode)` : 
                    '❌ DISABLED';
                
                const botStatus = botIsAdmin ? '✅ I am admin' : '❌ I am NOT admin';
                const botSuperStatus = botIsSuperAdmin ? '✅ I am superadmin' : '❌ I am NOT superadmin';
                
                let statusText = `📊 *Anti-Audio Status*\n\n`;
                statusText += `• Feature: ${status}\n`;
                statusText += `• Bot admin: ${botStatus}\n`;
                statusText += `• Bot superadmin: ${botSuperStatus}\n\n`;
                
                if (currentGroupSettings.enabled) {
                    const audioTypesCount = currentGroupSettings.audioTypes?.length || 0;
                    const audioTypesText = currentGroupSettings.audioTypes?.map(t => {
                        if (t === 'audio') return 'All audio';
                        if (t === 'voice') return 'Voice notes';
                        if (t === 'music') return 'Music files';
                        return t;
                    }).join(', ') || 'None';
                    statusText += `• Blocked audio types: ${audioTypesCount}\n`;
                    statusText += `• Types: ${audioTypesText}\n`;
                    statusText += `• Admins exempt: ${currentGroupSettings.exemptAdmins ? 'Yes' : 'No'}\n`;
                    
                    // Show warning counts if any
                    if (currentGroupSettings.warningCount && Object.keys(currentGroupSettings.warningCount).length > 0) {
                        statusText += `• Users warned: ${Object.keys(currentGroupSettings.warningCount).length}\n`;
                    }
                }
                
                statusText += `\n*Detection:*\n• Audio files (MP3, etc.)\n• Voice notes/recordings\n• Music files\n• Audio with captions`;
                
                await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `📊 *Anti-Audio Status*\n\n❌ DISABLED\nEveryone can share audio.\n\n*To enable:*\n\`.antiaudio on [mode]\`\n\nModes: warn, delete, kick\n\nExample: \`.antiaudio on delete\`` 
                }, { quoted: msg });
            }
        }
        else {
            // Show help
            const helpText = `╭─⌈ 🎵 *ANTI-AUDIO* ⌋\n│\n├─⊷ *.antiaudio on <warn|delete|kick>*\n│  └⊷ Enable with mode\n├─⊷ *.antiaudio off*\n│  └⊷ Disable protection\n├─⊷ *.antiaudio types [add/remove/list]*\n│  └⊷ Manage audio types\n├─⊷ *.antiaudio exemptadmins [on/off]*\n│  └⊷ Toggle admin exemption\n├─⊷ *.antiaudio status*\n│  └⊷ View current status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        }
    }
};

function setupAntiAudioListener(sock) {
    console.log('🔧 Setting up anti-audio listener for audio messages...');
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const newMsg = messages[0];
        
        // Skip if no message or not a group message
        if (!newMsg || !newMsg.key.remoteJid?.endsWith('@g.us')) return;
        
        // Skip bot's own messages
        if (newMsg.key.fromMe) return;
        
        const chatId = newMsg.key.remoteJid;
        
        // Load current settings
        const settings = loadAntiAudio();
        const groupSettings = settings.find(g => g.chatId === chatId);
        
        // Skip if anti-audio not enabled for this group
        if (!groupSettings || !groupSettings.enabled) return;
        
        // Check if message contains blocked audio type
        const message = newMsg.message;
        let audioType = null;
        let isAudio = false;
        
        // DEBUG: Log the message structure to see what's available
        console.log('DEBUG: Checking message type:', Object.keys(message || {}));
        
        // Check for audio messages - FIXED DETECTION
        if (message?.audioMessage || message?.pttMessage) {
            console.log('DEBUG: Audio message detected!');
            
            // For WhatsApp Web, audio might be in audioMessage or pttMessage
            const audioMsg = message.audioMessage || message.pttMessage;
            
            if (audioMsg) {
                console.log('DEBUG: Audio properties:', {
                    ptt: audioMsg.ptt,
                    mimetype: audioMsg.mimetype,
                    seconds: audioMsg.seconds,
                    fileName: audioMsg.fileName
                });
                
                // Determine audio type based on properties
                if (audioMsg.ptt === true) {
                    audioType = 'voice'; // Voice note (push-to-talk)
                } else if (audioMsg.mimetype?.includes('audio/')) {
                    // Check if it's music based on file name or duration
                    const isMusic = audioMsg.fileName?.match(/\.(mp3|m4a|flac|wav|ogg)$/i) ||
                                   audioMsg.seconds > 60; // Long audio might be music
                    audioType = isMusic ? 'music' : 'audio';
                } else {
                    audioType = 'audio'; // Generic audio
                }
                
                isAudio = true;
                console.log(`DEBUG: Detected audio type: ${audioType}`);
            }
        }
        
        // Skip if not audio or audio type not blocked
        if (!isAudio || !audioType || !groupSettings.audioTypes?.includes(audioType)) {
            console.log(`DEBUG: Skipping - isAudio: ${isAudio}, audioType: ${audioType}, in blocked types: ${groupSettings.audioTypes?.includes(audioType)}`);
            return;
        }
        
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
                console.log(`Skipping admin ${cleanMessageSender} for ${audioType} in ${chatId}`);
                return;
            }
            
            console.log(`${audioType.toUpperCase()} detected from ${cleanMessageSender} in ${chatId}`);
            
            // Initialize warning count for user if not exists
            if (!groupSettings.warningCount) {
                groupSettings.warningCount = {};
            }
            
            const userId = cleanMessageSender;
            if (!groupSettings.warningCount[userId]) {
                groupSettings.warningCount[userId] = 0;
            }
            
            // Audio type names for display
            const audioTypeNames = {
                'audio': 'Audio message',
                'voice': 'Voice note',
                'music': 'Music file'
            };
            
            const audioName = audioTypeNames[audioType] || audioType;
            
            // Handle based on mode
            switch (groupSettings.mode) {
                case 'warn':
                    groupSettings.warningCount[userId]++;
                    const warnings = groupSettings.warningCount[userId];
                    
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ *Audio Warning* @${senderNumber}\n\n${audioName}s are not allowed in this group!\nWarning #${warnings}\n\nRepeated violations may result in stricter actions.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Update settings with warning count
                    const warnSettingsIndex = settings.findIndex(g => g.chatId === chatId);
                    if (warnSettingsIndex !== -1) {
                        settings[warnSettingsIndex] = groupSettings;
                        saveAntiAudio(settings);
                    }
                    break;
                    
                case 'delete':
                    // Send warning
                    await sock.sendMessage(chatId, { 
                        text: `🚫 *Audio Deleted* @${senderNumber}\n\n${audioName}s are not allowed in this group!\nYour ${audioType} has been removed.`,
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
                        console.log(`Deleted ${audioType} from ${cleanMessageSender} in ${chatId}`);
                    } catch (deleteError) {
                        console.error('Failed to delete audio:', deleteError);
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
                            text: `⚠️ *Cannot Kick*\n\nI need superadmin permissions to kick members.\n\nUser @${senderNumber} shared a ${audioType} but I cannot kick them.`,
                            mentions: [cleanMessageSender]
                        });
                        return;
                    }
                    
                    // Send warning before kick
                    await sock.sendMessage(chatId, { 
                        text: `🚫 *Violation Detected* @${senderNumber}\n\nSharing ${audioName}s is not allowed in this group!\nYou will be kicked for this violation.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Wait a moment then kick
                    setTimeout(async () => {
                        try {
                            await sock.groupParticipantsUpdate(chatId, [cleanMessageSender], 'remove');
                            await sock.sendMessage(chatId, { 
                                text: `👢 *User Kicked*\n\n@${senderNumber} was removed for sharing a ${audioName}.`
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
            console.error('Error handling audio detection:', error);
        }
    });
    
    console.log('✅ Anti-audio listener attached for audio messages');
}