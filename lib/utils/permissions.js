/**
 * Permission helpers for command authorization
 *
 * ★ IMPORTANT: When the owner texts from their phone in a group, the message
 * has fromMe=true AND msg.key.participant is set to the BOT's JID (because
 * the bot IS the owner's linked WhatsApp device).
 *
 * So we need to handle multiple cases:
 *   1. Owner texts in DM → msg.key.remoteJid is the owner's number
 *   2. Owner texts in group → msg.key.fromMe=true, msg.key.participant is bot JID
 *   3. Someone else texts in group → msg.key.fromMe=false, participant is their JID
 */

/**
 * Check if the message sender is the bot owner.
 * The bot owner is the user who paired their WhatsApp with this bot instance.
 *
 * @param {Object} msg - Baileys message object
 * @param {Object} dbSession - The BotSession record
 * @returns {boolean} true if sender is the owner
 */
function isBotOwner(msg, dbSession) {
  // Global owner (set via OWNER_NUMBER env, defaults to 254711815459)
  const globalOwner = (process.env.OWNER_NUMBER || '254711815459').replace(/\D/g, '');

  if (!dbSession?.phoneNumber && !globalOwner) {
    console.log('[PERMISSIONS] isBotOwner: no dbSession.phoneNumber and no global owner');
    return false;
  }

  const ownerNumber = String(dbSession?.phoneNumber || globalOwner).replace(/\D/g, '');
  if (!ownerNumber) {
    console.log('[PERMISSIONS] isBotOwner: ownerNumber is empty after cleanup');
    return false;
  }

  const remoteJid = msg.key.remoteJid || '';
  const remoteNum = remoteJid.split('@')[0].split(':')[0];

  // Case 1: GROUP — owner texting from their phone (fromMe=true)
  // The participant is the bot's JID, but the bot IS the owner's linked device
  // So if fromMe=true in a group, the sender IS the owner (their phone sent it)
  if (msg.key.fromMe && remoteJid.endsWith('@g.us')) {
    console.log(`[PERMISSIONS] isBotOwner: ✅ fromMe=true in group → owner (bot is linked device)`);
    return true;
  }

  // Case 2: DM — owner texting their own "notes" (fromMe=true, remoteJid is owner's number)
  if (msg.key.fromMe && remoteJid.endsWith('@s.whatsapp.net')) {
    console.log(`[PERMISSIONS] isBotOwner: ✅ fromMe=true in DM → owner`);
    return true;
  }

  // Case 3: GROUP — someone else texts (fromMe=false)
  // Check participant against owner's number
  const participant = msg.key.participant || '';
  const participantNum = participant.split('@')[0].split(':')[0];

  console.log(`[PERMISSIONS] isBotOwner: checking participant ${participantNum} vs owner ${ownerNumber}`);

  if (participantNum && (participantNum === ownerNumber || (globalOwner && participantNum === globalOwner))) {
    console.log(`[PERMISSIONS] isBotOwner: ✅ participant matches owner`);
    return true;
  }

  // Case 4: DM — someone else texts the bot (fromMe=false)
  if (!msg.key.fromMe && remoteJid.endsWith('@s.whatsapp.net')) {
    if (remoteNum && (remoteNum === ownerNumber || (globalOwner && remoteNum === globalOwner))) {
      console.log(`[PERMISSIONS] isBotOwner: ✅ remoteJid matches owner (DM from another device)`);
      return true;
    }
    console.log(`[PERMISSIONS] isBotOwner: ❌ DM from ${remoteNum} (not owner ${ownerNumber})`);
    return false;
  }

  console.log(`[PERMISSIONS] isBotOwner: ❌ not the owner (fromMe=${msg.key.fromMe}, participant=${participantNum}, remote=${remoteNum}, owner=${ownerNumber})`);
  return false;
}

/**
 * Check if the sender is a group admin.
 * @param {Array} participants - group participants from sock.groupMetadata
 * @param {Object} msg - message
 * @returns {boolean}
 */
function isGroupAdmin(participants, msg) {
  if (!participants || !Array.isArray(participants)) return false;

  // For owner (fromMe=true), check if the BOT's number is admin
  // (because the bot IS the owner's linked device)
  if (msg.key.fromMe) {
    const botJid = participants.find(p => p.id.includes(msg.key.participant || ''));
    if (botJid?.admin) return true;
  }

  const senderJid = msg.key.participant || msg.key.remoteJid;
  const p = participants.find(part => part.id === senderJid);
  return !!p?.admin;
}

/**
 * Check if the bot itself is a group admin.
 *
 * ★ KEY INSIGHT: The bot is the owner's LINKED WhatsApp device.
 * They use the SAME phone number. If the OWNER is admin in the group,
 * the BOT is admin too (they're the same account).
 *
 * So we check: does the owner's phone number appear in participants as admin?
 *
 * @param {Array} participants - group participants
 * @param {Object} sock - Baileys socket
 * @param {Object} dbSession - DB session (to get owner's phone number)
 * @returns {boolean}
 */
function isBotAdmin(participants, sock, dbSession) {
  if (!participants || !Array.isArray(participants)) {
    console.log('[PERMISSIONS] isBotAdmin: no participants array');
    return false;
  }

  // Get the bot's base number (this is the owner's phone number — they're the same account)
  const botBaseNum = sock.user.id.split(':')[0].split('@')[0];
  console.log(`[PERMISSIONS] isBotAdmin: bot/owner base number = ${botBaseNum}`);
  console.log(`[PERMISSIONS] isBotAdmin: participants count = ${participants.length}`);

  // Also try dbSession.phoneNumber as backup
  const ownerNum = dbSession?.phoneNumber?.replace(/\D/g, '') || botBaseNum;

  // Look for ANY participant whose base number matches the owner's number
  for (const part of participants) {
    const partBase = part.id.split(':')[0].split('@')[0];
    if (partBase === botBaseNum || partBase === ownerNum) {
      console.log(`[PERMISSIONS] isBotAdmin: ✅ Found owner in participants: ${part.id} | admin=${part.admin}`);
      // admin can be 'admin', 'superadmin', or true
      return !!part.admin;
    }
  }

  console.log(`[PERMISSIONS] isBotAdmin: ❌ Owner (${botBaseNum}) NOT in participants list`);
  console.log(`[PERMISSIONS] isBotAdmin: participant base numbers =`, participants.map(p => p.id.split(':')[0].split('@')[0]).slice(0, 10));
  return false;
}

module.exports = { isBotOwner, isGroupAdmin, isBotAdmin };
