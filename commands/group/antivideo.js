import fs from 'fs';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const antiVideoFile = './antivideo.json';

// Ensure JSON file exists
if (!fs.existsSync(antiVideoFile)) {
    fs.writeFileSync(antiVideoFile, JSON.stringify([], null, 2));
}

// Load settings
function loadAntiVideo() {
    try {
        if (!fs.existsSync(antiVideoFile)) return [];
        const data = fs.readFileSync(antiVideoFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading anti-video settings:', error);
        return [];
    }
}

// Save settings
function saveAntiVideo(data) {
    try {
        fs.writeFileSync(antiVideoFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving anti-video settings:', error);
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
let antiVideoListenerAttached = false;

export default {
    name: 'antivideo',
    description: 'Control video sharing in the group',
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

        const settings = loadAntiVideo();
        const groupIndex = settings.findIndex(g => g.chatId === chatId);
        const currentGroupSettings = groupIndex !== -1 ? settings[groupIndex] : null;

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'on') {
            const mode = args[1]?.toLowerCase();
            
            if (!mode || !['warn', 'delete', 'kick'].includes(mode)) {
                return sock.sendMessage(chatId, { 
                    text: '╭─⌈ ⚙️ *ANTI-VIDEO SETUP* ⌋\n│\n├─⊷ *.antivideo on warn*\n│  └⊷ Warn senders\n├─⊷ *.antivideo on delete*\n│  └⊷ Auto-delete videos\n├─⊷ *.antivideo on kick*\n│  └⊷ Kick senders\n╰───' 
                }, { quoted: msg });
            }

            // Parse video types if specified
            const videoTypes = args.slice(2).map(t => t.toLowerCase()) || [];
            const defaultTypes = ['video']; // Default to regular videos only
            const validTypes = ['video', 'gif'];
            
            let selectedTypes = [];
            if (videoTypes.length > 0) {
                selectedTypes = videoTypes.filter(type => validTypes.includes(type));
            }
            if (selectedTypes.length === 0) {
                selectedTypes = defaultTypes;
            }

            // Warn if bot is not admin for certain modes
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
                videoTypes: selectedTypes,
                exemptAdmins: true,
                warningCount: {} // Track warnings per user
            };

            if (groupIndex !== -1) {
                settings[groupIndex] = newSettings;
            } else {
                settings.push(newSettings);
            }

            saveAntiVideo(settings);
            
            // Attach listener if not already attached
            if (!antiVideoListenerAttached) {
                setupAntiVideoListener(sock);
                antiVideoListenerAttached = true;
            }

            const modeDescriptions = {
                'warn': 'Users will receive warnings when sharing videos',
                'delete': 'Videos will be automatically deleted',
                'kick': 'Users will be kicked for sharing videos'
            };

            const typesText = selectedTypes.map(t => {
                if (t === 'video') return '• Regular videos (MP4, etc.)';
                if (t === 'gif') return '• GIFs (animated images)';
                return `• ${t.charAt(0).toUpperCase() + t.slice(1)}`;
            }).join('\n');

            await sock.sendMessage(chatId, { 
                text: `✅ *Anti-Video enabled!*\n\nMode: *${mode.toUpperCase()}*\n` 
            }, { quoted: msg });

        } 
        else if (subCommand === 'off') {
            if (groupIndex !== -1) {
                settings.splice(groupIndex, 1);
                saveAntiVideo(settings);
                await sock.sendMessage(chatId, { 
                    text: '❌ *Anti-Video disabled!*\n\nEveryone can now share videos in this group.' 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'ℹ️ Anti-Video is already disabled in this group.\nEveryone can share videos.' 
                }, { quoted: msg });
            }
        } 
        else if (subCommand === 'exemptadmins') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Video is not enabled in this group.\nEnable it first with `.antivideo on [mode]`' 
                }, { quoted: msg });
            }

            const toggle = args[1]?.toLowerCase();
            if (toggle === 'off') {
                currentGroupSettings.exemptAdmins = false;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption disabled*\n\nAdmins will now be subject to anti-video rules.' 
                }, { quoted: msg });
            } else if (toggle === 'on') {
                currentGroupSettings.exemptAdmins = true;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption enabled*\n\nAdmins can now share videos freely.' 
                }, { quoted: msg });
            } else {
                const currentStatus = currentGroupSettings.exemptAdmins ? 'enabled' : 'disabled';
                await sock.sendMessage(chatId, { 
                    text: `⚙️ *Admin Exemption Status*\n\nCurrently: *${currentStatus}*\n\nTo change:\n\`.antivideo exemptadmins on\` - Enable\n\`.antivideo exemptadmins off\` - Disable` 
                }, { quoted: msg });
            }
            
            settings[groupIndex] = currentGroupSettings;
            saveAntiVideo(settings);
        }
        else if (subCommand === 'types') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Video is not enabled in this group.\nEnable it first with `.antivideo on [mode]`' 
                }, { quoted: msg });
            }

            const action = args[1]?.toLowerCase();
            
            if (action === 'add') {
                const typesToAdd = args.slice(2).map(t => t.toLowerCase()).filter(t => 
                    ['video', 'gif'].includes(t)
                );
                
                if (typesToAdd.length === 0) {
                    return sock.sendMessage(chatId, { 
                        text: '╭─⌈ 🎬 *ANTI-VIDEO TYPES* ⌋\n│\n├─⊷ *.antivideo types add video*\n│  └⊷ Regular videos\n├─⊷ *.antivideo types add gif*\n│  └⊷ GIFs/Animated images\n╰───' 
                    }, { quoted: msg });
                }
                
                const addedTypes = [];
                typesToAdd.forEach(type => {
                    if (!currentGroupSettings.videoTypes.includes(type)) {
                        currentGroupSettings.videoTypes.push(type);
                        addedTypes.push(type);
                    }
                });
                
                if (addedTypes.length > 0) {
                    settings[groupIndex] = currentGroupSettings;
                    saveAntiVideo(settings);
                    const typesDisplay = addedTypes.map(t => 
                        t === 'video' ? 'Regular videos' : 'GIFs'
                    );
                    await sock.sendMessage(chatId, { 
                        text: `✅ Added video types:\n${typesDisplay.map(t => `• ${t}`).join('\n')}\n\nNow blocking ${currentGroupSettings.videoTypes.length} video types.` 
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
                        text: '╭─⌈ 🎬 *ANTI-VIDEO TYPES REMOVE* ⌋\n│\n├─⊷ *.antivideo types remove [type]*\n│  └⊷ Remove video type\n╰───' 
                    }, { quoted: msg });
                }
                
                const removedTypes = [];
                typesToRemove.forEach(type => {
                    const index = currentGroupSettings.videoTypes.indexOf(type);
                    if (index > -1) {
                        currentGroupSettings.videoTypes.splice(index, 1);
                        removedTypes.push(type);
                    }
                });
                
                if (removedTypes.length > 0) {
                    settings[groupIndex] = currentGroupSettings;
                    saveAntiVideo(settings);
                    const typesDisplay = removedTypes.map(t => 
                        t === 'video' ? 'Regular videos' : 'GIFs'
                    );
                    await sock.sendMessage(chatId, { 
                        text: `✅ Removed video types:\n${typesDisplay.map(t => `• ${t}`).join('\n')}\n\nNow blocking ${currentGroupSettings.videoTypes.length} video types.` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '❌ None of the specified types were being blocked.' 
                    }, { quoted: msg });
                }
            }
            else if (action === 'list') {
                const currentTypes = currentGroupSettings.videoTypes || [];
                if (currentTypes.length === 0) {
                    await sock.sendMessage(chatId, { 
                        text: '📋 *Blocked Video Types*\n\nNo video types are currently blocked.\n\nAdd types with:\n`.antivideo types add [type]`' 
                    }, { quoted: msg });
                } else {
                    let listText = '📋 *Blocked Video Types*\n\n';
                    currentTypes.forEach((type, index) => {
                        const displayName = type === 'video' ? 'Regular videos' : 'GIFs';
                        listText += `${index + 1}. ${displayName}\n`;
                    });
                    listText += `\nTotal: ${currentTypes.length} types\n\nRemove types with:\n\`.antivideo types remove [type]\``;
                    await sock.sendMessage(chatId, { text: listText }, { quoted: msg });
                }
            }
            else {
                await sock.sendMessage(chatId, { 
                    text: '╭─⌈ 📋 *ANTI-VIDEO TYPES* ⌋\n│\n├─⊷ *.antivideo types add [type]*\n│  └⊷ Add video type\n├─⊷ *.antivideo types remove [type]*\n│  └⊷ Remove video type\n├─⊷ *.antivideo types list*\n│  └⊷ View blocked types\n╰───' 
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
                
                let statusText = `📊 *Anti-Video Status*\n\n`;
                statusText += `• Feature: ${status}\n`;
                statusText += `• Bot admin: ${botStatus}\n`;
                statusText += `• Bot superadmin: ${botSuperStatus}\n\n`;
                
                if (currentGroupSettings.enabled) {
                    const videoTypesCount = currentGroupSettings.videoTypes?.length || 0;
                    const videoTypesText = currentGroupSettings.videoTypes?.map(t => 
                        t === 'video' ? 'Regular videos' : 'GIFs'
                    ).join(', ') || 'None';
                    statusText += `• Blocked video types: ${videoTypesCount}\n`;
                    statusText += `• Types: ${videoTypesText}\n`;
                    statusText += `• Admins exempt: ${currentGroupSettings.exemptAdmins ? 'Yes' : 'No'}\n`;
                    
                    // Show warning counts if any
                    if (currentGroupSettings.warningCount && Object.keys(currentGroupSettings.warningCount).length > 0) {
                        statusText += `• Users warned: ${Object.keys(currentGroupSettings.warningCount).length}\n`;
                    }
                }
                
                statusText += `\n*Detection:*\n• Video files (MP4, etc.)\n• GIFs/Animated videos\n• Videos with captions`;
                
                await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `📊 *Anti-Video Status*\n\n❌ DISABLED\nEveryone can share videos.\n\n*To enable:*\n\`.antivideo on [mode]\`\n\nModes: warn, delete, kick\n\nExample: \`.antivideo on delete\`` 
                }, { quoted: msg });
            }
        }
        else {
            // Show help
            const helpText = `╭─⌈ 🎬 *ANTI-VIDEO* ⌋\n│\n├─⊷ *.antivideo on <warn|delete|kick>*\n│  └⊷ Enable with mode\n├─⊷ *.antivideo off*\n│  └⊷ Disable protection\n├─⊷ *.antivideo types [add/remove/list]*\n│  └⊷ Manage video types\n├─⊷ *.antivideo exemptadmins [on/off]*\n│  └⊷ Toggle admin exemption\n├─⊷ *.antivideo status*\n│  └⊷ View current status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        }
    }
};

function setupAntiVideoListener(sock) {
    console.log('🔧 Setting up anti-video listener for videos and GIFs...');
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const newMsg = messages[0];
        
        // Skip if no message or not a group message
        if (!newMsg || !newMsg.key.remoteJid?.endsWith('@g.us')) return;
        
        // Skip bot's own messages
        if (newMsg.key.fromMe) return;
        
        const chatId = newMsg.key.remoteJid;
        
        // Load current settings
        const settings = loadAntiVideo();
        const groupSettings = settings.find(g => g.chatId === chatId);
        
        // Skip if anti-video not enabled for this group
        if (!groupSettings || !groupSettings.enabled) return;
        
        // Check if message contains blocked video type
        const message = newMsg.message;
        let videoType = null;
        let isVideo = false;
        
        // Check for videos
        if (message?.videoMessage) {
            // Check if it's a GIF or regular video
            if (message.videoMessage.gifPlayback) {
                videoType = 'gif';
            } else {
                videoType = 'video';
            }
            isVideo = true;
        }
        
        // Skip if not video or video type not blocked
        if (!isVideo || !videoType || !groupSettings.videoTypes?.includes(videoType)) {
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
                console.log(`Skipping admin ${cleanMessageSender} for ${videoType} in ${chatId}`);
                return;
            }
            
            console.log(`${videoType.toUpperCase()} detected from ${cleanMessageSender} in ${chatId}`);
            
            // Initialize warning count for user if not exists
            if (!groupSettings.warningCount) {
                groupSettings.warningCount = {};
            }
            
            const userId = cleanMessageSender;
            if (!groupSettings.warningCount[userId]) {
                groupSettings.warningCount[userId] = 0;
            }
            
            // Video type names for display
            const videoTypeNames = {
                'video': 'Video',
                'gif': 'GIF'
            };
            
            const videoName = videoTypeNames[videoType] || videoType;
            
            // Handle based on mode
            switch (groupSettings.mode) {
                case 'warn':
                    groupSettings.warningCount[userId]++;
                    const warnings = groupSettings.warningCount[userId];
                    
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ *Video Warning* @${senderNumber}\n\n${videoName}s are not allowed in this group!\nWarning #${warnings}\n\nRepeated violations may result in stricter actions.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Update settings with warning count
                    const warnSettingsIndex = settings.findIndex(g => g.chatId === chatId);
                    if (warnSettingsIndex !== -1) {
                        settings[warnSettingsIndex] = groupSettings;
                        saveAntiVideo(settings);
                    }
                    break;
                    
                case 'delete':
                    // Send warning
                    await sock.sendMessage(chatId, { 
                        text: `🚫 *Video Deleted* @${senderNumber}\n\n${videoName}s are not allowed in this group!\nYour ${videoType} has been removed.`,
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
                        console.log(`Deleted ${videoType} from ${cleanMessageSender} in ${chatId}`);
                    } catch (deleteError) {
                        console.error('Failed to delete video:', deleteError);
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
                            text: `⚠️ *Cannot Kick*\n\nI need superadmin permissions to kick members.\n\nUser @${senderNumber} shared a ${videoType} but I cannot kick them.`,
                            mentions: [cleanMessageSender]
                        });
                        return;
                    }
                    
                    // Send warning before kick
                    await sock.sendMessage(chatId, { 
                        text: `🚫 *Violation Detected* @${senderNumber}\n\nSharing ${videoName}s is not allowed in this group!\nYou will be kicked for this violation.`,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Wait a moment then kick
                    setTimeout(async () => {
                        try {
                            await sock.groupParticipantsUpdate(chatId, [cleanMessageSender], 'remove');
                            await sock.sendMessage(chatId, { 
                                text: `👢 *User Kicked*\n\n@${senderNumber} was removed for sharing a ${videoName}.`
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
            console.error('Error handling video detection:', error);
        }
    });
    
    console.log('✅ Anti-video listener attached for videos and GIFs');
}