import { createRequire } from 'module';
import { getMusicSession, updateMusicSession } from '../../lib/musicSession.js';
import { getBotName } from '../../lib/botname.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch (e) {}

export default {
  name: 'vnext',
  aliases: ['nextvid', 'vidnext', 'nextvideo'],
  category: 'Downloader',
  desc: 'Show next video search result',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p = prefix || '.';
    const session = getMusicSession(jid);

    if (!session || session.type !== 'video') {
      return sock.sendMessage(jid, {
        text: `⚠️ No active video session. Search first with *${p}ytmp4* or *${p}video*`
      }, { quoted: m });
    }

    const newIndex = session.index + 1;
    if (newIndex >= session.videos.length) {
      return sock.sendMessage(jid, {
        text: `⚠️ No more results. That was the last one! Use *${p}viddl* to download it or search again.`
      }, { quoted: m });
    }

    updateMusicSession(jid, { index: newIndex });
    const v = session.videos[newIndex];
    const thumbUrl = v.thumbnail || (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` : null);
    const remaining = session.videos.length - newIndex - 1;

    const buttons = [
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬇️ Download Video', id: `${p}viddl` }) }
    ];
    if (remaining > 0) {
      buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '➡️ Next Result', id: `${p}vnext` }) });
    }

    if (giftedBtns?.sendInteractiveMessage && thumbUrl) {
      try {
        await giftedBtns.sendInteractiveMessage(sock, jid, {
          title: v.title.substring(0, 60),
          image: { url: thumbUrl },
          text: `🎬 *${v.title}*\n👤 ${v.author || 'Unknown'}\n⏱️ ${v.duration || 'N/A'}\n\n_Result ${newIndex + 1} of ${session.videos.length}_`,
          footer: ` ${getBotName()}`,
          interactiveButtons: buttons
        });
        return;
      } catch (e) {
        console.log('[VNEXT] interactive send failed:', e?.message);
      }
    }

    const dlHint = remaining > 0
      ? `Use *${p}viddl* to download or *${p}vnext* for next.`
      : `Use *${p}viddl* to download.`;
    await sock.sendMessage(jid, {
      text: `🎬 *${v.title}*\n👤 ${v.author || 'Unknown'}\n⏱️ ${v.duration || 'N/A'}\n\n_Result ${newIndex + 1} of ${session.videos.length}_\n${dlHint}`
    }, { quoted: m });
  }
};
