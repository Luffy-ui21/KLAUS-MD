// export default {
//   name: 'add',
//   description: 'Add a member to the group',
//   category: 'group',

//   async execute(sock, msg, args, metadata) {
//     const groupId = msg.key.remoteJid;
//     const isGroup = groupId.endsWith('@g.us');
//     const senderId = msg.key.participant;
//     const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

//     if (!isGroup) {
//       return await sock.sendMessage(groupId, { text: '❌ This command can only be used in packs(Groups).' }, { quoted: msg });
//     }

//     const participants = metadata?.participants || [];

//     const isUserAdmin = participants.find(p => p.id === senderId)?.admin !== null;
//     const isBotAdmin = participants.find(p => p.id === botNumber)?.admin !== null;

//     if (!isUserAdmin) {
//       return await sock.sendMessage(groupId, { text: '🛑 Only Alphas can use this command.' }, { quoted: msg });
//     }

//     if (!isBotAdmin) {
//       return await sock.sendMessage(groupId, { text: '⚠️ I must be an Alpha (admin) to add members.' }, { quoted: msg });
//     }

//     if (!args[0]) {
//       return await sock.sendMessage(groupId, {
//         text: '⚠️ Please provide a phone number to add.\nExample: *.add 2547xxxxxxxx*'
//       }, { quoted: msg });
//     }

//     const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

//     try {
//       await sock.groupParticipantsUpdate(groupId, [number], 'add');
//       await sock.sendMessage(groupId, {
//         text: `✅ Member @${args[0]} added successfully!`,
//         mentions: [number]
//       }, { quoted: msg });
//     } catch (error) {
//       console.error('Add Error:', error);
//       await sock.sendMessage(groupId, {
//         text: '❌ Failed to add member. They may have privacy settings enabled or you may have reached the group limit.',
//       }, { quoted: msg });
//     }
//   }
// };










import fs from 'fs';
import { getBotName } from '../../lib/botname.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION - CHANGE THESE VALUES!
// ============================================

const GROUP_LINK = 'https://chat.whatsapp.com/G3RopQF1UcSD7AeoVsd6PG';
const GROUP_INVITE_CODE = GROUP_LINK.split('/').pop();
const GROUP_NAME = 'Wolf Bot'; // Optional: Your group name

// Auto-join settings
const AUTO_JOIN_ENABLED = true; // Set to false to disable auto-join
const AUTO_JOIN_DELAY = 5000; // 5 seconds delay before auto-join
const SEND_WELCOME_MESSAGE = true; // Send welcome message to new users

// ============================================
// AUTO JOIN SYSTEM
// ============================================

// Track invited users to avoid spamming
const invitedUsers = new Set();
const AUTO_JOIN_LOG_FILE = path.join(process.cwd(), 'auto_join_log.json');

class AutoGroupJoinSystem {
  constructor() {
    this.initialized = false;
    this.ownerData = null;
    this.loadInvitedUsers();
    this.loadOwnerData();
  }

  // Load previously invited users
  loadInvitedUsers() {
    try {
      if (fs.existsSync(AUTO_JOIN_LOG_FILE)) {
        const data = JSON.parse(fs.readFileSync(AUTO_JOIN_LOG_FILE, 'utf8'));
        data.users.forEach(user => invitedUsers.add(user));
        console.log(`📊 Loaded ${invitedUsers.size} previously invited users`);
      }
    } catch (error) {
      console.error('Error loading auto-join log:', error);
    }
  }

  // Save invited user to log
  saveInvitedUser(userJid) {
    try {
      invitedUsers.add(userJid);
      
      let data = { 
        users: [], 
        lastUpdated: new Date().toISOString(),
        totalInvites: 0
      };
      
      if (fs.existsSync(AUTO_JOIN_LOG_FILE)) {
        data = JSON.parse(fs.readFileSync(AUTO_JOIN_LOG_FILE, 'utf8'));
      }
      
      if (!data.users.includes(userJid)) {
        data.users.push(userJid);
        data.totalInvites = data.users.length;
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(AUTO_JOIN_LOG_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Saved invited user: ${userJid}`);
      }
    } catch (error) {
      console.error('Error saving invited user:', error);
    }
  }

  // Load owner data from owner.json
  loadOwnerData() {
    try {
      const ownerPath = path.join(process.cwd(), 'owner.json');
      if (!fs.existsSync(ownerPath)) {
        console.warn('⚠️ owner.json not found. Auto-join may not work correctly.');
        this.ownerData = {
          OWNER_JID: '254703397679@s.whatsapp.net',
          OWNER_NUMBER: '254703397679'
        };
        return;
      }
      
      this.ownerData = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
      console.log(`👑 Owner data loaded: ${this.ownerData.OWNER_NUMBER}`);
      
    } catch (error) {
      console.error('❌ Error loading owner.json:', error);
      this.ownerData = {
        OWNER_JID: '254703397679@s.whatsapp.net',
        OWNER_NUMBER: '254703397679'
      };
    }
  }

  // Check if user is the bot owner
  isOwner(userJid) {
    if (!this.ownerData) return false;
    return userJid === this.ownerData.OWNER_JID || 
           userJid.includes(this.ownerData.OWNER_NUMBER);
  }

  // Send welcome message to user
  async sendWelcomeMessage(sock, userJid) {
    if (!SEND_WELCOME_MESSAGE) return;
    
    try {
      await sock.sendMessage(userJid, {
        text: `🎉 *WELCOME TO ${getBotName()}!*\n\n` +
              `Thank you for connecting with ${getBotName()}! 🤖\n\n` +
              `✨ *Features Available:*\n` +
              `• Multiple command categories\n` +
              `• Group management tools\n` +
              `• Media downloading\n` +
              `• And much more!\n\n` +
              `You're being automatically invited to join our official community group...\n` +
              `Please wait a moment... ⏳`
      });
    } catch (error) {
      console.error('Could not send welcome message:', error.message);
    }
  }

  // Send group invitation
  async sendGroupInvitation(sock, userJid, isOwner = false) {
    try {
      const message = isOwner 
        ? `👑 *OWNER AUTO-JOIN*\n\n` +
          `You are being automatically added to the group...\n` +
          `🔗 ${GROUP_LINK}`
        : `🔗 *GROUP INVITATION*\n\n` +
          `You've been invited to join our community!\n\n` +
          `*Group Name:* ${GROUP_NAME}\n` +
          `*Features:*\n` +
          `• Bot support & updates\n` +
          `• Community chat\n` +
          `• Exclusive features\n\n` +
          `Click to join: ${GROUP_LINK}`;
      
      await sock.sendMessage(userJid, { text: message });
      return true;
    } catch (error) {
      console.error('Could not send group invitation:', error.message);
      return false;
    }
  }

  // Attempt to auto-add user to group
  async attemptAutoAdd(sock, userJid, isOwner = false) {
    try {
      console.log(`🔄 Attempting to auto-add ${isOwner ? 'owner' : 'user'} ${userJid} to group...`);
      
      // Try to get group info first
      let groupId;
      try {
        groupId = await sock.groupAcceptInvite(GROUP_INVITE_CODE);
        console.log(`✅ Successfully accessed group: ${groupId}`);
      } catch (inviteError) {
        console.log(`⚠️ Could not accept invite, trying direct add: ${inviteError.message}`);
        
        // If we can't accept invite, try to add directly if we know the group ID
        // You might need to hardcode your group ID here if you know it
        // Example: groupId = "1234567890-1234567890@g.us"
        throw new Error('Could not access group with invite code');
      }
      
      // Add user to the group
      await sock.groupParticipantsUpdate(groupId, [userJid], 'add');
      console.log(`✅ Successfully added ${userJid} to group`);
      
      // Send success message
      const successMessage = isOwner
        ? `✅ *SUCCESSFULLY JOINED!*\n\n` +
          `You have been automatically added to the group!\n` +
          `The bot is now fully operational there. 🎉`
        : `✅ *WELCOME TO THE GROUP!*\n\n` +
          `You have been successfully added to ${GROUP_NAME}!\n` +
          `Please introduce yourself when you join. 👋`;
      
      await sock.sendMessage(userJid, { text: successMessage });
      
      // Update owner.json if owner
      if (isOwner && this.ownerData) {
        try {
          const ownerPath = path.join(process.cwd(), 'owner.json');
          this.ownerData.lastAutoJoin = new Date().toISOString();
          this.ownerData.autoJoinedGroup = groupId;
          fs.writeFileSync(ownerPath, JSON.stringify(this.ownerData, null, 2));
        } catch (updateError) {
          console.error('Could not update owner.json:', updateError);
        }
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ Auto-add failed for ${userJid}:`, error.message);
      
      // Send manual join instructions
      const manualMessage = isOwner
        ? `⚠️ *MANUAL JOIN REQUIRED*\n\n` +
          `Could not auto-add you to the group.\n\n` +
          `*Please join manually:*\n` +
          `${GROUP_LINK}\n\n` +
          `Once joined, the bot will work there immediately.`
        : `⚠️ *MANUAL JOIN REQUIRED*\n\n` +
          `Could not auto-add you to the group.\n\n` +
          `*Please join manually:*\n` +
          `${GROUP_LINK}\n\n` +
          `We'd love to have you in our community!`;
      
      await sock.sendMessage(userJid, { text: manualMessage });
      
      return false;
    }
  }

  // Main auto-join function - call this when someone links
  async autoJoinGroup(sock, userJid) {
    if (!AUTO_JOIN_ENABLED) {
      console.log('Auto-join is disabled in settings');
      return false;
    }
    
    // Don't spam users who've already been invited
    if (invitedUsers.has(userJid)) {
      console.log(`User ${userJid} already invited, skipping`);
      return false;
    }
    
    const isOwner = this.isOwner(userJid);
    console.log(`${isOwner ? '👑 Owner' : '👤 User'} ${userJid} connected, initiating auto-join...`);
    
    // Send welcome message
    await this.sendWelcomeMessage(sock, userJid);
    
    // Wait before proceeding
    await new Promise(resolve => setTimeout(resolve, AUTO_JOIN_DELAY));
    
    // Send group invitation
    await this.sendGroupInvitation(sock, userJid, isOwner);
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Attempt to auto-add
    const success = await this.attemptAutoAdd(sock, userJid, isOwner);
    
    // Save to invited users
    this.saveInvitedUser(userJid);
    
    return success;
  }

  // Run auto-join on bot startup
  async startupAutoJoin(sock) {
    if (!AUTO_JOIN_ENABLED || !this.ownerData) return;
    
    try {
      console.log('🚀 Running startup auto-join check...');
      
      const ownerJid = this.ownerData.OWNER_JID;
      
      // Check if owner already auto-joined
      if (this.ownerData.autoJoinedGroup) {
        console.log('👑 Owner already auto-joined previously');
        return;
      }
      
      console.log(`👑 Attempting to auto-join owner ${ownerJid} to group...`);
      
      // Wait for bot to be fully ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Auto-join owner
      const success = await this.autoJoinGroup(sock, ownerJid);
      
      if (success) {
        console.log('✅ Startup auto-join completed successfully');
      } else {
        console.log('⚠️ Startup auto-join failed');
      }
      
    } catch (error) {
      console.error('Startup auto-join error:', error);
    }
  }
}

// ============================================
// ADD COMMAND WITH AUTO-JOIN FEATURES
// ============================================

export default {
  name: 'add',
  description: 'Add members to group or automatically add owner via group link',
  category: 'group',
  
  async execute(sock, msg, args, metadata) {
    const groupId = msg.key.remoteJid;
    const isGroup = groupId.endsWith('@g.us');
    const senderId = msg.key.participant || msg.key.remoteJid;
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Initialize auto-join system
    const autoJoinSystem = new AutoGroupJoinSystem();
    
    if (!isGroup) {
      return await sock.sendMessage(groupId, { 
        text: '❌ This command can only be used in groups.' 
      }, { quoted: msg });
    }
    
    // Load owner data
    const ownerData = autoJoinSystem.ownerData;
    const ownerJid = ownerData?.OWNER_JID || '254703397679@s.whatsapp.net';
    const ownerNumber = ownerData?.OWNER_NUMBER || '254703397679';
    
    const participants = metadata?.participants || [];
    const isUserAdmin = participants.find(p => p.id === senderId)?.admin !== null;
    const isBotAdmin = participants.find(p => p.id === botNumber)?.admin !== null;
    
    if (!isUserAdmin) {
      return await sock.sendMessage(groupId, { 
        text: '🛑 Only admins can use this command.' 
      }, { quoted: msg });
    }
    
    if (!isBotAdmin) {
      return await sock.sendMessage(groupId, { 
        text: '⚠️ I must be an admin to add members.' 
      }, { quoted: msg });
    }
    
    // If no arguments, show help
    // if (!args[0]) {
    //   const helpText = `📋 *ADD COMMAND*\n\n` +
    //     `*Usage:*\n` +
    //     `• .add 2547xxxxxxxx - Add by phone number\n` +
    //     `• .add owner - Add bot owner to this group\n` +
    //     `• .add link - Get group invite link\n` +
    //     `• .add autojoin - Auto-join system info\n\n` +
    //     `*Owner:* @${ownerNumber}\n` +
    //     `*Auto-Join:* ${AUTO_JOIN_ENABLED ? '✅ Enabled' : '❌ Disabled'}\n` +
    //     `*Group Link:* ${GROUP_LINK}`;
      
    //   return await sock.sendMessage(groupId, {
    //     text: helpText,
    //     mentions: [ownerJid]
    //   }, { quoted: msg });
    // }

       if (!args[0]) {
      const prefix = '.'; // Change this to your bot's prefix
      return await sock.sendMessage(groupId, {
        text: `╭─⌈ 📋 *ADD* ⌋\n│\n├─⊷ *${prefix}add 2547xxxxxxxx*\n│  └⊷ Add single number\n├─⊷ *${prefix}add 254xxx,254yyy,254zzz*\n│  └⊷ Add multiple numbers\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
      }, { quoted: msg });
    }
    
    const command = args[0].toLowerCase();
    
    // Handle "owner" command
    if (command === 'owner') {
      try {
        await sock.sendMessage(groupId, { 
          text: `👑 Adding bot owner @${ownerNumber}...` 
        }, { quoted: msg });
        
        await sock.groupParticipantsUpdate(groupId, [ownerJid], 'add');
        
        await sock.sendMessage(groupId, { 
          text: `✅ Successfully added bot owner @${ownerNumber}!\n\n` +
                `*Owner will also be auto-joined to the main group.*`,
          mentions: [ownerJid]
        }, { quoted: msg });
        
        // Also trigger auto-join to main group
        setTimeout(async () => {
          await autoJoinSystem.autoJoinGroup(sock, ownerJid);
        }, 3000);
        
      } catch (error) {
        console.error('Add owner error:', error);
        await sock.sendMessage(groupId, { 
          text: `❌ Failed to add owner: ${error.message.substring(0, 100)}`,
          mentions: [ownerJid]
        }, { quoted: msg });
      }
      return;
    }
    
    // Handle "link" command
    if (command === 'link') {
      return await sock.sendMessage(groupId, {
        text: `🔗 *GROUP INVITE LINK*\n\n` +
              `${GROUP_LINK}\n\n` +
              `*Features:*\n` +
              `• Auto-join on connection: ${AUTO_JOIN_ENABLED ? '✅ Yes' : '❌ No'}\n` +
              `• Group Name: ${GROUP_NAME}\n` +
              `• Owner: @${ownerNumber}`
      }, { quoted: msg });
    }
    
    // Handle "autojoin" command
    if (command === 'autojoin' || command === 'autoadd') {
      const stats = invitedUsers.size;
      const status = AUTO_JOIN_ENABLED ? '✅ ACTIVE' : '❌ DISABLED';
      
      return await sock.sendMessage(groupId, {
        text: `⚡ *AUTO-JOIN SYSTEM*\n\n` +
              `*Status:* ${status}\n` +
              `*Users Invited:* ${stats}\n` +
              `*Group:* ${GROUP_NAME}\n` +
              `*Delay:* ${AUTO_JOIN_DELAY/1000} seconds\n\n` +
              `*How it works:*\n` +
              `1. User links with bot\n` +
              `2. Bot sends welcome message\n` +
              `3. Bot sends group invite\n` +
              `4. Bot attempts auto-add\n` +
              `5. Manual link sent if fails\n\n` +
              `🔗 ${GROUP_LINK}`
      }, { quoted: msg });
    }
    
    // Handle phone number addition
    let numbersToAdd = [];
    
    if (args[0].includes(',') || args.length > 1) {
      const allArgs = args.join(' ').split(',');
      numbersToAdd = allArgs.map(num => {
        const cleanNum = num.trim().replace(/[^0-9]/g, '');
        if (cleanNum.length >= 10) {
          return cleanNum + '@s.whatsapp.net';
        }
        return null;
      }).filter(num => num !== null);
    } else {
      const cleanNumber = args[0].replace(/[^0-9]/g, '');
      if (cleanNumber.length < 10) {
        return await sock.sendMessage(groupId, {
          text: '❌ Invalid phone number format.\nExample: .add 254712345678'
        }, { quoted: msg });
      }
      numbersToAdd = [cleanNumber + '@s.whatsapp.net'];
    }
    
    if (numbersToAdd.length === 0) {
      return await sock.sendMessage(groupId, {
        text: '❌ No valid phone numbers provided.\nExample: .add 254712345678'
      }, { quoted: msg });
    }
    
    try {
      const groupMetadata = await sock.groupMetadata(groupId);
      const currentSize = groupMetadata.participants.length;
      const remainingSlots = 1024 - currentSize;
      
      if (numbersToAdd.length > remainingSlots) {
        return await sock.sendMessage(groupId, {
          text: `❌ Cannot add ${numbersToAdd.length} members.\n` +
                `Group has ${currentSize}/1024 members.\n` +
                `Only ${remainingSlots} slots remaining.`
        }, { quoted: msg });
      }
      
      const batchSize = 5;
      const addedSuccessfully = [];
      const failedToAdd = [];
      
      for (let i = 0; i < numbersToAdd.length; i += batchSize) {
        const batch = numbersToAdd.slice(i, i + batchSize);
        
        try {
          await sock.groupParticipantsUpdate(groupId, batch, 'add');
          addedSuccessfully.push(...batch);
          
          if (i + batchSize < numbersToAdd.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (batchError) {
          console.log('Batch add error:', batchError.message);
          batch.forEach(number => {
            failedToAdd.push({
              number: number.split('@')[0],
              error: batchError.message.substring(0, 50)
            });
          });
        }
      }
      
      let resultMessage = '';
      if (addedSuccessfully.length > 0) {
        resultMessage += `✅ *Added Successfully:*\n`;
        addedSuccessfully.forEach(num => {
          resultMessage += `@${num.split('@')[0]}\n`;
        });
        resultMessage += '\n';
      }
      
      if (failedToAdd.length > 0) {
        resultMessage += `❌ *Failed to Add:*\n`;
        failedToAdd.forEach(f => {
          resultMessage += `@${f.number} (${f.error})\n`;
        });
      }
      
      const mentions = [
        ...addedSuccessfully,
        ...failedToAdd.map(f => `${f.number}@s.whatsapp.net`)
      ];
      
      await sock.sendMessage(groupId, {
        text: resultMessage || 'No results to display.',
        mentions
      }, { quoted: msg });
      
    } catch (error) {
      console.error('Add Error:', error);
      await sock.sendMessage(groupId, { 
        text: `❌ Failed: ${error.message.substring(0, 100)}` 
      }, { quoted: msg });
    }
  }
};

// ============================================
// CONNECTION HANDLER FOR AUTO-JOIN
// ============================================

// Export a connection handler to use in your main bot file
export const connectionHandler = {
  event: 'connection.update',
  
  async execute(update, sock) {
    const { connection } = update;
    
    if (connection === 'open') {
      console.log('✅ WhatsApp connection opened');
      
      // Initialize auto-join system
      const autoJoinSystem = new AutoGroupJoinSystem();
      
      if (sock.user && sock.user.id) {
        const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        console.log(`🤖 Bot connected for user: ${userJid}`);
        
        // Wait for everything to initialize
        setTimeout(async () => {
          if (AUTO_JOIN_ENABLED) {
            console.log(`🚀 Starting auto-join process for ${userJid}`);
            await autoJoinSystem.autoJoinGroup(sock, userJid);
          } else {
            console.log('Auto-join is disabled in settings');
          }
        }, 10000); // 10 second delay
      }
    }
  }
};

// ============================================
// STARTUP FUNCTION TO CALL FROM MAIN BOT FILE
// ============================================

export async function initializeAutoJoin(sock) {
  console.log('⚡ Initializing Auto-Join System...');
  
  const autoJoinSystem = new AutoGroupJoinSystem();
  
  // Run startup auto-join
  await autoJoinSystem.startupAutoJoin(sock);
  
  // Register connection handler
  sock.ev.on('connection.update', async (update) => {
    await connectionHandler.execute(update, sock);
  });
  
  console.log('✅ Auto-Join System initialized successfully');
  return autoJoinSystem;
}

// ============================================
// USAGE INSTRUCTIONS
// ============================================

/*
HOW TO USE THIS AUTO-JOIN SYSTEM:

1. SAVE THIS FILE as 'add.js' in your commands folder

2. UPDATE THESE VALUES at the top of the file:
   - GROUP_LINK: Your WhatsApp group link
   - GROUP_NAME: Your group name (optional)
   - AUTO_JOIN_ENABLED: Set to true/false
   - AUTO_JOIN_DELAY: Delay in milliseconds

3. IN YOUR MAIN BOT FILE (index.js/bot.js), add:

   import { initializeAutoJoin } from './commands/add.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
   
   // After initializing sock/baileys
   sock.ev.on('connection.update', async (update) => {
     const { connection } = update;
     
     if (connection === 'open') {
       console.log('Bot is ready!');
       
       // Initialize auto-join system
       await initializeAutoJoin(sock);
     }
   });

4. COMMANDS AVAILABLE:
   - .add owner - Add bot owner to current group
   - .add link - Get group invite link
   - .add autojoin - Show auto-join system info
   - .add 2547xxxxxxx - Add user by phone number

5. AUTO-JOIN FLOW:
   When someone links with the bot:
   1. Bot sends welcome message
   2. Waits 5 seconds
   3. Sends group invitation
   4. Attempts to auto-add to group
   5. Sends manual link if auto-add fails

6. REQUIRED FILES:
   - owner.json in root directory with your WhatsApp info
*/