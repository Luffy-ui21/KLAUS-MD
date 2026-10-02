import axios from "axios";
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: "grok",
  category: "AI",
  aliases: ["xgrok", "xai", "elonai"],
  description: "Query X AI Grok via Keith's API",
  
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const quoted = m.quoted;
    let query = "";

    // Get query from arguments or quoted message
    if (args.length > 0) {
      query = args.join(" ");
    } else if (quoted && quoted.text) {
      query = quoted.text;
    } else {
      await sock.sendMessage(jid, { 
        text: `╭─⌈ 🤖 *X AI GROK* ⌋\n├─⊷ *${PREFIX}grok <question>*\n│  └⊷ Ask Grok anything\n├─⊷ *${PREFIX}xgrok <question>*\n│  └⊷ Alias for grok\n├─⊷ *${PREFIX}xai <question>*\n│  └⊷ Alias for grok\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
      return;
    }

    console.log(`🤖 [GROK] Query: "${query}"`);

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Make API request to Keith's Grok API
      const apiUrl = `https://apiskeith.vercel.app/ai/grok?q=${encodeURIComponent(query)}`;
      
      console.log(`🌐 [GROK] Calling API: ${apiUrl}`);
      
      const response = await axios({
        method: 'GET',
        url: apiUrl,
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://apiskeith.vercel.app/',
          'Origin': 'https://apiskeith.vercel.app'
        },
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      console.log(`✅ [GROK] Response status: ${response.status}`);
      
      // Parse response
      let grokResponse = '';
      let metadata = {
        creator: 'X AI',
        model: 'Grok',
        status: true,
        source: 'Keith API'
      };
      
      if (response.data && typeof response.data === 'object') {
        const data = response.data;
        
        console.log('📊 Grok API Response structure:', Object.keys(data));
        
        // Extract based on Keith API structure
        if (data.status === true && data.result) {
          grokResponse = data.result;
          console.log('✅ Using data.result');
        } else if (data.response) {
          grokResponse = data.response;
          console.log('✅ Using data.response');
        } else if (data.answer) {
          grokResponse = data.answer;
          console.log('✅ Using data.answer');
        } else if (data.text) {
          grokResponse = data.text;
          console.log('✅ Using data.text');
        } else if (data.content) {
          grokResponse = data.content;
          console.log('✅ Using data.content');
        } else if (data.message) {
          grokResponse = data.message;
          console.log('✅ Using data.message');
        } else if (data.data) {
          grokResponse = data.data;
          console.log('✅ Using data.data');
        } else if (data.error) {
          console.log('❌ API error:', data.error);
          throw new Error(data.error || 'Grok API returned error');
        } else {
          // Try to extract any text
          grokResponse = extractGrokResponse(data);
        }
      } else if (typeof response.data === 'string') {
        console.log('✅ Response is string');
        grokResponse = response.data;
      } else {
        console.log('❌ Invalid response format');
        throw new Error('Invalid API response format');
      }
      
      // Check if response is empty
      if (!grokResponse || grokResponse.trim() === '') {
        console.log('❌ Empty response');
        throw new Error('Grok returned empty response');
      }
      
      // Clean response
      grokResponse = grokResponse.trim();
      console.log(`📝 Response length: ${grokResponse.length} characters`);
      
      // Check for error indicators
      const lowerResponse = grokResponse.toLowerCase();
      if (lowerResponse.includes('error:') || 
          lowerResponse.startsWith('error') ||
          lowerResponse.includes('failed to') ||
          lowerResponse.includes('unavailable') ||
          lowerResponse.includes('not found')) {
        console.log('❌ Response contains error indicator');
        throw new Error(grokResponse);
      }
      
      // Format response for WhatsApp
      grokResponse = formatGrokResponse(grokResponse);
      
      // Truncate if too long for WhatsApp
      if (grokResponse.length > 2500) {
        grokResponse = grokResponse.substring(0, 2500) + '\n\n... (response truncated for WhatsApp)';
      }

      // Format final message
      let resultText = `🤖 *X AI GROK*\n\n`;
      
      // Query display
      const displayQuery = query.length > 80 ? query.substring(0, 80) + '...' : query;
      resultText += `💭 *Query:* ${displayQuery}\n\n`;
      
      // Grok Response
      resultText += `🤖 *Grok's Response:*\n${grokResponse}\n\n`;
      
      // Footer with X branding
      resultText += `⚡ *Powered by X AI Grok*\n`;
      resultText += `🚀 *Elon Musk's AI Assistant*`;

      // Send final answer
      console.log('📤 Sending final response to WhatsApp');
      await sock.sendMessage(jid, { text: resultText }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

      console.log(`✅ Grok response sent successfully`);

    } catch (error) {
      console.error('❌ [X AI Grok] ERROR:', error);
      console.error('❌ Error stack:', error.stack);
      
      let errorMessage = `❌ *X AI GROK ERROR*\n\n`;
      
      // Detailed error handling
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `• Grok API server is down\n`;
        errorMessage += `• X AI service unavailable\n`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += `• Request timed out (30s)\n`;
        errorMessage += `• X AI is processing\n`;
        errorMessage += `• Try simpler query\n`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += `• Cannot connect to Grok API\n`;
        errorMessage += `• Check internet connection\n`;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage += `• Connection aborted\n`;
        errorMessage += `• Network issue detected\n`;
      } else if (error.response?.status === 429) {
        errorMessage += `• Rate limit exceeded\n`;
        errorMessage += `• Too many Grok requests\n`;
        errorMessage += `• Wait 2-3 minutes\n`;
      } else if (error.response?.status === 404) {
        errorMessage += `• Grok endpoint not found\n`;
        errorMessage += `• API may have changed\n`;
      } else if (error.response?.status === 500) {
        errorMessage += `• X AI internal error\n`;
        errorMessage += `• Service temporarily down\n`;
      } else if (error.response?.status === 403) {
        errorMessage += `• Access forbidden\n`;
        errorMessage += `• API key may be invalid\n`;
      } else if (error.response?.status === 400) {
        errorMessage += `• Bad request to Grok\n`;
        errorMessage += `• Query may be malformed\n`;
      } else if (error.response?.data) {
        // Extract API error
        const apiError = error.response.data;
        console.log('📊 API Error response:', apiError);
        
        if (apiError.error) {
          errorMessage += `• Grok Error: ${apiError.error}\n`;
        } else if (apiError.message) {
          errorMessage += `• Error: ${apiError.message}\n`;
        } else if (apiError.details) {
          errorMessage += `• Details: ${apiError.details}\n`;
        } else if (typeof apiError === 'string') {
          errorMessage += `• Error: ${apiError}\n`;
        }
      } else if (error.message) {
        errorMessage += `• Error: ${error.message}\n`;
      }
      
      errorMessage += `\n🔧 *Troubleshooting:*\n`;
      errorMessage += `1. Try simpler/shorter query\n`;
      errorMessage += `2. Wait 1-2 minutes before retry\n`;
      errorMessage += `3. Check internet connection\n`;
      errorMessage += `4. Use other AI commands:\n`;
      errorMessage += `   • \`${PREFIX}gpt\` - ChatGPT\n`;
      errorMessage += `   • \`${PREFIX}bard\` - Google Bard\n`;
      errorMessage += `   • \`${PREFIX}claude\` - Claude AI\n`;
      errorMessage += `5. Try rephrasing your question\n`;
      
      // Send error message
      try {
        console.log('📤 Sending error message to user');
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, {
          text: errorMessage
        }, { quoted: m });
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
      }
    }
  }
};

// Helper functions

// Extract text from Grok API response
function extractGrokResponse(obj, depth = 0) {
  if (depth > 3) return 'Response too complex';
  
  // If it's a string, return it
  if (typeof obj === 'string') {
    return obj;
  }
  
  // If array, process each item
  if (Array.isArray(obj)) {
    return obj.map(item => extractGrokResponse(item, depth + 1))
              .filter(text => text && text.trim())
              .join('\n');
  }
  
  // If object, look for common response fields
  if (obj && typeof obj === 'object') {
    // Priority fields
    const priorityFields = [
      'result', 'response', 'answer', 'text', 'content', 
      'message', 'output', 'choices', 'candidates', 'grok'
    ];
    
    for (const field of priorityFields) {
      if (obj[field]) {
        const extracted = extractGrokResponse(obj[field], depth + 1);
        if (extracted && extracted.trim()) {
          return extracted;
        }
      }
    }
    
    // Try to extract from any string property
    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].trim()) {
        return obj[key];
      }
    }
    
    // Try to stringify the object
    try {
      const stringified = JSON.stringify(obj, null, 2);
      if (stringified.length < 1000) {
        return stringified;
      }
    } catch (e) {
      // Ignore stringify errors
    }
  }
  
  return 'Could not extract response from API';
}

// Format Grok response
function formatGrokResponse(text) {
  if (!text) return 'No response received from X AI Grok';
  
  // Clean up
  text = text.trim();
  
  // Remove excessive markdown
  text = cleanGrokResponse(text);
  
  // Add Grok personality
  text = addGrokPersonality(text);
  
  // Ensure proper spacing for WhatsApp
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return text;
}

// Clean Grok response
function cleanGrokResponse(text) {
  // Remove citation numbers
  text = text.replace(/\[\d+\]/g, '');
  
  // Clean markdown but keep some formatting
  text = text.replace(/```/g, '```\n');
  text = text.replace(/\*\*(.*?)\*\*/g, '*$1*');
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');
  
  return text;
}

// Add Grok's personality/style
function addGrokPersonality(text) {
  // Check if already has Grok style
  if (text.toLowerCase().includes('grok') || 
      text.toLowerCase().includes('elon') ||
      text.toLowerCase().includes('x ai')) {
    return text;
  }
  
  // Add some Grok-style intro if it's a longer response
  if (text.length > 100) {
    const grokIntros = [
      "🤖 Grok says: ",
      "🚀 X AI Grok here: ",
      "💭 According to Grok: "
    ];
    
    const randomIntro = grokIntros[Math.floor(Math.random() * grokIntros.length)];
    if (!text.startsWith(randomIntro.substring(0, 5))) {
      text = randomIntro + text;
    }
  }
  
  return text;
}