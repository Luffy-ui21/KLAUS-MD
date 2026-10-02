import { callAI } from '../../lib/aiHelper.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'codellama',
  description: 'Code Llama code generation',
  category: 'ai',
  aliases: ["codel","codellm","codeai"],
  usage: 'codellama [question]',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    let query = args.length > 0 ? args.join(' ') : (m.quoted?.text || '');

    if (!query) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 💻 *CODELLAMA AI* ⌋\n├─⊷ *${PREFIX}codellama <question>*\n│  └⊷ Code Llama code generation\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      let reply = await callAI('codellama', query);
      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text: `💻 *CODELLAMA AI*\n━━━━━━━━━━━━━━━━━\n${reply}\n━━━━━━━━━━━━━━━━━\n${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[CODELLAMA] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ *codellama AI Error*\n\n${err.message}\n\nPlease try again later.` }, { quoted: m });
    }
  }
};
