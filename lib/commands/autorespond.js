/**
 * .autorespond — Toggle AI auto-reply for incoming messages
 *
 * When ON, the bot automatically replies to messages on your behalf —
 * like you're typing yourself. Replies are short, casual, and match
 * the language of the sender (English or Swahili).
 *
 * Usage:
 *   .autorespond        → check current status
 *   .autorespond on      → enable auto-reply
 *   .autorespond off     → disable auto-reply
 *
 * For better AI replies, set GEMINI_API_KEY env var (free from Google AI Studio).
 * Without a key, uses built-in pattern-matching for common messages.
 */

const { prisma } = require('../db');

module.exports = {
  name: 'autorespond',
  aliases: ['autoreply', 'autobot', 'aireply', 'smartreply'],
  desc: 'Toggle AI auto-reply (English + Swahili)',
  category: 'owner',
  async execute({ reply, args, dbSession }) {
    if (!dbSession) return reply('❌ No session record.');

    const action = args[0]?.toLowerCase();

    if (action === 'on' || action === 'enable' || action === 'true') {
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { autoRespond: true },
      });
      const hasGemini = !!process.env.GEMINI_API_KEY;
      const aiStatus = hasGemini ? '🤖 Gemini AI (smart)' : '🧠 Local patterns (basic)';
      return reply(
        `✅ *Auto-Respond is now ON* 🟢\n\n` +
        `🤖 *AI Mode:* Multi-tier fallback\n` +
        `   1. ${hasGemini ? '✅ Gemini AI' : '⭕ Gemini AI (set GEMINI_API_KEY to enable)'}\n` +
        `   2. ✅ Pollinations.ai (free)\n` +
        `   3. ✅ Local patterns (always works)\n` +
        `🌐 *Languages:* English + Swahili + Sheng\n\n` +
        `_The bot will now reply to messages on your behalf — like you're typing yourself._\n\n` +
        (hasGemini
          ? '_✅ Gemini API key set — if your server region is supported, smart replies active._\n_Note: Gemini is blocked in some regions (e.g. Africa) — falls back automatically._'
          : '_💡 Set GEMINI_API_KEY env var for smarter AI replies (free from aistudio.google.com)_')
      );
    }

    if (action === 'off' || action === 'disable' || action === 'false') {
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { autoRespond: false },
      });
      return reply('✅ *Auto-Respond is now OFF* 🔴\n\n_Bot will no longer auto-reply._');
    }

    // Show current status
    const isOn = dbSession.autoRespond === true;
    const aiStatus = process.env.GEMINI_API_KEY ? '🤖 Gemini AI (smart)' : '🧠 Local patterns (basic)';

    return reply(
      `📝 *Auto-Respond Status*\n\n` +
      `📊 *Current:* ${isOn ? '🟢 ON' : '🔴 OFF'}\n` +
      `🤖 *AI Mode:* ${aiStatus}\n` +
      `🌐 *Languages:* English + Swahili\n\n` +
      `*Usage:*\n` +
      `  \`.autorespond on\`  → enable\n` +
      `  \`.autorespond off\` → disable\n\n` +
      (process.env.GEMINI_API_KEY
        ? '_✅ Gemini API key is set — smart replies active._'
        : '_💡 Set GEMINI_API_KEY env var for smarter AI replies (free from aistudio.google.com)_')
    );
  },
};
