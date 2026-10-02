export default {
  name: 'unstar',
  alias: ['unstarmessage', 'unstarmsg'],
  description: 'Unstar a replied starred message',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;

    if (!quotedKey?.stanzaId) {
      return sock.sendMessage(jid, {
        text: '⚠️ *Reply to the starred message* you want to unstar.\nExample: reply to any message with *.unstar*'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

      const fromMe = quotedKey.participant
        ? (quotedKey.participant === sock.user?.id || quotedKey.participant === sock.user?.lid)
        : true;

      await sock.star(jid, [{ id: quotedKey.stanzaId, fromMe }], false);

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '⭐ *Message unstarred!*\nThe message has been removed from starred messages.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[unstar]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed to unstar message: ${err.message}` }, { quoted: msg });
    }
  }
};
