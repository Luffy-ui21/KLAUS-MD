/**
 * .repo — Show the bot's GitHub repo + owner contact
 *
 * Shows the KLAUS-MD repo URL + owner contact info.
 */

module.exports = {
  name: 'repo',
  aliases: ['github', 'source', 'code', 'script'],
  desc: 'Show bot repository + owner contact',
  category: 'info',
  async execute({ reply, botName }) {
    await reply(
      `┏▣ ◈ *${botName} REPOSITORY* ◈
┗▣


🤖 *This Mini Bot:*
https://github.com/xtechkin-svg/YOBBY-MD

👑 *Owner:* KLAUS - NIK.ola
📱 *WhatsApp:* wa.me/254711815459

╭═══════════════════════✦═╗
║  *Enjoy KLAUS - NIK.ola* 👑      ║
╚═══════════════════════✦═╝

_🌟 Star the repo if you like the bot!_
_🚀 Powered by ${botName} - NIK.ola_

\`for premium Whatsapp bot dm\``
    );
  },
};
