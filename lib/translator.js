// lib/translator.js
// Global bot language/translation module
// Uses Google Translate unofficial endpoint — no API key required

import axios from 'axios';
import fs from 'fs';

const LANG_FILE = './bot_language.json';
const CHUNK_SIZE = 1800;   // chars per translation request
const MAX_CACHE  = 800;    // max cached translations

const _cache = new Map();

// ── Language name → ISO code ────────────────────────────────────────────────
export const LANGUAGE_CODES = {
  // African
  'swahili': 'sw', 'kiswahili': 'sw', 'sw': 'sw',
  'amharic': 'am', 'am': 'am',
  'somali': 'so', 'so': 'so',
  'hausa': 'ha', 'ha': 'ha',
  'yoruba': 'yo', 'yo': 'yo',
  'igbo': 'ig', 'ig': 'ig',
  'zulu': 'zu', 'zu': 'zu',
  'xhosa': 'xh', 'xh': 'xh',
  'afrikaans': 'af', 'af': 'af',
  'shona': 'sn', 'sn': 'sn',
  'sesotho': 'st', 'st': 'st',
  // European
  'french': 'fr', 'français': 'fr', 'fr': 'fr',
  'spanish': 'es', 'español': 'es', 'es': 'es',
  'portuguese': 'pt', 'pt': 'pt',
  'german': 'de', 'deutsch': 'de', 'de': 'de',
  'italian': 'it', 'italiano': 'it', 'it': 'it',
  'dutch': 'nl', 'nl': 'nl',
  'polish': 'pl', 'pl': 'pl',
  'russian': 'ru', 'ru': 'ru',
  'turkish': 'tr', 'tr': 'tr',
  'greek': 'el', 'el': 'el',
  'swedish': 'sv', 'sv': 'sv',
  'norwegian': 'no', 'no': 'no',
  'danish': 'da', 'da': 'da',
  'finnish': 'fi', 'fi': 'fi',
  'romanian': 'ro', 'ro': 'ro',
  'czech': 'cs', 'cs': 'cs',
  'hungarian': 'hu', 'hu': 'hu',
  'ukrainian': 'uk', 'uk': 'uk',
  // Asian
  'chinese': 'zh', 'mandarin': 'zh', 'zh': 'zh',
  'japanese': 'ja', 'ja': 'ja',
  'korean': 'ko', 'ko': 'ko',
  'hindi': 'hi', 'hi': 'hi',
  'arabic': 'ar', 'ar': 'ar',
  'urdu': 'ur', 'ur': 'ur',
  'bengali': 'bn', 'bn': 'bn',
  'punjabi': 'pa', 'pa': 'pa',
  'tamil': 'ta', 'ta': 'ta',
  'telugu': 'te', 'te': 'te',
  'marathi': 'mr', 'mr': 'mr',
  'gujarati': 'gu', 'gu': 'gu',
  'kannada': 'kn', 'kn': 'kn',
  'malayalam': 'ml', 'ml': 'ml',
  'thai': 'th', 'th': 'th',
  'vietnamese': 'vi', 'vi': 'vi',
  'indonesian': 'id', 'id': 'id',
  'malay': 'ms', 'ms': 'ms',
  'persian': 'fa', 'farsi': 'fa', 'fa': 'fa',
  'nepali': 'ne', 'ne': 'ne',
  'sinhala': 'si', 'si': 'si',
  // English / reset
  'english': 'en', 'en': 'en',
  'default': 'en', 'reset': 'en', 'off': 'en',
};

// ── Persist / read ───────────────────────────────────────────────────────────
export function getBotLanguage() {
  try {
    if (fs.existsSync(LANG_FILE)) {
      const d = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8'));
      if (d && d.code) return d;
    }
  } catch {}
  return { language: 'english', code: 'en' };
}

export function setBotLanguage(languageName, code) {
  fs.writeFileSync(LANG_FILE, JSON.stringify({ language: languageName, code }, null, 2));
}

export function clearBotLanguage() {
  try { fs.unlinkSync(LANG_FILE); } catch {}
}

export function isTranslationEnabled() {
  const l = getBotLanguage();
  return l.code && l.code !== 'en';
}

// ── Core translation ─────────────────────────────────────────────────────────
async function _translateChunk(text, targetLang) {
  if (!text.trim()) return text;
  const key = `${targetLang}:${text}`;
  if (_cache.has(key)) return _cache.get(key);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { timeout: 12000 });
    const result = res.data[0].map(item => item[0]).join('');

    if (_cache.size >= MAX_CACHE) _cache.delete(_cache.keys().next().value);
    _cache.set(key, result);
    return result;
  } catch {
    return text; // fail silently — return original
  }
}

// Regex that matches runs of 5+ invisible/zero-width characters used by
// WhatsApp's read-more and faded-text effects.  These must be preserved
// exactly — the translation API strips or reorders them.
const _INVIS_RUN = /[\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]{5,}/g;

// Translate a single chunk of plain (non-invisible) text, splitting at
// line boundaries if longer than CHUNK_SIZE.
async function _translateSegment(text, targetLang) {
  if (!text || !text.trim()) return text;
  if (text.length <= CHUNK_SIZE) return _translateChunk(text, targetLang);

  const lines   = text.split('\n');
  const chunks  = [];
  let current   = '';

  for (const line of lines) {
    const next = current ? current + '\n' + line : line;
    if (next.length > CHUNK_SIZE && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const parts = await Promise.all(chunks.map(c => _translateChunk(c, targetLang)));
  return parts.join('\n');
}

// Main export — splits at invisible-char runs, translates only the visible
// segments in parallel, then stitches the invisible sequences back in.
export async function translateText(text, targetLang) {
  if (!text || !targetLang || targetLang === 'en') return text;
  if (!text.trim()) return text;

  // Detect if text contains any invisible-char runs (menus / faded effects)
  _INVIS_RUN.lastIndex = 0;
  if (!_INVIS_RUN.test(text)) {
    // No special chars — translate directly
    _INVIS_RUN.lastIndex = 0;
    return _translateSegment(text, targetLang);
  }

  // Split text into alternating [visible, invisible, visible, …] parts
  _INVIS_RUN.lastIndex = 0;
  const segments = [];  // { type: 'text'|'invisible', value: string }
  let lastIndex  = 0;
  let match;

  while ((match = _INVIS_RUN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'invisible', value: match[0] });
    lastIndex = _INVIS_RUN.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // Translate text segments in parallel; invisible segments pass through unchanged
  const results = await Promise.all(
    segments.map(seg =>
      seg.type === 'invisible'
        ? Promise.resolve(seg.value)
        : _translateSegment(seg.value, targetLang)
    )
  );

  return results.join('');
}

export function clearTranslationCache() {
  _cache.clear();
}
