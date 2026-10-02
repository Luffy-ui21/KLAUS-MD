// lib/userProfile.js
// Persistent user profile and learning system for the chatbot.
//
// Each user gets a JSON profile that persists across sessions and stores:
//   - name, age, location (extracted automatically from messages)
//   - interests, dislikes
//   - memories[] — a rolling list of facts about the user
//   - messageCount, firstSeen, lastSeen
//
// The profile is included in the AI system prompt so the bot can address
// users by name, remember their preferences, and build on past conversations.

import fs from 'fs';
import path from 'path';

const PROFILES_BASE = './data/chatbot/profiles';
const MAX_MEMORIES  = 25;

// ── Fact extraction patterns ───────────────────────────────────────────────
// These regex patterns detect user self-disclosure in casual conversation.
const FACT_PATTERNS = [
  { re: /my name is ([A-Za-z]+)/i,              tag: 'name',       extract: m => m[1] },
  { re: /(?:i'?m|i am) ([A-Za-z]{2,20})(?:\s|$|,)/i, tag: 'name', extract: m => m[1] },
  { re: /call me ([A-Za-z]+)/i,                 tag: 'name',       extract: m => m[1] },
  { re: /(?:i'?m|i am) (\d{1,3})(?: years? old)?/i, tag: 'age',   extract: m => `${m[1]} years old` },
  { re: /i'?m (?:a |an )([\w\s]{3,30})/i,       tag: 'job',        extract: m => m[1].trim() },
  { re: /i work (?:as |at )([\w\s]{3,40})/i,    tag: 'job',        extract: m => m[1].trim() },
  { re: /i(?:'?m| am) from ([A-Za-z\s]{3,30})/i,tag: 'location',   extract: m => m[1].trim() },
  { re: /i live in ([A-Za-z\s]{3,30})/i,         tag: 'location',   extract: m => m[1].trim() },
  { re: /i (?:love|really like) ([\w\s]{3,40})/i,tag: 'interest',   extract: m => m[1].trim() },
  { re: /i (?:like|enjoy) ([\w\s]{3,40})/i,      tag: 'interest',   extract: m => m[1].trim() },
  { re: /i (?:hate|dislike|can'?t stand) ([\w\s]{3,40})/i, tag: 'dislike', extract: m => m[1].trim() },
  { re: /i(?:'?m| am) (?:learning|studying) ([\w\s]{3,40})/i, tag: 'learning', extract: m => m[1].trim() },
];

// Words that would make a false "name" match (skip these)
const SKIP_NAMES = new Set([
  'a', 'an', 'the', 'not', 'so', 'ok', 'here', 'just', 'very', 'good', 'bad',
  'fine', 'going', 'trying', 'sure', 'done', 'still', 'using', 'thinking',
  'looking', 'happy', 'sad', 'excited', 'tired', 'bored', 'hungry', 'ready',
  'back', 'new', 'old', 'young', 'big', 'small', 'busy', 'free', 'well',
  'getting', 'working', 'waiting', 'watching', 'listening', 'reading',
]);

// ── File helpers ───────────────────────────────────────────────────────────
function getProfileDir(botId) {
  const dir = path.join(PROFILES_BASE, botId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getProfilePath(botId, userId) {
  return path.join(getProfileDir(botId), `${userId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function loadProfile(botId, userId) {
  const file = getProfilePath(botId, userId);
  try {
    if (fs.existsSync(file)) {
      const p = JSON.parse(fs.readFileSync(file, 'utf8'));
      return p;
    }
  } catch {}
  return {
    userId,
    name:         null,
    age:          null,
    location:     null,
    job:          null,
    interests:    [],
    dislikes:     [],
    memories:     [],
    messageCount: 0,
    firstSeen:    new Date().toISOString(),
    lastSeen:     new Date().toISOString()
  };
}

export function saveProfile(botId, userId, profile) {
  const file = getProfilePath(botId, userId);
  profile.lastSeen     = new Date().toISOString();
  profile.messageCount = (profile.messageCount || 0) + 1;
  try { fs.writeFileSync(file, JSON.stringify(profile, null, 2)); } catch {}
}

// Extract facts from a single user message and update the profile object.
// Returns the (possibly modified) profile — call saveProfile() to persist.
export function learnFromMessage(text, profile) {
  const updated = { ...profile, memories: [...(profile.memories || [])] };
  const lower   = text.toLowerCase();

  for (const { re, tag, extract } of FACT_PATTERNS) {
    const match = lower.match(re);
    if (!match) continue;

    const raw   = extract(match);
    if (!raw || raw.length > 60) continue;

    // Skip generic words that would produce bad "name" entries
    if (tag === 'name' && SKIP_NAMES.has(raw.toLowerCase())) continue;

    const value  = raw.charAt(0).toUpperCase() + raw.slice(1);
    const memory = `User's ${tag}: ${value}`;

    // Update the dedicated field if this tag has one
    if (tag === 'name'     && !updated.name)     updated.name     = value;
    if (tag === 'age'      && !updated.age)       updated.age      = value;
    if (tag === 'location' && !updated.location)  updated.location = value;
    if (tag === 'job'      && !updated.job)        updated.job      = value;
    if (tag === 'interest') {
      if (!updated.interests.includes(value)) updated.interests.push(value);
      if (updated.interests.length > 10)       updated.interests = updated.interests.slice(-10);
    }
    if (tag === 'dislike') {
      if (!updated.dislikes.includes(value)) updated.dislikes.push(value);
      if (updated.dislikes.length > 10)       updated.dislikes = updated.dislikes.slice(-10);
    }

    // Add to rolling memories list (avoid duplicates)
    const alreadyKnown = updated.memories.some(m =>
      m.toLowerCase().includes(tag) && m.toLowerCase().includes(value.toLowerCase().slice(0, 8))
    );
    if (!alreadyKnown) {
      updated.memories.unshift(memory);
      if (updated.memories.length > MAX_MEMORIES) updated.memories = updated.memories.slice(0, MAX_MEMORIES);
    }
  }

  return updated;
}

// Build the profile context paragraph injected into the AI system prompt.
export function buildProfileContext(profile) {
  if (!profile) return '';

  const lines = [];

  if (profile.name)     lines.push(`- The user's name is ${profile.name}. Use their name naturally in conversation.`);
  if (profile.age)      lines.push(`- Age: ${profile.age}`);
  if (profile.location) lines.push(`- Location: ${profile.location}`);
  if (profile.job)      lines.push(`- Job/Role: ${profile.job}`);

  if ((profile.interests || []).length > 0) {
    lines.push(`- Interests: ${profile.interests.slice(0, 5).join(', ')}`);
  }

  const extraMemories = (profile.memories || [])
    .filter(m => !['name','age','location','job'].some(t => m.startsWith(`User's ${t}`)))
    .slice(0, 5);
  for (const mem of extraMemories) lines.push(`- ${mem}`);

  if (profile.messageCount > 1) {
    lines.push(`- You've spoken before (${profile.messageCount} messages total) — treat them as a returning friend.`);
  }

  if (lines.length === 0) return '';

  return `\n🧠 What you know about this user:\n${lines.join('\n')}\n`;
}

// Return a short greeting tailored to the profile (used when bot starts a reply).
export function getPersonalizedGreeting(profile) {
  if (profile?.name) {
    const greetings = [
      `Hey ${profile.name}!`,
      `${profile.name}!`,
      `Yo ${profile.name}!`,
      `${profile.name}, great question!`,
      `Sure thing, ${profile.name}!`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  return null;
}
