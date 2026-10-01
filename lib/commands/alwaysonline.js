/**
 * .alwaysonline — Keep the bot online 24/7
 *
 * When ON, the bot:
 *   - Sends periodic presence updates to keep "online" status
 *   - Bypasses the idle-session cleanup (never auto-disconnected)
 *   - Stays connected even when no messages are received
 *
 * Usage:
 *   .alwaysonline       → check current status
 *   .alwaysonline on     → enable always-online
 *   .alwaysonline off    → disable always-online
 *
 * Note: This uses ~5MB extra RAM per active session for the heartbeat timer.
 */

const { prisma } = require('../db');

module.exports = {
  name: 'alwaysonline',
  aliases: ['alwayson', 'online247', 'stayonline', '247'],
  desc: 'Keep bot online 24/7 (always show online)',
  category: 'owner',
  async execute({ reply, args, dbSession, sock }) {
    if (!dbSession) return reply('❌ No session record.');

    const action = args[0]?.toLowerCase();

    if (action === 'on' || action === 'enable' || action === 'true') {
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { alwaysOnline: true },
      });

      // Send an immediate presence update
      try {
        await sock.sendPresenceUpdate('available', dbSession.phoneNumber + '@s.whatsapp.net');
      } catch {}

      return reply(
        `✅ *Always-Online is now ON* 🟢\n\n` +
        `📡 *Status:* Online 24/7\n` +
        `⏱️ *Heartbeat:* Every 30 seconds\n` +
        `🔒 *Idle cleanup:* Bypassed\n\n` +
        `_Bot will stay online even when no messages are being sent._\n` +
        `_It will appear online to all your contacts._`
      );
    }

    if (action === 'off' || action === 'disable' || action === 'false') {
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { alwaysOnline: false },
      });

      // Set to unavailable
      try {
        await sock.sendPresenceUpdate('unavailable', dbSession.phoneNumber + '@s.whatsapp.net');
      } catch {}

      return reply('✅ *Always-Online is now OFF* 🔴\n\n_Bot will go offline normally when idle._');
    }

    // Show status
    const isOn = dbSession.alwaysOnline === true;
    return reply(
      `📝 *Always-Online Status*\n\n` +
      `📊 *Current:* ${isOn ? '🟢 ON (24/7 online)' : '🔴 OFF (normal)'}\n\n` +
      `*Usage:*\n` +
      `  \`.alwaysonline on\`  → enable 24/7 online\n` +
      `  \`.alwaysonline off\` → disable\n\n` +
      `_When ON, the bot stays online always — even when idle._`
    );
  },
};
