import axios from 'axios';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: "perplexity",
  aliases: ["plex", "askweb", "searchai", "aiweb"],
  category: "ai",
  description: "AI assistant powered by Perplexity with fallbacks",
  
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    
    // Check if query is provided
    if (args.length === 0) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🤖 *PERPLEXITY AI* ⌋\n├─⊷ *${PREFIX}perplexity <question>*\n│  └⊷ Ask Perplexity anything\n├─⊷ *${PREFIX}plex <question>*\n│  └⊷ Alias for perplexity\n├─⊷ *${PREFIX}searchai <question>*\n│  └⊷ Alias for perplexity\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const query = args.join(' ');
    
    try {
    //   // Show processing
    //   await sock.sendMessage(jid, {
    //     react: { text: '🔍', key: m.key }
    //   });

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Try multiple API endpoints
      const apiEndpoints = [
        `https://apiskeith.vercel.app/ai/perplexity?q=${encodeURIComponent(query)}`,
        `https://api.beautyofweb.com/perplexity?q=${encodeURIComponent(query)}`,
        `https://ai.tntechnical.com/api/perplexity?q=${encodeURIComponent(query)}`
      ];

      let response = null;
      let apiUsed = '';
      
      for (const endpoint of apiEndpoints) {
        try {
          console.log(`[PERPLEXITY] Trying: ${endpoint}`);
          const res = await axios.get(endpoint, {
            timeout: 25000,
            headers: {
              'User-Agent': 'WolfBot/1.0'
            }
          });
          
          if (res.data?.status && res.data.result && 
              !res.data.result.includes('failed') &&
              !res.data.result.includes('error') &&
              !res.data.result.includes('500') &&
              !res.data.result.includes('Request failed')) {
            response = res.data.result;
            apiUsed = endpoint.split('/')[2]; // Get domain
            break;
          }
        } catch (err) {
          console.log(`[PERPLEXITY] Endpoint failed: ${err.message}`);
          continue;
        }
      }

      // If all APIs fail, use fallback response
      if (!response) {
        // Simple AI fallback for common queries
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
          response = "Hello! 👋 I'm Perplexity AI, here to help answer your questions with web-informed responses. How can I assist you today?";
        } else if (lowerQuery.includes('weather')) {
          response = "I'd need your specific location to check current weather. For accurate weather information, please specify your city or check a weather service like weather.com or accuweather.com.";
        } else if (lowerQuery.includes('news')) {
          response = "For current news, I recommend checking reputable news sources like BBC News, CNN, Reuters, or Al Jazeera. You can also use Google News for the latest updates.";
        } else if (lowerQuery.includes('time')) {
          const now = new Date();
          response = `Current UTC time is: ${now.toUTCString()}. For local time, please specify your timezone or location.`;
        } else {
          response = `I received your question: "${query}". \n\nUnfortunately, the Perplexity API is currently experiencing issues. Please try:\n1. Rephrasing your question\n2. Using \`${PREFIX}ilama\` for general AI questions\n3. Trying again in a few minutes\n\nAlternatively, you can search the web directly for "${query}".`;
        }
        
        apiUsed = "WolfBot Fallback";
      }

      // Format response
      let messageText = `🤖 *PERPLEXITY AI*\n\n`;
      messageText += `💭 *Your Query:*\n${query}\n\n`;
      messageText += `💡 *Response:*\n${response}\n\n`;
      
      if (apiUsed !== "WolfBot Fallback") {
        messageText += `🔧 *Source:* ${apiUsed}\n`;
      }
      messageText += `✨ *Note:* Responses may include web search information`;

      // Send response
      await sock.sendMessage(jid, {
        text: messageText
      }, { quoted: m });

      // Update reaction
      await sock.sendMessage(jid, {
        react: { text: '✅', key: m.key }
      });

    } catch (error) {
      console.error('[PERPLEXITY] Error:', error.message);
      
      await sock.sendMessage(jid, {
        react: { text: '❌', key: m.key }
      });
      
      await sock.sendMessage(jid, {
        text: `❌ *Perplexity Unavailable*\n\n` +
              `All AI services are currently unavailable.\n\n` +
              `💡 *Alternatives:*\n` +
              `• Use \`${PREFIX}ilama\` for general AI chat\n` +
              `• Use \`${PREFIX}flux\` for AI image generation\n` +
              `• Search the web directly\n\n` +
              `📌 *Example:* \`${PREFIX}ilama ${args.join(' ')}\``
      }, { quoted: m });
    }
  }
};