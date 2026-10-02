// commands/logo/brandlogo.js
import fetch from "node-fetch";
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: "brandlogo",
  alias: ["fetchlogo", "companylogo", "branding"],
  desc: "Fetch real company logos and brand info 🏢",
  category: "Logo",
  usage: ".brandlogo <company name or domain>",
  async execute(sock, m, args) {
    try {
      const query = args.join(" ");
      if (!query) {
        return sock.sendMessage(m.key.remoteJid, {
          text: `╭─⌈ 🏢 *BRAND LOGO* ⌋\n├─⊷ *.brandlogo <domain>*\n│  └⊷ Fetch official brand logo\n├─⊷ *.brandlogo <brand name>*\n│  └⊷ Search by brand name\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }

      const apiKey = process.env.BRANDFETCH_API_KEY;
      
      if (!apiKey || apiKey.includes('N273MYI2rHRqwhclWq5OOaJFTUfsw2rJ4')) {
        return sock.sendMessage(m.key.remoteJid, {
          text: "🔑 *Brandfetch API Key Required*\n━━━━━━━━━━━━━━━━━\n1. Get key: https://brandfetch.com\n2. Set as BRANDFETCH_API_KEY\n3. Free tier: 50 requests/month"
        }, { quoted: m });
      }

      await sock.sendPresenceUpdate('composing', m.key.remoteJid);

      // Try to fetch brand data
      const response = await fetch(
        `https://api.brandfetch.io/v2/brands/${encodeURIComponent(query.toLowerCase())}`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "User-Agent": "WolfBot/1.0"
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return sock.sendMessage(m.key.remoteJid, {
            text: `🔍 *Brand Not Found*\nNo data for "${query}"\n\n*Try:*\n• Exact company name\n• Domain (apple.com not apple)\n• Known brands only`
          }, { quoted: m });
        }
        
        if (response.status === 429) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "⏳ *Rate Limited*\nBrandfetch free: 50 requests/month\nUpgrade: https://brandfetch.com/pricing"
          }, { quoted: m });
        }
        
        throw new Error(`Brandfetch API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Find logo (prefer square/icon logo)
      let logoUrl = null;
      if (data.logos && data.logos.length > 0) {
        const iconLogo = data.logos.find(logo => 
          logo.type === "icon" || logo.type === "symbol"
        );
        logoUrl = iconLogo?.formats?.[0]?.src || data.logos[0].formats[0]?.src;
      }

      // Prepare response text
      let caption = `🏢 *${data.name || query}*\n━━━━━━━━━━━━━━━━━\n`;
      
      if (data.domain) caption += `🌐 *Website:* ${data.domain}\n`;
      if (data.description) caption += `📝 *About:* ${data.description.substring(0, 100)}...\n`;
      if (data.industry) caption += `🏭 *Industry:* ${data.industry}\n`;
      
      caption += `\n🎨 *Brand Colors:*\n`;
      if (data.colors && data.colors.length > 0) {
        data.colors.slice(0, 3).forEach(color => {
          caption += `▫️ ${color.hex} (${color.type})\n`;
        });
      }

      if (logoUrl) {
        // Download and send logo
        const imageResponse = await fetch(logoUrl);
        const buffer = await imageResponse.buffer();
        
        await sock.sendMessage(m.key.remoteJid, {
          image: buffer,
          caption: caption
        }, { quoted: m });
      } else {
        // Send text only if no logo
        caption += "\n⚠️ *No logo available*";
        await sock.sendMessage(m.key.remoteJid, {
          text: caption
        }, { quoted: m });
      }

    } catch (err) {
      console.error("Brandlogo Error:", err);
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ *Brand Fetch Failed*\n${err.message}\n\n*Tip:* Use exact company names like "microsoft" not "ms"`
      }, { quoted: m });
    }
  }
};