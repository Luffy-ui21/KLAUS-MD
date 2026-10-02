import axios from "axios";
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: "speechwriter",
  category: "AI",
  aliases: ["speech", "writer", "speechwrite"],
  description: "Generate professional speeches using AI",
  
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    const quoted = m.quoted;
    let topic = "";

    // Get topic from arguments or quoted message
    if (args.length > 0) {
      topic = args.join(" ");
    } else if (quoted && quoted.text) {
      topic = quoted.text;
    } else {
      await sock.sendMessage(jid, { 
        text: `╭─⌈ 🎤 *AI SPEECH WRITER* ⌋\n├─⊷ *${PREFIX}speechwriter <topic>*\n│  └⊷ Generate a speech\n├─⊷ *${PREFIX}speechwriter <topic> -long -formal*\n│  └⊷ With length/type/tone options\n├─⊷ *${PREFIX}speech <topic>*\n│  └⊷ Alias for speechwriter\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
      return;
    }

    console.log(`🎤 [SPEECHWRITER] Topic: "${topic}"`);

    try {
      // Parse options from topic
      const options = {
        length: "short",
        type: "dedication",
        tone: "serious"
      };

      // Check for length options
      if (topic.includes('-long') || topic.includes('-l')) {
        options.length = "long";
        topic = topic.replace(/-long|-l/gi, '').trim();
      } else if (topic.includes('-medium') || topic.includes('-m')) {
        options.length = "medium";
        topic = topic.replace(/-medium|-m/gi, '').trim();
      } else if (topic.includes('-short') || topic.includes('-s')) {
        options.length = "short";
        topic = topic.replace(/-short|-s/gi, '').trim();
      }

      // Check for type options
      if (topic.includes('-dedication') || topic.includes('-d')) {
        options.type = "dedication";
        topic = topic.replace(/-dedication|-d/gi, '').trim();
      } else if (topic.includes('-inspirational') || topic.includes('-i')) {
        options.type = "inspirational";
        topic = topic.replace(/-inspirational|-i/gi, '').trim();
      } else if (topic.includes('-formal') || topic.includes('-f')) {
        options.type = "formal";
        topic = topic.replace(/-formal|-f/gi, '').trim();
      } else if (topic.includes('-casual') || topic.includes('-c')) {
        options.type = "casual";
        topic = topic.replace(/-casual|-c/gi, '').trim();
      }

      // Check for tone options
      if (topic.includes('-serious') || topic.includes('-sr')) {
        options.tone = "serious";
        topic = topic.replace(/-serious|-sr/gi, '').trim();
      } else if (topic.includes('-friendly') || topic.includes('-fr')) {
        options.tone = "friendly";
        topic = topic.replace(/-friendly|-fr/gi, '').trim();
      } else if (topic.includes('-persuasive') || topic.includes('-p')) {
        options.tone = "persuasive";
        topic = topic.replace(/-persuasive|-p/gi, '').trim();
      } else if (topic.includes('-motivational') || topic.includes('-mot')) {
        options.tone = "motivational";
        topic = topic.replace(/-motivational|-mot/gi, '').trim();
      }

      // Check if topic is empty after removing options
      if (!topic || topic.trim() === '') {
        await sock.sendMessage(jid, { 
          text: `❌ Please provide a speech topic.\n\nExample: \`${PREFIX}speechwriter graduation speech\``
        }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Build API URL
      const apiUrl = `https://apiskeith.vercel.app/ai/speechwriter?topic=${encodeURIComponent(topic)}&length=${options.length}&type=${options.type}&tone=${options.tone}`;
      
      console.log(`🌐 [SPEECHWRITER] Calling API: ${apiUrl}`);
      
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

      console.log(`✅ [SPEECHWRITER] Response status: ${response.status}`);
      

      // Parse response
      let speech = '';
      
      if (response.data && typeof response.data === 'object') {
        const data = response.data;
        
        console.log('📊 Speechwriter API Response structure:', Object.keys(data));
        
        // Extract speech from nested structure
        if (data.status === true && data.result?.data?.data?.speech) {
          speech = data.result.data.data.speech;
          console.log('✅ Using nested speech structure');
        } else if (data.result?.speech) {
          speech = data.result.speech;
          console.log('✅ Using result.speech');
        } else if (data.speech) {
          speech = data.speech;
          console.log('✅ Using data.speech');
        } else if (data.data?.speech) {
          speech = data.data.speech;
          console.log('✅ Using data.data.speech');
        } else if (data.response) {
          speech = data.response;
          console.log('✅ Using data.response');
        } else if (data.text) {
          speech = data.text;
          console.log('✅ Using data.text');
        } else if (data.error) {
          console.log('❌ API error:', data.error);
          throw new Error(data.error || 'Speechwriter API returned error');
        } else {
          // Try to extract any text
          speech = extractSpeechResponse(data);
        }
      } else if (typeof response.data === 'string') {
        console.log('✅ Response is string');
        speech = response.data;
      } else {
        console.log('❌ Invalid response format');
        throw new Error('Invalid API response format');
      }
      
      // Check if speech is empty
      if (!speech || speech.trim() === '') {
        console.log('❌ Empty speech response');
        throw new Error('Speechwriter returned empty speech');
      }
      
      // Clean speech
      speech = speech.trim();
      console.log(`📝 Speech length: ${speech.length} characters`);
      
      // Format speech for WhatsApp
      speech = formatSpeech(speech, options);
      
      // Truncate if too long for WhatsApp
      if (speech.length > 3500) {
        speech = speech.substring(0, 3500) + '\n\n... (speech truncated for WhatsApp)';
      }

      // Format final message
      let resultText = `🎤 *AI SPEECH WRITER*\n\n`;
      
      // Topic and options
      resultText += `📝 *Topic:* ${topic}\n`;
      resultText += `⚙️ *Settings:* ${options.length}, ${options.type}, ${options.tone}\n\n`;
      
      // Generated Speech with proper formatting
      resultText += `✍️ *Generated Speech:*\n\n${speech}\n\n`;
      
      // Footer
      resultText += `🔧 *Tips:* You can adjust length/type/tone with options\n`;
      resultText += `💡 *Example:* \`${PREFIX}speechwriter topic -long -inspirational -motivational\``;

      // Send final speech
      console.log('📤 Sending generated speech to WhatsApp');
      await sock.sendMessage(jid, { text: resultText }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

      console.log(`✅ Speech generated successfully for topic: "${topic}"`);

    } catch (error) {
      console.error('❌ [Speechwriter] ERROR:', error);
      console.error('❌ Error stack:', error.stack);
      
      let errorMessage = `❌ *SPEECH WRITER ERROR*\n\n`;
      
      // Detailed error handling
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `• Speechwriter API server is down\n`;
        errorMessage += `• Service temporarily unavailable\n`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += `• Request timed out (30s)\n`;
        errorMessage += `• AI is crafting your speech\n`;
        errorMessage += `• Try simpler topic\n`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += `• Cannot connect to Speechwriter API\n`;
        errorMessage += `• Check internet connection\n`;
      } else if (error.response?.status === 429) {
        errorMessage += `• Rate limit exceeded\n`;
        errorMessage += `• Too many speech requests\n`;
        errorMessage += `• Wait 2-3 minutes\n`;
      } else if (error.response?.status === 404) {
        errorMessage += `• Speechwriter endpoint not found\n`;
        errorMessage += `• API may have changed\n`;
      } else if (error.response?.status === 500) {
        errorMessage += `• Speechwriter internal error\n`;
        errorMessage += `• Service temporarily down\n`;
      } else if (error.response?.status === 400) {
        errorMessage += `• Bad request to Speechwriter\n`;
        errorMessage += `• Topic may be too complex\n`;
      } else if (error.response?.data) {
        const apiError = error.response.data;
        console.log('📊 API Error response:', apiError);
        
        if (apiError.error) {
          errorMessage += `• Error: ${apiError.error}\n`;
        } else if (apiError.message) {
          errorMessage += `• Error: ${apiError.message}\n`;
        } else if (typeof apiError === 'string') {
          errorMessage += `• Error: ${apiError}\n`;
        }
      } else if (error.message) {
        errorMessage += `• Error: ${error.message}\n`;
      }
      
      errorMessage += `\n🔧 *Troubleshooting:*\n`;
      errorMessage += `1. Try simpler/specific topic\n`;
      errorMessage += `2. Wait 1-2 minutes before retry\n`;
      errorMessage += `3. Check internet connection\n`;
      errorMessage += `4. Use different options:\n`;
      errorMessage += `   • Try shorter length (-short)\n`;
      errorMessage += `   • Try different type (-formal)\n`;
      errorMessage += `   • Try different tone (-friendly)\n`;
      errorMessage += `5. Use other writing commands:\n`;
      errorMessage += `   • \`${PREFIX}bard\` - Google Bard for writing\n`;
      errorMessage += `   • \`${PREFIX}gpt\` - ChatGPT for content\n`;
      
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

// Extract speech from API response
function extractSpeechResponse(obj, depth = 0) {
  if (depth > 3) return 'Speech content too complex';
  
  // If it's a string, return it
  if (typeof obj === 'string') {
    return obj;
  }
  
  // If array, process each item
  if (Array.isArray(obj)) {
    return obj.map(item => extractSpeechResponse(item, depth + 1))
              .filter(text => text && text.trim())
              .join('\n');
  }
  
  // If object, look for speech content
  if (obj && typeof obj === 'object') {
    // Priority fields for speeches
    const priorityFields = [
      'speech', 'content', 'text', 'response', 'result', 
      'message', 'data', 'output', 'generated'
    ];
    
    for (const field of priorityFields) {
      if (obj[field]) {
        const extracted = extractSpeechResponse(obj[field], depth + 1);
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
  }
  
  return 'Could not extract speech from API response';
}

// Format speech for readability
function formatSpeech(speech, options) {
  if (!speech) return 'No speech generated';
  
  // Clean up
  speech = speech.trim();
  
  // Add speech formatting based on type
  speech = addSpeechFormatting(speech, options.type, options.tone);
  
  // Add paragraph breaks for readability
  speech = addParagraphBreaks(speech);
  
  // Ensure proper spacing
  speech = speech.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return speech;
}

// Add speech formatting
function addSpeechFormatting(speech, type, tone) {
  // Add opening based on type and tone
  let opening = '';
  
  if (type === 'dedication') {
    opening = '🎤 *Dedication Speech*\n\n"';
  } else if (type === 'inspirational') {
    opening = '🌟 *Inspirational Speech*\n\n"';
  } else if (type === 'formal') {
    opening = '🤵 *Formal Address*\n\n"';
  } else if (type === 'casual') {
    opening = '😊 *Casual Talk*\n\n"';
  } else {
    opening = '🎤 *Generated Speech*\n\n"';
  }
  
  // Add closing quotes if not already present
  if (!speech.startsWith('"')) {
    speech = opening + speech;
  }
  
  if (!speech.endsWith('"')) {
    speech = speech + '"';
  }
  
  return speech;
}

// Add paragraph breaks for better readability
function addParagraphBreaks(text) {
  // Split by sentences and add breaks every 3-4 sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length <= 4) {
    return text;
  }
  
  let result = '';
  let sentenceCount = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    result += sentences[i].trim() + ' ';
    sentenceCount++;
    
    // Add paragraph break every 3-4 sentences
    if (sentenceCount >= 3 && i < sentences.length - 1) {
      result += '\n\n';
      sentenceCount = 0;
    }
  }
  
  return result.trim();
}