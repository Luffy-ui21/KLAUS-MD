/**
 * Anti-spam — Rate limit messages per user
 * Skips the bot owner (they can send as many messages as they want)
 */

const rates = new Map(); // jid -> [{ ts }, ...]
const WINDOW_MS = 5000; // 5 seconds
const MAX_MSGS = 5; // Max 5 msgs per 5s for non-owners

async function check(sock, msg, dbSession) {
  // ★ Skip anti-spam for the bot owner — they own the bot, they can spam if they want
  if (dbSession?.phoneNumber) {
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const senderNum = senderJid?.split('@')[0].split(':')[0];
    if (senderNum === dbSession.phoneNumber) {
      return; // Owner — don't rate-limit
    }
    // Also skip if fromMe=true (owner's linked device)
    if (msg.key.fromMe) {
      return;
    }
  }

  const jid = msg.key.participant || msg.key.remoteJid;
  const now = Date.now();

  if (!rates.has(jid)) rates.set(jid, []);
  const arr = rates.get(jid);
  arr.push({ ts: now });
  // Trim old entries
  while (arr.length && arr[0].ts < now - WINDOW_MS) arr.shift();

  if (arr.length > MAX_MSGS) {
    // Detected spam — silently ignore (no warning message)
    // Just reset their counter
    rates.set(jid, [{ ts: now }]);
    console.log(`[ANTI-SPAM] Rate limit hit by ${jid.split('@')[0]} — silently ignoring`);
  }
}

module.exports = { check };
