import * as baileys from 'wolfsocket';
const { proto } = baileys;

export default {
  name: 'unpin',
  alias: ['unpinmessage', 'unpinmsg'],
  description: 'Unpin a replied pinned message in the group',
  category: 'group',

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    const quotedKey = msg.message?.extendedTextMessage?.contextInfo;

    if (!quotedKey?.stanzaId) {
      return sock.sendMessage(jid, {
        text: '⚠️ *Reply to the pinned message* you want to unpin.\nExample: reply to the pinned message with *.unpin*'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

      const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
      const botLid = sock.user?.lid;
      const participant = quotedKey.participant;
      const isFromMe = participant === botId || participant === sock.user?.id || participant === botLid;

      const pinnedMsgKey = {
        remoteJid: jid,
        fromMe: isFromMe,
        id: quotedKey.stanzaId,
        participant: participant
      };

      await sock.sendMessage(jid, {
        pinInChat: {
          type: proto.PinInChat.Type.UNPIN_FOR_ALL,
          key: pinnedMsgKey
        }
      });

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      await sock.sendMessage(jid, {
        text: '📌 *Message unpinned!*\nThe pinned message has been removed.'
      }, { quoted: msg });

    } catch (err) {
      console.error('[unpin]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed to unpin message: ${err.message}` }, { quoted: msg });
    }
  }
};
