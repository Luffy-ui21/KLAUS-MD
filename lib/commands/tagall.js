/** .tagall — Mention everyone in the group (owner only) */
const { isBotOwner } = require('../utils/permissions');

module.exports = {
  name: 'tagall',
  aliases: ['everyone', 'mentionall', 'hidetag'],
  desc: 'Mention everyone in the group (owner only)',
  category: 'group',
  async execute({ sock, msg, args, from, isGroup, reply, dbSession }) {
    if (!isGroup) return reply('❌ Group only command.');
    if (!isBotOwner(msg, dbSession)) return reply('❌ *Only the bot owner can use this command.*');

    const metadata = await sock.groupMetadata(from);
    const message = args.length ? args.join(' ') : '📢 Attention everyone!';
    const mentions = metadata.participants.map(p => p.id);

    let body = `╔════════════════════════════╗
║   📢 *GROUP ANNOUNCEMENT*     ║
╚════════════════════════════╝

${message}

`;
    for (const id of mentions) body += `@${id.split('@')[0]} `;
    body += '\n\n_— via KLAUS-MD_';

    await sock.sendMessage(from, { text: body, mentions }, { quoted: msg });
  },
};
