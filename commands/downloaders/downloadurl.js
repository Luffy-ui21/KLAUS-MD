import axios from 'axios';
import path from 'path';
import dns from 'dns/promises';
import net from 'net';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9'
};

const SIZE_LIMITS = {
  image:    16 * 1024 * 1024,   // 16 MB
  sticker:   2 * 1024 * 1024,   //  2 MB
  audio:    50 * 1024 * 1024,   // 50 MB
  video:    64 * 1024 * 1024,   // 64 MB
  document:100 * 1024 * 1024    //100 MB
};

function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '?';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)}${u[i]}`;
}

function looksLikeUrl(s) {
  if (!s) return false;
  return /^https?:\/\/\S+/i.test(s.trim());
}

// Parse extension only from URL pathname — never from query string.
function extFromUrl(urlOrName) {
  if (!urlOrName) return '';
  try {
    const u = new URL(urlOrName);
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    return (path.extname(last) || '').replace('.', '').toLowerCase();
  } catch {
    return (path.extname(String(urlOrName).split('?')[0]) || '').replace('.', '').toLowerCase();
  }
}

function pickFileName(url, contentType) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (last && /\.[a-z0-9]{1,8}$/i.test(last)) return last;
    const extFromMime = mimeToExt(contentType);
    return (last || 'download') + (extFromMime ? '.' + extFromMime : '');
  } catch {
    return 'download' + (mimeToExt(contentType) ? '.' + mimeToExt(contentType) : '');
  }
}

// SSRF guard — reject loopback, private, link-local, and metadata addresses.
function _isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;                      // loopback
    if (a === 0)   return true;
    if (a === 169 && b === 254) return true;         // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;                       // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // IPv4-mapped IPv6 — re-check the v4 piece
    const m = lower.match(/^::ffff:([0-9.]+)$/);
    if (m && net.isIPv4(m[1])) return _isPrivateIp(m[1]);
    return false;
  }
  return true;
}

async function assertPublicHost(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { throw new Error('Invalid URL'); }

  const proto = parsed.protocol.toLowerCase();
  if (proto !== 'http:' && proto !== 'https:') {
    throw new Error(`Unsupported protocol: ${proto}`);
  }

  const host = parsed.hostname;
  if (!host) throw new Error('Missing host');

  // Block obvious local hostnames before DNS
  const lh = host.toLowerCase();
  if (lh === 'localhost' || lh.endsWith('.local') || lh.endsWith('.internal')) {
    throw new Error('Blocked: local/internal host');
  }

  // If host is already an IP, validate directly
  if (net.isIP(host)) {
    if (_isPrivateIp(host)) throw new Error('Blocked: private/loopback IP');
    return;
  }

  // Resolve and reject if any A/AAAA record points to a private range
  let addrs = [];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`DNS lookup failed for ${host}`);
  }
  if (!addrs.length) throw new Error(`No DNS records for ${host}`);
  for (const a of addrs) {
    if (_isPrivateIp(a.address)) {
      throw new Error('Blocked: host resolves to a private/loopback IP');
    }
  }
}

function mimeToExt(mime) {
  if (!mime) return '';
  const m = String(mime).toLowerCase();
  const map = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/heic': 'heic',
    'video/mp4': 'mp4', 'video/x-matroska': 'mkv', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'video/3gpp': '3gp',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/flac': 'flac',
    'application/pdf': 'pdf', 'application/zip': 'zip',
    'text/plain': 'txt'
  };
  return map[m] || '';
}

function classify(contentType, urlOrName) {
  const ct  = String(contentType || '').toLowerCase().split(';')[0].trim();
  const ext = extFromUrl(urlOrName);

  // Sticker first — webp or .webp extension
  if (ct === 'image/webp' || ext === 'webp') return 'sticker';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';

  // Fall back to extension when server lies / sends octet-stream
  if (['jpg','jpeg','png','gif','heic','bmp'].includes(ext)) return 'image';
  if (['mp4','mkv','webm','mov','3gp','avi'].includes(ext)) return 'video';
  if (['mp3','m4a','aac','ogg','wav','flac','opus'].includes(ext)) return 'audio';

  return 'document';
}

async function probeUrl(url) {
  // Try HEAD first; many CDNs honour it and we get type + size cheaply.
  try {
    const head = await axios.head(url, {
      timeout: 15000, maxRedirects: 5, headers: DEFAULT_HEADERS,
      validateStatus: (s) => s >= 200 && s < 400
    });
    return {
      contentType: head.headers['content-type'] || '',
      contentLength: parseInt(head.headers['content-length']) || 0,
      finalUrl: head.request?.res?.responseUrl || url
    };
  } catch {
    return { contentType: '', contentLength: 0, finalUrl: url };
  }
}

async function fetchBuffer(url, maxBytes) {
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 5,
    headers: DEFAULT_HEADERS,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    validateStatus: (s) => s >= 200 && s < 400
  });
  return {
    buffer: Buffer.from(resp.data),
    contentType: resp.headers['content-type'] || '',
    finalUrl: resp.request?.res?.responseUrl || url
  };
}

export default {
  name: 'downloadurl',
  aliases: ['downurl', 'urldl', 'dlurl', 'fetchurl'],
  category: 'Downloader',
  description: 'Download any direct URL — image, video, audio, sticker, or document — and send it back to the chat.',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p   = prefix || '/';

    const quotedText = m.quoted?.text?.trim()
      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
      || '';
    const raw = (args.join(' ').trim() || quotedText || '').trim();

    // Strip surrounding quotes / angle brackets if present
    const url = raw.replace(/^[<"'`\s]+|[>"'`\s]+$/g, '');

    if (!looksLikeUrl(url)) {
      return sock.sendMessage(jid, {
        text: `╭─⌈ 🔗 *URL DOWNLOADER* ⌋\n│\n├─⊷ *${p}downloadurl <url>*\n│  └⊷ Download any URL\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    console.log(`🔗 [URLDL] ${url}`);
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      // Step 0 — SSRF guard (block private/loopback/metadata addresses)
      await assertPublicHost(url);

      // Step 1 — probe (cheap)
      const probe = await probeUrl(url);
      let kind = classify(probe.contentType, probe.finalUrl);
      let limit = SIZE_LIMITS[kind] ?? SIZE_LIMITS.document;

      if (probe.contentLength && probe.contentLength > limit) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *File too large* (${fmtBytes(probe.contentLength)})\nLimit for ${kind}: ${fmtBytes(limit)}`
        }, { quoted: m });
      }

      // Step 2 — download with an adaptive cap.
      // If HEAD already gave us a trustworthy content-type, cap at that
      // type's limit so we don't waste 100 MB of memory on, say, an image.
      // Otherwise (no/empty/octet-stream type) fall back to the doc cap.
      const trustHeadType = !!probe.contentType
        && !/octet-stream|application\/binary/i.test(probe.contentType);
      const downloadCap = trustHeadType ? limit : SIZE_LIMITS.document;

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });
      const { buffer, contentType: ct2, finalUrl } = await fetchBuffer(url, downloadCap);

      // Re-classify with the real content-type (HEAD sometimes lies)
      kind  = classify(ct2 || probe.contentType, finalUrl);
      limit = SIZE_LIMITS[kind] ?? SIZE_LIMITS.document;

      if (buffer.length > limit) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `❌ *File too large* (${fmtBytes(buffer.length)})\nLimit for ${kind}: ${fmtBytes(limit)}`
        }, { quoted: m });
      }

      const fileName  = pickFileName(finalUrl, ct2 || probe.contentType);
      const sizeLabel = fmtBytes(buffer.length);
      const BOT_NAME  = getBotName();
      const caption   = `🔗 *URL Downloader*\n📦 *${fileName}*\n📏 ${sizeLabel}\n⚡ Powered by *${BOT_NAME}*`;

      await sock.sendMessage(jid, { react: { text: '📤', key: m.key } });

      // Step 3 — send as the right WhatsApp message type
      if (kind === 'sticker') {
        await sock.sendMessage(jid, { sticker: buffer }, { quoted: m });
      } else if (kind === 'image') {
        await sock.sendMessage(jid, { image: buffer, caption }, { quoted: m });
      } else if (kind === 'video') {
        await sock.sendMessage(jid, {
          video: buffer,
          caption,
          mimetype: ct2 || 'video/mp4'
        }, { quoted: m });
      } else if (kind === 'audio') {
        await sock.sendMessage(jid, {
          audio: buffer,
          mimetype: ct2 || 'audio/mpeg',
          ptt: false
        }, { quoted: m });
        // Also send a follow-up text card so the user sees title/size for audio
        await sock.sendMessage(jid, { text: caption }, { quoted: m });
      } else {
        await sock.sendMessage(jid, {
          document: buffer,
          fileName,
          mimetype: ct2 || 'application/octet-stream',
          caption
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`✅ [URLDL] sent ${kind} (${sizeLabel}) — ${fileName}`);
    } catch (err) {
      console.error(`❌ [URLDL] ${err.message}`);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });

      let msg = `❌ *Download failed*`;
      if (/^Blocked:|^Unsupported protocol|^Invalid URL|^Missing host|^DNS lookup failed|^No DNS records/i.test(err.message)) {
        msg += `\n🛡️ ${err.message}`;
      } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
        msg += `\n🌐 Could not reach that host.`;
      } else if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
        msg += `\n⏱ Timed out — file may be too big or the server is slow.`;
      } else if (err.response?.status === 403) {
        msg += `\n🔒 Server denied access (403).`;
      } else if (err.response?.status === 404) {
        msg += `\n🔍 File not found (404).`;
      } else if (/maxContentLength/i.test(err.message) || /maxBodyLength/i.test(err.message)) {
        msg += `\n📦 File exceeds the 100 MB hard limit.`;
      } else {
        msg += `\n${err.message.substring(0, 140)}`;
      }

      await sock.sendMessage(jid, { text: msg }, { quoted: m });
    }
  }
};
