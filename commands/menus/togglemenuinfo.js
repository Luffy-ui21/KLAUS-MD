

// // commands/menus/togglemenuinfo.js
// import { menuToggles, toggleField, getCurrentMenuStyle, getAllFieldsStatus } from "./menuToggles.js";

// export default {
//   name: "togglemenuinfo",
//   description: "Toggle info sections (user, owner, uptime, etc.) for menu styles 5, 6, and 7.",
//   alias: "tmi, togglemenu",
//   category: "owner", // Changed from "settings" to "owner"
//   ownerOnly: true, // Added owner restriction
  
//   async execute(sock, m, args, PREFIX, extra) {
//     const jid = m.key.remoteJid;
//     const { jidManager } = extra;
//     const field = args[0]?.toLowerCase();

//     // ====== OWNER CHECK ======
//     const isOwner = jidManager.isOwner(m);
//     const isFromMe = m.key.fromMe;
//     const senderJid = m.key.participant || jid;
//     const cleaned = jidManager.cleanJid(senderJid);
    
//     if (!isOwner) {
//       // Detailed error message in REPLY format
//       let errorMsg = `❌ *Owner Only Command!*\n\n`;
//       errorMsg += `Only the bot owner can toggle menu info sections.\n\n`;
//       errorMsg += `🔍 *Debug Info:*\n`;
//       errorMsg += `├─ Your JID: ${cleaned.cleanJid}\n`;
//       errorMsg += `├─ Your Number: ${cleaned.cleanNumber || 'N/A'}\n`;
//       errorMsg += `├─ Type: ${cleaned.isLid ? 'LID 🔗' : 'Regular 📱'}\n`;
//       errorMsg += `├─ From Me: ${isFromMe ? '✅ YES' : '❌ NO'}\n`;
      
//       // Get owner info
//       const ownerInfo = jidManager.getOwnerInfo ? jidManager.getOwnerInfo() : {};
//       errorMsg += `└─ Owner Number: ${ownerInfo.cleanNumber || 'Not set'}\n\n`;
      
//       if (cleaned.isLid && isFromMe) {
//         errorMsg += `⚠️ *Issue Detected:*\n`;
//         errorMsg += `You're using a linked device (LID).\n`;
//         errorMsg += `Try using ${PREFIX}fixowner or ${PREFIX}forceownerlid\n`;
//       } else if (!ownerInfo.cleanNumber) {
//         errorMsg += `⚠️ *Issue Detected:*\n`;
//         errorMsg += `Owner not set in jidManager!\n`;
//         errorMsg += `Try using ${PREFIX}debugchat fix\n`;
//       }
      
//       return sock.sendMessage(jid, { 
//         text: errorMsg 
//       }, { 
//         quoted: m // Reply format
//       });
//     }

//     // Get the CURRENT menu style dynamically
//     const currentMenuStyle = await getCurrentMenuStyle();
    
//     console.log(` [TOGGLEMENUINFO] Owner ${cleaned.cleanNumber} toggling menu style ${currentMenuStyle}`);

//     // Check if the current menu is toggleable (5, 6, or 7)
//     if (![5, 6, 7].includes(currentMenuStyle)) {
//       await sock.sendMessage(
//         jid,
//         { 
//           text: `❌ Current menu style (${currentMenuStyle}) does not support info toggles.\n\nOnly menu styles 5, 6, and 7 can be customized.\n\nSwitch to a compatible menu style first using *${PREFIX}menustyle*, then use this command.` 
//         },
//         { 
//           quoted: m // Reply format
//         }
//       );
//       return;
//     }

//     if (!field) {
//       // Show all toggles for the current menu
//       const fieldsStatus = getAllFieldsStatus(currentMenuStyle);
//       if (!fieldsStatus) {
//         await sock.sendMessage(
//           jid,
//           { 
//             text: `❌ No configuration found for menu style ${currentMenuStyle}.` 
//           },
//           { 
//             quoted: m // Reply format
//           }
//         );
//         return;
//       }

//       const fields = Object.entries(fieldsStatus)
//         .map(([key, value]) => `> ${value ? "✅" : "❌"} ${key}`)
//         .join("\n");
      
//       let ownerNote = "";
//       if (cleaned.isLid) {
//         ownerNote = `\n📱 *Owner:* Using linked device`;
//       }
      
//       await sock.sendMessage(
//         jid,
//         { 
//           text: ` *Menu Style ${currentMenuStyle} Info Toggles*\n\n*Current Status:*\n${fields}\n\n*Usage:* ${PREFIX}togglemenuinfo <field>\n\n*Available fields:* user, owner, mode, host, speed, prefix, uptime, version, usage, ram${ownerNote}` 
//         },
//         { 
//           quoted: m // Reply format
//         }
//       );
//       return;
//     }

//     // Toggle the field
//     const result = toggleField(currentMenuStyle, field);
    
//     // Enhanced success message
//     let successMsg = `✅ *Menu Toggle Updated*\n\n`;
//     successMsg += `🎨 Menu Style: ${currentMenuStyle}\n`;
//     successMsg += `⚙️ Field: ${field}\n`;
//     successMsg += `📊 Status: ${result.includes('enabled') ? '✅ Enabled' : '❌ Disabled'}\n\n`;
//     successMsg += `🔧 Changes applied to menu style ${currentMenuStyle}.`;
    
//     if (cleaned.isLid) {
//       successMsg += `\n📱 *Changed from linked device*`;
//     }
    
//     await sock.sendMessage(
//       jid, 
//       { 
//         text: successMsg 
//       }, 
//       { 
//         quoted: m // Reply format
//       }
//     );
//   },
// };



























// commands/menus/togglemenuinfo.js
import { menuToggles, toggleField, getCurrentMenuStyle, getAllFieldsStatus } from "./menuToggles.js";

export default {
  name: "togglemenuinfo",
  description: "Toggle info sections (user, owner, uptime, etc.) for menu styles 5, 6, and 7.",
  alias: "tmi, togglemenu",
  category: "owner",
  ownerOnly: true,
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const { jidManager } = extra;
    const field = args[0]?.toLowerCase();

    // ====== OWNER CHECK ======
    const isOwner = jidManager.isOwner(m);
    const isFromMe = m.key.fromMe;
    const senderJid = m.key.participant || jid;
    const cleaned = jidManager.cleanJid(senderJid);
    
    if (!isOwner) {
      let errorMsg = `❌ *Owner Only Command!*\n\n`;
      errorMsg += `Only the bot owner can toggle menu info sections.\n\n`;
      errorMsg += `🔍 *Debug Info:*\n`;
      errorMsg += `├─ Your JID: ${cleaned.cleanJid}\n`;
      errorMsg += `├─ Your Number: ${cleaned.cleanNumber || 'N/A'}\n`;
      errorMsg += `├─ Type: ${cleaned.isLid ? 'LID 🔗' : 'Regular 📱'}\n`;
      errorMsg += `├─ From Me: ${isFromMe ? '✅ YES' : '❌ NO'}\n`;
      
      const ownerInfo = jidManager.getOwnerInfo ? jidManager.getOwnerInfo() : {};
      errorMsg += `└─ Owner Number: ${ownerInfo.cleanNumber || 'Not set'}\n\n`;
      
      if (cleaned.isLid && isFromMe) {
        errorMsg += `⚠️ *Issue Detected:*\n`;
        errorMsg += `You're using a linked device (LID).\n`;
        errorMsg += `Try using \`${PREFIX}fixowner\` or \`${PREFIX}forceownerlid\`\n`;
      } else if (!ownerInfo.cleanNumber) {
        errorMsg += `⚠️ *Issue Detected:*\n`;
        errorMsg += `Owner not set in jidManager!\n`;
        errorMsg += `Try using \`${PREFIX}debugchat fix\`\n`;
      }
      
      return sock.sendMessage(jid, { 
        text: errorMsg 
      }, { 
        quoted: m
      });
    }

    // Get the CURRENT menu style dynamically
    const currentMenuStyle = await getCurrentMenuStyle();
    
    console.log(` [TOGGLEMENUINFO] Owner ${cleaned.cleanNumber} toggling menu style ${currentMenuStyle}`);

    // Check if the current menu is toggleable (5, 6, or 7)
    if (![5, 6, 7].includes(currentMenuStyle)) {
      await sock.sendMessage(
        jid,
        { 
          text: `❌ Current menu style (${currentMenuStyle}) does not support info toggles.\n\nOnly menu styles 5, 6, and 7 can be customized.\n\nSwitch to a compatible menu style first using \`${PREFIX}menustyle\`, then use this command.` 
        },
        { 
          quoted: m
        }
      );
      return;
    }

    if (!field) {
      // Show all toggles for the current menu
      const fieldsStatus = getAllFieldsStatus(currentMenuStyle);
      if (!fieldsStatus) {
        await sock.sendMessage(
          jid,
          { 
            text: `❌ No configuration found for menu style ${currentMenuStyle}.` 
          },
          { 
            quoted: m
          }
        );
        return;
      }

      // Organize fields into categories for better display
      const basicFields = [
        { key: 'user', label: '👤 User' },
        { key: 'owner', label: '👑 Owner' },
        { key: 'mode', label: '🎛️ Mode' },
        { key: 'prefix', label: '💬 Prefix' },
        { key: 'version', label: '📦 Version' }
      ];
      
      const timeFields = [
        { key: 'time', label: '🕐 Time' },
        { key: 'date', label: '📅 Date' },
        { key: 'timezone', label: '🌐 Timezone' }
      ];
      
      const performanceFields = [
        { key: 'speed', label: '⚡ Speed' },
        { key: 'uptime', label: '⏰ Uptime' },
        { key: 'usage', label: '💾 Usage' },
        { key: 'ram', label: '🎚️ RAM' }
      ];
      
    
      const platformFields = [
        { key: 'host', label: '🏠 Host' },
        { key: 'panel', label: '🌀 Panel' }
      ];
      
      const formatFieldList = (fieldList) => {
        return fieldList.map(({ key, label }) => {
          const status = fieldsStatus[key] ? "✅" : "❌";
          return `> ${status} ${label} (${key})`;
        }).join("\n");
      };
      
      let toggleList = `* Menu Style ${currentMenuStyle} Info Toggles*\n\n`;
      toggleList += `*👤 Basic Info:*\n${formatFieldList(basicFields)}\n\n`;
      toggleList += `*📅 Time & Date:*\n${formatFieldList(timeFields)}\n\n`;
      toggleList += `*⚡ Performance:*\n${formatFieldList(performanceFields)}\n\n`;
      toggleList += `*🌐 Platform:*\n${formatFieldList(platformFields)}`;
      
      let ownerNote = "";
      if (cleaned.isLid) {
        ownerNote = `\n\n📱 *Owner:* Using linked device`;
      }
      
      await sock.sendMessage(
        jid,
        { 
          text: `${toggleList}\n\n*Usage:* \`${PREFIX}togglemenuinfo <field>\`\n\n*Example:* \`${PREFIX}togglemenuinfo time\`\n${ownerNote}` 
        },
        { 
          quoted: m
        }
      );
      return;
    }

    // Toggle the field
    const result = toggleField(currentMenuStyle, field);
    
    // Map field keys to human-readable labels
    const fieldLabels = {
      user: '👤 User',
      owner: '👑 Owner',
      mode: '🎛️ Mode',
      host: '🏠 Host',
      speed: '⚡ Speed',
      prefix: '💬 Prefix',
      uptime: '⏰ Uptime',
      version: '📦 Version',
      usage: '💾 Usage',
      ram: '🎚️ RAM',
      time: '🕐 Time',
      date: '📅 Date',
      panel: '🌀 Panel',
      cores: '🚀 Cores',
      node: '🟢 Node',
      timezone: '🌐 Timezone',
      cputype: '🔧 CPU Type'
    };
    
    const fieldLabel = fieldLabels[field] || field;
    
    let successMsg = `✅ *Menu Toggle Updated*\n\n`;
    successMsg += `🎨 Menu Style: ${currentMenuStyle}\n`;
    successMsg += `📊 Section: ${fieldLabel}\n`;
    successMsg += `⚙️ Status: ${result.includes('enabled') ? '✅ Now Showing' : '❌ Now Hidden'}\n\n`;
    successMsg += `🔧 Changes applied to menu style ${currentMenuStyle}.`;
    
    if (cleaned.isLid) {
      successMsg += `\n📱 *Changed from linked device*`;
    }
    
    await sock.sendMessage(
      jid, 
      { 
        text: successMsg 
      }, 
      { 
        quoted: m
      }
    );
  },
};