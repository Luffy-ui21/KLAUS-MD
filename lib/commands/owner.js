/** .owner — Show owner info (every user is their own owner, plus a global owner) */
module.exports = {
  name: 'owner',
  aliases: ['creator', 'dev', 'contact', 'me'],
  desc: 'Show your bot owner info',
  category: 'info',
  async execute({ reply, botName, dbSession, pushName }) {
    const ownerNumber = dbSession?.phoneNumber || 'unknown';
    const ownerName = dbSession?.displayName || pushName || 'You';
    const globalOwner = (process.env.OWNER_NUMBER || '254711815459').replace(/\D/g, '');

    await reply(`╔══════════════════════════════╗
║      ${botName} - OWNER         ║
╚══════════════════════════════╝

👑 *Owner:* ${ownerName}
📱 *WhatsApp:* wa.me/${ownerNumber}
🤖 *Bot:* ${botName}
🟢 *Mode:* ${dbSession?.mode || 'public'}

👑 *Global Owner:* wa.me/${globalOwner}

_You are the owner of this bot instance._
_Type .menu to see commands_`);
  },
};
