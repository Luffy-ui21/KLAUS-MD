import axios from 'axios';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'metai',
  description: 'Meta AI assistant powered by advanced technology',
  category: 'ai',
  aliases: ['meta', 'metaai', 'askmeta', 'metabot'],
  usage: 'metai [question]',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const senderJid = m.key.participant || jid;
    
    // ====== HELP SECTION ======
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      const helpText = `╭─⌈ 🤖 *META AI* ⌋\n├─⊷ *${PREFIX}metai <question>*\n│  └⊷ Ask Meta AI anything\n├─⊷ *${PREFIX}meta <question>*\n│  └⊷ Alias for metai\n├─⊷ *${PREFIX}metaai <question>*\n│  └⊷ Alias for metai\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    // ====== SPECIAL COMMANDS ======
    const specialCommands = {
      'code': 'code',
      'program': 'code',
      'coding': 'code',
      'creative': 'creative',
      'write': 'creative',
      'story': 'creative',
      'explain': 'explain',
      'whatis': 'explain',
      'define': 'explain',
      'translate': 'translate',
      'lang': 'translate',
      'summarize': 'summarize',
      'summary': 'summarize'
    };

    let query = args.join(' ');
    let mode = 'general';
    let enhancedPrompt = '';

    // Check for special command modes
    const firstWord = args[0].toLowerCase();
    if (specialCommands[firstWord]) {
      mode = specialCommands[firstWord];
      query = args.slice(1).join(' ');
      
      switch(mode) {
        case 'code':
          enhancedPrompt = `Act as expert programmer. Provide clean, efficient code with explanations. Question: ${query}`;
          break;
        case 'creative':
          enhancedPrompt = `Act as creative writer. Be imaginative and descriptive. Write: ${query}`;
          break;
        case 'explain':
          enhancedPrompt = `Act as teacher. Explain clearly with examples. Topic: ${query}`;
          break;
        case 'translate':
          enhancedPrompt = `Translate the following text. If no language specified, translate to English: ${query}`;
          break;
        case 'summarize':
          enhancedPrompt = `Summarize the following text concisely: ${query}`;
          break;
      }
    } else {
      enhancedPrompt = query;
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // ====== API REQUEST (Using Keith's API) ======
      const apiUrl = 'https://apiskeith.vercel.app/ai/metai';
      
      console.log(`🤖 Meta AI Query [${mode}]: ${query}`);
      
      const response = await axios({
        method: 'GET',
        url: apiUrl,
        params: {
          q: enhancedPrompt || query
        },
        timeout: 30000, // 30 seconds
        headers: {
          'User-Agent': 'WolfBot-MetaAI/1.0',
          'Accept': 'application/json',
          'X-Requested-With': 'WolfBot',
          'Referer': 'https://apiskeith.vercel.app/'
        },
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });

      console.log(`✅ Meta AI Response status: ${response.status}`);
      
      // ====== PARSE RESPONSE ======
      let aiResponse = '';
      let metadata = {
        creator: 'Keith API',
        model: 'Meta AI',
        status: true
      };
      
      // Parse Keith API response format
      if (response.data && typeof response.data === 'object') {
        const data = response.data;
        
        // Extract based on Keith API structure
        if (data.status === true && data.result) {
          aiResponse = data.result;
        } else if (data.response) {
          aiResponse = data.response;
        } else if (data.answer) {
          aiResponse = data.answer;
        } else if (data.text) {
          aiResponse = data.text;
        } else if (data.message) {
          aiResponse = data.message;
        } else {
          // Fallback: extract any text from object
          aiResponse = extractTextFromObject(data);
        }
      } else if (typeof response.data === 'string') {
        aiResponse = response.data;
      } else {
        throw new Error('Invalid API response format');
      }
      
      // Check if response indicates error
      if (!aiResponse || aiResponse.toLowerCase().includes('error') || aiResponse.toLowerCase().includes('unavailable')) {
        throw new Error('Meta AI service returned an error');
      }
      
      // Format response
      aiResponse = formatMetaResponse(aiResponse, mode);
      
      // Truncate if too long for WhatsApp
      if (aiResponse.length > 2500) {
        aiResponse = aiResponse.substring(0, 2500) + '\n\n... (response truncated due to length)';
      }

      // ====== FORMAT FINAL MESSAGE ======
      let resultText = `🤖 *META AI ASSISTANT*\n\n`;
      
      // Mode indicator
      if (mode !== 'general') {
        const modeIcons = {
          'code': '👨‍💻',
          'creative': '🎨',
          'explain': '👨‍🏫',
          'translate': '🌐',
          'summarize': '📋'
        };
        resultText += `${modeIcons[mode] || '⚡'} *Mode:* ${mode.toUpperCase()}\n\n`;
      }
      
      // Question (truncated if long)
      const displayQuery = query.length > 80 ? query.substring(0, 80) + '...' : query;
      resultText += `🎯 *Query:* ${displayQuery}\n\n`;
      
      // AI Response
      resultText += `✨ *Meta AI Response:*\n${aiResponse}\n\n`;
      
      // Footer
     // resultText += `⚡ *Powered by Keith API | Meta AI Technology*`;

      // ====== SEND FINAL ANSWER ======
      await sock.sendMessage(jid, { text: resultText }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [Meta AI] ERROR:', error);
      
      let errorMessage = `❌ *META AI ERROR*\n\n`;
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `• Meta AI API server is down\n`;
        errorMessage += `• Please try again later\n`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += `• Request timed out (30s)\n`;
        errorMessage += `• Try simpler/shorter queries\n`;
      } else if (error.response?.status === 429) {
        errorMessage += `• Rate limit exceeded\n`;
        errorMessage += `• Too many requests to Meta AI\n`;
        errorMessage += `• Wait 1-2 minutes\n`;
      } else if (error.response?.status === 404) {
        errorMessage += `• Meta AI endpoint not found\n`;
        errorMessage += `• API may have changed\n`;
      } else if (error.response?.status === 500) {
        errorMessage += `• Meta AI server error\n`;
        errorMessage += `• Try again in a few minutes\n`;
      } else if (error.response?.data) {
        // Try to extract API error message
        try {
          const apiError = error.response.data;
          if (apiError.error) {
            errorMessage += `• API Error: ${apiError.error}\n`;
          } else if (apiError.message) {
            errorMessage += `• Error: ${apiError.message}\n`;
          }
        } catch (e) {
          errorMessage += `• Error: ${error.message}\n`;
        }
      } else {
        errorMessage += `• Error: ${error.message}\n`;
      }
      
      errorMessage += `\n🔧 *Troubleshooting:*\n`;
      errorMessage += `1. Try shorter/simpler questions\n`;
      errorMessage += `2. Wait 1 minute before retrying\n`;
      errorMessage += `3. Check your internet connection\n`;
      errorMessage += `4. Use \`${PREFIX}gpt\` as alternative\n`;
      errorMessage += `5. Contact support if issue persists\n`;
      
      // Send error message
      try {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, {
          text: errorMessage
        }, { quoted: m });
      } catch (sendError) {
        console.error('Failed to send error message:', sendError);
      }
    }
  },
};

// ====== HELPER FUNCTIONS ======

// Extract text from API response object
function extractTextFromObject(obj, maxDepth = 3) {
  const textParts = [];
  
  function extract(obj, depth = 0) {
    if (depth > maxDepth) return;
    
    if (typeof obj === 'string') {
      textParts.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        extract(item, depth + 1);
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key === 'text' || key === 'content' || key === 'message' || key === 'result') {
          extract(obj[key], depth + 1);
        }
      }
    }
  }
  
  extract(obj);
  
  // Combine and clean up text
  let combined = textParts.join(' ').trim();
  
  // Remove excessive whitespace
  combined = combined.replace(/\s+/g, ' ');
  
  // If still empty, return stringified version
  if (!combined && obj) {
    combined = JSON.stringify(obj, null, 2).substring(0, 1500);
  }
  
  return combined;
}

// Format Meta AI response
function formatMetaResponse(text, mode) {
  if (!text) return 'No response received';
  
  // Clean up common formatting issues
  text = text.trim();
  
  // Remove excessive newlines
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // For code mode, ensure code blocks
  if (mode === 'code') {
    // Add code blocks if code-like content but no blocks
    if (isCodeContent(text) && !text.includes('```')) {
      text = '```' + text + '```';
    }
  }
  
  // For creative mode, ensure proper paragraph breaks
  if (mode === 'creative') {
    text = text.replace(/([.!?])\s+/g, '$1\n\n');
  }
  
  return text;
}

// Detect if content is code
function isCodeContent(text) {
  const codeKeywords = [
    'function', 'def ', 'class ', 'import ', 'export ', 'const ', 'let ', 'var ',
    'if (', 'for (', 'while (', 'return ', 'console.log', 'print(', 'System.out',
    'public ', 'private ', 'protected ', 'void ', 'int ', 'string ', 'bool',
    '#include', 'using ', 'namespace ', '<?php', '<html', '<script',
    'python', 'javascript', 'java', 'c++', 'c#', 'php', 'html', 'css', 'sql'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Check for multiple code indicators
  let score = 0;
  
  for (const keyword of codeKeywords) {
    if (lowerText.includes(keyword)) {
      score++;
      if (score >= 2) return true;
    }
  }
  
  // Check for common code patterns
  const codePatterns = [
    /\w+\s*=\s*.+;/,  // variable assignment
    /function\s+\w+\s*\(/,  // function definition
    /class\s+\w+\s*\{/,  // class definition
    /import\s+.+from/,  // ES6 import
    /System\.out\.println/,  // Java print
    /console\.log/,  // JS print
    /print\(/,  // Python print
    /<\?php/,  // PHP opening
    /<\/?[a-z][^>]*>/  // HTML tags
  ];
  
  for (const pattern of codePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}