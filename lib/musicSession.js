const sessions = new Map();
const TTL = 10 * 60 * 1000;

export function setMusicSession(chatId, data) {
  sessions.set(chatId, { ...data, ts: Date.now() });
}

export function getMusicSession(chatId) {
  const s = sessions.get(chatId);
  if (!s) return null;
  if (Date.now() - s.ts > TTL) {
    sessions.delete(chatId);
    return null;
  }
  return s;
}

export function updateMusicSession(chatId, updates) {
  const s = sessions.get(chatId);
  if (s) sessions.set(chatId, { ...s, ...updates, ts: Date.now() });
}

export function clearMusicSession(chatId) {
  sessions.delete(chatId);
}
