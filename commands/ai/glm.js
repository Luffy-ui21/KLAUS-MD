import { chat } from '../../lib/nvidia.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'glm',
  description: 'GLM-4.7 — multilingual agentic coding & reasoning model by Z.ai (via NVIDIA NIM)',
  category: 'ai',
  aliases: ['glmai', 'glm4', 'zai'],
  usage: 'glm [question]',

  async execute(sock, m, args, PREFIX) {
    const jid   = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    let query = args.length > 0 ? args.join(' ') : (m.quoted?.text || '');

    if (!query) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🤖 *GLM 4.7 AI* ⌋\n` +
          `├─⊷ *${PREFIX}glm <question>*\n` +
          `│  └⊷ Z.ai GLM-4.7 — coding, reasoning, tools\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🤖', key: m.key } });

      let reply = await chat(query, {
        model:       'z-ai/glm4.7',
        system:      'You are GLM-4.7, a helpful, accurate, and concise AI assistant skilled at coding, reasoning, and answering questions clearly.',
        temperature: 0.6,
        topP:        0.95,
        maxTokens:   2048,
        timeoutMs:   180000   // 3 min — GLM-4.7 reasoning can be slow
      });

      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text:
          `🤖 *GLM 4.7 AI*\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${reply}\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[GLM] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });

      const aborted = err.name === 'AbortError' || /aborted/i.test(err.message || '');
      const friendly = aborted
        ? '⏱️ GLM took too long to respond (model is busy or thinking deeply).\nTry a shorter question or wait a moment and retry.'
        : err.message;

      await sock.sendMessage(jid, {
        text: `❌ *GLM AI Error*\n\n${friendly}`
      }, { quoted: m });
    }
  }
};
