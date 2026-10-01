/** .revoke — Revoke group invite link */
module.exports = {
  name: 'revoke',
  aliases: ['revokelink', 'resetlink'],
  desc: 'Revoke the group invite link (admin only)',
  category: 'admin',
  async execute({ sock, msg, from, isGroup, reply }) {
    if (!isGroup) return reply('❌ Group only.');
    try {
      await sock.groupRevokeInvite(from);
      await reply(`✅ Invite link revoked. New link will be generated when you use .link`);
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`);
    }
  },
};
