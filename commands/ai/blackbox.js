import { callAI } from '../../lib/aiHelper.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'blackbox',
  description: 'Blackbox AI - Advanced problem-solving and analysis',
  category: 'ai',
  aliases: ['bb', 'blackboxai', 'askbb', 'blackbot', 'boxai'],
  usage: 'blackbox [question or problem]',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const senderJid = m.key.participant || jid;
    
    // ====== HELP SECTION ======
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      const helpText = `╭─⌈ 🤖 *BLACKBOX AI* ⌋\n├─⊷ *${PREFIX}blackbox <question>*\n│  └⊷ Ask Blackbox anything\n├─⊷ *${PREFIX}bb <question>*\n│  └⊷ Alias for blackbox\n├─⊷ *${PREFIX}blackboxai <question>*\n│  └⊷ Alias for blackbox\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    // ====== SPECIAL COMMANDS ======
    const specialCommands = {
      'solve': 'solve',
      'math': 'math',
      'calculate': 'math',
      'calc': 'math',
      'debug': 'debug',
      'fix': 'debug',
      'error': 'debug',
      'code': 'code',
      'program': 'code',
      'algorithm': 'algorithm',
      'logic': 'logic',
      'explain': 'explain',
      'analyze': 'analyze',
      'analysis': 'analyze'
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
        case 'solve':
          enhancedPrompt = `Act as expert problem solver. Provide step-by-step solution: ${query}`;
          break;
        case 'math':
          enhancedPrompt = `Act as mathematician. Solve/show calculations: ${query}`;
          break;
        case 'debug':
          enhancedPrompt = `Act as debugger. Find/fix errors in: ${query}`;
          break;
        case 'code':
          enhancedPrompt = `Act as programmer. Write optimized code: ${query}`;
          break;
        case 'algorithm':
          enhancedPrompt = `Act as algorithm expert. Design/explain algorithm: ${query}`;
          break;
        case 'logic':
          enhancedPrompt = `Act as logic expert. Analyze/provide reasoning: ${query}`;
          break;
        case 'explain':
          enhancedPrompt = `Act as technical expert. Explain clearly: ${query}`;
          break;
        case 'analyze':
          enhancedPrompt = `Act as analyst. Provide detailed analysis: ${query}`;
          break;
      }
    } else {
      enhancedPrompt = query;
    }

    try {
      // ====== PROCESSING MESSAGE ======
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // ====== API REQUEST ======
      console.log(`🤖 Blackbox Query [${mode}]: ${query}`);

      let aiResponse = await callAI('blackbox', enhancedPrompt || query);

      // Check if response is empty or indicates error
      if (!aiResponse || aiResponse.trim() === '') {
        throw new Error('Blackbox returned empty response');
      }

      // Clean and format response
      aiResponse = aiResponse.trim();
      
      // Format based on mode
      aiResponse = formatBlackboxResponse(aiResponse, mode, query);
      
      // Truncate if too long for WhatsApp
      if (aiResponse.length > 3000) {
        aiResponse = aiResponse.substring(0, 3000) + '\n\n... (response truncated, too complex)';
      }

      // ====== FORMAT FINAL MESSAGE ======
      let resultText = `🤖 *BLACKBOX AI*\n\n`;
      
      // Mode indicator with emoji
      if (mode !== 'general') {
        const modeIcons = {
          'solve': '🔧',
          'math': '🧮',
          'debug': '🐛',
          'code': '💻',
          'algorithm': '🔢',
          'logic': '🧠',
          'explain': '📚',
          'analyze': '🔍'
        };
        resultText += `${modeIcons[mode] || '⚡'} *Mode:* ${mode.toUpperCase()}\n\n`;
      }
      
      // Problem/Query
      const displayQuery = query.length > 100 ? query.substring(0, 100) + '...' : query;
      resultText += `🎯 *Problem:* ${displayQuery}\n\n`;
      
      // Blackbox Response
      resultText += `✨ *Blackbox Solution:*\n${aiResponse}\n\n`;
      
      // Footer
     //resultText += `⚡ *Powered by Keith API | Blackbox AI*`;

      // ====== SEND FINAL ANSWER ======
      await sock.sendMessage(jid, { text: resultText }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [Blackbox AI] ERROR:', error);
      
      let errorMessage = `❌ *BLACKBOX AI ERROR*\n\n`;
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `• Blackbox API server is down\n`;
        errorMessage += `• Please try again later\n`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += `• Request timed out (40s)\n`;
        errorMessage += `• Problem too complex\n`;
        errorMessage += `• Try breaking it down\n`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += `• Cannot connect to Blackbox API\n`;
        errorMessage += `• Check internet connection\n`;
      } else if (error.response?.status === 429) {
        errorMessage += `• Rate limit exceeded\n`;
        errorMessage += `• Too many Blackbox requests\n`;
        errorMessage += `• Wait 2-3 minutes\n`;
      } else if (error.response?.status === 404) {
        errorMessage += `• Blackbox endpoint not found\n`;
        errorMessage += `• API may have changed\n`;
      } else if (error.response?.status === 500) {
        errorMessage += `• Blackbox internal error\n`;
        errorMessage += `• Complex problem caused crash\n`;
      } else if (error.response?.status === 400) {
        errorMessage += `• Bad request to Blackbox\n`;
        errorMessage += `• Query may be malformed\n`;
      } else if (error.response?.data) {
        // Extract API error
        const apiError = error.response.data;
        if (apiError.error) {
          errorMessage += `• Blackbox Error: ${apiError.error}\n`;
        } else if (apiError.message) {
          errorMessage += `• Error: ${apiError.message}\n`;
        } else if (typeof apiError === 'string') {
          errorMessage += `• Error: ${apiError}\n`;
        }
      } else if (error.message) {
        errorMessage += `• Error: ${error.message}\n`;
      }
      
      errorMessage += `\n🔧 *Troubleshooting:*\n`;
      errorMessage += `1. Simplify your problem\n`;
      errorMessage += `2. Break into smaller parts\n`;
      errorMessage += `3. Wait 2 minutes before retry\n`;
      errorMessage += `4. Check query formatting\n`;
      errorMessage += `5. Use \`${PREFIX}gpt\` for simpler questions\n`;
      
      // Try to send error message
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

// Extract text from Blackbox API response
function extractBlackboxResponse(obj) {
  // Prioritize common response fields
  const priorityFields = ['result', 'solution', 'answer', 'response', 'text', 'content', 'message'];
  
  for (const field of priorityFields) {
    if (obj[field] && typeof obj[field] === 'string') {
      return obj[field];
    }
  }
  
  // If no string field found, try to extract from nested objects
  if (obj.data) {
    return extractBlackboxResponse(obj.data);
  }
  
  // If array with items, join them
  if (Array.isArray(obj) && obj.length > 0) {
    return obj.map(item => 
      typeof item === 'string' ? item : JSON.stringify(item)
    ).join('\n');
  }
  
  // Last resort: stringify with limit
  return JSON.stringify(obj, null, 2).substring(0, 2000);
}

// Format Blackbox response based on mode
function formatBlackboxResponse(text, mode, originalQuery) {
  if (!text) return 'No solution available';
  
  // Clean up
  text = text.trim();
  
  // Remove markdown if present (for WhatsApp compatibility)
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  
  // Handle code blocks specially
  text = formatCodeBlocks(text);
  
  // Add step numbers for solutions
  if (mode === 'solve' || mode === 'debug' || mode === 'algorithm') {
    text = addStepNumbers(text);
  }
  
  // Format math expressions
  if (mode === 'math' || text.includes('=') || text.includes('+') || text.includes('-') || text.includes('*') || text.includes('/')) {
    text = formatMathExpressions(text);
  }
  
  // Ensure proper line breaks
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Add header for long responses
  if (text.length > 500) {
    const lines = text.split('\n');
    if (lines.length > 10) {
      text = `📋 **Detailed Analysis:**\n\n${text}`;
    }
  }
  
  return text;
}

// Format code blocks for WhatsApp
function formatCodeBlocks(text) {
  // Handle ```code``` blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let formatted = text;
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || '';
    const code = match[2].trim();
    const formattedCode = `💻 *Code${language ? ' (' + language + ')' : ''}:*\n${code}\n`;
    formatted = formatted.replace(match[0], formattedCode);
  }
  
  return formatted;
}

// Add step numbers to solutions
function addStepNumbers(text) {
  const lines = text.split('\n');
  const numberedLines = [];
  let stepCount = 1;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && 
        (trimmed.toLowerCase().startsWith('step') || 
         trimmed.match(/^\d+[\.\)]/) ||
         trimmed.includes(':') ||
         trimmed.length > 50)) {
      numberedLines.push(`📌 *Step ${stepCount++}:* ${trimmed}`);
    } else {
      numberedLines.push(line);
    }
  }
  
  return numberedLines.join('\n');
}

// Format mathematical expressions
function formatMathExpressions(text) {
  // Add spacing around operators for readability
  let formatted = text
    .replace(/(\d)([+\-*/])(\d)/g, '$1 $2 $3')
    .replace(/=/g, ' = ')
    .replace(/\s+/g, ' ');
  
  // Highlight final answers
  const answerMatch = formatted.match(/(?:answer|result|solution|equals?)[:\s]*([^.\n]+)/i);
  if (answerMatch) {
    const answer = answerMatch[1].trim();
    formatted = formatted.replace(answerMatch[0], `✅ *Answer:* ${answer}`);
  }
  
  return formatted;
}