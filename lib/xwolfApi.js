import axios from 'axios';
import { proxyFetch } from './proxyFetch.js';
import { sigLog } from './sigLog.js';

const BASE     = 'https://apis.xwolf.space/download';
const STREAM   = 'https://apis.xwolf.space/stream';
const SEARCH   = 'https://apis.xwolf.space/api/search';
const TRENDING = 'https://apis.xwolf.space/api/trending';

const BOT_KEY = process.env.XWOLF_API_KEY || process.env.XWOLF_BOT_KEY || 'wxa_u_xwk7sch6xj';

function isSuccess(val) {
    if (val === true || val === 1) return true;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return false;
}

/**
 * PRIMARY DOWNLOAD — calls /stream on the API server.
 * Uses proxyFetch so the request goes through BOT_PROXY_URL if configured.
 * Returns a Buffer on success, null on failure.
 */
export async function streamXWolf(urlOrQuery, type = 'mp3', timeout = 120000) {
    const params = new URLSearchParams({ q: urlOrQuery, type, key: BOT_KEY });
    const url    = `${STREAM}?${params.toString()}`;
    sigLog('🌐', `stream/${type}`, 'Requesting via proxy…');
    const buf = await proxyFetch(url, timeout);
    if (buf) sigLog('✅', `stream/${type}`, 'Stream received', { Size: `${(buf.byteLength / 1024 / 1024).toFixed(1)}MB` });
    return buf;
}

/**
 * SEARCH — returns array of items from xwolf search API.
 */
export async function xwolfSearch(query, limit = 10) {
    try {
        const res = await axios.get(SEARCH, {
            params:  { q: query, key: BOT_KEY },
            timeout: 15000
        });
        const d = res.data;
        sigLog('🔎', 'xwolf/search', 'Search response', {
            success: String(d?.success),
            items:   d?.items?.length ?? 0,
        });
        if (isSuccess(d?.success) && Array.isArray(d.items)) {
            return d.items.slice(0, limit);
        }
    } catch (e) {
        sigLog('❌', 'xwolf/search', 'Request failed', { Error: e.message }, 'red');
    }
    return [];
}

/**
 * TRENDING — returns trending items.
 */
export async function xwolfTrending(limit = 10) {
    try {
        const res = await axios.get(TRENDING, {
            params:  { key: BOT_KEY },
            timeout: 15000
        });
        const d = res.data;
        if (isSuccess(d?.success) && Array.isArray(d.items)) {
            return d.items.slice(0, limit);
        }
    } catch (e) {
        sigLog('❌', 'xwolf/trending', 'Request failed', { Error: e.message }, 'red');
    }
    return [];
}

/**
 * LYRICS — returns lyrics for a song.
 */
export async function xwolfLyrics(query) {
    try {
        const res = await axios.get(`${BASE}/lyrics`, {
            params:  { q: query, key: BOT_KEY },
            timeout: 15000
        });
        const d = res.data;
        if (isSuccess(d?.success) && d?.lyrics) {
            return { title: d.title || query, artist: d.artist || '', lyrics: d.lyrics };
        }
    } catch (e) {
        sigLog('❌', 'xwolf/lyrics', 'Request failed', { Error: e.message }, 'red');
    }
    return null;
}

// ── Internal helpers for the *Download* family ────────────────────────────
function buildQueryParams(urlOrQuery) {
    if (/^https?:\/\//i.test(urlOrQuery)) return { url: urlOrQuery, key: BOT_KEY };
    return { q: urlOrQuery, key: BOT_KEY };
}

function buildMeta(d, query, fallbackQuality) {
    return {
        title:        d.title       || d.searchResult?.title || query,
        quality:      d.quality     || fallbackQuality,
        thumbnail:    d.thumbnail   || d.thumbnailMq || (d.videoId ? `https://img.youtube.com/vi/${d.videoId}/hqdefault.jpg` : ''),
        youtubeUrl:   d.youtubeUrl  || '',
        videoId:      d.videoId     || '',
        channelTitle: d.searchResult?.channelTitle || '',
        duration:     d.searchResult?.duration     || ''
    };
}

async function fetchBuffer(url, timeout, maxBytes) {
    const dlRes = await axios.get(url, {
        responseType:     'arraybuffer',
        timeout,
        maxRedirects:     5,
        maxContentLength: maxBytes,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://apis.xwolf.space/' }
    });
    return Buffer.from(dlRes.data);
}

function looksLikeHtml(buf) {
    const hdr = buf.slice(0, 60).toString('utf8').toLowerCase();
    return hdr.includes('<!doctype') || hdr.includes('<html') || hdr.includes('bad gateway');
}

/**
 * AUDIO DOWNLOAD — iterates ALL xwolf audio endpoints with per-endpoint
 * proxyUrl + downloadUrl fallback. Returns first successful Buffer with ._meta.
 *
 * Endpoints tried in order: mp3 → dlmp3 → yta3 → yta → yta2 → audio
 * (ytmp3 was removed — it had repeated timeout issues)
 *   (CDN endpoints first for speed; /audio is server-hosted file — slow but reliable last resort)
 */
export async function xwolfDownloadAudio(query, timeout = 90000) {
    if (!query) return null;
    // NOTE: 'ytmp3' removed — that endpoint had repeated timeout issues.
    const endpoints = ['mp3', 'dlmp3', 'yta3', 'yta', 'yta2', 'audio'];
    const params    = buildQueryParams(query);

    for (const ep of endpoints) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, { params, timeout: 30000 });
            const d   = res.data;
            if (!isSuccess(d?.success)) {
                sigLog('⚠️', `xwolf/${ep}`, 'Endpoint returned not-success', null, 'yellow');
                continue;
            }
            const candidates = [d.downloadUrl, d.proxyUrl, d.url].filter(Boolean);
            if (!candidates.length) {
                sigLog('⚠️', `xwolf/${ep}`, 'No URL in response', null, 'yellow');
                continue;
            }
            sigLog('🎯', `xwolf/${ep}`, 'Resolved track', {
                Title:   (d.title || query).substring(0, 50),
                Quality: d.quality || '?',
            });

            for (const dlUrl of candidates) {
                try {
                    const buf = await fetchBuffer(dlUrl, timeout, 100 * 1024 * 1024);
                    if (!buf || buf.length < 10_000) {
                        sigLog('⚠️', `xwolf/${ep}`, 'Buffer too small', { Size: `${buf?.length ?? 0} bytes` }, 'yellow');
                        continue;
                    }
                    if (looksLikeHtml(buf)) {
                        sigLog('⚠️', `xwolf/${ep}`, 'HTML response — skipping', null, 'yellow');
                        continue;
                    }
                    sigLog('✅', `xwolf/${ep}`, 'Audio downloaded', { Size: `${(buf.byteLength / 1024 / 1024).toFixed(1)}MB` });
                    buf._meta = buildMeta(d, query, '320kbps');
                    return buf;
                } catch (e) {
                    sigLog('❌', `xwolf/${ep}`, 'Download error', { Error: e.message }, 'red');
                }
            }
        } catch (e) {
            sigLog('❌', `xwolf/${ep}`, 'API error', { Error: e.message }, 'red');
        }
    }
    return null;
}

/**
 * VIDEO DOWNLOAD — iterates ALL xwolf video endpoints with per-endpoint
 * proxyUrl + downloadUrl fallback. Returns first successful Buffer with ._meta.
 *
 * Endpoints tried in order: mp4 → video → hd → dlmp4 → ytmp4
 *   (CDN endpoints first; /ytmp4 is server-hosted file — slow but reliable last resort)
 */
export async function xwolfDownloadVideo(query, timeout = 120000) {
    if (!query) return null;
    const endpoints = ['mp4', 'video', 'hd', 'dlmp4', 'ytmp4'];
    const params    = buildQueryParams(query);

    for (const ep of endpoints) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, { params, timeout: 30000 });
            const d   = res.data;
            if (!isSuccess(d?.success)) {
                sigLog('⚠️', `xwolf/${ep}`, 'Endpoint returned not-success', null, 'yellow');
                continue;
            }
            const candidates = [d.downloadUrl, d.proxyUrl, d.videoUrl, d.url].filter(Boolean);
            if (!candidates.length) {
                sigLog('⚠️', `xwolf/${ep}`, 'No URL in response', null, 'yellow');
                continue;
            }
            sigLog('🎯', `xwolf/${ep}`, 'Resolved video', {
                Title:   (d.title || query).substring(0, 50),
                Quality: d.quality || '?',
            });

            for (const dlUrl of candidates) {
                try {
                    const buf = await fetchBuffer(dlUrl, timeout, 300 * 1024 * 1024);
                    if (!buf || buf.length < 10_000) {
                        sigLog('⚠️', `xwolf/${ep}`, 'Buffer too small', { Size: `${buf?.length ?? 0} bytes` }, 'yellow');
                        continue;
                    }
                    if (looksLikeHtml(buf)) {
                        sigLog('⚠️', `xwolf/${ep}`, 'HTML response — skipping', null, 'yellow');
                        continue;
                    }
                    const sig = buf.slice(4, 8).toString('ascii');
                    if (!['ftyp', 'free', 'moov', 'mdat', 'wide'].includes(sig)) {
                        sigLog('⚠️', `xwolf/${ep}`, 'Unexpected MP4 bytes', { Sig: sig }, 'yellow');
                        continue;
                    }
                    sigLog('✅', `xwolf/${ep}`, 'Video downloaded', { Size: `${(buf.byteLength / 1024 / 1024).toFixed(1)}MB` });
                    buf._meta = buildMeta(d, query, '720p');
                    return buf;
                } catch (e) {
                    sigLog('❌', `xwolf/${ep}`, 'Download error', { Error: e.message }, 'red');
                }
            }
        } catch (e) {
            sigLog('❌', `xwolf/${ep}`, 'API error', { Error: e.message }, 'red');
        }
    }
    return null;
}

/**
 * COMBO DOWNLOAD — calls /download/ytmp5 which returns BOTH mp3 + mp4 in one shot.
 * Returns { audio: Buffer|null, video: Buffer|null, meta: {...} } or null on failure.
 */
export async function xwolfDownloadCombo(query, timeout = 120000) {
    if (!query) return null;
    try {
        const res = await axios.get(`${BASE}/ytmp5`, {
            params: buildQueryParams(query),
            timeout: 30000
        });
        const d = res.data;
        if (!isSuccess(d?.success)) return null;
        sigLog('🎯', 'xwolf/ytmp5', 'Resolved combo', { Title: (d.title || query).substring(0, 50) });

        const meta = {
            title:      d.title      || query,
            thumbnail:  d.thumbnail  || (d.videoId ? `https://img.youtube.com/vi/${d.videoId}/hqdefault.jpg` : ''),
            youtubeUrl: d.youtubeUrl || '',
            videoId:    d.videoId    || ''
        };

        const tryFetch = async (block, maxBytes, kind) => {
            if (!block) return null;
            const urls = [block.downloadUrl, block.proxyUrl].filter(Boolean);
            for (const u of urls) {
                try {
                    const buf = await fetchBuffer(u, timeout, maxBytes);
                    if (buf && buf.length > 10_000 && !looksLikeHtml(buf)) {
                        sigLog('✅', `xwolf/ytmp5/${kind}`, 'Stream downloaded', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
                        return buf;
                    }
                } catch (e) {
                    sigLog('❌', `xwolf/ytmp5/${kind}`, 'Download error', { Error: e.message }, 'red');
                }
            }
            return null;
        };

        const [audio, video] = await Promise.all([
            tryFetch(d.mp3, 100 * 1024 * 1024, 'mp3'),
            tryFetch(d.mp4, 300 * 1024 * 1024, 'mp4')
        ]);
        return { audio, video, meta };
    } catch (e) {
        sigLog('❌', 'xwolf/ytmp5', 'Combo error', { Error: e.message }, 'red');
        return null;
    }
}

/**
 * LEGACY helpers — kept for Keith API fallback compatibility.
 * These fetch just the metadata/download URL (not the file itself).
 */
// Legacy helper paths (used by queryXWolfAudio). 'ytmp3' removed — see note above.
const AUDIO_PATHS = ['mp3', 'audio', 'dlmp3', 'yta', 'yta2', 'yta3'];
const VIDEO_PATHS = ['mp4', 'ytmp4', 'video', 'hd', 'dlmp4'];

function buildParams(urlOrQuery) {
    const base = { key: BOT_KEY };
    if (/^https?:\/\//i.test(urlOrQuery)) return { ...base, url: urlOrQuery };
    return { ...base, q: urlOrQuery };
}

function normalizeData(d, path) {
    if (!d) return null;
    const isAudio = AUDIO_PATHS.includes(path);
    // xwolf can return the URL under any of these field names depending on endpoint
    const dlUrl   = d.downloadUrl || d.download_url || d.videoUrl || d.proxyUrl || d.url || null;
    if (!dlUrl || typeof dlUrl !== 'string' || !dlUrl.startsWith('http')) return null;
    return {
        title:        d.title      || '',
        download_url: dlUrl,
        quality:      d.quality    || (isAudio ? '192kbps' : '360p'),
        thumbnail:    d.thumbnail  || d.thumbnailMq || '',
        youtubeUrl:   d.youtubeUrl || '',
        videoId:      d.videoId    || ''
    };
}

async function queryXWolf(urlOrQuery, paths, timeout = 30000) {
    const params = buildParams(urlOrQuery);
    for (const path of paths) {
        try {
            const res = await axios.get(`${BASE}/${path}`, { params, timeout });
            const d   = res.data;
            const hasUrl = d?.downloadUrl || d?.download_url || d?.videoUrl || d?.proxyUrl || d?.url;
            if (isSuccess(d?.success) && hasUrl) {
                const data = normalizeData(d, path);
                if (data) return { success: true, data, endpoint: `xwolf/${path}` };
            }
        } catch (e) {
            sigLog('❌', `xwolf/${path}`, 'Legacy query error', { Error: e.message }, 'red');
        }
    }
    return { success: false };
}

export function queryXWolfAudio(urlOrQuery) { return queryXWolf(urlOrQuery, AUDIO_PATHS, 30000); }
export function queryXWolfVideo(urlOrQuery) { return queryXWolf(urlOrQuery, VIDEO_PATHS, 35000); }

/**
 * Download a YouTube video via xwolf /download/hd.
 * Accepts a search query string (q=) — no separate search step needed.
 * Returns a valid MP4 Buffer, or null on failure.
 */
export async function xwolfDownloadHd(query) {
    if (!query) return null;
    try {
        const res = await axios.get(`${BASE}/hd`, {
            params: { q: query, key: BOT_KEY },
            timeout: 25000
        });
        const d = res.data;
        if (!isSuccess(d?.success)) {
            sigLog('⚠️', 'xwolf/hd', 'Endpoint failed', { Body: JSON.stringify(d).substring(0, 80) }, 'yellow');
            return null;
        }
        const dlUrl = d.videoUrl || d.downloadUrl || d.url;
        if (!dlUrl) {
            sigLog('⚠️', 'xwolf/hd', 'No video URL in response', null, 'yellow');
            return null;
        }
        sigLog('🎯', 'xwolf/hd', 'Resolved — downloading', { Title: (d.title || query).substring(0, 40) });
        const dlRes = await axios.get(dlUrl, {
            responseType: 'arraybuffer',
            timeout: 150_000,
            maxContentLength: 200 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://apis.xwolf.space/' }
        });
        const buf = Buffer.from(dlRes.data);
        if (!buf || buf.length < 10_000) {
            sigLog('⚠️', 'xwolf/hd', 'Buffer too small', { Size: `${buf.length} bytes` }, 'yellow');
            return null;
        }
        const sig = buf.slice(4, 8).toString('ascii');
        if (!['ftyp', 'free', 'moov', 'mdat'].includes(sig)) {
            sigLog('⚠️', 'xwolf/hd', 'Not MP4 bytes', { Sig: sig }, 'yellow');
            return null;
        }
        sigLog('✅', 'xwolf/hd', 'Valid MP4 received', { Size: `${(buf.byteLength / 1024 / 1024).toFixed(1)}MB` });
        return { buffer: buf, title: d.title || '', thumbnail: d.thumbnail || '' };
    } catch (e) {
        sigLog('❌', 'xwolf/hd', 'Request error', { Error: e.message }, 'red');
        return null;
    }
}

/**
 * Download a YouTube video via xwolf /download/mp4.
 * Returns a valid MP4 Buffer, or null on failure.
 * Uses the direct downloadUrl from the API — no proxy needed, works from Replit.
 */
export async function xwolfDownloadMp4(youtubeUrl) {
    if (!/^https?:\/\//i.test(youtubeUrl)) return null;
    try {
        const res = await axios.get(`${BASE}/mp4`, {
            params: { url: youtubeUrl, key: BOT_KEY },
            timeout: 25000
        });
        const d = res.data;
        if (!isSuccess(d?.success) || !d?.downloadUrl) {
            sigLog('⚠️', 'xwolf/mp4', 'Endpoint failed', { Body: JSON.stringify(d).substring(0, 80) }, 'yellow');
            return null;
        }
        sigLog('🎯', 'xwolf/mp4', 'Resolved — downloading', { Title: (d.title || '').substring(0, 40) });
        const dlRes = await axios.get(d.downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 150_000,
            maxContentLength: 200 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://apis.xwolf.space/' }
        });
        const buf = Buffer.from(dlRes.data);
        if (!buf || buf.length < 10_000) {
            sigLog('⚠️', 'xwolf/mp4', 'Buffer too small', { Size: `${buf.length} bytes` }, 'yellow');
            return null;
        }
        const sig = buf.slice(4, 8).toString('ascii');
        if (!['ftyp', 'free', 'moov', 'mdat'].includes(sig)) {
            sigLog('⚠️', 'xwolf/mp4', 'Not MP4 bytes', { Sig: sig }, 'yellow');
            return null;
        }
        sigLog('✅', 'xwolf/mp4', 'Valid MP4 received', { Size: `${(buf.byteLength / 1024 / 1024).toFixed(1)}MB` });
        return buf;
    } catch (e) {
        sigLog('❌', 'xwolf/mp4', 'Request error', { Error: e.message }, 'red');
        return null;
    }
}