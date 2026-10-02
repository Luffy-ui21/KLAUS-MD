// case 5: {
//   // First, get the bot name BEFORE showing loading message
//   const getBotName = () => {
//     try {
//       const possiblePaths = [
//         './bot_settings.json',
//         path.join(__dirname, 'bot_settings.json'),
//         path.join(__dirname, '../bot_settings.json'),
//         path.join(__dirname, '../../bot_settings.json'),
//         path.join(__dirname, '../../../bot_settings.json'),
//         path.join(__dirname, '../commands/owner/bot_settings.json'),
//       ];
      
//       for (const settingsPath of possiblePaths) {
//         if (fs.existsSync(settingsPath)) {
//           try {
//             const settingsData = fs.readFileSync(settingsPath, 'utf8');
//             const settings = JSON.parse(settingsData);
            
//             if (settings.botName && settings.botName.trim() !== '') {
//               return settings.botName.trim();
//             }
//           } catch (parseError) {}
//         }
//       }
      
//       if (global.BOT_NAME) {
//         return global.BOT_NAME;
//       }
      
//       if (process.env.BOT_NAME) {
//         return process.env.BOT_NAME;
//       }
      
//     } catch (error) {}
    
//     return 'WOLFBOT';
//   };
  
//   // Get the current bot name
//   const currentBotName = getBotName();
  
//   // ========== CREATE FAKE CONTACT FUNCTION ==========
//   const createFakeContact = (message) => {
//     const jid = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
//     return {
//       key: {
//         remoteJid: "status@broadcast",
//         fromMe: false,
//         id: "WOLF-X"
//       },
//       message: {
//         contactMessage: {
//           displayName: "WOLF BOT",
//           vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:WOLF BOT\nitem1.TEL;waid=${jid}:${jid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
//         }
//       },
//       participant: "0@s.whatsapp.net"
//     };
//   };
  
//   // Create fake contact for quoted messages
//   const fkontak = createFakeContact(m);
  
//   // ========== SIMPLE LOADING MESSAGE ==========
//   const loadingMessage = `⚡ ${currentBotName} menu loading...`;
  
//   // Send loading message with fake contact
//   await sock.sendMessage(jid, { 
//     text: loadingMessage 
//   }, { 
//     quoted: fkontak 
//   });
  
//   // Add a small delay
//   await new Promise(resolve => setTimeout(resolve, 800));
  
//   // ========== REST OF YOUR EXISTING CODE ==========
//   // 📝 Full info + commands (with individual toggles)
//   let finalText = "";
  
//   // ========== ADD FADED TEXT HELPER FUNCTION ==========
//   const createFadedEffect = (text) => {
//     /**
//      * Creates WhatsApp's "faded/spoiler" text effect
//      * @param {string} text - Text to apply faded effect to
//      * @returns {string} Formatted text with faded effect
//      */
    
//     // WhatsApp needs a LOT of invisible characters for the fade effect
//     // Create a string with 800-1000 invisible characters
//     const invisibleChars = [
//       '\u200D', // ZERO WIDTH JOINER
//       '\u200C', // ZERO WIDTH NON-JOINER
//       '\u2060', // WORD JOINER
//       '\uFEFF', // ZERO WIDTH NO-BREAK SPACE
//       '\u200B', // ZERO WIDTH SPACE
//       '\u200E', // LEFT-TO-RIGHT MARK
//       '\u200F', // RIGHT-TO-LEFT MARK
//       '\u2061', // FUNCTION APPLICATION
//       '\u2062', // INVISIBLE TIMES
//       '\u2063', // INVISIBLE SEPARATOR
//       '\u2064', // INVISIBLE PLUS
//     ];
    
//     // Create a long string of invisible characters (900 chars)
//     let fadeString = '';
//     for (let i = 0; i < 900; i++) {
//       fadeString += invisibleChars[i % invisibleChars.length];
//     }
    
//     // Add some line breaks and more invisible chars for better effect
//     fadeString += '\n\u200B\u200B\u200B\u200B\u200B\u200B\u200B\u200B\n';
    
//     return `${fadeString}${text}`;
//   };
  
//   // ========== ADD "READ MORE" HELPER FUNCTION ==========
//   const createReadMoreEffect = (text1, text2) => {
//     /**
//      * Creates WhatsApp's "Read more" effect using invisible characters
//      * @param {string} text1 - First part (visible before "Read more")
//      * @param {string} text2 - Second part (hidden after "Read more")
//      * @returns {string} Formatted text with "Read more" effect
//      */
    
//     // WhatsApp needs MORE invisible characters to trigger "Read more"
//     // Use 500+ characters for better reliability
//     const invisibleChars = [
//       '\u200E',    // LEFT-TO-RIGHT MARK
//       '\u200F',    // RIGHT-TO-LEFT MARK
//       '\u200B',    // ZERO WIDTH SPACE
//       '\u200C',    // ZERO WIDTH NON-JOINER
//       '\u200D',    // ZERO WIDTH JOINER
//       '\u2060',    // WORD JOINER
//       '\uFEFF',    // ZERO WIDTH NO-BREAK SPACE
//     ];
    
//     // Create a LONG string of invisible characters (500-600 chars)
//     // WhatsApp needs enough to break the line detection
//     const invisibleString = Array.from({ length: 550 }, 
//       (_, i) => invisibleChars[i % invisibleChars.length]
//     ).join('');
    
//     // Add a newline after invisible characters for cleaner break
//     return `${text1}${invisibleString}\n${text2}`;
//   };
//   // ========== END OF HELPER FUNCTIONS ==========
  
//   // Helper functions (same as before)
//   const getBotMode = () => {
//     try {
//       const possiblePaths = [
//         './bot_mode.json',
//         path.join(__dirname, 'bot_mode.json'),
//         path.join(__dirname, '../bot_mode.json'),
//         path.join(__dirname, '../../bot_mode.json'),
//         path.join(__dirname, '../../../bot_mode.json'),
//         path.join(__dirname, '../commands/owner/bot_mode.json'),
//       ];
      
//       for (const modePath of possiblePaths) {
//         if (fs.existsSync(modePath)) {
//           try {
//             const modeData = JSON.parse(fs.readFileSync(modePath, 'utf8'));
            
//             if (modeData.mode) {
//               let displayMode;
//               switch(modeData.mode.toLowerCase()) {
//                 case 'public':
//                   displayMode = '🌍 Public';
//                   break;
//                 case 'silent':
//                   displayMode = '🔇 Silent';
//                   break;
//                 case 'private':
//                   displayMode = '🔒 Private';
//                   break;
//                 case 'group-only':
//                   displayMode = '👥 Group Only';
//                   break;
//                 case 'maintenance':
//                   displayMode = '🛠️ Maintenance';
//                   break;
//                 default:
//                   displayMode = `⚙️ ${modeData.mode.charAt(0).toUpperCase() + modeData.mode.slice(1)}`;
//               }
//               return displayMode;
//             }
//           } catch (parseError) {}
//         }
//       }
      
//       // Fallback to global variables
//       if (global.BOT_MODE) {
//         return global.BOT_MODE === 'silent' ? '🔇 Silent' : '🌍 Public';
//       }
//       if (global.mode) {
//         return global.mode === 'silent' ? '🔇 Silent' : '🌍 Public';
//       }
//       if (process.env.BOT_MODE) {
//         return process.env.BOT_MODE === 'silent' ? '🔇 Silent' : '🌍 Public';
//       }
      
//     } catch (error) {}
    
//     return '🌍 Public';
//   };
  
//   const getOwnerName = () => {
//     try {
//       const botSettingsPaths = [
//         './bot_settings.json',
//         path.join(__dirname, 'bot_settings.json'),
//         path.join(__dirname, '../bot_settings.json'),
//         path.join(__dirname, '../../bot_settings.json'),
//       ];
      
//       for (const settingsPath of botSettingsPaths) {
//         if (fs.existsSync(settingsPath)) {
//           try {
//             const settingsData = fs.readFileSync(settingsPath, 'utf8');
//             const settings = JSON.parse(settingsData);
            
//             if (settings.ownerName && settings.ownerName.trim() !== '') {
//               return settings.ownerName.trim();
//             }
//           } catch (parseError) {}
//         }
//       }
      
//       const ownerPath = path.join(__dirname, 'owner.json');
//       if (fs.existsSync(ownerPath)) {
//         const ownerData = fs.readFileSync(ownerPath, 'utf8');
//         const ownerInfo = JSON.parse(ownerData);
        
//         if (ownerInfo.owner && ownerInfo.owner.trim() !== '') {
//           return ownerInfo.owner.trim();
//         } else if (ownerInfo.number && ownerInfo.number.trim() !== '') {
//           return ownerInfo.number.trim();
//         } else if (ownerInfo.phone && ownerInfo.phone.trim() !== '') {
//           return ownerInfo.phone.trim();
//         } else if (ownerInfo.contact && ownerInfo.contact.trim() !== '') {
//           return ownerInfo.contact.trim();
//         } else if (Array.isArray(ownerInfo) && ownerInfo.length > 0) {
//           const owner = typeof ownerInfo[0] === 'string' ? ownerInfo[0] : "Unknown";
//           return owner;
//         }
//       }
      
//       if (global.OWNER_NAME) {
//         return global.OWNER_NAME;
//       }
//       if (global.owner) {
//         return global.owner;
//       }
//       if (process.env.OWNER_NUMBER) {
//         return process.env.OWNER_NUMBER;
//       }
      
//     } catch (error) {}
    
//     return 'Unknown';
//   };
  
//   const getBotPrefix = () => {
//     try {
//       const botSettingsPaths = [
//         './bot_settings.json',
//         path.join(__dirname, 'bot_settings.json'),
//         path.join(__dirname, '../bot_settings.json'),
//         path.join(__dirname, '../../bot_settings.json'),
//       ];
      
//       for (const settingsPath of botSettingsPaths) {
//         if (fs.existsSync(settingsPath)) {
//           try {
//             const settingsData = fs.readFileSync(settingsPath, 'utf8');
//             const settings = JSON.parse(settingsData);
            
//             if (settings.prefix && settings.prefix.trim() !== '') {
//               return settings.prefix.trim();
//             }
//           } catch (parseError) {}
//         }
//       }
      
//       if (global.prefix) {
//         return global.prefix;
//       }
      
//       if (process.env.PREFIX) {
//         return process.env.PREFIX;
//       }
      
//     } catch (error) {}
    
//     return '.';
//   };
  
//   const getBotVersion = () => {
//     try {
//       const ownerPath = path.join(__dirname, 'owner.json');
//       if (fs.existsSync(ownerPath)) {
//         const ownerData = fs.readFileSync(ownerPath, 'utf8');
//         const ownerInfo = JSON.parse(ownerData);
        
//         if (ownerInfo.version && ownerInfo.version.trim() !== '') {
//           return ownerInfo.version.trim();
//         }
//       }
      
//       const botSettingsPaths = [
//         './bot_settings.json',
//         path.join(__dirname, 'bot_settings.json'),
//         path.join(__dirname, '../bot_settings.json'),
//       ];
      
//       for (const settingsPath of botSettingsPaths) {
//         if (fs.existsSync(settingsPath)) {
//           try {
//             const settingsData = fs.readFileSync(settingsPath, 'utf8');
//             const settings = JSON.parse(settingsData);
            
//             if (settings.version && settings.version.trim() !== '') {
//               return settings.version.trim();
//             }
//           } catch (parseError) {}
//         }
//       }
      
//       if (global.VERSION) {
//         return global.VERSION;
//       }
      
//       if (global.version) {
//         return global.version;
//       }
      
//       if (process.env.VERSION) {
//         return process.env.VERSION;
//       }
      
//     } catch (error) {}
    
//     return 'v1.0.0';
//   };
  
//   const getDeploymentPlatform = () => {
//     // Detect deployment platform
//     if (process.env.REPL_ID || process.env.REPLIT_DB_URL) {
//       return {
//         name: 'Replit',
//         status: 'Active',
//         icon: '🌀'
//       };
//     } else if (process.env.HEROKU_APP_NAME) {
//       return {
//         name: 'Heroku',
//         status: 'Active',
//         icon: '🦸'
//       };
//     } else if (process.env.RENDER_SERVICE_ID) {
//       return {
//         name: 'Render',
//         status: 'Active',
//         icon: '⚡'
//       };
//     } else if (process.env.RAILWAY_ENVIRONMENT) {
//       return {
//         name: 'Railway',
//         status: 'Active',
//         icon: '🚂'
//       };
//     } else if (process.env.VERCEL) {
//       return {
//         name: 'Vercel',
//         status: 'Active',
//         icon: '▲'
//       };
//     } else if (process.env.GLITCH_PROJECT_REMIX) {
//       return {
//         name: 'Glitch',
//         status: 'Active',
//         icon: '🎏'
//       };
//     } else if (process.env.KOYEB) {
//       return {
//         name: 'Koyeb',
//         status: 'Active',
//         icon: '☁️'
//       };
//     } else if (process.env.CYCLIC_URL) {
//       return {
//         name: 'Cyclic',
//         status: 'Active',
//         icon: '🔄'
//       };
//     } else if (process.env.PANEL) {
//       return {
//         name: 'PteroPanel',
//         status: 'Active',
//         icon: '🖥️'
//       };
//     } else if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT) {
//       return {
//         name: 'VPS/SSH',
//         status: 'Active',
//         icon: '🖥️'
//       };
//     } else if (process.platform === 'win32') {
//       return {
//         name: 'Windows PC',
//         status: 'Active',
//         icon: '💻'
//       };
//     } else if (process.platform === 'linux') {
//       return {
//         name: 'Linux VPS',
//         status: 'Active',
//         icon: '🐧'
//       };
//     } else if (process.platform === 'darwin') {
//       return {
//         name: 'MacOS',
//         status: 'Active',
//         icon: '🍎'
//       };
//     } else {
//       return {
//         name: 'Local Machine',
//         status: 'Active',
//         icon: '🏠'
//       };
//     }
//   };
  
//   // Get current time and date
//   const now = new Date();
//   const currentTime = now.toLocaleTimeString('en-US', { 
//     hour12: true, 
//     hour: '2-digit', 
//     minute: '2-digit',
//     second: '2-digit'
//   });
  
//   const currentDate = now.toLocaleDateString('en-US', {
//     weekday: 'long',
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric'
//   });
  
//   // Load bot information using helper functions (botName already loaded above)
//   const ownerName = getOwnerName();
//   const botPrefix = getBotPrefix();
//   const botVersion = getBotVersion();
//   const botMode = getBotMode();
//   const deploymentPlatform = getDeploymentPlatform();
  
//   // ========== ADDED HELPER FUNCTIONS FOR SYSTEM METRICS ==========
//   const formatUptime = (seconds) => {
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secs = Math.floor(seconds % 60);
//     return `${hours}h ${minutes}m ${secs}s`;
//   };
  
//   const getRAMUsage = () => {
//     const used = process.memoryUsage().heapUsed / 1024 / 1024;
//     const total = os.totalmem() / 1024 / 1024 / 1024;
//     const percent = (used / (total * 1024)) * 100;
//     return Math.round(percent);
//   };
  
//   // ========== SIMPLIFIED MENU WITH FADED EFFECT ==========
//   let infoSection = `╭─⊷ *${currentBotName} MENU*
// │
// ├─⊷ *📊 BOT INFO*
// │  ├─⊷ *User:* ${m.pushName || "Anonymous"}
// │  ├─⊷ *Date:* ${currentDate}
// │  ├─⊷ *Time:* ${currentTime}
// │  ├─⊷ *Owner:* ${ownerName}
// │  ├─⊷ *Mode:* ${botMode}
// │  ├─⊷ *Prefix:* [ ${botPrefix} ]
// │  ├─⊷ *Version:* ${botVersion}
// │  ├─⊷ *Platform:* ${deploymentPlatform.name}
// │  └─⊷ *Status:* ${deploymentPlatform.status}
// │
// ├─⊷ *📈 SYSTEM STATUS*
// │  ├─⊷ *Uptime:* ${formatUptime(process.uptime())}
// │  ├─⊷ *RAM Usage:* ${getRAMUsage()}%
// │  └─⊷ *Speed:* ${(performance.now() - performance.now()).toFixed(2)}ms
// │
// ╰─⊷ *Type .help <command> for details*\n\n`;

//   // Apply faded effect to the info section with MORE invisible chars
//   const fadedInfoSection = createFadedEffect(infoSection);

//   // ========== MENU LIST WITH BOX STYLE AND DOTS ==========
//   const commandsText = `╭─⊷ *🏠 GROUP MANAGEMENT*
// │
// ├─⊷ *🛡️ ADMIN & MODERATION*
// │  • add
// │  • promote
// │  • demote
// │  • kick
// │  • kickall
// │  • ban
// │  • unban
// │  • banlist
// │  • clearbanlist
// │  • warn
// │  • resetwarn
// │  • setwarn
// │  • mute
// │  • unmute
// │  • gctime
// │  • antileave
// │  • antilink
// │  • welcome
// │
// ├─⊷ *🚫 AUTO-MODERATION*
// │  • antisticker
// │  • antilink
// │  • antiimage
// │  • antivideo
// │  • antiaudio
// │  • antimention
// │  • antistatusmention
// │  • antigrouplink
// │
// ├─⊷ *📊 GROUP INFO & TOOLS*
// │  • groupinfo
// │  • tagadmin
// │  • tagall
// │  • hidetag
// │  • link
// │  • invite
// │  • revoke
// │  • setdesc
// │  • fangtrace
// │  • getgpp
// │
// ╰─⊷

// ╭─⊷ *🎨 MENU COMMANDS*
// │
// │  • togglemenuinfo
// │  • setmenuimage
// │  • resetmenuinfo
// │  • menustyle
// │
// ╰─⊷

// ╭─⊷ *👑 OWNER CONTROLS*
// │
// ├─⊷ *⚡ CORE MANAGEMENT*
// │  • setbotname
// │  • setowner
// │  • setprefix
// │  • iamowner
// │  • about
// │  • block
// │  • unblock
// │  • blockdetect
// │  • silent
// │  • anticall
// │  • mode
// │  • online
// │  • setpp
// │  • repo
// │
// ├─⊷ *🔄 SYSTEM & MAINTENANCE*
// │  • restart
// │  • workingreload
// │  • reloadenv
// │  • getsettings
// │  • setsetting
// │  • test
// │  • disk
// │  • hostip
// │  • findcommands
// │
// ╰─⊷

// ╭─⊷ *⚙️ AUTOMATION*
// │
// │  • autoread
// │  • autotyping
// │  • autorecording
// │  • autoreact
// │  • autoreactstatus
// │  • autobio
// │  • autorec
// │
// ╰─⊷

// ╭─⊷ *✨ GENERAL UTILITIES*
// │
// ├─⊷ *🔍 INFO & SEARCH*
// │  • alive
// │  • ping
// │  • ping2
// │  • time
// │  • connection
// │  • define
// │  • news
// │  • covid
// │  • iplookup
// │  • getip
// │  • getpp
// │  • getgpp
// │  • prefixinfo
// │
// ├─⊷ *🔗 CONVERSION & MEDIA*
// │  • shorturl
// │  • qrencode
// │  • take
// │  • imgbb
// │  • save
// │
// ├─⊷ *📝 PERSONAL TOOLS*
// │  • pair
// │  • resetwarn
// │  • setwarn
// │
// ╰─⊷

// ╭─⊷ *🎵 MUSIC & MEDIA*
// │
// │  • play
// │  • song
// │  • lyrics
// │  • spotify
// │  • video
// │  • video2
// │  • bassboost
// │  • trebleboost
// │
// ╰─⊷

// ╭─⊷ *🤖 MEDIA & AI COMMANDS*
// │
// ├─⊷ *⬇️ MEDIA DOWNLOADS*
// │  • youtube
// │  • instagram
// │  • facebook
// │  • snapchat
// │  • apk
// │
// ├─⊷ *🎨 AI GENERATION*
// │  • gpt
// │  • gemini
// │  • deepseek
// │  • deepseek+
// │  • analyze
// │  • suno
// │  • wolfbot
// │  • videogen
// │
// ╰─⊷

// ╭─⊷ *🖼️ IMAGE TOOLS*
// │
// │  • image
// │  • imagegenerate
// │  • anime
// │  • art
// │  • real
// │
// ╰─⊷

// ╭─⊷ *🛡️ SECURITY & HACKING*
// │
// ├─⊷ *🌐 NETWORK & INFO*
// │  • ipinfo
// │  • shodan
// │  • iplookup
// │  • getip
// │
// ╰─⊷

// ╭─⊷ *🎨 LOGO DESIGN STUDIO*
// │
// ├─⊷ *🌟 PREMIUM METALS*
// │  • goldlogo
// │  • silverlogo
// │  • platinumlogo
// │  • chromelogo
// │  • diamondlogo
// │  • bronzelogo
// │  • steelogo
// │  • copperlogo
// │  • titaniumlogo
// │
// ├─⊷ *🔥 ELEMENTAL EFFECTS*
// │  • firelogo
// │  • icelogo
// │  • iceglowlogo
// │  • lightninglogo
// │  • aqualogo
// │  • rainbowlogo
// │  • sunlogo
// │  • moonlogo
// │
// ├─⊷ *🎭 MYTHICAL & MAGICAL*
// │  • dragonlogo
// │  • phoenixlogo
// │  • wizardlogo
// │  • crystallogo
// │  • darkmagiclogo
// │
// ├─⊷ *🌌 DARK & GOTHIC*
// │  • shadowlogo
// │  • smokelogo
// │  • bloodlogo
// │
// ├─⊷ *💫 GLOW & NEON EFFECTS*
// │  • neonlogo
// │  • glowlogo
// │
// ├─⊷ *🤖 TECH & FUTURISTIC*
// │  • matrixlogo
// │
// ╰─⊷

// ╭─⊷ *🐙 GITHUB COMMANDS*
// │
// │  • gitclone
// │  • repo
// │  • commits
// │  • stars
// │  • watchers
// │  • release
// │
// ╰─⊷

// ╭─⊷ *🌸 ANIME COMMANDS*
// │
// │  • awoo
// │  • bj
// │  • bully
// │  • cringe
// │  • cry
// │  • dance
// │  • glomp
// │  • highfive
// │  • kill
// │  • kiss
// │  • lick
// │  • megumin
// │  • neko
// │  • pat
// │  • shinobu
// │  • trap
// │  • trap2
// │  • waifu
// │  • wink
// │  • yeet
// │
// ╰─⊷

// ${getFooter(m.key.participant || m.key.remoteJid)}`;

//   // ========== APPLY "READ MORE" EFFECT ==========
//   // Combine faded info section (visible) and commands (hidden) with "Read more"
//   finalText = createReadMoreEffect(fadedInfoSection, commandsText);
//   // ========== END "READ MORE" EFFECT ==========

//   // Send the menu with fake contact
//   await sock.sendMessage(jid, { 
//     text: finalText 
//   }, { 
//     quoted: fkontak 
//   });
  
//   console.log(`✅ ${currentBotName} menu sent with faded effect and dot style`);
//   break;
// }