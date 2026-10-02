import fs from 'fs';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const antiGroupLinkFile = './antigrouplink.json';

// Ensure JSON file exists
if (!fs.existsSync(antiGroupLinkFile)) {
    fs.writeFileSync(antiGroupLinkFile, JSON.stringify([], null, 2));
}

// Load settings
function loadAntiGroupLink() {
    try {
        if (!fs.existsSync(antiGroupLinkFile)) return [];
        const data = fs.readFileSync(antiGroupLinkFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading anti-group-link settings:', error);
        return [];
    }
}

// Save settings
function saveAntiGroupLink(data) {
    try {
        fs.writeFileSync(antiGroupLinkFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving anti-group-link settings:', error);
    }
}

// Utility function to clean JID
function cleanJid(jid) {
    if (!jid) return jid;
    // Remove device suffix and ensure proper format
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

// Extract all WhatsApp group links from text
function extractWhatsAppGroupLinks(text) {
    const links = [];
    if (!text || typeof text !== 'string') return links;
    
    // Clean the text
    const cleanText = text.replace(/[*_~`|]/g, '');
    
    // WhatsApp group link patterns
    const groupLinkPatterns = [
        /(https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9_-]{22}/gi,  // Standard 22 char invite
        /(https?:\/\/)?chat\.whatsapp\.com\/invite\/[A-Za-z0-9_-]+/gi,  // Invite links
        /(https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}/gi,  // Any whatsapp.com link
        /whatsapp\.com\/chat\/[A-Za-z0-9_-]+/gi,  // Alternative format
        /whatsapp\.com\/group\/[A-Za-z0-9_-]+/gi,  // Group format
        /whatsapp\.com\/invite\/[A-Za-z0-9_-]+/gi,  // Invite format
    ];
    
    // Find all matches
    groupLinkPatterns.forEach(pattern => {
        pattern.lastIndex = 0;
        const matches = cleanText.match(pattern);
        if (matches) {
            matches.forEach(link => {
                let cleanLink = link.trim();
                // Ensure proper URL format
                if (!cleanLink.startsWith('http')) {
                    cleanLink = 'https://' + cleanLink;
                }
                // Standardize format
                cleanLink = cleanLink.replace('whatsapp.com', 'chat.whatsapp.com');
                // Remove trailing punctuation
                cleanLink = cleanLink.replace(/[.,;:!?]+$/, '');
                
                if (!links.includes(cleanLink)) {
                    links.push(cleanLink);
                }
            });
        }
    });
    
    return links;
}

// Extract invite code from WhatsApp group link
function extractInviteCode(link) {
    if (!link) return null;
    
    // Extract the invite code part
    const match = link.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

// Check if a link is the current group's link
async function isCurrentGroupLink(sock, chatId, link) {
    try {
        // Get current group's invite link
        const inviteCode = await sock.groupInviteCode(chatId);
        const currentGroupLink = `https://chat.whatsapp.com/${inviteCode}`;
        
        // Extract invite codes for comparison
        const linkInviteCode = extractInviteCode(link);
        const currentInviteCode = extractInviteCode(currentGroupLink);
        
        // Compare invite codes
        return linkInviteCode === currentInviteCode;
    } catch (error) {
        console.error('Error checking group link:', error);
        return false;
    }
}

// Check if message contains WhatsApp group links
function containsWhatsAppGroupLinks(text) {
    if (!text || typeof text !== 'string') return false;
    
    // Clean the text
    const cleanText = text.replace(/[*_~`|]/g, '');
    
    // Check for WhatsApp group links
    const groupLinkRegex = /(?:https?:\/\/)?(?:chat\.|www\.)?whatsapp\.com\/(?:chat|group|invite)\/[A-Za-z0-9_-]+|chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}/gi;
    
    return groupLinkRegex.test(cleanText);
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
let antiGroupLinkListenerAttached = false;

export default {
    name: 'antigrouplink',
    description: 'Block other WhatsApp group links, allow only this group link',
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

        const settings = loadAntiGroupLink();
        const groupIndex = settings.findIndex(g => g.chatId === chatId);
        const currentGroupSettings = groupIndex !== -1 ? settings[groupIndex] : null;

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'on') {
            const mode = args[1]?.toLowerCase();
            
            if (!mode || !['warn', 'delete', 'kick'].includes(mode)) {
                return sock.sendMessage(chatId, { 
                    text: '╭─⌈ ⚙️ *ANTI-GROUP-LINK SETUP* ⌋\n│\n├─⊷ *.antigrouplink on warn*\n│  └⊷ Warn senders\n├─⊷ *.antigrouplink on delete*\n│  └⊷ Auto-delete links\n├─⊷ *.antigrouplink on kick*\n│  └⊷ Kick senders\n╰───' 
                }, { quoted: msg });
            }

            // Get current group's invite link
            let currentGroupLink = '';
            try {
                const inviteCode = await sock.groupInviteCode(chatId);
                currentGroupLink = `https://chat.whatsapp.com/${inviteCode}`;
            } catch (error) {
                console.error('Error getting group invite code:', error);
                return sock.sendMessage(chatId, { 
                    text: '❌ Failed to get this group\'s invite link. Make sure I have admin permissions to generate invite links.' 
                }, { quoted: msg });
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
                currentGroupLink: currentGroupLink,
                allowedLinks: [currentGroupLink], // Only current group link is allowed
                exemptAdmins: true,
                warningCount: {}, // Track warnings per user
                violations: {} // Track violations
            };

            if (groupIndex !== -1) {
                settings[groupIndex] = newSettings;
            } else {
                settings.push(newSettings);
            }

            saveAntiGroupLink(settings);
            
            // Attach listener if not already attached
            if (!antiGroupLinkListenerAttached) {
                setupAntiGroupLinkListener(sock);
                antiGroupLinkListenerAttached = true;
            }

            const modeDescriptions = {
                'warn': 'Users will receive warnings for sharing other group links',
                'delete': 'Other group links will be deleted automatically',
                'kick': 'Users will be kicked for sharing other group links'
            };

            await sock.sendMessage(chatId, { 
                text: `✅ *Anti-Group-Link enabled!*\n\nMode: *${mode.toUpperCase()}*\n${modeDescriptions[mode]}\n\n✅ *Allowed:* This group link only\n❌ *Blocked:* All other WhatsApp group links\n\nAdmins are exempt from this rule.\n\nTo disable: \`.antigrouplink off\`` 
            }, { quoted: msg });

        } 
        else if (subCommand === 'off') {
            if (groupIndex !== -1) {
                settings.splice(groupIndex, 1);
                saveAntiGroupLink(settings);
                await sock.sendMessage(chatId, { 
                    text: '❌ *Anti-Group-Link disabled!*\n\nUsers can now share other group links.' 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'ℹ️ Anti-Group-Link is already disabled in this group.' 
                }, { quoted: msg });
            }
        } 
        else if (subCommand === 'exemptadmins') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Group-Link is not enabled in this group.\nEnable it first with `.antigrouplink on [mode]`' 
                }, { quoted: msg });
            }

            const toggle = args[1]?.toLowerCase();
            if (toggle === 'off') {
                currentGroupSettings.exemptAdmins = false;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption disabled*\n\nAdmins will now be subject to anti-group-link rules.' 
                }, { quoted: msg });
            } else if (toggle === 'on') {
                currentGroupSettings.exemptAdmins = true;
                await sock.sendMessage(chatId, { 
                    text: '⚙️ *Admin exemption enabled*\n\nAdmins can now share group links freely.' 
                }, { quoted: msg });
            } else {
                const currentStatus = currentGroupSettings.exemptAdmins ? 'enabled' : 'disabled';
                await sock.sendMessage(chatId, { 
                    text: `⚙️ *Admin Exemption Status*\n\nCurrently: *${currentStatus}*\n\nTo change:\n\`.antigrouplink exemptadmins on\` - Enable\n\`.antigrouplink exemptadmins off\` - Disable` 
                }, { quoted: msg });
            }
            
            settings[groupIndex] = currentGroupSettings;
            saveAntiGroupLink(settings);
        }
        else if (subCommand === 'status') {
            if (currentGroupSettings) {
                const status = currentGroupSettings.enabled ? 
                    `✅ ENABLED (${currentGroupSettings.mode.toUpperCase()} mode)` : 
                    '❌ DISABLED';
                
                const botStatus = botIsAdmin ? '✅ I am admin' : '❌ I am NOT admin';
                const botSuperStatus = botIsSuperAdmin ? '✅ I am superadmin' : '❌ I am NOT superadmin';
                
                let statusText = `📊 *Anti-Group-Link Status*\n\n`;
                statusText += `• Feature: ${status}\n`;
                statusText += `• Bot admin: ${botStatus}\n`;
                statusText += `• Bot superadmin: ${botSuperStatus}\n\n`;
                
                if (currentGroupSettings.enabled) {
                    statusText += `• Mode: ${currentGroupSettings.mode.toUpperCase()}\n`;
                    statusText += `• Allowed links: 1 (this group only)\n`;
                    statusText += `• Admins exempt: ${currentGroupSettings.exemptAdmins ? 'Yes' : 'No'}\n`;
                    
                    // Show warning counts if any
                    if (currentGroupSettings.warningCount && Object.keys(currentGroupSettings.warningCount).length > 0) {
                        statusText += `• Users warned: ${Object.keys(currentGroupSettings.warningCount).length}\n`;
                    }
                    
                    // Show violation counts if any
                    if (currentGroupSettings.violations && Object.keys(currentGroupSettings.violations).length > 0) {
                        statusText += `• Total violations: ${Object.keys(currentGroupSettings.violations).length}\n`;
                    }
                }
                
                statusText += `\n*What is allowed:*\n• This group's invite link only\n\n*What is blocked:*\n• All other WhatsApp group links\n• Any chat.whatsapp.com links\n• Group promotion links`;
                
                await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `📊 *Anti-Group-Link Status*\n\n❌ DISABLED\nUsers can share any group links.\n\n*To enable:*\n\`.antigrouplink on [mode]\`\n\nModes: warn, delete, kick\n\nExample: \`.antigrouplink on delete\`` 
                }, { quoted: msg });
            }
        }
        else if (subCommand === 'getlink') {
            // Get and display current group's link
            try {
                const inviteCode = await sock.groupInviteCode(chatId);
                const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
                
                await sock.sendMessage(chatId, { 
                    text: `🔗 *This Group\'s Invite Link*\n\n\`${groupLink}\`\n\n*Note:*\n• This is the ONLY allowed group link\n• Other group links will be blocked\n• Share this to invite people to this group` 
                }, { quoted: msg });
            } catch (error) {
                console.error('Error getting group invite code:', error);
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to get group invite link. Make sure I have admin permissions to generate invite links.' 
                }, { quoted: msg });
            }
        }
        else if (subCommand === 'resetlink') {
            if (!currentGroupSettings || !currentGroupSettings.enabled) {
                return sock.sendMessage(chatId, { 
                    text: '❌ Anti-Group-Link is not enabled in this group.' 
                }, { quoted: msg });
            }

            // Reset group invite link
            try {
                await sock.groupRevokeInvite(chatId);
                const newInviteCode = await sock.groupInviteCode(chatId);
                const newGroupLink = `https://chat.whatsapp.com/${newInviteCode}`;
                
                // Update settings with new link
                currentGroupSettings.currentGroupLink = newGroupLink;
                currentGroupSettings.allowedLinks = [newGroupLink];
                
                settings[groupIndex] = currentGroupSettings;
                saveAntiGroupLink(settings);
                
                await sock.sendMessage(chatId, { 
                    text: `🔄 *Group Link Reset*\n\n✅ New invite link generated:\n\`${newGroupLink}\`\n\nAll previous invite links are now invalid.\n\n*Note:*\n• Only this new link is allowed\n• Old links will now be blocked` 
                }, { quoted: msg });
            } catch (error) {
                console.error('Error resetting group invite:', error);
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to reset group invite link. Make sure I have admin permissions.' 
                }, { quoted: msg });
            }
        }
        else if (subCommand === 'test') {
            // Test detection on provided text or quoted message
            let testText = '';
            
            if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                testText = extractMessageText(quotedMsg);
            }
            
            if (!testText && args.length > 1) {
                testText = args.slice(1).join(' ');
            }
            
            if (!testText) {
                testText = "Join my other group: https://chat.whatsapp.com/ABC123DEF456GHI789JKL";
            }
            
            const hasGroupLinks = containsWhatsAppGroupLinks(testText);
            const extractedLinks = extractWhatsAppGroupLinks(testText);
            
            let testResult = `🔍 *Group Link Detection Test*\n\n`;
            testResult += `Test text: ${testText}\n\n`;
            testResult += `Contains WhatsApp group links: ${hasGroupLinks ? '✅ Yes' : '❌ No'}\n`;
            
            if (hasGroupLinks) {
                testResult += `Found ${extractedLinks.length} group link(s):\n`;
                extractedLinks.forEach((link, i) => {
                    testResult += `${i + 1}. \`${link}\`\n`;
                });
                
                // Check if current group link is stored
                if (currentGroupSettings?.currentGroupLink) {
                    testResult += `\n*Current Group Link:*\n\`${currentGroupSettings.currentGroupLink}\`\n`;
                    
                    // Test if links would be allowed
                    testResult += `\n*Would be allowed:*\n`;
                    extractedLinks.forEach((link, i) => {
                        const isCurrent = link === currentGroupSettings.currentGroupLink;
                        testResult += `${i + 1}. ${isCurrent ? '✅ ALLOWED' : '❌ BLOCKED'}\n`;
                    });
                }
            }
            
            await sock.sendMessage(chatId, { text: testResult }, { quoted: msg });
        }
        else if (subCommand === 'check') {
            // Check a specific link
            const linkToCheck = args.slice(1).join(' ');
            
            if (!linkToCheck) {
                return sock.sendMessage(chatId, { 
                    text: '╭─⌈ 🔍 *ANTI-GROUP-LINK CHECK* ⌋\n│\n├─⊷ *.antigrouplink check [link]*\n│  └⊷ Check a group link\n╰───' 
                }, { quoted: msg });
            }
            
            if (!containsWhatsAppGroupLinks(linkToCheck)) {
                return sock.sendMessage(chatId, { 
                    text: `❌ Not a WhatsApp group link:\n\`${linkToCheck}\`\n\nThis feature only checks WhatsApp group links (chat.whatsapp.com).` 
                }, { quoted: msg });
            }
            
            const extractedLinks = extractWhatsAppGroupLinks(linkToCheck);
            const link = extractedLinks[0];
            
            let checkResult = `🔍 *Link Check*\n\n`;
            checkResult += `Link: \`${link}\`\n\n`;
            
            if (currentGroupSettings?.enabled) {
                const isAllowed = currentGroupSettings.allowedLinks?.includes(link);
                
                checkResult += `*Status:* ${isAllowed ? '✅ ALLOWED' : '❌ BLOCKED'}\n`;
                checkResult += `*Reason:* ${isAllowed ? 'This group\'s link' : 'Other group link'}\n\n`;
                
                if (!isAllowed && currentGroupSettings.currentGroupLink) {
                    checkResult += `*Current Group Link:*\n\`${currentGroupSettings.currentGroupLink}\`\n`;
                    checkResult += `\nOnly the current group link is allowed.`;
                }
            } else {
                checkResult += `*Status:* ℹ️ Anti-Group-Link is disabled\n`;
                checkResult += `This link would be allowed if the feature was enabled.`;
            }
            
            await sock.sendMessage(chatId, { text: checkResult }, { quoted: msg });
        }
        else {
            // Show help
            const helpText = `╭─⌈ 🚫 *ANTI-GROUP-LINK* ⌋\n│\n├─⊷ *.antigrouplink on <warn|delete|kick>*\n│  └⊷ Enable with mode\n├─⊷ *.antigrouplink off*\n│  └⊷ Disable protection\n├─⊷ *.antigrouplink getlink*\n│  └⊷ Show invite link\n├─⊷ *.antigrouplink resetlink*\n│  └⊷ Reset invite link\n├─⊷ *.antigrouplink exemptadmins [on/off]*\n│  └⊷ Toggle admin exemption\n├─⊷ *.antigrouplink status*\n│  └⊷ View current status\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        }
    }
};

function setupAntiGroupLinkListener(sock) {
    console.log('🔧 Setting up anti-group-link listener...');
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const newMsg = messages[0];
        
        // Skip if no message or not a group message
        if (!newMsg || !newMsg.key.remoteJid?.endsWith('@g.us')) return;
        
        // Skip bot's own messages
        if (newMsg.key.fromMe) return;
        
        const chatId = newMsg.key.remoteJid;
        
        // Load current settings
        const settings = loadAntiGroupLink();
        const groupSettings = settings.find(g => g.chatId === chatId);
        
        // Skip if anti-group-link not enabled for this group
        if (!groupSettings || !groupSettings.enabled) return;
        
        // Get message content
        const message = newMsg.message;
        const messageText = extractMessageText(message);
        
        if (!messageText) return;
        
        // Check if message contains WhatsApp group links
        const hasGroupLinks = containsWhatsAppGroupLinks(messageText);
        
        if (!hasGroupLinks) return;
        
        // Extract all WhatsApp group links from the message
        const extractedLinks = extractWhatsAppGroupLinks(messageText);
        
        if (extractedLinks.length === 0) return;
        
        // Check which links are allowed (only current group link)
        const blockedLinks = [];
        const allowedLinks = [];
        
        extractedLinks.forEach(link => {
            if (groupSettings.allowedLinks?.includes(link)) {
                allowedLinks.push(link);
            } else {
                blockedLinks.push(link);
            }
        });
        
        // If no blocked links, return (all links are allowed)
        if (blockedLinks.length === 0) return;
        
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
                console.log(`Skipping admin ${cleanMessageSender} for group links in ${chatId}`);
                return;
            }
            
            console.log(`Blocked group links detected from ${cleanMessageSender} in ${chatId}: ${blockedLinks.join(', ')}`);
            
            // Track violation
            if (!groupSettings.violations) {
                groupSettings.violations = {};
            }
            
            if (!groupSettings.violations[cleanMessageSender]) {
                groupSettings.violations[cleanMessageSender] = {
                    count: 0,
                    lastLinks: [],
                    timestamps: []
                };
            }
            
            groupSettings.violations[cleanMessageSender].count++;
            groupSettings.violations[cleanMessageSender].lastLinks = blockedLinks;
            groupSettings.violations[cleanMessageSender].timestamps.push(new Date().toISOString());
            
            // Initialize warning count for user if not exists
            if (!groupSettings.warningCount) {
                groupSettings.warningCount = {};
            }
            
            const userId = cleanMessageSender;
            if (!groupSettings.warningCount[userId]) {
                groupSettings.warningCount[userId] = 0;
            }
            
            // Handle based on mode
            switch (groupSettings.mode) {
                case 'warn':
                    groupSettings.warningCount[userId]++;
                    const warnings = groupSettings.warningCount[userId];
                    
                    let warningMessage = `⚠️ *Group Link Warning* @${senderNumber}\n\n`;
                    warningMessage += `Sharing other WhatsApp group links is not allowed!\n`;
                    warningMessage += `Warning #${warnings}\n\n`;
                    
                    warningMessage += `❌ *Blocked links found:*\n`;
                    blockedLinks.forEach((link, i) => {
                        warningMessage += `${i + 1}. \`${link}\`\n`;
                    });
                    
                    if (allowedLinks.length > 0) {
                        warningMessage += `\n✅ *Allowed link:*\n`;
                        warningMessage += `\`${groupSettings.currentGroupLink}\`\n`;
                    }
                    
                    warningMessage += `\n*Allowed:* This group link only\n`;
                    warningMessage += `*Blocked:* All other group links\n\n`;
                    warningMessage += `Repeated violations may result in stricter actions.`;
                    
                    await sock.sendMessage(chatId, { 
                        text: warningMessage,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Update settings
                    const warnIndex = settings.findIndex(g => g.chatId === chatId);
                    if (warnIndex !== -1) {
                        settings[warnIndex] = groupSettings;
                        saveAntiGroupLink(settings);
                    }
                    break;
                    
                case 'delete':
                    // Send warning
                    let deleteMessage = `🚫 *Group Link Violation* @${senderNumber}\n\n`;
                    deleteMessage += `Sharing other WhatsApp group links is prohibited!\n\n`;
                    
                    deleteMessage += `❌ *Blocked links removed:*\n`;
                    blockedLinks.forEach((link, i) => {
                        deleteMessage += `${i + 1}. \`${link}\`\n`;
                    });
                    
                    deleteMessage += `\n✅ *Only this group link is allowed:*\n`;
                    deleteMessage += `\`${groupSettings.currentGroupLink}\`\n\n`;
                    deleteMessage += `This message has been deleted.`;
                    
                    await sock.sendMessage(chatId, { 
                        text: deleteMessage,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Delete the message with group links
                    try {
                        await sock.sendMessage(chatId, { 
                            delete: {
                                id: newMsg.key.id,
                                participant: messageSender,
                                remoteJid: chatId,
                                fromMe: false
                            }
                        });
                        console.log(`Deleted message with group links from ${cleanMessageSender} in ${chatId}`);
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
                            text: `⚠️ *Cannot Kick*\n\nI need superadmin permissions to kick members.\n\nUser @${senderNumber} shared other group links but I cannot kick them.`,
                            mentions: [cleanMessageSender]
                        });
                        return;
                    }
                    
                    // Check violation count
                    const violationCount = groupSettings.violations[cleanMessageSender]?.count || 1;
                    
                    let kickMessage = `🚫 *Final Warning* @${senderNumber}\n\n`;
                    kickMessage += `Sharing other group links is strictly prohibited!\n`;
                    kickMessage += `Violation #${violationCount}\n\n`;
                    
                    kickMessage += `❌ *Blocked links found:*\n`;
                    blockedLinks.forEach((link, i) => {
                        kickMessage += `${i + 1}. \`${link}\`\n`;
                    });
                    
                    kickMessage += `\n✅ *Only allowed link:*\n`;
                    kickMessage += `\`${groupSettings.currentGroupLink}\`\n\n`;
                    kickMessage += `You will be removed from this group.`;
                    
                    await sock.sendMessage(chatId, { 
                        text: kickMessage,
                        mentions: [cleanMessageSender]
                    });
                    
                    // Wait then kick (immediate kick for sharing other group links)
                    setTimeout(async () => {
                        try {
                            await sock.groupParticipantsUpdate(chatId, [cleanMessageSender], 'remove');
                            await sock.sendMessage(chatId, { 
                                text: `👢 *User Removed*\n\n@${senderNumber} was kicked for sharing other WhatsApp group links.\n\nReason: Promoting other groups (${blockedLinks.length} links found)`
                            });
                        } catch (kickError) {
                            console.error('Failed to kick user:', kickError);
                            await sock.sendMessage(chatId, { 
                                text: `❌ *Failed to remove user*\n\nCould not remove @${senderNumber}. Please check my permissions.`,
                                mentions: [cleanMessageSender]
                            });
                        }
                    }, 3000);
                    break;
            }
            
        } catch (error) {
            console.error('Error handling group link detection:', error);
        }
    });
    
    console.log('✅ Anti-group-link listener attached (blocking other WhatsApp group links)');
}