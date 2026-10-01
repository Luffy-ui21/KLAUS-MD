/**
 * Anti-call — Auto-rejects incoming WhatsApp calls + notifies the caller
 *
 * Per-user setting: dbSession.antiCall (default true)
 *   .anticall on   → enable (auto-reject all incoming calls)
 *   .anticall off  → disable (allow calls)
 *
 * Baileys emits the 'call' event with an ARRAY of call objects.
 * sessionManager.js handles unwrapping the array + iterating.
 */

async function handleCall(sock, callEvent, dbSession) {
  console.log('[ANTI-CALL] handleCall called with:', JSON.stringify({
    hasCallEvent: !!callEvent,
    from: callEvent?.from,
    id: callEvent?.id,
    status: callEvent?.status,
    isVideo: callEvent?.isVideo,
    isGroup: callEvent?.isGroup,
  }));

  // Anti-call is ON by default. Disable via .anticall off or env ANTI_CALL=false
  if (process.env.ANTI_CALL === 'false') {
    console.log('[ANTI-CALL] Disabled by env ANTI_CALL=false');
    return;
  }
  if (dbSession?.antiCall === false) {
    console.log('[ANTI-CALL] Disabled by dbSession.antiCall=false');
    return;
  }

  const callId = callEvent?.id;
  const callerJid = callEvent?.from;
  const isVideo = callEvent?.isVideo;
  const status = callEvent?.status;
  const isGroup = callEvent?.isGroup;

  if (!callId || !callerJid) {
    console.log('[ANTI-CALL] Missing callId or callerJid — skipping');
    return;
  }

  // Only reject 'offer' status (the incoming ring)
  if (status !== 'offer') {
    console.log(`[ANTI-CALL] Status is '${status}' (not 'offer') — skipping`);
    return;
  }

  // Skip group calls (can't reject those)
  if (isGroup) {
    console.log('[ANTI-CALL] Group call — skipping');
    return;
  }

  const callerNum = callerJid.split('@')[0].split(':')[0];
  console.log(`[ANTI-CALL] Incoming ${isVideo ? 'video' : 'voice'} call from ${callerNum} (id=${callId}) — rejecting`);

  // Method 1: Use sock.rejectCall (the official Baileys API)
  try {
    if (typeof sock.rejectCall === 'function') {
      await sock.rejectCall(callId, callerJid);
      console.log(`[ANTI-CALL] ✓ Rejected call ${callId} via sock.rejectCall`);
    } else {
      console.warn('[ANTI-CALL] sock.rejectCall is not a function');
      // Method 2: Manual protocol reject (fallback)
      await manualRejectCall(sock, callId, callerJid);
    }
  } catch (e) {
    console.warn(`[ANTI-CALL] sock.rejectCall failed: ${e.message} — trying manual method`);
    try {
      await manualRejectCall(sock, callId, callerJid);
    } catch (e2) {
      console.warn(`[ANTI-CALL] Manual reject also failed: ${e2.message}`);
    }
  }

  // Notify the caller why their call was rejected
  try {
    await sock.sendMessage(callerJid, {
      text: `📞 *Sorry, I don't accept calls.*\n\nThis number is running a *WhatsApp bot*. Please send a text message instead.\n\n_Type \`.menu\` to see what I can do._`,
    });
    console.log(`[ANTI-CALL] ✓ Sent notification to ${callerNum}`);
  } catch (e) {
    console.warn(`[ANTI-CALL] Failed to notify caller: ${e.message}`);
  }
}

/**
 * Manual call rejection via WhatsApp protocol (fallback)
 */
async function manualRejectCall(sock, callId, callerJid) {
  const stanza = {
    tag: 'call',
    attrs: {
      from: sock.user?.id,
      to: callerJid,
    },
    content: [
      {
        tag: 'reject',
        attrs: {
          'call-id': callId,
          'call-creator': callerJid,
          count: '0',
        },
        content: undefined,
      },
    ],
  };
  await sock.query(stanza);
  console.log(`[ANTI-CALL] ✓ Rejected call ${callId} via manual protocol`);
}

module.exports = {
  handleCall,
  // Expose a command so users can toggle anti-call for their session
  name: 'anticall',
  aliases: ['anticall', 'ac'],
  desc: 'Toggle anti-call (on/off) for your bot',
  category: 'anti',
  async execute({ reply, args, dbSession }) {
    if (!dbSession) return reply('❌ No session record.');
    const action = args[0]?.toLowerCase();
    let newValue;
    if (action === 'on') newValue = true;
    else if (action === 'off') newValue = false;
    else {
      return reply(
        `📝 *Anti-Call is currently:* ${dbSession.antiCall === false ? '🔴 OFF' : '🟢 ON'}\n\n` +
        `*Usage:* \`.anticall on\` or \`.anticall off\`\n\n` +
        `_When ON, incoming WhatsApp calls are auto-rejected and the caller is notified._`
      );
    }
    try {
      const { prisma } = require('../db');
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { antiCall: newValue },
      });
      await reply(`✅ *Anti-Call is now ${newValue ? '🟢 ON' : '🔴 OFF'}*`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
