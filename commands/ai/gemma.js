import { chat } from '../../lib/nvidia.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'gemma',
  description: 'Gemma 2 (2B) — small & fast Google model via NVIDIA NIM',
  category: 'ai',
  aliases: ['gemmaai', 'g2b'],
  usage: 'gemma [question]',

  async execute(sock, m, args, PREFIX) {
    const jid   = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    let query = args.length > 0 ? args.join(' ') : (m.quoted?.text || '');

    if (!query) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ ✨ *GEMMA 2 (2B)* ⌋\n` +
          `├─⊷ *${PREFIX}gemma <question>*\n` +
          `│  └⊷ Google Gemma 2 — small, fast, sharp\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '✨', key: m.key } });

      let reply = await chat(query, {
        model:       'google/gemma-2-2b-it',
        system:      'You are Gemma, a friendly and concise AI assistant. Answer accurately and briefly.',
        temperature: 0.7,
        topP:        0.95,
        maxTokens:   1024,
        timeoutMs:   45000
      });

      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text:
          `✨ *GEMMA 2 (2B)*\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${reply}\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[GEMMA] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *Gemma AI Error*\n\n${err.message}\n\nPlease try again later.`
      }, { quoted: m });
    }
  }
};
