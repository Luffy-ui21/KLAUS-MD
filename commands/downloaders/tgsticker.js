// commands/downloaders/tgsticker.js
// .tgsticker — Search & download Telegram sticker packs via apiskeith.top
// API: GET https://apiskeith.top/download/tgstories?q=<query>
// Response: { status: true, result: [ { name, title, description, type, stickers: [{ emoji, imageUrl }] } ] }

import { createRequire } from 'module';
import axios from 'axios';
import fs from 'fs';
import { createWriteStream, existsSync } from 'fs';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';

const _req = createRequire(import.meta.url);
let giftedBtnsTg;
try { giftedBtnsTg = _req('wolfbtns'); } catch {}

const MAX_STICKERS = 6;   // max sticker images to send per pack
const MAX_PACKS    = 5;   // max packs to show in button picker

// ── Download a webp sticker image to /tmp ─────────────────────────────────────
async function downloadWebp(url, filePath) {
  const writer = createWriteStream(filePath);
  const response = await axios({
    method: 'GET', url,
    responseType: 'stream',
    timeout: 30000,
    maxContentLength: 10 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ── Fetch sticker packs from apiskeith ───────────────────────────────────────
async function fetchStickerPacks(query) {
  const res = await axios.get('https://apiskeith.top/download/tgstories', {
    params: { q: query },
    timeout: 25000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const d = res.data;
  if (!d || d.status !== true || !Array.isArray(d.result) || d.result.length === 0) return null;
  return d.result;
}

// ── Send stickers from a pack ─────────────────────────────────────────────────
async function sendPackStickers(sock, jid, pack, m) {
  const stickers = (pack.stickers || []).slice(0, MAX_STICKERS);
  if (stickers.length === 0) {
    return sock.sendMessage(jid, { text: `⚠️ No stickers found in this pack.` }, { quoted: m });
  }

  const header = `🎭 *${pack.title || pack.name}*\n` +
    `${pack.description ? `📝 ${pack.description}\n` : ''}` +
    `📦 Type: ${pack.type || 'image'} | 🖼️ ${stickers.length} stickers`;

  await sock.sendMessage(jid, { text: header }, { quoted: m });

  const ts = Date.now();
  const tmpFiles = [];

  for (let i = 0; i < stickers.length; i++) {
    const sticker = stickers[i];
    const imgUrl  = sticker.imageUrl;
    if (!imgUrl) continue;

    const filePath = `/tmp/wolfbot_tg_sticker_${ts}_${i}.webp`;
    try {
      await downloadWebp(imgUrl, filePath);
      tmpFiles.push(filePath);

      const buf = fs.readFileSync(filePath);
      // Send as sticker
      await sock.sendMessage(jid, {
        sticker: buf,
        mimetype: 'image/webp'
      }, { quoted: i === 0 ? m : undefined });

      if (i < stickers.length - 1) await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`[TGSticker] sticker ${i + 1} failed: ${e.message}`);
    }
  }

  // Cleanup
  for (const f of tmpFiles) {
    try { if (existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

// ── Command export ────────────────────────────────────────────────────────────
export default {
  name: 'tgsticker',
  aliases: ['tgs', 'telesticker', 'tgpack'],
  description: 'Search & download Telegram sticker packs',
  category: 'downloaders',

  async execute(sock, m, args, PREFIX) {
    const jid   = m.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🎭 *TELEGRAM STICKERS* ⌋\n│\n` +
          `├─⊷ *${PREFIX}tgsticker <name>*\n│  └⊷ Search Telegram sticker packs\n│\n` +
          `├─⊷ *Examples:*\n` +
          `│  └⊷ ${PREFIX}tgsticker pepe\n` +
          `│  └⊷ ${PREFIX}tgsticker anime girl\n` +
          `│  └⊷ ${PREFIX}tgs cats\n│\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    let packs;
    try {
      packs = await fetchStickerPacks(query);
    } catch (e) {
      console.log(`[TGSticker] API error: ${e.message}`);
    }

    if (!packs) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      return sock.sendMessage(jid, {
        text: `❌ No sticker packs found for *"${query}"*\n\nTry a different keyword.`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    // ── Button mode: show pack picker ─────────────────────────────────────────
    if (isButtonModeEnabled() && giftedBtnsTg?.sendInteractiveMessage) {
      const topPacks = packs.slice(0, MAX_PACKS);
      const listText =
        `🎭 *Telegram Sticker Packs*\n\n` +
        `Found *${packs.length}* pack(s) for *"${query}"*\n\n` +
        topPacks.map((p, i) =>
          `${i + 1}. *${p.title || p.name}* — ${(p.stickers || []).length} stickers (${p.type || 'image'})`
        ).join('\n') +
        `\n\n▸ Tap a pack to get its stickers:`;

      const btns = topPacks.map((p, i) => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: `${i + 1}. ${(p.title || p.name).slice(0, 25)}`,
          id: `${PREFIX}tgpackget_${i}__${query}`
        })
      }));

      try {
        await giftedBtnsTg.sendInteractiveMessage(sock, jid, {
          body: { text: listText },
          footer: { text: getBotName() },
          interactiveButtons: btns
        }, { quoted: m });
        return;
      } catch (e) {
        console.log(`[TGSticker] Button picker failed, sending first pack directly: ${e.message}`);
      }
    }

    // ── Fallback / no buttons: send first pack directly ───────────────────────
    await sendPackStickers(sock, jid, packs[0], m);

    if (packs.length > 1) {
      await sock.sendMessage(jid, {
        text:
          `📦 *${packs.length} packs found for "${query}"*\n\n` +
          packs.slice(0, MAX_PACKS).map((p, i) =>
            `${i + 1}. *${p.title || p.name}* — ${(p.stickers || []).length} stickers`
          ).join('\n') +
          `\n\n💡 Showing pack 1. More sticker packs available for this query.`
      }, { quoted: m });
    }
  }
};
