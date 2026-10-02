import { callAI } from '../../lib/aiHelper.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'openchat',
  description: 'OpenChat AI model',
  category: 'ai',
  aliases: ["openchatai","oc","ochat"],
  usage: 'openchat [question]',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    let query = args.length > 0 ? args.join(' ') : (m.quoted?.text || '');

    if (!query) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 💬 *OPENCHAT AI* ⌋\n├─⊷ *${PREFIX}openchat <question>*\n│  └⊷ OpenChat AI model\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      let reply = await callAI('openchat', query);
      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text: `💬 *OPENCHAT AI*\n━━━━━━━━━━━━━━━━━\n${reply}\n━━━━━━━━━━━━━━━━━\n${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[OPENCHAT] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *openchat AI Error*\n\n${err.message}\n\nPlease try again later.` }, { quoted: m });
    }
  }
};
