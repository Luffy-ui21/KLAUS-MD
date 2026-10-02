// import axios from 'axios';

// export default {
//   name: 'humanizer',
//   description: 'Transform AI-generated text into more human-like writing',
//   category: 'ai',
//   aliases: ['humanize', 'makehuman', 'naturalize', 'rewrite'],
//   usage: 'humanizer [text or reply to message] [style]',
  
//   async execute(sock, m, args, PREFIX) {
//     const jid = m.key.remoteJid;
    
//     // Help section
//     if (args.length === 0 || args[0].toLowerCase() === 'help') {
//       const helpText = `✍️ *TEXT HUMANIZER*\n\n` +
//         `Transform AI-generated text into natural human-like writing\n\n` +
//         `📌 *Usage:*\n` +
//         `• \`${PREFIX}humanizer your text here\`\n` +
//         `• Reply to any message with \`${PREFIX}humanizer\`\n` +
//         `• Add style: \`${PREFIX}humanizer text casual\`\n\n` +
//         `🎨 *Available Styles:*\n` +
//         `• \`casual\` - Everyday conversation\n` +
//         `• \`professional\` - Business/work\n` +
//         `• \`creative\` - Storytelling/creative\n` +
//         `• \`academic\` - Educational content\n` +
//         `• \`social\` - Social media posts\n` +
//         `• \`email\` - Email communication\n` +
//         `• \`blog\` - Blog/article writing\n\n` +
//         `✨ *Features:*\n` +
//         `• Removes AI patterns\n` +
//         `• Adds natural variation\n` +
//         `• Improves readability\n` +
//         `• Adjusts tone and style\n` +
//         `• Preserves original meaning`;
      
//       return sock.sendMessage(jid, { text: helpText }, { quoted: m });
//     }

//     // Parse style if provided
//     const availableStyles = ['casual', 'professional', 'creative', 'academic', 'social', 'email', 'blog'];
//     let style = 'casual';
//     let textParts = args;
    
//     // Check if last arg is a style
//     if (availableStyles.includes(args[args.length - 1]?.toLowerCase())) {
//       style = args[args.length - 1].toLowerCase();
//       textParts = args.slice(0, -1);
//     }
    
//     // Get text to humanize
//     let text = textParts.join(' ');
    
//     // Check for quoted message
//     if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
//       const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
//       text = quoted.conversation || 
//              quoted.extendedTextMessage?.text || 
//              quoted.imageMessage?.caption ||
//              quoted.videoMessage?.caption ||
//              text;
//     }

//     if (!text || text.length < 10) {
//       return sock.sendMessage(jid, {
//         text: `❌ *Text Too Short*\n\n` +
//               `Please provide at least 10 characters to humanize.\n` +
//               `Example: \`${PREFIX}humanizer This is an AI-generated text that needs to sound more natural.\``
//       }, { quoted: m });
//     }

//     // Show processing message
//     const status = await sock.sendMessage(jid, {
//       text: `✍️ *HUMANIZING TEXT*\n\n` +
//             `📝 *Original:* "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"\n` +
//             `🎨 *Style:* ${style.toUpperCase()}\n` +
//             `⚡ *Transforming AI patterns into natural writing...*\n\n` +
//             `⏳ *Processing...*`
//     }, { quoted: m });

//     try {
//       // Step 1: Analyze text for AI patterns
//       const analysis = await analyzeTextForHumanization(text);
      
//       // Step 2: Apply humanization techniques
//       const humanizedText = await humanizeText(text, style, analysis);
      
//       // Step 3: Generate comparison report
//       const report = await generateHumanizationReport(text, humanizedText, style, analysis);
      
//       // Send result
//       await sock.sendMessage(jid, {
//         text: report,
//         edit: status.key
//       });

//     } catch (error) {
//       console.error('Humanizer error:', error);
      
//       // Fallback to local humanization
//       const humanizedText = localHumanizeText(text, style);
//       const report = generateSimpleReport(text, humanizedText, style);
      
//       await sock.sendMessage(jid, {
//         text: report + '\n\n⚠️ *Note: Using local humanization methods*',
//         edit: status.key
//       });
//     }
//   }
// };

// // ==================== TEXT ANALYSIS ====================

// async function analyzeTextForHumanization(text) {
//   console.log(`Analyzing text for humanization (${text.length} chars)`);
  
//   const analysis = {
//     aiIndicators: [],
//     humanIndicators: [],
//     improvementAreas: [],
//     toneScore: 0,
//     readabilityScore: 0,
//     personalizationScore: 0,
//     naturalnessScore: 0
//   };
  
//   // Check for common AI patterns
//   const aiPatterns = [
//     { pattern: /as an ai language model/i, name: 'AI disclaimer' },
//     { pattern: /based on my training data/i, name: 'Training data reference' },
//     { pattern: /i don't have personal (experiences|emotions)/i, name: 'Emotion disclaimer' },
//     { pattern: /firstly.*secondly.*thirdly/i, name: 'Numbered structure' },
//     { pattern: /in conclusion.*(to sum up|overall)/i, name: 'Formal conclusion' },
//     { pattern: /it is important to note that/i, name: 'Academic phrasing' },
//     { pattern: /this (ensures|guarantees|provides)/i, name: 'Corporate phrasing' },
//     { pattern: /\b(utilize|facilitate|implement|optimize)\b/i, name: 'Corporate jargon' },
//     { pattern: /on one hand.*on the other hand/i, name: 'Balanced perspective' },
//     { pattern: /there are several (reasons|factors|aspects)/i, name: 'Enumerative introduction' }
//   ];
  
//   // Check for human patterns
//   const humanPatterns = [
//     { pattern: /\b(lol|lmao|haha|hehe)\b/i, name: 'Laughter expressions' },
//     { pattern: /\b(omg|wtf|smh|tbh|imo)\b/i, name: 'Internet slang' },
//     { pattern: /i (think|feel|believe)/i, name: 'Personal opinion' },
//     { pattern: /in my (opinion|experience)/i, name: 'Personal perspective' },
//     { pattern: /personally.*i/i, name: 'Personal voice' },
//     { pattern: /\b(like|you know|i mean)\b/i, name: 'Conversational fillers' },
//     { pattern: /typo|mistake|error.*made/i, name: 'Self-correction' },
//     { pattern: /sorry.*(typo|mistake)/i, name: 'Apology for errors' }
//   ];
  
//   // Analyze sentence structure
//   const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   const words = text.split(/\s+/);
  
//   // Detect AI patterns
//   aiPatterns.forEach(({ pattern, name }) => {
//     if (pattern.test(text)) {
//       analysis.aiIndicators.push(name);
//     }
//   });
  
//   // Detect human patterns
//   humanPatterns.forEach(({ pattern, name }) => {
//     if (pattern.test(text)) {
//       analysis.humanIndicators.push(name);
//     }
//   });
  
//   // Sentence structure analysis
//   if (sentences.length > 0) {
//     const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
//     const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentences.length;
//     const lengthVariation = calculateStandardDeviation(sentenceLengths);
    
//     // AI text often has consistent sentence length
//     if (lengthVariation < 3) {
//       analysis.improvementAreas.push('Sentence length too consistent');
//     }
    
//     // Very long sentences
//     if (avgSentenceLength > 25) {
//       analysis.improvementAreas.push('Sentences too long');
//     }
    
//     // Analyze vocabulary
//     const uniqueWords = new Set(words.map(w => w.toLowerCase()));
//     const lexicalDiversity = uniqueWords.size / words.length;
    
//     if (lexicalDiversity < 0.4) {
//       analysis.improvementAreas.push('Low vocabulary diversity');
//     }
//   }
  
//   // Check for personal pronouns
//   const personalPronouns = countPersonalPronouns(text);
//   if (personalPronouns < 2) {
//     analysis.improvementAreas.push('Lack of personal pronouns');
//   }
  
//   // Check for contractions
//   const contractions = countContractions(text);
//   if (contractions < 1) {
//     analysis.improvementAreas.push('No contractions used');
//   }
  
//   // Check for emotional words
//   const emotionalWords = countEmotionalWords(text);
//   if (emotionalWords < 1) {
//     analysis.improvementAreas.push('Lack of emotional language');
//   }
  
//   // Calculate scores
//   analysis.toneScore = calculateToneScore(text);
//   analysis.readabilityScore = calculateReadabilityScore(text);
//   analysis.personalizationScore = calculatePersonalizationScore(text);
//   analysis.naturalnessScore = calculateNaturalnessScore(text);
  
//   return analysis;
// }

// // ==================== HUMANIZATION ENGINE ====================

// async function humanizeText(text, style, analysis) {
//   console.log(`Humanizing text with style: ${style}`);
  
//   try {
//     // Use GPT API for advanced humanization
//     const prompt = createHumanizationPrompt(text, style, analysis);
    
//     const response = await axios.get('https://iamtkm.vercel.app/ai/gpt5', {
//       params: {
//         apikey: 'tkm',
//         text: prompt
//       },
//       timeout: 30000
//     });
    
//     let humanizedText = response.data?.result || response.data?.response || '';
    
//     // Clean up the response
//     humanizedText = humanizedText
//       .replace(/^["']|["']$/g, '') // Remove quotes
//       .replace(/^Humanized text:\s*/i, '')
//       .replace(/^Response:\s*/i, '')
//       .trim();
    
//     // If API returns nonsense, fall back to local methods
//     if (humanizedText.length < text.length * 0.3 || humanizedText === text) {
//       throw new Error('API returned insufficient or identical text');
//     }
    
//     return humanizedText;
    
//   } catch (error) {
//     console.log('API failed, using local humanization');
//     return localHumanizeText(text, style);
//   }
// }

// function createHumanizationPrompt(originalText, style, analysis) {
//   const styleInstructions = {
//     casual: 'Make this sound like natural everyday conversation. Use contractions, informal language, and personal pronouns.',
//     professional: 'Make this professional but natural for business communication. Keep it clear and concise but not robotic.',
//     creative: 'Make this creative and engaging for storytelling. Add descriptive language and vary sentence structure.',
//     academic: 'Make this suitable for educational content. Keep it informative but more engaging and less formal.',
//     social: 'Make this perfect for social media. Keep it short, engaging, and use appropriate hashtags if relevant.',
//     email: 'Make this suitable for email communication. Professional but warm, with proper email structure.',
//     blog: 'Make this engaging for blog/article writing. Add personality while keeping it informative.'
//   };
  
//   let prompt = `Rewrite this text to sound more human and natural. `;
//   prompt += `${styleInstructions[style]}\n\n`;
  
//   // Add specific improvements based on analysis
//   if (analysis.improvementAreas.length > 0) {
//     prompt += `Specifically address these issues:\n`;
//     analysis.improvementAreas.forEach(area => {
//       prompt += `- ${area}\n`;
//     });
//     prompt += `\n`;
//   }
  
//   // Instructions for humanization
//   prompt += `Apply these humanization techniques:\n`;
//   prompt += `1. Remove any AI-sounding phrases\n`;
//   prompt += `2. Add natural variation in sentence length\n`;
//   prompt += `3. Use contractions where appropriate\n`;
//   prompt += `4. Add personal pronouns and opinions\n`;
//   prompt += `5. Make the tone match ${style} style\n`;
//   prompt += `6. Keep the original meaning intact\n`;
//   prompt += `7. Make it sound like a real person wrote it\n\n`;
  
//   prompt += `Text to humanize:\n"${originalText}"\n\n`;
//   prompt += `Provide ONLY the humanized version without any explanation.`;
  
//   return prompt;
// }

// // ==================== LOCAL HUMANIZATION (FALLBACK) ====================

// function localHumanizeText(text, style) {
//   console.log(`Using local humanization for style: ${style}`);
  
//   // Apply multiple transformation passes
//   let humanized = text;
  
//   // Pass 1: Remove AI patterns
//   humanized = removeAIPatterns(humanized);
  
//   // Pass 2: Apply style-specific transformations
//   humanized = applyStyleTransformations(humanized, style);
  
//   // Pass 3: Add natural variations
//   humanized = addNaturalVariations(humanized);
  
//   // Pass 4: Improve readability
//   humanized = improveReadability(humanized);
  
//   return humanized;
// }

// function removeAIPatterns(text) {
//   let result = text;
  
//   // Remove AI disclaimers
//   const aiPhrases = [
//     { pattern: /\bas an ai language model\b/gi, replacement: '' },
//     { pattern: /\bbased on my training data\b/gi, replacement: 'Based on what I know' },
//     { pattern: /\bi don't have personal (experiences|emotions)\b/gi, replacement: '' },
//     { pattern: /\bas a large language model\b/gi, replacement: '' },
//     { pattern: /\bi am an ai\b/gi, replacement: '' },
//     { pattern: /\bi cannot (feel|experience|have emotions)\b/gi, replacement: '' }
//   ];
  
//   aiPhrases.forEach(({ pattern, replacement }) => {
//     result = result.replace(pattern, replacement);
//   });
  
//   // Replace formal academic phrases
//   const formalPhrases = [
//     { pattern: /\bit is important to note that\b/gi, replacement: 'It\'s worth noting that' },
//     { pattern: /\bin conclusion\b/gi, replacement: 'So to wrap up' },
//     { pattern: /\bto sum up\b/gi, replacement: 'In short' },
//     { pattern: /\bwith regard to\b/gi, replacement: 'About' },
//     { pattern: /\bin order to\b/gi, replacement: 'To' },
//     { pattern: /\bwith the purpose of\b/gi, replacement: 'To' },
//     { pattern: /\bat this point in time\b/gi, replacement: 'Now' },
//     { pattern: /\bdue to the fact that\b/gi, replacement: 'Because' }
//   ];
  
//   formalPhrases.forEach(({ pattern, replacement }) => {
//     result = result.replace(pattern, replacement);
//   });
  
//   return result.trim();
// }

// function applyStyleTransformations(text, style) {
//   let result = text;
  
//   switch (style) {
//     case 'casual':
//       result = makeTextCasual(result);
//       break;
//     case 'professional':
//       result = makeTextProfessional(result);
//       break;
//     case 'creative':
//       result = makeTextCreative(result);
//       break;
//     case 'academic':
//       result = makeTextAcademic(result);
//       break;
//     case 'social':
//       result = makeTextSocial(result);
//       break;
//     case 'email':
//       result = makeTextEmail(result);
//       break;
//     case 'blog':
//       result = makeTextBlog(result);
//       break;
//   }
  
//   return result;
// }

// function makeTextCasual(text) {
//   let result = text;
  
//   // Add contractions
//   result = addContractions(result);
  
//   // Add conversational fillers occasionally
//   if (Math.random() > 0.7) {
//     const fillers = ['You know, ', 'I mean, ', 'Honestly, ', 'Basically, '];
//     const sentences = result.split(/(?<=[.!?])\s+/);
//     if (sentences.length > 0) {
//       sentences[0] = fillers[Math.floor(Math.random() * fillers.length)] + sentences[0];
//       result = sentences.join(' ');
//     }
//   }
  
//   // Add personal pronouns
//   result = addPersonalPronouns(result);
  
//   // Shorten sentences
//   result = shortenSentences(result);
  
//   return result;
// }

// function makeTextProfessional(text) {
//   let result = text;
  
//   // Remove overly casual language
//   result = result.replace(/\b(lol|lmao|omg|wtf)\b/gi, '');
  
//   // Ensure clarity but keep natural flow
//   result = improveClarity(result);
  
//   // Add appropriate professional tone
//   const sentences = result.split(/(?<=[.!?])\s+/);
//   if (sentences.length > 0 && !/^thanks|^thank you/i.test(sentences[0])) {
//     sentences[0] = 'I wanted to share that ' + sentences[0].toLowerCase();
//     result = sentences.join(' ');
//   }
  
//   return result;
// }

// function makeTextCreative(text) {
//   let result = text;
  
//   // Add descriptive adjectives
//   const adjectives = ['amazing', 'incredible', 'fascinating', 'interesting', 'remarkable'];
//   const words = result.split(' ');
//   const descriptiveWords = words.filter(w => 
//     /^[A-Z][a-z]+$/.test(w) && w.length > 5
//   );
  
//   if (descriptiveWords.length > 0) {
//     const randomIndex = Math.floor(Math.random() * descriptiveWords.length);
//     const wordIndex = words.indexOf(descriptiveWords[randomIndex]);
//     if (wordIndex > 0) {
//       const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
//       words[wordIndex] = adj + ' ' + words[wordIndex];
//       result = words.join(' ');
//     }
//   }
  
//   // Vary sentence structure more
//   result = varySentenceStructure(result);
  
//   // Add sensory language
//   const sensoryWords = ['feel', 'see', 'hear', 'imagine', 'experience'];
//   sensoryWords.forEach(word => {
//     if (!result.toLowerCase().includes(word) && Math.random() > 0.8) {
//       const sentences = result.split(/(?<=[.!?])\s+/);
//       if (sentences.length > 0) {
//         const randomSentence = Math.floor(Math.random() * sentences.length);
//         sentences[randomSentence] = `You can almost ${word} it - ${sentences[randomSentence].toLowerCase()}`;
//         result = sentences.join(' ');
//       }
//     }
//   });
  
//   return result;
// }

// function makeTextAcademic(text) {
//   let result = text;
  
//   // Keep it informative but more engaging
//   result = result.replace(/\bit is important to note that\b/gi, 'What\'s interesting is that');
//   result = result.replace(/\bin this essay\b/gi, 'Here');
  
//   // Add transition words for flow
//   const transitions = ['Moreover, ', 'Additionally, ', 'Furthermore, ', 'However, '];
//   const sentences = result.split(/(?<=[.!?])\s+/);
  
//   for (let i = 1; i < sentences.length && i < 4; i++) {
//     if (Math.random() > 0.5) {
//       sentences[i] = transitions[Math.floor(Math.random() * transitions.length)] + sentences[i];
//     }
//   }
  
//   result = sentences.join(' ');
  
//   return result;
// }

// function makeTextSocial(text) {
//   let result = text;
  
//   // Shorten significantly
//   result = shortenText(result, 280); // Twitter-like length
  
//   // Add hashtags if relevant
//   const topics = extractTopics(text);
//   if (topics.length > 0) {
//     const hashtags = topics.slice(0, 3).map(t => `#${t.replace(/\s+/g, '')}`);
//     result += ' ' + hashtags.join(' ');
//   }
  
//   // Add emojis occasionally
//   const emojis = ['😊', '✨', '🌟', '💡', '👍', '🔥'];
//   if (Math.random() > 0.5) {
//     const sentences = result.split(/(?<=[.!?])\s+/);
//     if (sentences.length > 0) {
//       const lastSentence = sentences[sentences.length - 1];
//       sentences[sentences.length - 1] = lastSentence + ' ' + emojis[Math.floor(Math.random() * emojis.length)];
//       result = sentences.join(' ');
//     }
//   }
  
//   return result;
// }

// function makeTextEmail(text) {
//   let result = text;
  
//   // Add email structure
//   const sentences = result.split(/(?<=[.!?])\s+/);
  
//   if (sentences.length > 0) {
//     // Add greeting if missing
//     if (!/^(hi|hello|dear|hi there)/i.test(sentences[0])) {
//       const greetings = ['Hi there,', 'Hello,', 'Hi,', 'Hey,'];
//       sentences[0] = greetings[Math.floor(Math.random() * greetings.length)] + ' ' + sentences[0];
//     }
    
//     // Add closing if missing
//     if (!/(best|regards|thanks|sincerely)/i.test(sentences[sentences.length - 1])) {
//       const closings = ['Best regards,', 'Thanks,', 'Cheers,', 'Take care,'];
//       sentences.push(closings[Math.floor(Math.random() * closings.length)]);
//     }
    
//     result = sentences.join('\n\n');
//   }
  
//   return result;
// }

// function makeTextBlog(text) {
//   let result = text;
  
//   // Make it more engaging for reading
//   const sentences = result.split(/(?<=[.!?])\s+/);
  
//   if (sentences.length > 0) {
//     // Add a hook/question at the beginning
//     if (!/\?$/.test(sentences[0])) {
//       const hooks = [
//         'Have you ever wondered... ',
//         'Let me tell you something interesting... ',
//         'Here\'s what I discovered... '
//       ];
//       sentences[0] = hooks[Math.floor(Math.random() * hooks.length)] + sentences[0];
//     }
    
//     // Add paragraph breaks for readability
//     result = sentences.join('\n\n');
//   }
  
//   // Add subheadings if long enough
//   if (result.length > 300) {
//     const parts = result.split('\n\n');
//     if (parts.length > 2) {
//       parts[1] = '## The Key Points\n\n' + parts[1];
//       result = parts.join('\n\n');
//     }
//   }
  
//   return result;
// }

// function addNaturalVariations(text) {
//   let result = text;
  
//   // Vary sentence length
//   result = varySentenceLength(result);
  
//   // Add occasional conversational elements
//   if (Math.random() > 0.7) {
//     const conversational = ['By the way, ', 'Actually, ', 'You know what? ', 'Interesting thing is, '];
//     const sentences = result.split(/(?<=[.!?])\s+/);
//     if (sentences.length > 1) {
//       const insertAt = Math.floor(Math.random() * (sentences.length - 1)) + 1;
//       sentences.splice(insertAt, 0, conversational[Math.floor(Math.random() * conversational.length)]);
//       result = sentences.join(' ');
//     }
//   }
  
//   // Add occasional personal reflection
//   if (Math.random() > 0.8) {
//     const reflections = [
//       ' I find this really fascinating.',
//       ' It\'s something worth thinking about.',
//       ' This reminds me of something similar.',
//       ' What do you think about this?'
//     ];
//     result += reflections[Math.floor(Math.random() * reflections.length)];
//   }
  
//   return result;
// }

// function improveReadability(text) {
//   let result = text;
  
//   // Break up long sentences
//   const sentences = result.split(/(?<=[.!?])\s+/);
//   const improvedSentences = sentences.map(sentence => {
//     if (sentence.split(/\s+/).length > 25) {
//       // Split on conjunctions or commas
//       const parts = sentence.split(/(, and|, but|, or|, so|;)/);
//       if (parts.length > 1) {
//         return parts.join(' '); // Keep split but add space
//       } else {
//         // Split on commas
//         const commaParts = sentence.split(/,/);
//         if (commaParts.length > 1) {
//           return commaParts.slice(0, -1).join(',') + '. ' + commaParts[commaParts.length - 1];
//         }
//       }
//     }
//     return sentence;
//   });
  
//   result = improvedSentences.join(' ');
  
//   // Ensure proper spacing
//   result = result.replace(/\s+/g, ' ').replace(/\s([.,!?])/g, '$1');
  
//   return result;
// }

// // ==================== UTILITY FUNCTIONS ====================

// function addContractions(text) {
//   const contractionsMap = {
//     'do not': 'don\'t',
//     'does not': 'doesn\'t',
//     'did not': 'didn\'t',
//     'cannot': 'can\'t',
//     'could not': 'couldn\'t',
//     'will not': 'won\'t',
//     'would not': 'wouldn\'t',
//     'should not': 'shouldn\'t',
//     'is not': 'isn\'t',
//     'are not': 'aren\'t',
//     'was not': 'wasn\'t',
//     'were not': 'weren\'t',
//     'have not': 'haven\'t',
//     'has not': 'hasn\'t',
//     'had not': 'hadn\'t',
//     'i am': 'I\'m',
//     'you are': 'you\'re',
//     'he is': 'he\'s',
//     'she is': 'she\'s',
//     'it is': 'it\'s',
//     'we are': 'we\'re',
//     'they are': 'they\'re',
//     'there is': 'there\'s',
//     'there are': 'there\'re',
//     'that is': 'that\'s',
//     'what is': 'what\'s',
//     'who is': 'who\'s',
//     'where is': 'where\'s',
//     'when is': 'when\'s',
//     'why is': 'why\'s',
//     'how is': 'how\'s'
//   };
  
//   let result = text;
//   Object.entries(contractionsMap).forEach(([full, contraction]) => {
//     const regex = new RegExp(`\\b${full}\\b`, 'gi');
//     result = result.replace(regex, contraction);
//   });
  
//   return result;
// }

// function addPersonalPronouns(text) {
//   let result = text;
//   const sentences = result.split(/(?<=[.!?])\s+/);
  
//   // Check if first person is used, if not, add it to some sentences
//   const hasFirstPerson = /I |me |my |mine |we |us |our/i.test(text);
  
//   if (!hasFirstPerson && sentences.length > 0) {
//     // Add "I think" or similar to some sentences
//     for (let i = 0; i < Math.min(2, sentences.length); i++) {
//       if (Math.random() > 0.5) {
//         const starters = ['I think ', 'I believe ', 'I feel ', 'In my opinion, '];
//         sentences[i] = starters[Math.floor(Math.random() * starters.length)] + sentences[i].toLowerCase();
//       }
//     }
//     result = sentences.join(' ');
//   }
  
//   return result;
// }

// function shortenSentences(text) {
//   const sentences = text.split(/(?<=[.!?])\s+/);
//   const shortened = sentences.map(sentence => {
//     const words = sentence.split(/\s+/);
//     if (words.length > 20) {
//       // Try to split on conjunctions
//       const conjunctions = [' and ', ' but ', ' or ', ' so ', ' yet ', ' however ', ' therefore '];
//       for (const conj of conjunctions) {
//         if (sentence.includes(conj)) {
//           const parts = sentence.split(conj);
//           if (parts.length > 1) {
//             return parts[0] + '.' + conj + parts.slice(1).join(conj);
//           }
//         }
//       }
      
//       // Split on commas
//       const commaParts = sentence.split(/,/);
//       if (commaParts.length > 2) {
//         return commaParts[0] + '. ' + commaParts.slice(1).join(',');
//       }
//     }
//     return sentence;
//   });
  
//   return shortened.join(' ');
// }

// function improveClarity(text) {
//   let result = text;
  
//   // Replace complex words with simpler ones where appropriate
//   const simplifications = [
//     { complex: /\butilize\b/gi, simple: 'use' },
//     { complex: /\bfacilitate\b/gi, simple: 'help' },
//     { complex: /\bimplement\b/gi, simple: 'put in place' },
//     { complex: /\boptimize\b/gi, simple: 'improve' },
//     { complex: /\bstrategize\b/gi, simple: 'plan' },
//     { complex: /\bleverage\b/gi, simple: 'use' },
//     { complex: /\bsynergize\b/gi, simple: 'work together' },
//     { complex: /\bparadigm\b/gi, simple: 'model' },
//     { complex: /\bbandwidth\b/gi, simple: 'time' },
//     { complex: /\btouch base\b/gi, simple: 'check in' }
//   ];
  
//   simplifications.forEach(({ complex, simple }) => {
//     result = result.replace(complex, simple);
//   });
  
//   return result;
// }

// function varySentenceStructure(text) {
//   const sentences = text.split(/(?<=[.!?])\s+/);
//   const varied = sentences.map((sentence, index) => {
//     // Every few sentences, change the structure
//     if (index % 3 === 0 && index > 0) {
//       const starters = [
//         'What\'s really interesting is that ',
//         'The thing is, ',
//         'Here\'s the key point: ',
//         'Let me put it this way: '
//       ];
//       return starters[Math.floor(Math.random() * starters.length)] + sentence.toLowerCase();
//     }
//     return sentence;
//   });
  
//   return varied.join(' ');
// }

// function shortenText(text, maxLength) {
//   if (text.length <= maxLength) return text;
  
//   // Try to cut at a sentence boundary
//   const sentences = text.split(/(?<=[.!?])\s+/);
//   let result = '';
  
//   for (const sentence of sentences) {
//     if ((result + ' ' + sentence).length <= maxLength) {
//       result += (result ? ' ' : '') + sentence;
//     } else {
//       break;
//     }
//   }
  
//   // If still too long, cut at word boundary
//   if (result.length === 0 || result.length > maxLength) {
//     result = text.substring(0, maxLength - 3);
//     const lastSpace = result.lastIndexOf(' ');
//     if (lastSpace > maxLength * 0.7) {
//       result = result.substring(0, lastSpace);
//     }
//     result += '...';
//   }
  
//   return result;
// }

// function extractTopics(text) {
//   const words = text.toLowerCase().split(/\s+/);
//   const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
  
//   // Count word frequencies
//   const freq = {};
//   words.forEach(word => {
//     const cleanWord = word.replace(/[^a-z]/g, '');
//     if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
//       freq[cleanWord] = (freq[cleanWord] || 0) + 1;
//     }
//   });
  
//   // Get top 5 words
//   return Object.entries(freq)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 5)
//     .map(([word]) => word);
// }

// function varySentenceLength(text) {
//   const sentences = text.split(/(?<=[.!?])\s+/);
  
//   // Ensure variation in sentence length
//   const variedSentences = sentences.map((sentence, index) => {
//     const words = sentence.split(/\s+/).length;
    
//     // Occasionally create very short sentences for emphasis
//     if (index > 0 && index % 4 === 0 && words > 10) {
//       // Split into two shorter sentences
//       const midpoint = Math.floor(words / 2);
//       const sentenceWords = sentence.split(/\s+/);
//       const firstPart = sentenceWords.slice(0, midpoint).join(' ');
//       const secondPart = sentenceWords.slice(midpoint).join(' ');
//       return firstPart + '. ' + secondPart;
//     }
    
//     return sentence;
//   });
  
//   return variedSentences.join(' ');
// }

// // ==================== ANALYSIS UTILITIES ====================

// function calculateStandardDeviation(numbers) {
//   if (numbers.length === 0) return 0;
  
//   const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
//   const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
//   const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  
//   return Math.sqrt(variance);
// }

// function countPersonalPronouns(text) {
//   const pronouns = [' I ', ' me ', ' my ', ' mine ', ' we ', ' us ', ' our ', ' ours '];
//   let count = 0;
  
//   pronouns.forEach(pronoun => {
//     const regex = new RegExp(pronoun, 'gi');
//     const matches = text.match(regex);
//     if (matches) count += matches.length;
//   });
  
//   return count;
// }

// function countContractions(text) {
//   const contractions = [
//     "don't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't",
//     "haven't", "hasn't", "hadn't", "wouldn't", "couldn't", "shouldn't",
//     "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
//     "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd",
//     "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", "she'll",
//     "we'll", "they'll", "that's", "there's", "what's", "who's"
//   ];
  
//   let count = 0;
//   contractions.forEach(contraction => {
//     const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
//     const matches = text.match(regex);
//     if (matches) count += matches.length;
//   });
  
//   return count;
// }

// function countEmotionalWords(text) {
//   const emotionalWords = [
//     'love', 'hate', 'happy', 'sad', 'angry', 'excited', 'frustrated',
//     'disappointed', 'hopeful', 'anxious', 'joy', 'sorrow', 'fear',
//     'surprise', 'disgust', 'passion', 'despair', 'euphoria', 'melancholy',
//     'amazing', 'terrible', 'awesome', 'awful', 'wonderful', 'horrible'
//   ];
  
//   let count = 0;
//   emotionalWords.forEach(word => {
//     const regex = new RegExp(`\\b${word}\\b`, 'gi');
//     const matches = text.match(regex);
//     if (matches) count += matches.length;
//   });
  
//   return count;
// }

// function calculateToneScore(text) {
//   // Higher score = more formal/robotic
//   let score = 50;
  
//   // Formal indicators increase score
//   const formalIndicators = ['therefore', 'however', 'moreover', 'furthermore', 'consequently'];
//   formalIndicators.forEach(indicator => {
//     const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
//     if (regex.test(text)) score += 10;
//   });
  
//   // Informal indicators decrease score
//   const informalIndicators = ['lol', 'lmao', 'omg', 'haha', 'hehe'];
//   informalIndicators.forEach(indicator => {
//     const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
//     if (regex.test(text)) score -= 15;
//   });
  
//   // Contractions decrease score (more casual)
//   const contractions = countContractions(text);
//   score -= contractions * 2;
  
//   return Math.max(0, Math.min(100, score));
// }

// function calculateReadabilityScore(text) {
//   // Simplified readability calculation
//   const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   const words = text.split(/\s+/);
  
//   if (sentences.length === 0 || words.length === 0) return 50;
  
//   const avgSentenceLength = words.length / sentences.length;
//   const avgWordLength = text.replace(/[^a-z]/gi, '').length / words.length;
  
//   // Lower score = easier to read
//   let score = 50;
  
//   if (avgSentenceLength > 20) score += 20;
//   if (avgWordLength > 5) score += 15;
  
//   return Math.max(0, Math.min(100, score));
// }

// function calculatePersonalizationScore(text) {
//   let score = 0;
  
//   // Personal pronouns
//   const personalPronouns = countPersonalPronouns(text);
//   score += personalPronouns * 5;
  
//   // Opinions/feelings
//   const opinionWords = ['think', 'feel', 'believe', 'opinion'];
//   opinionWords.forEach(word => {
//     const regex = new RegExp(`\\b${word}\\b`, 'gi');
//     if (regex.test(text)) score += 10;
//   });
  
//   // First person sentences
//   const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   const firstPersonSentences = sentences.filter(s => /^I |^My |^We /.test(s));
//   score += (firstPersonSentences.length / sentences.length) * 30;
  
//   return Math.min(100, score);
// }

// function calculateNaturalnessScore(text) {
//   // Combined score of various naturalness factors
//   let score = 50;
  
//   // Sentence length variation
//   const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   if (sentences.length > 1) {
//     const lengths = sentences.map(s => s.split(/\s+/).length);
//     const stdDev = calculateStandardDeviation(lengths);
//     if (stdDev > 5) score += 10; // Good variation
//     if (stdDev < 2) score -= 10; // Too uniform
//   }
  
//   // Contractions
//   const contractions = countContractions(text);
//   score += contractions * 2;
  
//   // Emotional words
//   const emotionalWords = countEmotionalWords(text);
//   score += emotionalWords * 3;
  
//   // Conversational markers
//   const conversational = ['you know', 'i mean', 'like', 'actually', 'basically'];
//   conversational.forEach(marker => {
//     if (text.toLowerCase().includes(marker)) score += 5;
//   });
  
//   return Math.max(0, Math.min(100, score));
// }

// // ==================== REPORT GENERATION ====================

// async function generateHumanizationReport(original, humanized, style, analysis) {
//   const improvements = calculateImprovements(original, humanized, analysis);
  
//   let report = `✍️ *TEXT HUMANIZATION REPORT*\n`;
//   report += `━`.repeat(30) + `\n\n`;
  
//   // Style and overview
//   report += `🎨 *Style Applied:* ${style.toUpperCase()}\n`;
//   report += `📊 *Humanization Level:* ${improvements.humanizationLevel}\n\n`;
  
//   // Before/After comparison
//   report += `📝 *ORIGINAL TEXT:*\n`;
//   report += `"${truncateText(original, 100)}"\n\n`;
  
//   report += `✨ *HUMANIZED TEXT:*\n`;
//   report += `"${truncateText(humanized, 100)}"\n\n`;
  
//   // Full humanized text (if not too long)
//   if (humanized.length <= 500) {
//     report += `📋 *FULL HUMANIZED VERSION:*\n`;
//     report += `${humanized}\n\n`;
//   }
  
//   // Key improvements
//   report += `📈 *KEY IMPROVEMENTS:*\n`;
  
//   if (improvements.aiPatternsRemoved > 0) {
//     report += `✅ Removed ${improvements.aiPatternsRemoved} AI patterns\n`;
//   }
  
//   if (improvements.readabilityImproved) {
//     report += `✅ Improved readability by ${improvements.readabilityChange}%\n`;
//   }
  
//   if (improvements.personalizationIncreased > 0) {
//     report += `✅ Added ${improvements.personalizationIncreased}% more personal touch\n`;
//   }
  
//   if (improvements.naturalnessImproved > 0) {
//     report += `✅ Increased naturalness by ${improvements.naturalnessImproved}%\n`;
//   }
  
//   if (improvements.sentenceVariationAdded) {
//     report += `✅ Added sentence structure variation\n`;
//   }
  
//   // Stats
//   report += `\n📊 *STATISTICS:*\n`;
//   report += `• Original length: ${original.length} chars\n`;
//   report += `• Humanized length: ${humanized.length} chars\n`;
//   report += `• Change: ${improvements.lengthChange > 0 ? '+' : ''}${improvements.lengthChange}%\n`;
//   report += `• Sentence count: ${improvements.sentenceCount}\n`;
//   report += `• Avg. sentence length: ${improvements.avgSentenceLength} words\n\n`;
  
//   // Style-specific tips
//   report += `💡 *STYLE TIPS FOR ${style.toUpperCase()}:*\n`;
//   report += getStyleTips(style);
  
//   // How to use
//   report += `\n🎯 *HOW TO USE THIS TEXT:*\n`;
//   report += getUsageTips(style);
  
//   // Footer
//   report += `\n` + `━`.repeat(30) + `\n`;
//   report += `✍️ Humanized at: ${new Date().toLocaleTimeString()}\n`;
//   report += `⚡ WolfBot Humanizer v2.0`;
  
//   return report;
// }

// function generateSimpleReport(original, humanized, style) {
//   let report = `✍️ *TEXT HUMANIZATION*\n`;
//   report += `━`.repeat(30) + `\n\n`;
  
//   report += `🎨 *Style:* ${style.toUpperCase()}\n\n`;
  
//   report += `📝 *Before:*\n`;
//   report += `"${truncateText(original, 80)}"\n\n`;
  
//   report += `✨ *After:*\n`;
//   report += `"${truncateText(humanized, 80)}"\n\n`;
  
//   // Show full text if not too long
//   if (humanized.length <= 400) {
//     report += `📋 *Full Result:*\n`;
//     report += `${humanized}\n\n`;
//   }
  
//   // Basic stats
//   const origSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   const humanSentences = humanized.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   const origWords = original.split(/\s+/).length;
//   const humanWords = humanized.split(/\s+/).length;
  
//   report += `📊 *Changes Made:*\n`;
//   report += `• Removed AI-sounding phrases\n`;
//   report += `• Added natural variations\n`;
//   report += `• Adjusted tone for ${style} style\n`;
//   report += `• Sentences: ${origSentences.length} → ${humanSentences.length}\n`;
//   report += `• Words: ${origWords} → ${humanWords}\n\n`;
  
//   report += `💡 *Tip:* Use for emails, social posts, or any content that needs a human touch!\n`;
  
//   report += `\n` + `━`.repeat(30) + `\n`;
//   report += `⚡ WolfBot Humanizer`;
  
//   return report;
// }

// function calculateImprovements(original, humanized, analysis) {
//   const origSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
//   const humanSentences = humanized.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
//   const origWords = original.split(/\s+/).length;
//   const humanWords = humanized.split(/\s+/).length;
  
//   // Calculate various metrics
//   const aiPatternsRemoved = analysis.aiIndicators.length;
  
//   const origReadability = calculateReadabilityScore(original);
//   const humanReadability = calculateReadabilityScore(humanized);
//   const readabilityChange = Math.round(((origReadability - humanReadability) / origReadability) * 100);
  
//   const origPersonalization = calculatePersonalizationScore(original);
//   const humanPersonalization = calculatePersonalizationScore(humanized);
//   const personalizationIncreased = Math.round(((humanPersonalization - origPersonalization) / 100) * 100);
  
//   const origNaturalness = calculateNaturalnessScore(original);
//   const humanNaturalness = calculateNaturalnessScore(humanized);
//   const naturalnessImproved = Math.round(((humanNaturalness - origNaturalness) / 100) * 100);
  
//   const lengthChange = Math.round(((humanized.length - original.length) / original.length) * 100);
  
//   // Determine humanization level
//   let humanizationLevel = 'MODERATE';
//   const totalImprovement = Math.abs(readabilityChange) + personalizationIncreased + naturalnessImproved;
//   if (totalImprovement > 100) humanizationLevel = 'HIGH';
//   if (totalImprovement < 30) humanizationLevel = 'LIGHT';
  
//   return {
//     aiPatternsRemoved,
//     readabilityImproved: readabilityChange > 10,
//     readabilityChange: Math.abs(readabilityChange),
//     personalizationIncreased,
//     naturalnessImproved,
//     sentenceVariationAdded: Math.abs(origSentences.length - humanSentences.length) > 0,
//     lengthChange,
//     sentenceCount: humanSentences.length,
//     avgSentenceLength: Math.round(humanWords / (humanSentences.length || 1)),
//     humanizationLevel
//   };
// }

// function truncateText(text, maxLength) {
//   if (text.length <= maxLength) return text;
//   return text.substring(0, maxLength - 3) + '...';
// }

// function getStyleTips(style) {
//   const tips = {
//     casual: '• Use contractions and informal language\n• Add personal pronouns\n• Keep sentences short and natural\n• Use conversational fillers occasionally',
//     professional: '• Be clear and concise\n• Avoid slang but stay natural\n• Use professional vocabulary appropriately\n• Maintain respectful tone',
//     creative: '• Use descriptive language\n• Vary sentence structure\n• Add sensory details\n• Create emotional connection',
//     academic: '• Be informative but engaging\n• Use transition words\n• Support points clearly\n• Maintain educational tone',
//     social: '• Keep it short and engaging\n• Use hashtags if relevant\n• Add emojis appropriately\n• Write for quick reading',
//     email: '• Use proper email structure\n• Be professional but warm\n• Clear subject implied\n• Appropriate greetings/closings',
//     blog: '• Hook readers immediately\n• Use subheadings for scannability\n• Add personality\n• End with call to action or reflection'
//   };
  
//   return tips[style] || tips.casual;
// }

// function getUsageTips(style) {
//   const usages = {
//     casual: 'Perfect for messages, chats, and informal communication with friends or colleagues.',
//     professional: 'Ideal for business emails, reports, and professional correspondence.',
//     creative: 'Great for stories, creative writing, marketing copy, and engaging content.',
//     academic: 'Suitable for educational materials, tutorials, and informative content.',
//     social: 'Optimized for social media posts, tweets, and online sharing.',
//     email: 'Ready to use in email communication with proper structure.',
//     blog: 'Perfect for blog posts, articles, and longer-form online content.'
//   };
  
//   return usages[style] || 'Use for any text that needs to sound more human and natural.';
// }

// // Export for testing if needed
// export {
//   localHumanizeText,
//   analyzeTextForHumanization,
//   calculateImprovements
// };























import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'humanizer',
  description: 'Transform AI-generated text into more human-like writing',
  category: 'ai',
  aliases: ['humanize', 'makehuman', 'naturalize', 'rewrite'],
  usage: 'humanizer [text or reply to message] [style]',
  
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    
    // Help section
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      return sock.sendMessage(jid, {
        text: `╭─⌈ ✍️ *TEXT HUMANIZER* ⌋\n├─⊷ *${PREFIX}humanizer <text>*\n│  └⊷ Humanize AI-generated text\n├─⊷ *${PREFIX}humanizer <text> <style>*\n│  └⊷ casual, professional, creative,\n│  └⊷ academic, social, email, blog\n├─⊷ Reply to message with *${PREFIX}humanizer*\n│  └⊷ Humanize quoted text\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    // Parse style if provided
    const availableStyles = ['casual', 'professional', 'creative', 'academic', 'social', 'email', 'blog'];
    let style = 'casual';
    let textParts = args;
    
    // Check if last arg is a style
    if (availableStyles.includes(args[args.length - 1]?.toLowerCase())) {
      style = args[args.length - 1].toLowerCase();
      textParts = args.slice(0, -1);
    }
    
    // Get text to humanize
    let text = textParts.join(' ');
    
    // Check for quoted message
    if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
      text = quoted.conversation || 
             quoted.extendedTextMessage?.text || 
             quoted.imageMessage?.caption ||
             quoted.videoMessage?.caption ||
             text;
    }

    if (!text || text.length < 10) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ ❌ *TEXT TOO SHORT* ⌋\n├─⊷ Provide at least 10 characters\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    // Show processing message
    const status = await sock.sendMessage(jid, {
      text: `✍️ *HUMANIZING TEXT*\n\n` +
            `📝 *Original:* "${truncateText(text, 50)}"\n` +
            `🎨 *Style:* ${style.toUpperCase()}\n` +
            `⚡ *Transforming AI patterns into natural writing...*\n\n` +
            `⏳ *Processing...*`
    }, { quoted: m });

    try {
      // Step 1: Analyze text for AI patterns
      const analysis = await analyzeTextForHumanization(text);
      
      // Step 2: Apply humanization techniques using API first
      let humanizedText = await humanizeTextWithAPI(text, style, analysis);
      
      // Step 3: If API fails or text is similar, use enhanced local methods
      if (!humanizedText || humanizedText === text || humanizedText.length < text.length * 0.5) {
        console.log('API returned insufficient results, using enhanced local humanization');
        humanizedText = enhancedHumanizeText(text, style, analysis);
      }
      
      // Step 4: Post-process to ensure quality
      humanizedText = postProcessHumanizedText(humanizedText, style, text);
      
      // Step 5: Send results in TWO messages
      
      // Message 1: Report/analysis
      const report = await generateHumanizationReport(text, humanizedText, style, analysis);
      await sock.sendMessage(jid, {
        text: report,
        edit: status.key
      });
      
      // Message 2: Clean humanized text (as a new message)
      setTimeout(async () => {
        await sock.sendMessage(jid, {
          text: `📄 *HUMANIZED TEXT (${style.toUpperCase()}):*\n\n` +
                `${humanizedText}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `✅ Ready to use | ✍️ Humanized by ${getBotName()}`,
          quoted: m
        });
      }, 1000);

    } catch (error) {
      console.error('Humanizer error:', error);
      
      // Fallback to enhanced local humanization
      const humanizedText = enhancedHumanizeText(text, style);
      const report = generateSimpleReport(text, humanizedText, style);
      
      await sock.sendMessage(jid, {
        text: report + '\n\n⚠️ *Note: Using advanced local humanization methods*',
        edit: status.key
      });
      
      // Send clean humanized text as separate message
      setTimeout(async () => {
        await sock.sendMessage(jid, {
          text: `📄 *HUMANIZED TEXT (${style.toUpperCase()}):*\n\n` +
                `${humanizedText}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `✅ Local Processing | ✍️ Humanized by ${getBotName()}`,
          quoted: m
        });
      }, 1000);
    }
  }
};

// ==================== ENHANCED HUMANIZATION FUNCTIONS ====================

async function humanizeTextWithAPI(text, style, analysis) {
  try {
    console.log(`Using GPT API for humanization (style: ${style})`);
    
    const prompt = createEnhancedHumanizationPrompt(text, style, analysis);
    
    const response = await axios.get('https://iamtkm.vercel.app/ai/gpt5', {
      params: {
        apikey: 'tkm',
        text: prompt
      },
      timeout: 30000
    });
    
    let humanizedText = response.data?.result || response.data?.response || '';
    
    // Clean up the response - remove any metadata or quotes
    humanizedText = cleanAPIResponse(humanizedText);
    
    // Validate the response
    if (!isValidHumanization(text, humanizedText)) {
      throw new Error('API returned invalid humanization');
    }
    
    return humanizedText;
    
  } catch (error) {
    console.error('API humanization failed:', error.message);
    return null;
  }
}

function cleanAPIResponse(text) {
  if (!text) return '';
  
  // Remove common wrapper phrases
  const wrappers = [
    /^["']|["']$/g,
    /^Humanized text:\s*/i,
    /^Response:\s*/i,
    /^Here(?:'s| is) (?:the |a )?(?:humanized|rewritten|improved) (?:version|text):\s*/i,
    /^As a human.*?:\s*/i,
    /^Based on.*?:\s*/i,
    /^[\*\-]\s*/g,
    /^```[\s\S]*?\n|```$/g
  ];
  
  let cleaned = text;
  wrappers.forEach(wrapper => {
    cleaned = cleaned.replace(wrapper, '');
  });
  
  // Trim and clean up whitespace
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove excessive newlines
  
  return cleaned;
}

function createEnhancedHumanizationPrompt(originalText, style, analysis) {
  const styleInstructions = {
    casual: `Transform this into natural everyday conversation. Use:
• Contractions (don't, can't, I'm)
• Informal but clear language
• Personal pronouns (I, you, we)
• Natural sentence flow
• Conversational tone like you're talking to a friend
• Keep it authentic and relatable`,
    
    professional: `Rewrite this for professional business communication. Use:
• Clear and concise language
• Professional but not robotic tone
• Active voice where appropriate
• Business-appropriate vocabulary
• Polite and respectful tone
• Keep it efficient but natural`,
    
    creative: `Make this creative and engaging for storytelling. Use:
• Descriptive and vivid language
• Varied sentence structure
• Metaphors and imagery when appropriate
• Emotional connection
• Engaging opening and satisfying flow
• Show, don't just tell`,
    
    academic: `Adapt this for educational content. Use:
• Clear explanations
• Engaging but informative tone
• Smooth transitions between ideas
• Accessible language for learners
• Examples to illustrate points
• Maintain educational value`,
    
    social: `Optimize this for social media. Use:
• Short, punchy sentences
• Engaging openings
• Hashtags if relevant
• Emojis occasionally (but not overdoing it)
• Conversational tone
• Optimized for quick reading and sharing`,
    
    email: `Format this as a professional email. Include:
• Appropriate greeting (Hi, Hello, Dear)
• Clear subject implied in opening
• Professional but warm tone
• Organized structure with paragraphs
• Clear call to action or closing
• Appropriate sign-off (Best regards, Thanks, etc.)`,
    
    blog: `Rewrite this for a blog/article. Use:
• Engaging headline/opening
• Clear paragraph structure
• Subheadings for longer content
• Conversational yet informative tone
• Personal voice or examples
• Strong conclusion or call to action`
  };

  let prompt = `You are a professional humanization expert. Your task is to rewrite the following text to sound more natural, human, and authentic in ${style} style.\n\n`;
  
  // Add specific issues to fix
  if (analysis.aiIndicators.length > 0) {
    prompt += `SPECIFIC ISSUES TO FIX:\n`;
    analysis.aiIndicators.forEach(issue => {
      prompt += `- ${issue}\n`;
    });
    prompt += `\n`;
  }
  
  if (analysis.improvementAreas.length > 0) {
    prompt += `AREAS FOR IMPROVEMENT:\n`;
    analysis.improvementAreas.forEach(area => {
      prompt += `- ${area}\n`;
    });
    prompt += `\n`;
  }
  
  // Add style-specific instructions
  prompt += `STYLE REQUIREMENTS (${style}):\n`;
  prompt += styleInstructions[style] + `\n\n`;
  
  // Core humanization rules
  prompt += `CORE HUMANIZATION RULES:\n`;
  prompt += `1. Remove all AI-sounding phrases and patterns\n`;
  prompt += `2. Add natural variation in sentence length and structure\n`;
  prompt += `3. Use contractions where appropriate (don't, can't, etc.)\n`;
  prompt += `4. Add personal voice and perspective\n`;
  prompt += `5. Improve flow and readability\n`;
  prompt += `6. Make it sound like a real person wrote it\n`;
  prompt += `7. PRESERVE the original meaning and key information\n`;
  prompt += `8. Do NOT add any additional explanations or analysis\n`;
  prompt += `9. Do NOT use markdown or formatting\n`;
  prompt += `10. Keep the output length similar to the input\n\n`;
  
  // Provide the text
  prompt += `TEXT TO HUMANIZE:\n`;
  prompt += `"${originalText}"\n\n`;
  
  // Final instruction
  prompt += `Provide ONLY the humanized text, nothing else. No introductions, no explanations, just the rewritten text.`;
  
  return prompt;
}

function enhancedHumanizeText(text, style, analysis = null) {
  console.log(`Using enhanced local humanization for style: ${style}`);
  
  // Apply multiple transformation passes
  let humanized = text;
  
  // Pass 1: Deep clean AI patterns
  humanized = deepCleanAIPatterns(humanized);
  
  // Pass 2: Apply style-specific transformations
  humanized = applyEnhancedStyleTransformations(humanized, style);
  
  // Pass 3: Add sophisticated natural variations
  humanized = addSophisticatedVariations(humanized, style);
  
  // Pass 4: Optimize for human readability
  humanized = optimizeHumanReadability(humanized);
  
  // Pass 5: Final polish
  humanized = finalPolish(humanized, style);
  
  return humanized;
}

function deepCleanAIPatterns(text) {
  let result = text;
  
  // Comprehensive list of AI patterns to remove
  const aiPatterns = [
    // AI disclaimers
    { pattern: /\b(?:as an|as a) (?:ai|artificial intelligence|large language) (?:model|assistant)\b/gi, replacement: '' },
    { pattern: /\bbased on my (?:training data|knowledge base|programming)\b/gi, replacement: 'Based on what I know' },
    { pattern: /\bi don't have (?:personal |human )?(?:experiences|emotions|feelings|consciousness)\b/gi, replacement: '' },
    { pattern: /\bi am (?:an ai|a computer program|a machine)\b/gi, replacement: '' },
    { pattern: /\bmy (?:primary|main) (?:function|purpose|goal) (?:is|are)\b/gi, replacement: 'I can help you with' },
    
    // Formal academic patterns
    { pattern: /\bit is (?:important|crucial|essential|vital) to note (?:that)?\b/gi, replacement: 'It\'s worth noting that' },
    { pattern: /\bin (?:this|the) (?:essay|paper|document|analysis)\b/gi, replacement: 'Here' },
    { pattern: /\bthe purpose of this (?:section|part|essay) is to\b/gi, replacement: 'This aims to' },
    { pattern: /\bas (?:previously|previously )?mentioned\b/gi, replacement: 'As I said earlier' },
    { pattern: /\b(?:first and foremost|firstly|secondly|thirdly|lastly)\b/gi, replacement: match => {
      const replacements = ['First,', 'Second,', 'Third,', 'Finally,'];
      const index = ['firstly', 'secondly', 'thirdly', 'lastly'].indexOf(match.toLowerCase());
      return index >= 0 ? replacements[index] : 'To start,';
    }},
    
    // Corporate jargon
    { pattern: /\butilize\b/gi, replacement: 'use' },
    { pattern: /\bfacilitate\b/gi, replacement: 'help' },
    { pattern: /\bimplement\b/gi, replacement: 'put in place' },
    { pattern: /\boptimize\b/gi, replacement: 'improve' },
    { pattern: /\bleverage\b/gi, replacement: 'use' },
    { pattern: /\bsynergize\b/gi, replacement: 'work together' },
    { pattern: /\bparadigm\b/gi, replacement: 'approach' },
    { pattern: /\bstreamline\b/gi, replacement: 'simplify' },
    { pattern: /\bdeliverables\b/gi, replacement: 'results' },
    { pattern: /\btouch base\b/gi, replacement: 'check in' },
    
    // Formal connectors
    { pattern: /\bin order to\b/gi, replacement: 'to' },
    { pattern: /\bwith regard to\b/gi, replacement: 'about' },
    { pattern: /\bwith the purpose of\b/gi, replacement: 'to' },
    { pattern: /\bat this point in time\b/gi, replacement: 'now' },
    { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
    { pattern: /\bin the event that\b/gi, replacement: 'if' },
    { pattern: /\bprior to\b/gi, replacement: 'before' },
    { pattern: /\bsubsequent to\b/gi, replacement: 'after' },
    
    // Redundant phrases
    { pattern: /\babsolutely (?:essential|necessary|critical)\b/gi, replacement: 'essential' },
    { pattern: /\badvance (?:planning|warning|notice)\b/gi, replacement: 'planning' },
    { pattern: /\b(?:basic|fundamental) (?:essentials|principles)\b/gi, replacement: 'basics' },
    { pattern: /\b(?:close|complete) proximity\b/gi, replacement: 'close' },
    { pattern: /\b(?:end|final) result\b/gi, replacement: 'result' },
  ];
  
  aiPatterns.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });
  
  // Clean up double spaces and punctuation
  result = result.replace(/\s+/g, ' ').trim();
  result = result.replace(/\s([.,!?])/g, '$1');
  result = result.replace(/([.,!?])([A-Za-z])/g, '$1 $2');
  
  return result;
}

function applyEnhancedStyleTransformations(text, style) {
  const transformers = {
    casual: transformToCasual,
    professional: transformToProfessional,
    creative: transformToCreative,
    academic: transformToAcademic,
    social: transformToSocial,
    email: transformToEmail,
    blog: transformToBlog
  };
  
  const transformer = transformers[style] || transformToCasual;
  return transformer(text);
}

function transformToCasual(text) {
  let result = text;
  
  // Add natural contractions
  result = addAdvancedContractions(result);
  
  // Add conversational elements
  const sentences = result.split(/(?<=[.!?])\s+/);
  const transformedSentences = sentences.map((sentence, index) => {
    let transformed = sentence;
    
    // Occasionally add conversational starters
    if (index === 0 && Math.random() > 0.5) {
      const starters = ['You know, ', 'Actually, ', 'So, ', 'Well, ', 'Hey, '];
      transformed = starters[Math.floor(Math.random() * starters.length)] + transformed.toLowerCase();
    }
    
    // Add occasional fillers in longer texts
    if (sentences.length > 3 && index > 0 && index < sentences.length - 1 && Math.random() > 0.7) {
      const fillers = ['I mean, ', 'You see, ', 'Basically, ', 'Honestly, '];
      transformed = fillers[Math.floor(Math.random() * fillers.length)] + transformed;
    }
    
    // Convert formal endings to casual
    transformed = transformed.replace(/\bIn conclusion\b/gi, 'So to wrap up');
    transformed = transformed.replace(/\bTherefore\b/gi, 'So');
    transformed = transformed.replace(/\bHowever\b/gi, 'But');
    transformed = transformed.replace(/\bFurthermore\b/gi, 'Also');
    
    return transformed;
  });
  
  result = transformedSentences.join(' ');
  
  // Add personal touch
  if (!/ I | my | we | us /i.test(result) && sentences.length > 0) {
    const personalAdditions = [
      ' I think this is really interesting.',
      ' It\'s something I\'ve been thinking about.',
      ' What do you think about this?',
      ' This is just my take on it.'
    ];
    if (Math.random() > 0.5) {
      result += personalAdditions[Math.floor(Math.random() * personalAdditions.length)];
    }
  }
  
  return result;
}

function transformToProfessional(text) {
  let result = text;
  
  // Remove overly casual language
  const casualPatterns = [
    /\b(lol|lmao|omg|wtf|smh|tbh)\b/gi,
    /\b(like,|you know|i mean)\b/gi,
    /\b(dude|bro|man|buddy)\b/gi
  ];
  
  casualPatterns.forEach(pattern => {
    result = result.replace(pattern, '');
  });
  
  // Improve clarity without making it robotic
  result = improveProfessionalClarity(result);
  
  // Ensure proper structure
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 0) {
    // Professional opening if missing
    if (!/^(I wanted to|I\'m writing to|This is to|Let me)/i.test(sentences[0])) {
      const openings = [
        'I wanted to share that ',
        'Let me explain that ',
        'To address this, ',
        'Regarding this topic, '
      ];
      sentences[0] = openings[Math.floor(Math.random() * openings.length)] + sentences[0].toLowerCase();
    }
    
    // Professional transitions
    for (let i = 1; i < Math.min(sentences.length, 4); i++) {
      if (!/^(Additionally|Moreover|Furthermore|However|Therefore)/i.test(sentences[i]) && Math.random() > 0.5) {
        const transitions = ['Additionally, ', 'Moreover, ', 'Furthermore, ', 'However, ', 'Therefore, '];
        sentences[i] = transitions[Math.floor(Math.random() * transitions.length)] + sentences[i];
      }
    }
    
    result = sentences.join(' ');
  }
  
  return result;
}

function transformToCreative(text) {
  let result = text;
  
  // Add descriptive language
  const descriptiveWords = {
    nouns: ['journey', 'story', 'experience', 'adventure', 'process', 'path'],
    adjectives: ['amazing', 'incredible', 'fascinating', 'remarkable', 'extraordinary', 'unique'],
    verbs: ['discover', 'explore', 'uncover', 'reveal', 'experience', 'witness']
  };
  
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 0) {
    // Enhance first sentence
    const firstWords = sentences[0].split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    if (!/^(let me|imagine|picture|think about)/i.test(firstWords)) {
      const creativeOpenings = [
        'Let me paint you a picture: ',
        'Imagine this: ',
        'Picture this: ',
        'Think about this for a moment: '
      ];
      sentences[0] = creativeOpenings[Math.floor(Math.random() * creativeOpenings.length)] + sentences[0].toLowerCase();
    }
    
    // Add sensory language occasionally
    sentences.forEach((sentence, index) => {
      if (index > 0 && index < sentences.length - 1 && Math.random() > 0.7) {
        const sensory = ['You can almost feel ', 'It\'s like seeing ', 'Imagine hearing ', 'Think about touching '];
        const sensoryStart = sensory[Math.floor(Math.random() * sensory.length)];
        sentences[index] = sensoryStart + sentence.toLowerCase();
      }
    });
    
    result = sentences.join(' ');
  }
  
  // Add metaphors if appropriate
  if (result.length > 100 && Math.random() > 0.5) {
    const metaphors = [
      ' It\'s like finding a needle in a haystack.',
      ' This reminds me of building a sandcastle - it takes patience and care.',
      ' Think of it as putting together a puzzle.',
      ' It\'s similar to planting a seed and watching it grow.'
    ];
    result += metaphors[Math.floor(Math.random() * metaphors.length)];
  }
  
  return result;
}

function transformToAcademic(text) {
  let result = text;
  
  // Make academic but engaging
  result = result.replace(/\bit is important to note that\b/gi, 'What\'s interesting is that');
  result = result.replace(/\bin this essay\b/gi, 'In this discussion');
  result = result.replace(/\bthe author\b/gi, 'I');
  
  // Add engaging academic transitions
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 1) {
    for (let i = 1; i < Math.min(sentences.length, 5); i++) {
      if (Math.random() > 0.5) {
        const academicTransitions = [
          'Building on this idea, ',
          'To expand on this point, ',
          'Another important aspect is ',
          'It\'s also worth considering that ',
          'This leads us to '
        ];
        sentences[i] = academicTransitions[Math.floor(Math.random() * academicTransitions.length)] + sentences[i].toLowerCase();
      }
    }
    
    result = sentences.join(' ');
  }
  
  // Add academic framing
  if (!/^(This analysis|This discussion|In examining)/i.test(result.substring(0, 50))) {
    const framings = [
      'In examining this topic, ',
      'This analysis suggests that ',
      'When considering this issue, '
    ];
    result = framings[Math.floor(Math.random() * framings.length)] + result.toLowerCase();
  }
  
  return result;
}

function transformToSocial(text) {
  let result = text;
  
  // Shorten for social media
  result = optimizeForSocialMedia(result);
  
  // Add hashtags based on content
  const topics = extractKeywords(text);
  if (topics.length > 0) {
    const hashtags = topics.slice(0, 3).map(t => `#${t.replace(/\s+/g, '')}`);
    result += ' ' + hashtags.join(' ');
  }
  
  // Add engagement elements
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 0) {
    // Add emojis occasionally
    const emojis = ['✨', '🌟', '💡', '🔥', '👍', '👏', '🎯', '🚀'];
    if (Math.random() > 0.3) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const lastSentence = sentences[sentences.length - 1];
      sentences[sentences.length - 1] = lastSentence.replace(/[.!?]+$/, '') + ' ' + emoji;
    }
    
    // Add questions for engagement
    if (Math.random() > 0.5 && !/\?$/.test(result)) {
      const questions = ['What do you think?', 'Thoughts?', 'Agree?', 'Have you experienced this?'];
      result = result.replace(/[.!?]+$/, '') + ' ' + questions[Math.floor(Math.random() * questions.length)];
    }
    
    result = sentences.join(' ');
  }
  
  return result;
}

function transformToEmail(text) {
  let result = text;
  
  // Add email structure
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 0) {
    // Add greeting
    const greetings = ['Hi there,', 'Hello,', 'Hi,', 'Dear reader,'];
    if (!/^(Hi|Hello|Dear|Greetings)/i.test(sentences[0])) {
      sentences[0] = greetings[Math.floor(Math.random() * greetings.length)] + '\n\n' + sentences[0];
    }
    
    // Add professional closing
    const closings = [
      '\n\nBest regards,\n[Your Name]',
      '\n\nSincerely,\n[Your Name]',
      '\n\nKind regards,\n[Your Name]',
      '\n\nThanks,\n[Your Name]'
    ];
    
    if (!/(Best|Regards|Sincerely|Thanks|Cheers)/i.test(result.slice(-50))) {
      result = sentences.join('\n\n') + closings[Math.floor(Math.random() * closings.length)];
    } else {
      result = sentences.join('\n\n');
    }
  }
  
  // Ensure proper paragraph breaks
  result = result.replace(/\n\s*\n/g, '\n\n');
  
  return result;
}

function transformToBlog(text) {
  let result = text;
  
  // Create engaging blog structure
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length > 0) {
    // Add engaging opening
    if (!/^(Have you ever|Let me tell you|Here\'s something|You won\'t believe)/i.test(sentences[0])) {
      const blogOpenings = [
        'Have you ever wondered... ',
        'Let me share something interesting with you... ',
        'Here\'s something I discovered... ',
        'You might find this surprising... '
      ];
      sentences[0] = blogOpenings[Math.floor(Math.random() * blogOpenings.length)] + sentences[0].toLowerCase();
    }
    
    // Add subheadings for longer content
    if (sentences.length > 5) {
      const midpoint = Math.floor(sentences.length / 2);
      sentences.splice(midpoint, 0, '\n\n## Key Insights\n\n');
    }
    
    result = sentences.join('\n\n');
  }
  
  // Add call to action if appropriate
  if (!/^(Share your|Let me know|What are your)/i.test(result.slice(-100)) && Math.random() > 0.5) {
    const ctas = [
      '\n\nWhat are your thoughts on this? Share in the comments below!',
      '\n\nHave you experienced something similar? Let me know!',
      '\n\nWhat topic should I cover next? Let me know what you\'re interested in!'
    ];
    result += ctas[Math.floor(Math.random() * ctas.length)];
  }
  
  return result;
}

function addAdvancedContractions(text) {
  const contractionMap = {
    'do not': 'don\'t',
    'does not': 'doesn\'t',
    'did not': 'didn\'t',
    'can not': 'can\'t',
    'cannot': 'can\'t',
    'could not': 'couldn\'t',
    'will not': 'won\'t',
    'would not': 'wouldn\'t',
    'should not': 'shouldn\'t',
    'must not': 'mustn\'t',
    'is not': 'isn\'t',
    'are not': 'aren\'t',
    'was not': 'wasn\'t',
    'were not': 'weren\'t',
    'has not': 'hasn\'t',
    'have not': 'haven\'t',
    'had not': 'hadn\'t',
    'i am': 'I\'m',
    'you are': 'you\'re',
    'he is': 'he\'s',
    'she is': 'she\'s',
    'it is': 'it\'s',
    'we are': 'we\'re',
    'they are': 'they\'re',
    'there is': 'there\'s',
    'there are': 'there\'re',
    'that is': 'that\'s',
    'what is': 'what\'s',
    'who is': 'who\'s',
    'where is': 'where\'s',
    'when is': 'when\'s',
    'why is': 'why\'s',
    'how is': 'how\'s',
    'i have': 'I\'ve',
    'you have': 'you\'ve',
    'we have': 'we\'ve',
    'they have': 'they\'ve',
    'i would': 'I\'d',
    'you would': 'you\'d',
    'he would': 'he\'d',
    'she would': 'she\'d',
    'we would': 'we\'d',
    'they would': 'they\'d',
    'i will': 'I\'ll',
    'you will': 'you\'ll',
    'he will': 'he\'ll',
    'she will': 'she\'ll',
    'we will': 'we\'ll',
    'they will': 'they\'ll'
  };
  
  let result = text;
  
  // Apply contractions intelligently
  Object.entries(contractionMap).forEach(([full, contraction]) => {
    // Use word boundaries and case-insensitive matching
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    result = result.replace(regex, contraction);
  });
  
  return result;
}

function addSophisticatedVariations(text, style) {
  let result = text;
  const sentences = result.split(/(?<=[.!?])\s+/);
  
  if (sentences.length <= 1) return result;
  
  const transformedSentences = sentences.map((sentence, index) => {
    let transformed = sentence;
    
    // Vary sentence openings (avoid starting too many sentences the same way)
    if (index > 0) {
      const firstWord = sentence.split(' ')[0].toLowerCase();
      const prevFirstWord = sentences[index - 1].split(' ')[0].toLowerCase();
      
      if (firstWord === prevFirstWord && firstWord.length > 2) {
        const alternativeStarts = getAlternativeStarts(firstWord, style);
        if (alternativeStarts.length > 0) {
          const words = transformed.split(' ');
          words[0] = alternativeStarts[Math.floor(Math.random() * alternativeStarts.length)];
          transformed = words.join(' ');
        }
      }
    }
    
    // Vary sentence length by occasionally combining or splitting
    if (index < sentences.length - 1 && Math.random() > 0.7) {
      const currentWords = transformed.split(/\s+/).length;
      const nextWords = sentences[index + 1].split(/\s+/).length;
      
      // Combine short sentences
      if (currentWords < 8 && nextWords < 8) {
        transformed = transformed.replace(/[.!?]+$/, '') + ' and ' + sentences[index + 1].toLowerCase();
        sentences[index + 1] = ''; // Mark for removal
      }
    }
    
    return transformed;
  });
  
  // Remove marked sentences and join
  result = transformedSentences.filter(s => s !== '').join(' ');
  
  // Add occasional rhetorical questions for engagement
  if (style !== 'professional' && style !== 'academic' && sentences.length > 2) {
    if (Math.random() > 0.7) {
      const questions = ['Interesting, right?', 'Makes sense, doesn\'t it?', 'Pretty cool, huh?'];
      result += ' ' + questions[Math.floor(Math.random() * questions.length)];
    }
  }
  
  return result;
}

function getAlternativeStarts(word, style) {
  const alternatives = {
    casual: {
      'the': ['This', 'That', 'It', ''],
      'it': ['This', 'That', 'The thing', 'What'],
      'this': ['That', 'It', 'Here\'s something', 'What'],
      'that': ['This', 'It', 'Here\'s what', 'Something'],
      'there': ['Here', 'You\'ll find', 'We have'],
      'here': ['There', 'In this', 'You can see']
    },
    professional: {
      'the': ['This', 'Our', 'This particular', 'The following'],
      'it': ['This', 'That', 'The situation', 'The matter'],
      'this': ['That', 'The following', 'Our analysis shows'],
      'that': ['This', 'The aforementioned', 'Our findings indicate']
    },
    creative: {
      'the': ['Imagine the', 'Picture this', 'Consider the', 'Visualize the'],
      'it': ['Picture this', 'Imagine that', 'Consider this', 'Visualize it'],
      'this': ['Imagine this', 'Picture that', 'Consider this', 'Visualize this'],
      'that': ['Imagine that', 'Picture something', 'Consider that']
    }
  };
  
  return alternatives[style]?.[word] || [];
}

function optimizeHumanReadability(text) {
  let result = text;
  
  // Break up long sentences
  const sentences = result.split(/(?<=[.!?])\s+/);
  const optimizedSentences = sentences.map(sentence => {
    const words = sentence.split(/\s+/);
    
    if (words.length > 25) {
      // Try to split on natural breaks
      const naturalBreaks = [
        /(, and|, but|, or|, so|;)/,
        /(, which|, that|, who|, whom|, whose)/,
        /( because| although| since| while| whereas)/
      ];
      
      for (const breakPattern of naturalBreaks) {
        const parts = sentence.split(breakPattern);
        if (parts.length > 2) {
          // Reconstruct with better punctuation
          let reconstructed = '';
          for (let i = 0; i < parts.length; i += 2) {
            if (parts[i]) {
              reconstructed += parts[i].trim();
              if (i + 1 < parts.length && parts[i + 1]) {
                reconstructed += parts[i + 1];
              }
              if (i + 2 < parts.length) {
                reconstructed += ' ';
              }
            }
          }
          return reconstructed;
        }
      }
      
      // Split on commas as last resort
      const commaParts = sentence.split(/,/);
      if (commaParts.length > 2) {
        const firstPart = commaParts[0];
        const rest = commaParts.slice(1).join(',');
        return firstPart + '. ' + rest.charAt(0).toUpperCase() + rest.slice(1);
      }
    }
    
    return sentence;
  });
  
  result = optimizedSentences.join(' ');
  
  // Improve paragraph structure for longer texts
  if (result.length > 200) {
    const sentencesForParagraphs = result.split(/(?<=[.!?])\s+/);
    if (sentencesForParagraphs.length > 4) {
      const paragraphs = [];
      let currentParagraph = [];
      
      sentencesForParagraphs.forEach((sentence, index) => {
        currentParagraph.push(sentence);
        
        // Start new paragraph every 3-5 sentences
        if (currentParagraph.length >= 3 && 
            (index === sentencesForParagraphs.length - 1 || 
             currentParagraph.length >= 4 || 
             Math.random() > 0.7)) {
          paragraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
      });
      
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
      }
      
      result = paragraphs.join('\n\n');
    }
  }
  
  // Clean up whitespace
  result = result.replace(/\s+/g, ' ').trim();
  result = result.replace(/\s([.,!?])/g, '$1');
  result = result.replace(/([.,!?])([A-Za-z])/g, '$1 $2');
  
  return result;
}

function finalPolish(text, style) {
  let result = text;
  
  // Style-specific final touches
  switch (style) {
    case 'casual':
      // Ensure conversational tone
      if (!/[.!?]$/.test(result)) {
        result += '.';
      }
      break;
      
    case 'professional':
      // Ensure proper capitalization
      result = result.charAt(0).toUpperCase() + result.slice(1);
      break;
      
    case 'email':
      // Ensure proper line breaks
      result = result.replace(/\n\s*\n/g, '\n\n');
      break;
  }
  
  // Remove any double punctuation
  result = result.replace(/([.!?])\s*[.!?]+/g, '$1');
  
  // Ensure spacing after punctuation
  result = result.replace(/([.,!?])([A-Za-z])/g, '$1 $2');
  
  // Remove any remaining excessive whitespace
  result = result.replace(/\s\s+/g, ' ');
  
  return result.trim();
}

function postProcessHumanizedText(humanizedText, style, originalText) {
  if (!humanizedText || humanizedText.trim().length === 0) {
    return originalText; // Fallback to original if humanization failed
  }
  
  let result = humanizedText;
  
  // Ensure the humanized text is significantly different from original
  if (isTooSimilar(result, originalText)) {
    console.log('Text too similar, applying additional transformations');
    result = applyAdditionalTransformations(result, style);
  }
  
  // Ensure proper length (not too short)
  if (result.length < originalText.length * 0.3) {
    console.log('Text too short, combining with original');
    result = blendWithOriginal(result, originalText, style);
  }
  
  // Final validation
  if (!isValidHumanization(originalText, result)) {
    console.log('Humanization validation failed, using fallback');
    return enhancedHumanizeText(originalText, style);
  }
  
  return result;
}

function isTooSimilar(text1, text2) {
  if (!text1 || !text2) return false;
  
  const clean1 = text1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const clean2 = text2.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  
  // Calculate word overlap
  const words1 = new Set(clean1.split(/\s+/));
  const words2 = clean2.split(/\s+/);
  
  let matches = 0;
  words2.forEach(word => {
    if (words1.has(word) && word.length > 3) {
      matches++;
    }
  });
  
  const similarity = matches / Math.max(words1.size, words2.length);
  return similarity > 0.8; // More than 80% similar
}

function applyAdditionalTransformations(text, style) {
  let result = text;
  
  // Apply style-specific intensification
  switch (style) {
    case 'casual':
      result = addMoreConversationalElements(result);
      break;
    case 'creative':
      result = addMoreDescriptiveLanguage(result);
      break;
    case 'social':
      result = makeMoreEngagingForSocial(result);
      break;
  }
  
  return result;
}

function blendWithOriginal(humanized, original, style) {
  // Take the best parts of both
  const humanizedSentences = humanized.split(/(?<=[.!?])\s+/);
  const originalSentences = original.split(/(?<=[.!?])\s+/);
  
  if (humanizedSentences.length === 0) return original;
  if (originalSentences.length === 0) return humanized;
  
  // Create a blend - start with humanized, add original if needed
  let result = humanized;
  
  if (humanizedSentences.length < originalSentences.length * 0.5) {
    // Add some original sentences (humanized)
    const sentencesToAdd = Math.min(2, originalSentences.length - humanizedSentences.length);
    for (let i = 0; i < sentencesToAdd; i++) {
      const originalSentence = originalSentences[i];
      const humanizedVersion = enhancedHumanizeText(originalSentence, style);
      if (humanizedVersion) {
        result += ' ' + humanizedVersion;
      }
    }
  }
  
  return result;
}

function isValidHumanization(original, humanized) {
  if (!humanized || humanized.trim().length === 0) return false;
  if (humanized === original) return false;
  if (humanized.length < original.length * 0.3) return false;
  if (humanized.length > original.length * 3) return false;
  
  // Check if it contains obvious AI patterns
  const aiPatterns = [
    /as an ai language model/i,
    /based on my training data/i,
    /i don't have personal experiences/i
  ];
  
  for (const pattern of aiPatterns) {
    if (pattern.test(humanized)) return false;
  }
  
  return true;
}

// ==================== REPORT GENERATION ====================

async function generateHumanizationReport(original, humanized, style, analysis) {
  const improvements = calculateImprovements(original, humanized, analysis);
  
  let report = `✍️ *TEXT HUMANIZATION COMPLETE*\n`;
  report += `━`.repeat(30) + `\n\n`;
  
  // Style and overview
  report += `🎨 *Style Applied:* ${style.toUpperCase()}\n`;
  report += `📊 *Humanization Level:* ${improvements.humanizationLevel}\n`;
  report += `✅ *Success Rate:* ${improvements.successRate}%\n\n`;
  
  // Before/After comparison
  report += `📝 *ORIGINAL TEXT (${original.length} chars):*\n`;
  report += `"${truncateText(original, 120)}"\n\n`;
  
  report += `✨ *HUMANIZED TEXT (${humanized.length} chars):*\n`;
  report += `"${truncateText(humanized, 120)}"\n\n`;
  
  // Key improvements
  report += `📈 *KEY IMPROVEMENTS:*\n`;
  
  if (improvements.aiPatternsRemoved > 0) {
    report += `✅ Removed ${improvements.aiPatternsRemoved} AI patterns\n`;
  }
  
  if (improvements.readabilityImproved > 0) {
    report += `✅ Readability improved by ${improvements.readabilityImproved}%\n`;
  }
  
  if (improvements.naturalnessImproved > 0) {
    report += `✅ Naturalness increased by ${improvements.naturalnessImproved}%\n`;
  }
  
  if (improvements.personalizationAdded > 0) {
    report += `✅ Added ${improvements.personalizationAdded}% personal touch\n`;
  }
  
  if (improvements.sentenceVariation) {
    report += `✅ Improved sentence structure variation\n`;
  }
  
  // Stats
  report += `\n📊 *STATISTICS:*\n`;
  report += `• Original length: ${original.length} characters\n`;
  report += `• Humanized length: ${humanized.length} characters\n`;
  report += `• Sentence count: ${improvements.sentenceCount}\n`;
  report += `• Avg. sentence length: ${improvements.avgSentenceLength} words\n`;
  report += `• Contractions added: ${improvements.contractionsAdded}\n\n`;
  
  // Next message notification
  report += `📄 *Next Message:* The complete humanized text will be sent separately for easy copying and use.\n\n`;
  
  // Style-specific tips
  report += `💡 *USAGE TIPS FOR ${style.toUpperCase()}:*\n`;
  report += getStyleUsageTips(style);
  
  // Footer
  report += `\n` + `━`.repeat(30) + `\n`;
  report += `⏰ Processed at: ${new Date().toLocaleTimeString()}\n`;
  report += `⚡ ${getBotName()} Humanizer v2.0 | Next-gen AI-to-human conversion`;
  
  return report;
}

function generateSimpleReport(original, humanized, style) {
  let report = `✍️ *TEXT HUMANIZATION*\n`;
  report += `━`.repeat(30) + `\n\n`;
  
  report += `🎨 *Style:* ${style.toUpperCase()}\n\n`;
  
  report += `📝 *Before (${original.length} chars):*\n`;
  report += `"${truncateText(original, 80)}"\n\n`;
  
  report += `✨ *After (${humanized.length} chars):*\n`;
  report += `"${truncateText(humanized, 80)}"\n\n`;
  
  // Basic stats
  const origSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const humanSentences = humanized.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const origWords = original.split(/\s+/).length;
  const humanWords = humanized.split(/\s+/).length;
  
  report += `📊 *Changes Made:*\n`;
  report += `• Removed AI-sounding phrases\n`;
  report += `• Added natural variations\n`;
  report += `• Adjusted tone for ${style} style\n`;
  report += `• Sentences: ${origSentences.length} → ${humanSentences.length}\n`;
  report += `• Words: ${origWords} → ${humanWords}\n\n`;
  
  report += `📄 *Next Message:* Complete humanized text will be sent separately.\n\n`;
  
  report += `💡 *Tip:* Perfect for emails, social posts, or any content needing a human touch!\n`;
  
  report += `\n` + `━`.repeat(30) + `\n`;
  report += `⚡ ${getBotName()} Humanizer | Local Processing`;
  
  return report;
}

function calculateImprovements(original, humanized, analysis) {
  const origSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const humanSentences = humanized.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const origWords = original.split(/\s+/).length;
  const humanWords = humanized.split(/\s+/).length;
  
  // Calculate various metrics
  const aiPatternsRemoved = analysis?.aiIndicators?.length || 0;
  
  const origReadability = calculateReadabilityScore(original);
  const humanReadability = calculateReadabilityScore(humanized);
  const readabilityImproved = Math.max(0, Math.round(((origReadability - humanReadability) / origReadability) * 100));
  
  const origNaturalness = calculateNaturalnessScore(original);
  const humanNaturalness = calculateNaturalnessScore(humanized);
  const naturalnessImproved = Math.max(0, Math.round(((humanNaturalness - origNaturalness) / 100) * 100));
  
  const origPersonalization = calculatePersonalizationScore(original);
  const humanPersonalization = calculatePersonalizationScore(humanized);
  const personalizationAdded = Math.max(0, humanPersonalization - origPersonalization);
  
  const contractionsAdded = countContractions(humanized) - countContractions(original);
  
  // Calculate success rate
  let successRate = 60; // Base rate
  if (naturalnessImproved > 20) successRate += 20;
  if (aiPatternsRemoved > 0) successRate += 10;
  if (humanized.length > original.length * 0.7 && humanized.length < original.length * 1.5) successRate += 10;
  
  // Determine humanization level
  let humanizationLevel = 'MODERATE';
  const totalImprovement = naturalnessImproved + readabilityImproved + personalizationAdded;
  if (totalImprovement > 80) humanizationLevel = 'HIGH';
  if (totalImprovement > 120) humanizationLevel = 'EXCELLENT';
  if (totalImprovement < 30) humanizationLevel = 'LIGHT';
  
  // Check sentence variation
  const sentenceVariation = humanSentences.length !== origSentences.length || 
                           calculateSentenceLengthVariation(humanized) > calculateSentenceLengthVariation(original);
  
  return {
    aiPatternsRemoved,
    readabilityImproved,
    naturalnessImproved,
    personalizationAdded,
    sentenceVariation,
    contractionsAdded,
    sentenceCount: humanSentences.length,
    avgSentenceLength: Math.round(humanWords / (humanSentences.length || 1)),
    humanizationLevel,
    successRate: Math.min(100, successRate)
  };
}

function getStyleUsageTips(style) {
  const tips = {
    casual: '• Perfect for chats, messages, and informal communication\n• Sounds like natural conversation\n• Great for connecting with friends or colleagues',
    professional: '• Ideal for business emails and reports\n• Maintains professionalism while sounding human\n• Effective for client communication',
    creative: '• Great for stories, marketing, and engaging content\n• Adds personality and flair\n• Captures attention and imagination',
    academic: '• Suitable for educational materials\n• Makes complex topics more accessible\n• Engages learners effectively',
    social: '• Optimized for social media platforms\n• Increases engagement and shares\n• Perfect for tweets and posts',
    email: '• Ready-to-use email format\n• Professional yet approachable\n• Includes proper structure and tone',
    blog: '• Engaging blog/article format\n• Reader-friendly structure\n• Includes hooks and calls to action'
  };
  
  return tips[style] || 'Use for any text that needs to sound more natural and human.';
}

// ==================== UTILITY FUNCTIONS ====================

function analyzeTextForHumanization(text) {
  console.log(`Analyzing text for humanization (${text.length} chars)`);
  
  const analysis = {
    aiIndicators: [],
    humanIndicators: [],
    improvementAreas: [],
    toneScore: 0,
    readabilityScore: 0,
    personalizationScore: 0,
    naturalnessScore: 0
  };
  
  // Check for common AI patterns
  const aiPatterns = [
    { pattern: /as an ai language model/i, name: 'AI disclaimer' },
    { pattern: /based on my training data/i, name: 'Training data reference' },
    { pattern: /i don't have personal (experiences|emotions)/i, name: 'Emotion disclaimer' },
    { pattern: /firstly.*secondly.*thirdly/i, name: 'Numbered structure' },
    { pattern: /in conclusion.*(to sum up|overall)/i, name: 'Formal conclusion' },
    { pattern: /it is important to note that/i, name: 'Academic phrasing' },
    { pattern: /this (ensures|guarantees|provides)/i, name: 'Corporate phrasing' },
    { pattern: /\b(utilize|facilitate|implement|optimize)\b/i, name: 'Corporate jargon' },
    { pattern: /on one hand.*on the other hand/i, name: 'Balanced perspective' },
    { pattern: /there are several (reasons|factors|aspects)/i, name: 'Enumerative introduction' }
  ];
  
  // Check for human patterns
  const humanPatterns = [
    { pattern: /\b(lol|lmao|haha|hehe)\b/i, name: 'Laughter expressions' },
    { pattern: /\b(omg|wtf|smh|tbh|imo)\b/i, name: 'Internet slang' },
    { pattern: /i (think|feel|believe)/i, name: 'Personal opinion' },
    { pattern: /in my (opinion|experience)/i, name: 'Personal perspective' },
    { pattern: /personally.*i/i, name: 'Personal voice' },
    { pattern: /\b(like|you know|i mean)\b/i, name: 'Conversational fillers' },
    { pattern: /typo|mistake|error.*made/i, name: 'Self-correction' },
    { pattern: /sorry.*(typo|mistake)/i, name: 'Apology for errors' }
  ];
  
  // Analyze sentence structure
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/);
  
  // Detect AI patterns
  aiPatterns.forEach(({ pattern, name }) => {
    if (pattern.test(text)) {
      analysis.aiIndicators.push(name);
    }
  });
  
  // Detect human patterns
  humanPatterns.forEach(({ pattern, name }) => {
    if (pattern.test(text)) {
      analysis.humanInders.push(name);
    }
  });
  
  // Sentence structure analysis
  if (sentences.length > 0) {
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentences.length;
    const lengthVariation = calculateStandardDeviation(sentenceLengths);
    
    // AI text often has consistent sentence length
    if (lengthVariation < 3) {
      analysis.improvementAreas.push('Sentence length too consistent');
    }
    
    // Very long sentences
    if (avgSentenceLength > 25) {
      analysis.improvementAreas.push('Sentences too long');
    }
    
    // Analyze vocabulary
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const lexicalDiversity = uniqueWords.size / words.length;
    
    if (lexicalDiversity < 0.4) {
      analysis.improvementAreas.push('Low vocabulary diversity');
    }
  }
  
  // Check for personal pronouns
  const personalPronouns = countPersonalPronouns(text);
  if (personalPronouns < 2) {
    analysis.improvementAreas.push('Lack of personal pronouns');
  }
  
  // Check for contractions
  const contractions = countContractions(text);
  if (contractions < 1) {
    analysis.improvementAreas.push('No contractions used');
  }
  
  // Check for emotional words
  const emotionalWords = countEmotionalWords(text);
  if (emotionalWords < 1) {
    analysis.improvementAreas.push('Lack of emotional language');
  }
  
  // Calculate scores
  analysis.toneScore = calculateToneScore(text);
  analysis.readabilityScore = calculateReadabilityScore(text);
  analysis.personalizationScore = calculatePersonalizationScore(text);
  analysis.naturalnessScore = calculateNaturalnessScore(text);
  
  return analysis;
}

function calculateStandardDeviation(numbers) {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  return Math.sqrt(variance);
}

function calculateSentenceLengthVariation(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 1) return 0;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  return calculateStandardDeviation(lengths);
}

function countPersonalPronouns(text) {
  const pronouns = [' I ', ' me ', ' my ', ' mine ', ' we ', ' us ', ' our ', ' ours '];
  let count = 0;
  pronouns.forEach(pronoun => {
    const regex = new RegExp(pronoun, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

function countContractions(text) {
  const contractions = [
    "don't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't",
    "haven't", "hasn't", "hadn't", "wouldn't", "couldn't", "shouldn't",
    "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
    "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd",
    "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", "she'll",
    "we'll", "they'll", "that's", "there's", "what's", "who's"
  ];
  
  let count = 0;
  contractions.forEach(contraction => {
    const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

function countEmotionalWords(text) {
  const emotionalWords = [
    'love', 'hate', 'happy', 'sad', 'angry', 'excited', 'frustrated',
    'disappointed', 'hopeful', 'anxious', 'joy', 'sorrow', 'fear',
    'surprise', 'disgust', 'passion', 'despair', 'euphoria', 'melancholy',
    'amazing', 'terrible', 'awesome', 'awful', 'wonderful', 'horrible'
  ];
  
  let count = 0;
  emotionalWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

function calculateToneScore(text) {
  let score = 50;
  const formalIndicators = ['therefore', 'however', 'moreover', 'furthermore', 'consequently'];
  formalIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    if (regex.test(text)) score += 10;
  });
  
  const informalIndicators = ['lol', 'lmao', 'omg', 'haha', 'hehe'];
  informalIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    if (regex.test(text)) score -= 15;
  });
  
  const contractions = countContractions(text);
  score -= contractions * 2;
  
  return Math.max(0, Math.min(100, score));
}

function calculateReadabilityScore(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/);
  
  if (sentences.length === 0 || words.length === 0) return 50;
  
  const avgSentenceLength = words.length / sentences.length;
  const avgWordLength = text.replace(/[^a-z]/gi, '').length / words.length;
  
  let score = 50;
  if (avgSentenceLength > 20) score += 20;
  if (avgWordLength > 5) score += 15;
  
  return Math.max(0, Math.min(100, score));
}

function calculatePersonalizationScore(text) {
  let score = 0;
  const personalPronouns = countPersonalPronouns(text);
  score += personalPronouns * 5;
  
  const opinionWords = ['think', 'feel', 'believe', 'opinion'];
  opinionWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(text)) score += 10;
  });
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const firstPersonSentences = sentences.filter(s => /^I |^My |^We /.test(s));
  score += (firstPersonSentences.length / sentences.length) * 30;
  
  return Math.min(100, score);
}

function calculateNaturalnessScore(text) {
  let score = 50;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const stdDev = calculateStandardDeviation(lengths);
    if (stdDev > 5) score += 10;
    if (stdDev < 2) score -= 10;
  }
  
  const contractions = countContractions(text);
  score += contractions * 2;
  
  const emotionalWords = countEmotionalWords(text);
  score += emotionalWords * 3;
  
  const conversational = ['you know', 'i mean', 'like', 'actually', 'basically'];
  conversational.forEach(marker => {
    if (text.toLowerCase().includes(marker)) score += 5;
  });
  
  return Math.max(0, Math.min(100, score));
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function extractKeywords(text) {
  const words = text.toLowerCase().split(/\s+/);
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
  
  const freq = {};
  words.forEach(word => {
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
      freq[cleanWord] = (freq[cleanWord] || 0) + 1;
    }
  });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function optimizeForSocialMedia(text) {
  if (text.length <= 280) return text;
  
  // Try to cut at a sentence boundary
  const sentences = text.split(/(?<=[.!?])\s+/);
  let result = '';
  
  for (const sentence of sentences) {
    if ((result + ' ' + sentence).length <= 250) { // Leave room for hashtags
      result += (result ? ' ' : '') + sentence;
    } else {
      break;
    }
  }
  
  // If still too long, cut at word boundary
  if (result.length === 0 || result.length > 250) {
    result = text.substring(0, 250);
    const lastSpace = result.lastIndexOf(' ');
    if (lastSpace > 200) {
      result = result.substring(0, lastSpace);
    }
    result += '...';
  }
  
  return result;
}

function improveProfessionalClarity(text) {
  let result = text;
  const simplifications = [
    { complex: /\butilize\b/gi, simple: 'use' },
    { complex: /\bfacilitate\b/gi, simple: 'help' },
    { complex: /\bimplement\b/gi, simple: 'put in place' },
    { complex: /\boptimize\b/gi, simple: 'improve' },
    { complex: /\bstrategize\b/gi, simple: 'plan' },
    { complex: /\bleverage\b/gi, simple: 'use' },
    { complex: /\bsynergize\b/gi, simple: 'work together' },
    { complex: /\bparadigm\b/gi, simple: 'approach' },
    { complex: /\bbandwidth\b/gi, simple: 'time' },
    { complex: /\btouch base\b/gi, simple: 'check in' }
  ];
  
  simplifications.forEach(({ complex, simple }) => {
    result = result.replace(complex, simple);
  });
  
  return result;
}

function addMoreConversationalElements(text) {
  let result = text;
  const elements = [' By the way,', ' You know,', ' Actually,', ' I think,', ' Honestly,'];
  
  if (Math.random() > 0.5 && !elements.some(el => result.includes(el))) {
    const element = elements[Math.floor(Math.random() * elements.length)];
    const sentences = result.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
      const insertIndex = Math.floor(Math.random() * (sentences.length - 1)) + 1;
      sentences.splice(insertIndex, 0, element);
      result = sentences.join(' ');
    }
  }
  
  return result;
}

function addMoreDescriptiveLanguage(text) {
  let result = text;
  const descriptors = {
    'interesting': ['fascinating', 'captivating', 'intriguing', 'compelling'],
    'good': ['excellent', 'outstanding', 'remarkable', 'impressive'],
    'important': ['crucial', 'essential', 'vital', 'critical'],
    'big': ['significant', 'substantial', 'considerable', 'major']
  };
  
  Object.entries(descriptors).forEach(([basic, advanced]) => {
    const regex = new RegExp(`\\b${basic}\\b`, 'gi');
    if (regex.test(result) && Math.random() > 0.5) {
      const replacement = advanced[Math.floor(Math.random() * advanced.length)];
      result = result.replace(regex, replacement);
    }
  });
  
  return result;
}

function makeMoreEngagingForSocial(text) {
  let result = text;
  
  // Add more emojis
  const emojis = ['✨', '🔥', '🚀', '💯', '👏', '🎯', '💡', '🌟'];
  if (Math.random() > 0.3) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    result = result.replace(/[.!?]+$/, '') + ' ' + emoji;
  }
  
  // Add engagement question
  if (!/\?$/.test(result) && Math.random() > 0.5) {
    const questions = ['What do you think?', 'Agree?', 'Thoughts?', 'Have you tried this?'];
    result += ' ' + questions[Math.floor(Math.random() * questions.length)];
  }
  
  return result;
}

// Export for testing if needed
export {
  enhancedHumanizeText,
  analyzeTextForHumanization,
  calculateImprovements
};