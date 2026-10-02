// commands/menus/resetmenuinfo.js
import { menuToggles, saveConfig } from "./menuToggles.js";

export default {
  name: "resetmenuinfo",
  description: "Reset all menu info toggles to default for all styles or a specific style.",
  alias: "rmi, resetmenu",
  category: "owner",
  ownerOnly: true,
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const { jidManager } = extra;
    const style = args[0] ? parseInt(args[0]) : null;
    
    // ====== OWNER CHECK ======
    if (!jidManager.isOwner(m)) {
      return sock.sendMessage(
        jid,
        { 
          text: `❌ *Owner Only Command!*\n\nOnly the bot owner can reset menu info settings.` 
        },
        { 
          quoted: m 
        }
      );
    }
    
    const senderJid = m.key.participant || jid;
    const cleaned = jidManager.cleanJid(senderJid);
    
    if (style) {
      // Reset specific style
      if (![5, 6, 7].includes(style)) {
        return sock.sendMessage(
          jid,
          { 
            text: `❌ Menu style ${style} does not support info toggles.\n\nOnly styles 5, 6, and 7 can be reset.` 
          },
          { 
            quoted: m 
          }
        );
      }
      
      const styleKey = `style${style}`;
      const defaultConfig = {
        style5: {
          user: true,
          owner: true,
          mode: true,
          host: true,
          speed: true,
          prefix: true,
          uptime: true,
          version: true,
          usage: true,
          ram: true,
          time: true,
          date: true,
          panel: true,
          cores: true,
          node: true,
          timezone: true,
          cputype: true
        },
        style6: {
          user: true,
          owner: true,
          mode: true,
          host: true,
          speed: true,
          prefix: true,
          uptime: true,
          version: true,
          usage: true,
          ram: true,
          time: true,
          date: true,
          panel: true,
          cores: true,
          node: true,
          timezone: true,
          cputype: true
        },
        style7: {
          user: true,
          owner: true,
          mode: true,
          host: true,
          speed: true,
          prefix: true,
          uptime: true,
          version: true,
          usage: true,
          ram: true,
          time: true,
          date: true,
          panel: true,
          cores: true,
          node: true,
          timezone: true,
          cputype: true
        }
      };
      
      menuToggles[styleKey] = defaultConfig[styleKey];
      saveConfig();
      
      let successMsg = `✅ *Menu Info Reset Complete*\n\n`;
      successMsg += `🎨 Menu Style: ${style}\n`;
      successMsg += `🔄 Status: All info sections reset to default\n`;
      successMsg += `📊 Fields: 17 info sections enabled\n\n`;
      successMsg += `✅ Time & Date: Enabled\n`;
      successMsg += `✅ Hardware Info: Enabled\n`;
      successMsg += `✅ Platform Info: Enabled\n`;
      
      if (cleaned.isLid) {
        successMsg += `\n📱 *Reset from linked device*`;
      }
      
      return sock.sendMessage(
        jid,
        { 
          text: successMsg 
        },
        { 
          quoted: m 
        }
      );
      
    } else {
      // Reset all styles
      const defaultConfig = {
        style5: {
          user: true,
          owner: true,
          mode: true,
          host: true,
          speed: true,
          prefix: true,
          uptime: true,
          version: true,
          usage: true,
          ram: true,
          time: true,
          date: true,
          panel: true,
          cores: true,
          node: true,
          timezone: true,
          cputype: true
        },
        style6: {
          user: true,
          owner: true,
          mode: true,
          host: true,
          speed: true,
          prefix: true,
          uptime: true,
          version: true,
          usage: true,
          ram: true,
          time: true,
          date: true,
          panel: true,
          cores: true,
          node: true,
          timezone: true,
          cputype: true
        },
        style7: {
          user: true,
          owner: true,
          mode: true,
          host: true,
          speed: true,
          prefix: true,
          uptime: true,
          version: true,
          usage: true,
          ram: true,
          time: true,
          date: true,
          panel: true,
          cores: true,
          node: true,
          timezone: true,
          cputype: true
        }
      };
      
      Object.assign(menuToggles, defaultConfig);
      saveConfig();
      
      let successMsg = `✅ *All Menu Info Reset Complete*\n\n`;
      successMsg += `🎨 Styles Reset: 5, 6, 7\n`;
      successMsg += `🔄 Status: All info sections reset to default\n`;
      successMsg += `📊 Total Fields: 51 info sections (17 per style)\n\n`;
      successMsg += `✅ All time & date fields enabled\n`;
      successMsg += `✅ All hardware info fields enabled\n`;
      successMsg += `✅ All platform info fields enabled\n`;
      
      if (cleaned.isLid) {
        successMsg += `\n📱 *Reset from linked device*`;
      }
      
      return sock.sendMessage(
        jid,
        { 
          text: successMsg 
        },
        { 
          quoted: m 
        }
      );
    }
  },
};