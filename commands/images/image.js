import axios from "axios";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

// ── Primary API — cod3uchiha image search ─────────────────────────────────────
async function searchCod3Images(query, limit = 8) {
    const resp = await axios.get('https://api.cod3uchiha.com/downloaders/img', {
        params: { text: query, limit: Math.min(limit, 10) },
        timeout: 15000
    });
    const data = resp.data;
    if (!data?.status || !data?.result?.images?.length) {
        throw new Error('No results from cod3uchiha image API');
    }
    return data.result.images.slice(0, limit).map(r => ({
        url:       r.url,
        thumbnail: r.url,
        title:     r.title || '',
        source:    ''
    })).filter(r => r.url?.startsWith('http'));
}

// ── Fallback 1 — XWolf ────────────────────────────────────────────────────────
async function searchXWolfImages(query, limit = 8) {
    const resp = await axios.get('https://apis.xwolf.space/api/search/images', {
        params: { q: query },
        timeout: 15000
    });
    const data = resp.data;
    if (!data?.success || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error('No results from XWolf API');
    }
    return data.results.slice(0, limit).map(r => ({
        url:       r.image,
        thumbnail: r.thumbnail || '',
        title:     r.title || '',
        source:    r.pageUrl || ''
    })).filter(r => r.url && r.url.startsWith('http'));
}

// ── Fallback 2 — DuckDuckGo ───────────────────────────────────────────────────
const DDG_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://duckduckgo.com/'
};

async function getDDGToken(query) {
    const resp = await axios.get('https://duckduckgo.com/', {
        params: { q: query },
        headers: { ...DDG_HEADERS, Accept: 'text/html' },
        timeout: 10000
    });
    const match = resp.data.match(/vqd=["']?([\d-]+)["']?/) ||
                  resp.data.match(/vqd=([\d-]+)/);
    return match?.[1] || null;
}

async function searchDDGImages(query, limit = 8) {
    const vqd = await getDDGToken(query);
    if (!vqd) throw new Error('Could not get DuckDuckGo token');

    const resp = await axios.get('https://duckduckgo.com/i.js', {
        params: { l: 'us-en', o: 'json', q: query, vqd, f: ',,,,,', p: '1' },
        headers: DDG_HEADERS,
        timeout: 15000
    });

    const results = resp.data?.results;
    if (!Array.isArray(results) || results.length === 0) throw new Error('No DDG results');

    return results.slice(0, limit).map(r => ({
        url: r.image, thumbnail: r.thumbnail, title: r.title || '', source: r.url || ''
    })).filter(r => r.url?.startsWith('http'));
}

// ── Fallback 2 — Google scrape ────────────────────────────────────────────────
async function searchGoogleImages(query, limit = 8) {
    const resp = await axios.get('https://www.google.com/search', {
        params: { q: query, tbm: 'isch', ijn: '0' },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
    });

    const html = resp.data;
    const images = [];
    const pattern = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)",\s*(\d+),\s*(\d+)\]/gi;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        if (url.includes('gstatic.com') || url.includes('google.com')) continue;
        if (url.length > 500) continue;
        if (!images.find(i => i.url === url)) images.push({ url, title: '' });
        if (images.length >= limit) break;
    }
    if (images.length === 0) throw new Error('No Google image results parsed');
    return images;
}

// ── Download helper ───────────────────────────────────────────────────────────
async function downloadImage(url) {
    const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 10 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Referer': new URL(url).origin
        }
    });

    const ct = resp.headers['content-type'] || '';
    if (!ct.startsWith('image/')) throw new Error('Not an image');

    const buf = Buffer.from(resp.data);
    if (buf.length < 1000) throw new Error('Image too small');
    if (buf.length > 5 * 1024 * 1024) throw new Error('Image too large for WhatsApp');

    let mime = 'image/jpeg';
    if (ct.includes('png'))  mime = 'image/png';
    else if (ct.includes('gif'))  mime = 'image/gif';
    else if (ct.includes('webp')) mime = 'image/webp';

    return { buffer: buf, mime };
}

// ── Command ───────────────────────────────────────────────────────────────────
export default {
    name: "image",
    aliases: ["img", "pic", "photo", "searchimage"],
    category: "Search",
    description: "Search and download images from the web",

    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;
        let query = args.length > 0 ? args.join(" ") : (m.quoted?.text || "");

        if (!query) {
            return sock.sendMessage(jid, {
                text: `╭─⌈ 📸 *IMAGE SEARCH* ⌋\n├─⊷ *${PREFIX}image <query>*\n│  └⊷ Search and send images from the web\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        // parse -limit flag
        let limit = 5;
        const limitMatch = query.match(/-limit\s+(\d+)/i);
        if (limitMatch) {
            limit = Math.min(Math.max(parseInt(limitMatch[1]), 1), 10);
            query = query.replace(limitMatch[0], '').trim();
        }

        if (!query) return sock.sendMessage(jid, { text: '❌ Please provide a search query.' }, { quoted: m });

        await sock.sendMessage(jid, { react: { text: '🔍', key: m.key } });

        let images  = [];
        let apiUsed = '';

        // Try cod3uchiha first, fall back to XWolf → DDG → Google
        try {
            images  = await searchCod3Images(query, limit + 5);
            apiUsed = 'cod3uchiha';
        } catch (e0) {
            console.log(`[IMAGE] cod3uchiha failed: ${e0.message}`);
            try {
                images  = await searchXWolfImages(query, limit + 5);
                apiUsed = 'XWolf';
            } catch (e1) {
                console.log(`[IMAGE] XWolf API failed: ${e1.message}`);
                try {
                    images  = await searchDDGImages(query, limit + 5);
                    apiUsed = 'DuckDuckGo';
                } catch (e2) {
                    console.log(`[IMAGE] DDG failed: ${e2.message}`);
                    try {
                        images  = await searchGoogleImages(query, limit + 5);
                        apiUsed = 'Google';
                    } catch (e3) {
                        console.log(`[IMAGE] Google failed: ${e3.message}`);
                        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
                        return sock.sendMessage(jid, {
                            text: `❌ *Image search failed*\n\nCould not find images for "*${query}*".\n\n💡 Try different keywords or try again shortly.`
                        }, { quoted: m });
                    }
                }
            }
        }

        if (images.length === 0) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return sock.sendMessage(jid, {
                text: `❌ No images found for "*${query}*"\n\n💡 Try different keywords or simpler search terms.`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⬇️', key: m.key } });

        let sent = 0;
        for (let i = 0; i < images.length && sent < limit; i++) {
            try {
                let downloaded;
                try {
                    downloaded = await downloadImage(images[i].url);
                } catch {
                    if (images[i].thumbnail) {
                        downloaded = await downloadImage(images[i].thumbnail);
                    } else {
                        continue;
                    }
                }

                sent++;
                const title   = images[i].title ? `\n📌 ${images[i].title}` : '';
                const caption = sent === 1
                    ? `📸 *Image ${sent}/${limit}* — "${query}"${title}\n🔍 via ${apiUsed}`
                    : `📸 *${sent}/${limit}*`;

                await sock.sendMessage(jid, {
                    image:    downloaded.buffer,
                    mimetype: downloaded.mime,
                    caption
                });

                if (sent < limit && i < images.length - 1) {
                    await new Promise(r => setTimeout(r, 800));
                }
            } catch (err) {
                console.log(`[IMAGE] Skip image ${i + 1}: ${err.message}`);
            }
        }

        if (sent === 0) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return sock.sendMessage(jid, {
                text: `❌ Found results but couldn't download any images.\n\n💡 Try: \`${PREFIX}image ${query} -limit 3\``
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    }
};
