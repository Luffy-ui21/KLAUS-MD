// commands/ai/deepseek-plus.js
import fetch from "node-fetch";
import { downloadMediaMessage } from "wolfsocket";
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: "deepseek+",
  alias: ["ds+", "deepseekfile", "deepfile", "wolfvision"],
  desc: "DeepSeek AI with file upload via OpenRouter 📎 (Images, PDF, TXT, etc.)",
  category: "AI",
  usage: ".deepseek+ <question> [reply to file]",
  cooldown: 5,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const query = args.join(" ").trim();

    try {
      // Check if there's a quoted message
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      if (!query && !quoted) {
        return sock.sendMessage(jid, {
          text: `╭─⌈ 📎 *DEEPSEEK+ AI* 🧠 ⌋\n├─⊷ *.deepseek+ <question> (reply to file)*\n│  └⊷ Analyze file with DeepSeek\n├─⊷ *.ds+ <question> (reply to file)*\n│  └⊷ Alias for deepseek+\n├─⊷ *.deepseek+ --code <question>*\n│  └⊷ Use DeepSeek Coder model\n├─⊷ *.deepseek+ --vision <question>*\n│  └⊷ Use Gemini Pro Vision model\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }

      // Check for model flags
      let model = "deepseek/deepseek-chat";
      let cleanQuery = query;
      let modelName = "DeepSeek Chat";
      
      const modelFlags = {
        '--code': { id: "deepseek/deepseek-coder", name: "DeepSeek Coder" },
        '--coder': { id: "deepseek/deepseek-coder", name: "DeepSeek Coder" },
        '--vision': { id: "google/gemini-pro-vision", name: "Gemini Pro Vision" },
        '--gemini': { id: "google/gemini-pro-vision", name: "Gemini Pro Vision" },
        '--r1': { id: "deepseek/deepseek-r1", name: "DeepSeek R1" }
      };
      
      for (const [flag, modelInfo] of Object.entries(modelFlags)) {
        if (query.includes(flag)) {
          model = modelInfo.id;
          modelName = modelInfo.name;
          cleanQuery = query.replace(flag, '').trim();
          break;
        }
      }

      // Get OpenRouter API key
      const apiKey = getOpenRouterKey();
      
      if (!apiKey || !apiKey.startsWith('sk-or-v1')) {
        return sock.sendMessage(jid, {
          text: `🔑 *OpenRouter API Key*\n\n` +
                `API key not properly configured.\n\n` +
                `Contact bot administrator.`
        }, { quoted: m });
      }

      // Download and process file if quoted
      let fileData = null;
      let fileName = "Unknown";
      let fileType = "unknown";
      
      if (quoted) {
        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        fileData = await downloadAndProcessFile(sock, quoted);
        
        if (!fileData) {
          await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
          return sock.sendMessage(jid, {
            text: `❌ *File Download Failed*\n\n` +
                  `Could not download the file.\n` +
                  `Make sure file isn't too large.\n\n` +
                  `💡 Try sending the file again.`
          }, { quoted: m });
        }

        fileName = fileData.name;
        fileType = fileData.type;
      }

      if (!quoted) {
        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
      }

      // Call OpenRouter API with file
      const result = await callOpenRouterWithFile(
        cleanQuery || "Analyze this file",
        fileData,
        apiKey,
        model
      );

      if (!result.success) {
        let errorMsg = result.error;
        let suggestion = "Try a different file or question";
        
        if (errorMsg.includes("large") || errorMsg.includes("size")) {
          suggestion = "File too large. Try smaller file (<5MB)";
        } else if (errorMsg.includes("format") || errorMsg.includes("type")) {
          suggestion = "File format not supported. Try image or text file";
        } else if (errorMsg.includes("credit") || errorMsg.includes("balance")) {
          suggestion = "Out of OpenRouter credits. Contact admin.";
        } else if (errorMsg.includes("vision") && model.includes("deepseek")) {
          suggestion = "DeepSeek vision may not support this file. Try --vision flag for Gemini";
        }
        
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *Analysis Error*\n\n` +
                `*Model:* ${modelName}\n` +
                `*File:* ${fileName}\n` +
                `*Error:* ${errorMsg}\n\n` +
                `💡 *Solution:* ${suggestion}`
        }, { quoted: m });
      }

      // Format and send response
      const analysisReply = formatAnalysisResponse(
        result.reply,
        cleanQuery || "File analysis",
        modelName,
        fileName,
        fileType,
        result.usage
      );

      await sock.sendMessage(jid, { text: analysisReply }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

      // Show cost if significant
      if (result.usage?.total_cost && result.usage.total_cost > 0.001) {
        await sock.sendMessage(jid, {
          text: `💰 *Cost:* $${result.usage.total_cost.toFixed(6)}\n` +
                `📊 *Tokens:* ${result.usage.total_tokens?.toLocaleString() || '?'}`
        });
      }

    } catch (err) {
      console.error("❌ [DEEPSEEK+ ERROR]:", err);
      
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `📎 *DeepSeek+ Error*\n\n` +
              `*Details:* ${err.message}\n\n` +
              `🔧 *Try:*\n` +
              `• Smaller files (<5MB)\n` +
              `• Common formats (JPG, PNG, PDF, TXT)\n` +
              `• .deepseek for text-only\n` +
              `• .ai for other models`
      }, { quoted: m });
    }
  }
};

// ============================================
// OPENROUTER API KEY (Your existing key)
// ============================================

function getOpenRouterKey() {
  return process.env.OPENROUTER_API_KEY || '';
}

// ============================================
// FILE DOWNLOAD AND PROCESSING
// ============================================

async function downloadAndProcessFile(sock, quotedMessage) {
  try {
    // Check media type
    const mediaTypes = ['imageMessage', 'documentMessage', 'videoMessage'];
    const mediaType = mediaTypes.find(type => quotedMessage[type]);
    
    if (!mediaType) return null;

    // Download media
    const messageObj = {
      key: { remoteJid: "temp", id: "temp" },
      message: { ...quotedMessage }
    };
    
    const buffer = await downloadMediaMessage(
      messageObj,
      "buffer",
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );

    if (!buffer || buffer.length === 0) {
      throw new Error("Empty file received");
    }

    // Get file info
    let fileName = "file";
    let mimeType = "application/octet-stream";
    
    if (mediaType === 'documentMessage') {
      fileName = quotedMessage.documentMessage.fileName || "document";
      mimeType = quotedMessage.documentMessage.mimetype || mimeType;
    } else if (mediaType === 'imageMessage') {
      fileName = "image.jpg";
      mimeType = quotedMessage.imageMessage.mimetype || "image/jpeg";
    } else if (mediaType === 'videoMessage') {
      fileName = "video.mp4";
      mimeType = quotedMessage.videoMessage.mimetype || "video/mp4";
    }

    // Extract text from text-based files
    let textContent = null;
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    const textExtensions = ['txt', 'pdf', 'doc', 'docx', 'js', 'py', 'java', 'cpp', 'c', 
                           'html', 'css', 'json', 'xml', 'md', 'csv', 'log', 'yml', 'yaml'];
    
    if (textExtensions.includes(fileExt) && buffer.length < 500000) { // < 500KB
      try {
        textContent = buffer.toString('utf-8');
        // Limit text length
        if (textContent.length > 100000) {
          textContent = textContent.substring(0, 100000) + "... [truncated]";
        }
      } catch (e) {
        console.log("Could not extract text:", e.message);
      }
    }

    return {
      buffer,
      name: fileName,
      type: mimeType,
      size: buffer.length,
      textContent,
      isText: !!textContent,
      extension: fileExt
    };

  } catch (error) {
    console.error("File processing error:", error);
    return null;
  }
}

// ============================================
// OPENROUTER API WITH FILE SUPPORT
// ============================================

async function callOpenRouterWithFile(query, fileData, apiKey, model = "deepseek/deepseek-chat") {
  try {
    const startTime = Date.now();
    
    // Prepare messages array
    const messages = [];
    
    // Add system message
    messages.push({
      role: "system",
      content: `You are ${getBotName()} File Analyzer. Analyze files thoroughly and provide helpful insights.
               For images: Describe content, text, objects, colors.
               For documents: Summarize, extract key points.
               For code: Explain, find bugs, suggest improvements.
               For videos: Describe scenes, actions, content.
               Be detailed but concise.`
    });

    // Prepare content array
    const content = [{ type: "text", text: query }];

    // Add file content based on type
    if (fileData) {
      if (fileData.isText && fileData.textContent) {
        // For text files, send as text
        content.push({
          type: "text",
          text: `File: ${fileData.name}\nContent:\n${fileData.textContent}`
        });
      } else {
        // For images/videos, send as base64
        const base64Data = fileData.buffer.toString('base64');
        
        if (model.includes("gemini") || model.includes("vision")) {
          // Gemini expects image_url format
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${fileData.type};base64,${base64Data}`
            }
          });
        } else {
          // DeepSeek expects similar format
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${fileData.type};base64,${base64Data}`
            }
          });
        }
      }
    }

    messages.push({ role: "user", content });

    // Call OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://wolfbot.com",
        "X-Title": "WolfBot File Analysis"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 3000,
        top_p: 0.9
      }),
      timeout: 90000 // 90 seconds for file processing
    });

    const data = await response.json();
    const latency = Date.now() - startTime;

    if (!response.ok) {
      console.error("OpenRouter File Error:", data);
      
      let errorMessage = "File analysis failed";
      const status = response.status;
      
      const errorMap = {
        400: "Invalid file format or too large",
        413: "File too large (>10MB)",
        415: "Unsupported media type",
        429: "Rate limit exceeded",
        500: "Server error during analysis"
      };
      
      if (errorMap[status]) {
        errorMessage = errorMap[status];
      } else if (data.error?.message) {
        errorMessage = data.error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
        code: status,
        latency
      };
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
      return {
        success: false,
        error: "No analysis generated",
        latency,
        details: data
      };
    }

    return {
      success: true,
      reply: data.choices[0].message.content.trim(),
      model: data.model || model,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
        total_cost: data.usage?.total_cost || 0,
        latency
      },
      id: data.id,
      provider: "OpenRouter"
    };

  } catch (error) {
    console.error("OpenRouter File Network Error:", error);
    
    return {
      success: false,
      error: error.message || "Network timeout",
      details: error.code
    };
  }
}

// ============================================
// RESPONSE FORMATTING
// ============================================

function formatAnalysisResponse(reply, query, model, fileName, fileType, usage = {}) {
  const fileInfo = fileName ? 
    `📎 *File:* ${fileName}\n` +
    `📁 *Type:* ${fileType}\n` : '';
  
  // const tokenInfo = usage.total_tokens ? 
  //   `📊 *Tokens:* ${usage.total_tokens.toLocaleString()}` : '';
  
  // const costInfo = usage.total_cost ? 
  //   `💰 *Cost:* $${usage.total_cost.toFixed(6)}` : '';
  
  // const latencyInfo = usage.latency ? 
  //   `⏱️ *Time:* ${usage.latency}ms` : '';

  // Format code blocks
  const formattedReply = reply.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang ? ` (${lang})` : '';
    return `📝 *Code${language}:*\n${code}\n`;
  });

  return `📎 *${getBotName()} DeepSeek+* 🧠
━━━━━━━━━━━━━━━━

${fileInfo}*Model:* ${model}
*Via:* OpenRouter

🗨️ *Query:*
${query.substring(0, 150)}${query.length > 150 ? '...' : ''}

━━━━━━━━━━━━━━━━

💭 *Analysis:*
${formattedReply.substring(0, 3500)}

━━━━━━━━━━━━━━━━


 *${getBotName()} File Analysis*`;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const deepseekPlusUtils = {
  analyzeFile: async (fileBuffer, query, options = {}) => {
    const apiKey = getOpenRouterKey();
    const model = options.model || "deepseek/deepseek-chat";
    
    const fileData = {
      buffer: fileBuffer,
      name: options.fileName || "file",
      type: options.mimeType || "application/octet-stream",
      size: fileBuffer.length,
      textContent: options.textContent || null,
      isText: !!options.textContent
    };
    
    return await callOpenRouterWithFile(query, fileData, apiKey, model);
  },

  supportedFormats: () => {
    return {
      images: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
      documents: [".pdf", ".txt", ".doc", ".docx", ".md"],
      code: [".js", ".py", ".java", ".cpp", ".c", ".html", ".css", ".json", ".xml"],
      data: [".csv", ".xlsx", ".xls"],
      videos: [".mp4", ".mov", ".avi"] // Short clips only
    };
  },

  getMaxFileSize: () => {
    return {
      images: "10MB",
      documents: "5MB",
      textFiles: "500KB",
      videos: "20MB (short clips)"
    };
  },

  testFileSupport: async () => {
    try {
      // Create a simple test image
      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );
      
      const apiKey = getOpenRouterKey();
      const result = await deepseekPlusUtils.analyzeFile(
        testBuffer,
        "Describe this image",
        { fileName: "test.png", mimeType: "image/png" }
      );
      
      return {
        success: result.success,
        message: result.success ? 'File analysis working' : result.error,
        apiKeyValid: apiKey && apiKey.startsWith('sk-or-v1')
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
};