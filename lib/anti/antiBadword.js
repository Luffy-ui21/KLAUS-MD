/** Anti-badword — Delete messages containing profanity */
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'nigger', 'faggot'];

async function check(sock, msg, dbSession) {
  if (process.env.ANTI_BADWORD !== 'true') return;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (!text) return;

  const lower = text.toLowerCase();
  const hasBad = BAD_WORDS.some(w => lower.includes(w));
  if (!hasBad) return;
  if (msg.key.fromMe) return;

  try {
    const gid = msg.key.remoteJid;
    if (gid.endsWith('@g.us')) {
      const metadata = await sock.groupMetadata(gid);
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const botIsAdmin = metadata.participants.find(p => p.id === botId)?.admin;
      if (botIsAdmin) await sock.sendMessage(gid, { delete: msg.key });
    }
    await sock.sendMessage(gid, {
      text: `🚫 @${(msg.key.participant || gid).split('@')[0]} *no bad words please.*`,
      mentions: [msg.key.participant || gid],
    });
  } catch {}
}

module.exports = { check };
