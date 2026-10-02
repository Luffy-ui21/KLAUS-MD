import { chat } from '../../lib/nvidia.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'kimi',
  description: 'Kimi K2 Thinking — reasoning model by Moonshot AI (via NVIDIA NIM)',
  category: 'ai',
  aliases: ['kimiai', 'k2'],
  usage: 'kimi [question]',

  async execute(sock, m, args, PREFIX) {
    const jid   = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    let query = args.length > 0 ? args.join(' ') : (m.quoted?.text || '');

    if (!query) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🧠 *KIMI K2 THINKING* ⌋\n` +
          `├─⊷ *${PREFIX}kimi <question>*\n` +
          `│  └⊷ Moonshot AI reasoning model via NVIDIA\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🧠', key: m.key } });

      let reply = await chat(query, {
        model:       'moonshotai/kimi-k2-thinking',
        system:      'You are Kimi, a thoughtful and helpful AI assistant. Think carefully, then give a clear, concise final answer.',
        temperature: 0.6,
        topP:        0.95,
        maxTokens:   4096,
        timeoutMs:   120000   // 2 min — reasoning model can be slow on cold-start
      });

      // Strip <think> blocks if the model leaked any into final text
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text:
          `🧠 *KIMI K2 THINKING*\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${reply}\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[KIMI] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Kimi AI Error*\n\n${err.message}\n\nPlease try again later.`
      }, { quoted: m });
    }
  }
};
