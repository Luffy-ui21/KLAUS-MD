import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'summarize',
  description: 'Summarize long text or notes into key points',
  category: 'ai',
  aliases: ['summary', 'summarise', 'summarize'],
  usage: 'summarize [text/notes to summarize]',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const senderJid = m.key.participant || jid;
    
    // ====== HELP SECTION ======
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      const helpText = `╭─⌈ 📝 *SUMMARIZER* ⌋\n├─⊷ *${PREFIX}summarize <text>*\n│  └⊷ Summarize long text\n├─⊷ *${PREFIX}summary <text>*\n│  └⊷ Alias for summarize\n├─⊷ *${PREFIX}summarize brief: <text>*\n│  └⊷ Brief 1-2 sentence summary\n├─⊷ *${PREFIX}summarize bullets: <text>*\n│  └⊷ Summary in bullet points\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    let textToSummarize = args.join(' ');
    
    // Check for quoted message
    if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
      const quotedText = quotedMsg.conversation || 
                        quotedMsg.extendedTextMessage?.text ||
                        quotedMsg.imageMessage?.caption ||
                        '';
      
      if (quotedText.trim().length > 0) {
        textToSummarize = quotedText + (textToSummarize ? '\n\nAdditional: ' + textToSummarize : '');
      }
    }

    // Minimum text length check
    if (textToSummarize.length < 20) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ ❌ *TEXT TOO SHORT* ⌋\n├─⊷ *${PREFIX}summarize <text>*\n│  └⊷ Provide at least 20 characters\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    // ====== SUMMARIZATION OPTIONS ======
    const summaryTypes = {
      'brief': 'Provide a very brief summary (1-2 sentences)',
      'detailed': 'Provide a detailed summary with key points',
      'bullets': 'Provide summary in bullet points',
      'paragraph': 'Provide summary in paragraph form'
    };

    let summaryType = 'auto'; // Default
    let cleanText = textToSummarize;
    
    // Check for summary type specification
    const typeMatch = textToSummarize.match(/^(brief|detailed|bullets|paragraph):\s*(.+)/i);
    if (typeMatch) {
      summaryType = typeMatch[1].toLowerCase();
      cleanText = typeMatch[2];
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // ====== ENHANCED PROMPT FOR SUMMARIZATION ======
      let summaryPrompt = `Please summarize the following text`;
      
      switch(summaryType) {
        case 'brief':
          summaryPrompt += ` in 1-2 sentences maximum. Be very concise:\n\n`;
          break;
        case 'detailed':
          summaryPrompt += ` in detail, capturing all main points and important details:\n\n`;
          break;
        case 'bullets':
          summaryPrompt += ` using bullet points. Each bullet should be a key point:\n\n`;
          break;
        case 'paragraph':
          summaryPrompt += ` in a well-structured paragraph:\n\n`;
          break;
        default:
          summaryPrompt += ` appropriately. If text is long, use bullet points. If short, use paragraph:\n\n`;
      }
      
      summaryPrompt += `${cleanText}\n\n`;
      summaryPrompt += `IMPORTANT: Provide ONLY the summary, no additional commentary or labels.`;

      // ====== API REQUEST ======
      const apiUrl = 'https://iamtkm.vercel.app/ai/gpt5';
      const apiKey = 'tkm';
      
      console.log(`📝 Summarization Request [${summaryType}]: ${cleanText.length} chars`);
      
      const response = await axios({
        method: 'GET',
        url: apiUrl,
        params: {
          apikey: apiKey,
          text: summaryPrompt
        },
        timeout: 30000, // 30 seconds
        headers: {
          'User-Agent': 'WolfBot-Summarizer/1.0',
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });


      // ====== PARSE RESPONSE ======
      let summary = '';
      
      if (response.data && typeof response.data === 'object') {
        const data = response.data;
        
        if (data.status === true && data.result) {
          summary = data.result;
        } else if (data.response) {
          summary = data.response;
        } else if (data.answer) {
          summary = data.answer;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
          summary = data.choices[0].message.content;
        } else {
          summary = JSON.stringify(data, null, 2);
        }
      } else if (typeof response.data === 'string') {
        summary = response.data;
      } else {
        summary = 'Failed to generate summary. Please try again.';
      }
      
      // Clean up the summary (remove any prompt remnants)
      summary = summary.replace(/Please summarize.*?:?\s*/i, '');
      summary = summary.replace(/^(summary|summarized?):?\s*/i, '');
      summary = summary.trim();

      // ====== FORMAT FINAL MESSAGE ======
      const originalWords = cleanText.split(/\s+/).length;
      const summaryWords = summary.split(/\s+/).length;
      const reduction = Math.round((1 - (summaryWords / originalWords)) * 100);
      
      let resultText = `📝 *${getBotName()} SUMMARIZER*\n\n`;
      
      // Original text preview
      const preview = cleanText.length > 100 
        ? cleanText.substring(0, 100) + '...' 
        : cleanText;
      resultText += `📄 *Original:* ${preview}\n\n`;
      
      // Summary
      resultText += `✨ *Summary:*\n${summary}\n\n`;
      
      // Statistics
      resultText += `📊 *Statistics:*\n`;
      resultText += `• Original: ${originalWords} words\n`;
      resultText += `• Summary: ${summaryWords} words\n`;
      resultText += `• Reduction: ${reduction}%\n`;
      resultText += `• Type: ${summaryType.charAt(0).toUpperCase() + summaryType.slice(1)}\n\n`;
      
      // Usage tips
      resultText += `💡 *Usage Tips:*\n`;
      resultText += `• Add \`brief:\` for short summaries\n`;
      resultText += `• Add \`detailed:\` for comprehensive summaries\n`;
      resultText += `• Add \`bullets:\` for bullet points\n`;
      resultText += `• Add \`paragraph:\` for paragraph format\n`;
      resultText += `• Reply to a message to summarize it\n\n`;
      
      resultText += `${getFooter(m.key.participant || m.key.remoteJid)}`;

      // ====== SEND FINAL ANSWER ======
      await sock.sendMessage(jid, { text: resultText }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [Summarizer] ERROR:', error);
      
      let errorMessage = `❌ *SUMMARIZER ERROR*\n\n`;
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage += `• AI service is down\n`;
        errorMessage += `• Please try again later\n`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += `• Processing time exceeded (30s)\n`;
        errorMessage += `• Try with shorter text\n`;
      } else if (error.response?.status === 429) {
        errorMessage += `• Rate limit exceeded\n`;
        errorMessage += `• Too many requests\n`;
      } else {
        errorMessage += `• Error: ${error.message}\n`;
      }
      
      errorMessage += `\n🔧 *Troubleshooting:*\n`;
      errorMessage += `1. Try shorter text\n`;
      errorMessage += `2. Check internet connection\n`;
      errorMessage += `3. Wait 1 minute before retrying\n`;
      errorMessage += `4. Use \`${PREFIX}gpt\` for complex queries\n`;
      
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