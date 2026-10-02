// commands/logo/logoai.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: "logoai",
  alias: ["logogen", "createlogo", "designlogo"],
  desc: "Generate AI-powered logos with Logo.dev API 🎨",
  category: "Logo",
  usage: ".logoai <company name> --style=modern --color=blue",
  async execute(sock, m, args) {
    try {
      const query = args.join(" ");
      if (!query || query.includes("--help")) {
        return sock.sendMessage(m.key.remoteJid, {
          text: `╭─⌈ 🎨 *AI LOGO GENERATOR* ⌋\n├─⊷ *.logoai <company name>*\n│  └⊷ Generate AI logo\n├─⊷ *.logoai <name> --style=<style>*\n│  └⊷ modern/minimal/vintage/playful\n├─⊷ *.logoai <name> --color=<color>*\n│  └⊷ blue/red/green/purple\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }

      const apiKey = process.env.LOGO_DEV_API_KEY;
      
      if (!apiKey || apiKey === 'sk_QV2nWNWwSdu5IgWfLBfcZA') {
        return sock.sendMessage(m.key.remoteJid, {
          text: "🔑 *Logo.dev API Key Required*\n━━━━━━━━━━━━━━━━━\n1. Get key from: https://logo.dev\n2. Set as LOGO_DEV_API_KEY in panel\n3. Restart bot"
        }, { quoted: m });
      }

      await sock.sendPresenceUpdate('composing', m.key.remoteJid);

      // Parse options
      const companyName = query.split('--')[0].trim();
      const options = {};
      query.split('--').slice(1).forEach(opt => {
        const [key, value] = opt.split('=');
        if (key && value) options[key.trim()] = value.trim();
      });

      // Call Logo.dev API
      const response = await fetch("https://api.logo.dev/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "WolfBot/1.0"
        },
        body: JSON.stringify({
          company_name: companyName,
          style: options.style || "modern",
          primary_color: options.color || "#3B82F6",
          industry: options.industry || "technology",
          variants: 3, // Generate 3 logo options
          format: "png"
        })
      });

      if (!response.ok) {
        const error = await response.text();
        
        if (response.status === 402) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "💳 *Logo.dev Credits Exhausted*\n━━━━━━━━━━━━━━━━━\nYou've used all API credits.\n\n*Pricing:*\n• 10 credits = $9/month\n• 50 credits = $39/month\n• Get more: https://logo.dev/pricing"
          }, { quoted: m });
        }
        
        if (response.status === 429) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "⏳ *Rate Limited*\nLogo.dev API: 5 logos/minute\nWait 60 seconds."
          }, { quoted: m });
        }
        
        throw new Error(`Logo.dev API Error: ${error.substring(0, 100)}`);
      }

      const data = await response.json();
      
      if (!data.logos || data.logos.length === 0) {
        return sock.sendMessage(m.key.remoteJid, {
          text: "❌ *No Logos Generated*\nTry different style/color options."
        }, { quoted: m });
      }

      // Send first logo as image
      const logoUrl = data.logos[0].url;
      
      // Download and send image
      const imageResponse = await fetch(logoUrl);
      const buffer = await imageResponse.buffer();
      
      await sock.sendMessage(m.key.remoteJid, {
        image: buffer,
        caption: `🎨 *Generated Logo for ${companyName}*\n━━━━━━━━━━━━━━━━━\n*Style:* ${options.style || "modern"}\n*Color:* ${options.color || "blue"}\n*Variants:* ${data.logos.length} generated\n\n*Commands:*\n.logoai ${companyName} --style=minimal\n.logoai ${companyName} --color=red`
      }, { quoted: m });

    } catch (err) {
      console.error("LogoAI Error:", err);
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ *Logo Generation Failed*\n━━━━━━━━━━━━━━━━━\n${err.message}\n\n*Alternative:* Use .brandlogo to fetch existing logos`
      }, { quoted: m });
    }
  }
};