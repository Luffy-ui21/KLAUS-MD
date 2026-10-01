/**
 * .whoami — Show the current user's own session info
 *
 * Confirms that THIS paired user's bot instance is healthy.
 * Multi-user friendly: every user gets their own answer.
 */

module.exports = {
  name: 'whoami',
  aliases: ['myinfo', 'session', 'me'],
  desc: 'Show your bot session info',
  category: 'info',
  async execute({ reply, botName, dbSession, pushName, prefix }) {
    if (!dbSession) {
      return reply(
        `⚠️ *No session record found for you.*\n\n` +
        `This shouldn't happen. Try:\n` +
        `• Re-pair on the website\n` +
        `• Or type *${prefix}disconnect* and pair again`
      );
    }

    const status = dbSession.status === 'connected' ? '🟢 Online' : '🔴 Offline';
    const mode = dbSession.mode === 'private' ? '🔒 Private (only you)' : '🌍 Public (everyone)';
    const createdAt = new Date(dbSession.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' });
    const lastActive = dbSession.lastActiveAt
      ? new Date(dbSession.lastActiveAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })
      : 'unknown';

    await reply(`╔══════════════════════════════════════╗
║       ${botName} — YOUR SESSION        ║
╚══════════════════════════════════════╝

👤 *Name:* ${dbSession.displayName || pushName || 'You'}
📱 *Number:* ${dbSession.phoneNumber}
🆔 *Session ID:* ${dbSession.id}
🤖 *Bot:* ${botName}
${status} *Status:* ${dbSession.status}
⚡ *Prefix:* ${dbSession.prefix || prefix}
${mode} *Mode:* ${dbSession.mode}

📅 *Paired:* ${createdAt}
⏱️ *Last active:* ${lastActive}
📊 *Commands run:* ${dbSession.commandsExecuted || 0}

👑 _You are the owner of THIS bot instance._
_Every user who pairs gets their own._`);
  },
};
