export default {
  name: 'star',
  alias: ['starmessage', 'starmsg'],
  description: 'Star a replied message',
  category: 'group',

  async execute(sock, msg, args, from, isGroup, sender) {
    const jid = msg.key.remoteJid;

    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;

    if (!quotedKey?.stanzaId) {
      return sock.sendMessage(jid, {
        text: '⚠️ *Reply to a message* to star it.\nExample: reply to any message with *.star*'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

      const fromMe = quotedKey.participant
        ? (quotedKey.participant === sock.user?.id || quotedKey.participant === sock.user?.lid)
        : true;

      await sock.star(jid, [{ id: quotedKey.stanzaId, fromMe }], true);

      await sock.sendMessage(jid, { react: { text: '⭐', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '⭐ *Message starred!*\nYou can find it in starred messages.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[star]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed to star message: ${err.message}` }, { quoted: msg });
    }
  }
};
