import { chat } from '../../lib/nvidia.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'deepseekv4',
  description: 'DeepSeek V4 Flash — fast frontier reasoning via NVIDIA NIM',
  category: 'ai',
  aliases: ['dsv4', 'dsflash', 'v4flash'],
  usage: 'deepseekv4 [question]',

  async execute(sock, m, args, PREFIX) {
    const jid   = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    let query = args.length > 0 ? args.join(' ') : (m.quoted?.text || '');

    if (!query) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🧠 *DEEPSEEK V4 FLASH* ⌋\n` +
          `├─⊷ *${PREFIX}deepseekv4 <question>*\n` +
          `│  └⊷ Fast frontier reasoning model\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🧠', key: m.key } });

      let reply = await chat(query, {
        model:       'deepseek-ai/deepseek-v4-flash',
        system:      'You are DeepSeek V4 Flash, a sharp and concise reasoning assistant. Answer accurately and clearly.',
        temperature: 0.6,
        topP:        0.95,
        maxTokens:   2048,
        timeoutMs:   90000
      });

      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (reply.length > 4000) reply = reply.substring(0, 4000) + '\n\n_...(truncated)_';

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      await sock.sendMessage(jid, {
        text:
          `🧠 *DEEPSEEK V4 FLASH*\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${reply}\n` +
          `━━━━━━━━━━━━━━━━━\n` +
          `${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

    } catch (err) {
      console.error('[DEEPSEEKV4] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ *DeepSeek V4 Error*\n\n${err.message}\n\nPlease try again later.`
      }, { quoted: m });
    }
  }
};
