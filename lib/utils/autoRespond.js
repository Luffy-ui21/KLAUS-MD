/**
 * AI Auto-Responder Module — Multi-tier
 *
 * Generates human-like replies to incoming WhatsApp messages.
 * Supports English + Swahili (detects which language the sender used).
 *
 * Tier 1: Google Gemini API (if GEMINI_API_KEY env var is set AND region is supported)
 *         — best quality, understands full context
 * Tier 2: Pollinations.ai free API (anonymous, no key)
 *         — usually reliable, no setup needed
 * Tier 3: Smart local pattern-matching response engine (always available)
 *         — detects intent (greeting, question, thanks, etc.) + language
 *
 * The reply should sound like the bot owner typing casually on WhatsApp —
 * short, natural, mixed English/Swahili (Sheng style).
 */

const axios = require('axios');

/**
 * Detect if a message is in Swahili (or Sheng) vs English.
 */
function detectLanguage(text) {
  if (!text) return 'en';
  const t = text.toLowerCase();
  const swahiliWords = [
    'jambo', 'habari', 'mambo', 'vipi', 'sasa', 'hujambo', 'salama',
    'asante', 'karibu', 'nzuri', 'sawa', 'ndio', 'hapana', 'siyo',
    'nini', 'gani', 'wapi', 'lini', 'kwa', 'nina', 'wewe', 'yangu',
    'siku', 'leo', 'kesho', 'jana', 'sasa', 'bado', 'sana', 'kidogo',
    'tatu', 'mbili', 'moja', 'nyingi', 'wote', 'hii', 'hizi', 'zile',
    'yeye', 'wao', 'sisi', 'wewe', 'mimi', 'nyinyi', 'ninyi',
    'nahitaji', 'ninataka', 'nataka', 'unaweza', 'weza', 'fanya',
    'kuja', 'enda', 'rudi', 'acha', 'subiri', 'sikiliza', 'ongea',
    'maana', 'sababu', 'hivyo', 'hakuna', 'kuna', 'ila', 'lakini',
    'sijui', 'najua', 'elewa', 'pata', 'toa', 'pa', 'nipe',
  ];
  let swCount = 0;
  for (const w of swahiliWords) {
    if (t.includes(w)) swCount++;
  }
  if (swCount >= 2) return 'sw';
  if (swCount === 1) return 'mixed';
  return 'en';
}

/**
 * Detect the intent of a message.
 */
function detectIntent(text) {
  if (!text) return 'unknown';
  const t = text.toLowerCase().trim();

  if (/^(hi|hey|hello|yo|sup|hiya|heyo|hallo|hola)\b/.test(t)) return 'greeting';
  if (/^(jambo|hujambo|habari|mambo|vipi|sasa|salama|helo)\b/.test(t)) return 'greeting';
  if (/^(morning|evening|afternoon|afternon)\b/.test(t)) return 'greeting';
  if (/asubuhi|jioni|mchana/.test(t)) return 'greeting';

  if (/how are you|how r u|how you doing|wyd|what you doing/.test(t)) return 'howareyou';
  if (/umeshindaje|unafanyaje|uliaje|habari yako|habari za leo|mambo vipi|niko aje/.test(t)) return 'howareyou';

  if (/thank|thx|thanks|appreciate/.test(t)) return 'thanks';
  if (/asante|asante sana|naheshimu|shukran/.test(t)) return 'thanks';

  if (/^(bye|goodbye|gtg|cya|later|tc)\b/.test(t)) return 'bye';
  if (/^(tutaonana|baadaye|kwa heri|lakini|later)\b/.test(t)) return 'bye';

  if (t.endsWith('?') || t.endsWith('?')) return 'question';
  if (/^(what|who|where|when|why|how|which|can|could|would|will|do|did|is|are|am|have|has)\b/.test(t)) return 'question';
  if (/^(nini|nani|wapi|lini|mbona|vipi|gani|je|apana)\b/.test(t)) return 'question';

  if (/^(ok|okay|k|kk|alright|sure|fine|cool|nice|got it|seen)\b/.test(t)) return 'ack';
  if (/^(sawa|ndio|eeh|ee|aha|hmm|nimepata|nimesikia)\b/.test(t)) return 'ack';

  if (/love|miss you|cute|sweet|nice one|well done|good job/.test(t)) return 'compliment';
  if (/nakupenda|namiss|wewe ni|upo fiti/.test(t)) return 'compliment';

  if (/help|assist|support|need|how do i|how to/.test(t)) return 'help';
  if (/saidizi|msaada|niongelee|nisaidie/.test(t)) return 'help';

  return 'chat';
}

/**
 * Smart local reply generator (Tier 3 — always available)
 */
function localReply(text, senderName = '') {
  const lang = detectLanguage(text);
  const intent = detectIntent(text);

  const responses = {
    greeting: {
      en: ['Heyy 👋', 'Hello! What\'s good?', 'Hey, how are you?', 'Yo! Long time', 'Hi there 😊'],
      sw: ['Mambo vipi 👋', 'Niaje! Habari zako?', 'Jambo! Habari yako?', 'Sasa! Vipi?', 'Heyy, umeshindaje?'],
      mixed: ['Sema! Uko aje?', 'Niaje! Habari?', 'Mambo! Vipi?', 'Hey, long time! Uko fiti?'],
    },
    howareyou: {
      en: ['I\'m good, thanks! You?', 'Doing great! How about you?', 'All good 😊 Wbu?', 'Fine fine! And you?'],
      sw: ['Niko poa! Wewe?', 'Nimekuwa nzuri! Umeshindaje?', 'Sawa tu! Habari yako?', 'Niko fiti! Wewe je?'],
      mixed: ['Niko poa tu! Uko aje?', 'Fit! Habari?', 'Niko good! Wewe?'],
    },
    thanks: {
      en: ['Anytime! 😊', 'No problem!', 'You\'re welcome', 'My pleasure', 'It\'s okay!'],
      sw: ['Karibu! 😊', 'Hakuna shida!', 'Asante pia!', 'Tupo pamoja', 'Sawa sana!'],
      mixed: ['Karibu sana!', 'Hakuna mathanga!', 'Anytime! 😊'],
    },
    bye: {
      en: ['Bye! 👋', 'See you!', 'Take care!', 'Later!', 'Catch you later'],
      sw: ['Tutaonana! 👋', 'Baadaye!', 'Kwa heri! Care!', 'Baadaye bro!', 'Nakuona'],
      mixed: ['Later! 👋', 'Tutaonana!', 'Baadaye tu!'],
    },
    question: {
      en: ['Hmm good question 🤔', 'Let me think about that', 'Not sure, what do you think?', 'Haha that\'s a tough one'],
      sw: ['Sijui kwa sasa 🤔', 'Hebu nifikirie', 'Mmmh, ni ngumu kusema', 'Acha nifikirie kidogo'],
      mixed: ['Mmmh, good question 🤔', 'Sijui tbh', 'Hebu acha nifikirie'],
    },
    ack: {
      en: ['👍', 'Okay!', 'Got it', 'Sure thing', 'Cool!'],
      sw: ['Sawa 👍', 'Nimepata', 'Eeh', 'Hakuna shida', 'Okay!'],
      mixed: ['Sawa 👍', 'Okay!', 'Eeh sawa'],
    },
    compliment: {
      en: ['Aww thanks! 😊', 'That\'s sweet of you', 'Haha appreciate it', 'You\'re the best!'],
      sw: ['Asante sana! 😊', 'Wewe pia!', 'Haha asante!', 'Karibu sana'],
      mixed: ['Asante! 😊', 'Aww thanks!', 'Wewe pia!'],
    },
    help: {
      en: ['Sure, what do you need?', 'I got you — what\'s up?', 'Tell me more', 'How can I help?'],
      sw: ['Nisaidie vipi?', 'Sema, nini tatizo?', 'Nipo, tuambie', 'Nisaidie aje?'],
      mixed: ['Niko hapa, sema?', 'What do you need?', 'Tuambie, niko ready'],
    },
    chat: {
      en: ['Haha true!', 'Yeah I feel you', 'For real!', 'I get you', 'Hmm interesting', 'Tell me more 👀', 'Oh really? 😄', 'Haha yeah'],
      sw: ['Eeh ndio hivo!', 'Nimepata', 'Kweli kabisa!', 'Nakuelewa', 'Hebu nieleze zaidi', 'Kweli? 😄', 'Haha ndio!'],
      mixed: ['Eeh true!', 'Nakuelewa', 'For real!', 'Kweli kabisa', 'Hebu tell me more', 'Nimepata'],
    },
    unknown: {
      en: ['Yeah?', 'Hmm?', 'What\'s up?', 'Tell me more'],
      sw: ['Eeh?', 'Mmh?', 'Nini?', 'Sema'],
      mixed: ['Eeh?', 'Mmh?', 'Nini?', 'Sema'],
    },
  };

  const pool = responses[intent]?.[lang] || responses.chat[lang] || responses.chat.en;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Tier 1: Google Gemini API
 * Requires GEMINI_API_KEY env var.
 * Note: Gemini may be blocked in some regions (e.g. Africa) — falls through to Tier 2.
 */
async function geminiReply(text, senderName = '', conversationContext = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const systemPrompt = `You are responding on behalf of a Kenyan WhatsApp user. The user's name is ${senderName || 'a contact'}.

Your job is to reply to their message as if you ARE the person receiving the message — casual, short, like a real WhatsApp text. Rules:
- Detect the language: if they write in Swahili, reply in Swahili. If English, reply in English. If mixed (Sheng), reply in Sheng.
- Keep replies SHORT (1-2 sentences max). Real WhatsApp texts are brief.
- Use casual texting language (no formal grammar needed).
- Be friendly and natural. Use emojis sparingly like a real person.
- If they ask a question you can't answer, give a vague natural response (don't say "I'm an AI").
- If they ask how you are, say you're good / fine / niko poa.
- If it's a greeting, greet back naturally.
- NEVER mention you're an AI or bot. You are the person.

Reply with ONLY the WhatsApp message text, nothing else. No quotes, no explanations.`;

    const userContent = `${conversationContext.map(m => `${m.role === 'user' ? 'Them' : 'Me'}: ${m.content}`).join('\n')}\nThem: ${text}\nMe:`;

    // Try multiple model names (some are deprecated, some need full path)
    const modelCandidates = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash',
    ];

    for (const model of modelCandidates) {
      try {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userContent }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 100, topP: 0.9 },
          },
          { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
        );

        const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          return reply.trim().slice(0, 500);  // Safety cap
        }
      } catch (e) {
        const status = e.response?.status;
        if (status === 404) continue;  // Model not found — try next
        if (status === 400 && e.response?.data?.error?.message?.includes('location')) {
          console.warn('[AUTO-RESPOND] Gemini blocked in this region — using fallback');
          return null;  // Region blocked — give up immediately
        }
        // Other errors (network, rate limit) — try next model
        continue;
      }
    }
    return null;
  } catch (e) {
    console.warn('[AUTO-RESPOND] Gemini failed:', e.message);
    return null;
  }
}

/**
 * Tier 2: Pollinations.ai free API (anonymous, no key needed)
 * Tries multiple times — sometimes rate-limited.
 */
async function pollinationsReply(text, senderName = '', conversationContext = []) {
  try {
    const systemPrompt = `You are a Kenyan WhatsApp user named ${senderName || 'a friend'}. Reply casually and briefly to: "${text}". Match the language (English/Swahili/Sheng). 1-2 short sentences. No AI mentions.`;

    const fullPrompt = conversationContext.length > 0
      ? `${systemPrompt}\n\nPrevious: ${conversationContext.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\nReply:`
      : systemPrompt;

    const encoded = encodeURIComponent(fullPrompt);
    const url = `https://text.pollinations.ai/${encoded}?model=openai&private=true`;

    const res = await axios.get(url, {
      timeout: 20000,
      headers: { 'User-Agent': 'MEGH-MD-Bot/4.7' },
    });

    if (typeof res.data === 'string' && res.data.trim().length > 0) {
      let reply = res.data.trim();
      // Clean up common AI artifacts
      reply = reply.replace(/^(Me:|Reply:|Response:)\s*/i, '').replace(/^["']|["']$/g, '');
      if (reply.length > 0 && reply.length < 500) {
        return reply;
      }
    }
    return null;
  } catch (e) {
    console.warn('[AUTO-RESPOND] Pollinations failed:', e.message);
    return null;
  }
}

/**
 * Main entry: generate a reply for the given message.
 * Tries Gemini first → Pollinations → local fallback.
 */
async function generateReply(text, senderName = '', conversationContext = []) {
  const cleanText = (text || '').trim();
  if (!cleanText) return null;

  // Tier 1: Gemini API
  if (process.env.GEMINI_API_KEY) {
    const aiReply = await geminiReply(cleanText, senderName, conversationContext);
    if (aiReply) {
      console.log('[AUTO-RESPOND] ✅ Used Gemini AI');
      return aiReply;
    }
  }

  // Tier 2: Pollinations.ai
  const polReply = await pollinationsReply(cleanText, senderName, conversationContext);
  if (polReply) {
    console.log('[AUTO-RESPOND] ✅ Used Pollinations.ai');
    return polReply;
  }

  // Tier 3: Local pattern matching (always available)
  console.log('[AUTO-RESPOND] ✅ Used local patterns');
  return localReply(cleanText, senderName);
}

module.exports = { generateReply, detectLanguage, detectIntent, localReply };
