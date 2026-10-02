/**
 * xcasperApi.js — xcasper.space downloader integration.
 *
 * Audio download priority (per xcasperAudio):
 *   1. y2mate    → returns occoco.etacloud.org URL — works directly from Replit ✅
 *   2. yt-audio  → returns xcasper proxy stream URL — works if BOT_PROXY_URL set
 *   3. ytmp3     → returns xcasper proxy stream URL — works if BOT_PROXY_URL set
 *
 * Spotify priority (per xcasperSpotify):
 *   1. sportify  → cdn-spotify.zm.io.vn audio URL — works directly from Replit ✅
 *   2. spotify4  → gets YouTube match ID → feeds into y2mate ✅
 *
 * Video download priority (per xcasperVideo):
 *   1. ytmp5 → xcasper proxy URL — accessible from Replit ✅ (serves both mp3/mp4; validated by magic bytes)
 *   2. ytmp6 → xcasper proxy URL — accessible from Replit ✅ (mp4 360p fallback)
 *
 * Instagram: ig → ig2 → ig3 → ig4 fallback chain.
 */

import axios from 'axios';
import { proxyFetch } from './proxyFetch.js';

const BASE = 'https://apis.xcasper.space/api/downloader';

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * y2mate: returns { buf, title, id } or null.
 * Download URL is at occoco.etacloud.org — no IP lock, works from Replit.
 */
async function y2mateDownload(ytUrl) {
    try {
        const res = await axios.get(`${BASE}/y2mate`, {
            params: { url: ytUrl },
            timeout: 30000
        });
        const d = res.data;
        if (!d?.success || !d?.download) {
            console.log(`[xcasper/y2mate] no download URL`);
            return null;
        }
        console.log(`[xcasper/y2mate] got URL, downloading...`);
        const buf = await proxyFetch(d.download, 120_000);
        return buf ? { buf, title: d.title || '', id: d.id || '' } : null;
    } catch (e) {
        console.log(`[xcasper/y2mate] error: ${e.message}`);
        return null;
    }
}

/**
 * yt-audio: returns { buf, title, thumbnail, duration } or null.
 * Picks best m4a from audios[]. Works if BOT_PROXY_URL routes through xcasper's IP.
 */
async function ytAudioDownload(ytUrl) {
    try {
        const res = await axios.get(`${BASE}/yt-audio`, {
            params: { url: ytUrl },
            timeout: 30000
        });
        const d = res.data;
        if (!d?.success || !Array.isArray(d?.audios) || !d.audios.length) return null;

        const m4a  = d.audios.filter(a => a.ext === 'm4a');
        const pool = m4a.length ? m4a : d.audios;
        const best = pool.reduce((a, b) => {
            const bRate = parseInt(b.label) || 0;
            const aRate = parseInt(a.label) || 0;
            return bRate > aRate ? b : a;
        });
        if (!best?.url) return null;

        console.log(`[xcasper/yt-audio] downloading: ${best.label}`);
        const buf = await proxyFetch(best.url, 120_000);
        return buf ? { buf, title: d.title || '', thumbnail: d.thumbnail || '', duration: d.duration || 0 } : null;
    } catch (e) {
        console.log(`[xcasper/yt-audio] error: ${e.message}`);
        return null;
    }
}

/**
 * ytmp3: fallback using xcasper's ytmp3 endpoint.
 * Picks best m4a from downloads[].
 */
async function ytmp3Download(ytUrl) {
    try {
        const res = await axios.get(`${BASE}/ytmp3`, {
            params: { url: ytUrl },
            timeout: 30000
        });
        const d = res.data;
        if (!d?.success) return null;
        const downloads = d?.data?.downloads;
        if (!Array.isArray(downloads) || !downloads.length) return null;

        const m4a  = downloads.filter(x => x.extension === 'm4a');
        const pool = m4a.length ? m4a : downloads;
        const best = pool.reduce((a, b) => (b.bitrate > a.bitrate ? b : a));
        if (!best?.url) return null;

        console.log(`[xcasper/ytmp3] downloading: ${best.quality}`);
        const buf = await proxyFetch(best.url, 120_000);
        return buf ? { buf, title: d?.data?.title || '' } : null;
    } catch (e) {
        console.log(`[xcasper/ytmp3] error: ${e.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC EXPORTS
// ─────────────────────────────────────────────────────────────

/**
 * xcasperToolsAudio: hits https://apis.xcasper.space/api/tools/yt-audio?url=<videoId>&format=mp3
 * Accepts either a YouTube URL or a bare 11-char video ID.
 * The tools endpoint may return JSON with a download URL OR raw audio bytes directly.
 * Returns Buffer or null.
 */
export async function xcasperToolsAudio(urlOrId) {
    const m = (urlOrId || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    const videoId = m ? m[1] : (urlOrId?.length === 11 ? urlOrId : null);
    if (!videoId) { console.log(`[xcasper/tools] cannot extract video ID`); return null; }

    const reqUrl = `https://apis.xcasper.space/api/tools/yt-audio?url=${videoId}&format=mp3`;
    console.log(`[xcasper/tools] requesting: ${reqUrl}`);

    // Common headers that help bypass Cloudflare bot checks
    const HEADERS = {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://xcasper.space/',
        'Origin':          'https://xcasper.space'
    };

    // Helper: parse response buffer (JSON or raw binary)
    async function parseResponse(buf) {
        if (!buf || buf.length < 500) return null;
        const text = buf.slice(0, 400).toString('utf8');
        // Check if it's JSON with a download URL
        if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
            try {
                const json = JSON.parse(buf.toString('utf8'));
                const dlUrl = json?.url || json?.download || json?.data?.url || json?.result?.url || json?.link;
                if (dlUrl && dlUrl.startsWith('http')) {
                    console.log(`[xcasper/tools] JSON → fetching download URL...`);
                    const dlBuf = await proxyFetch(dlUrl, 120_000);
                    if (dlBuf) { console.log(`[xcasper/tools] ✅ ${(dlBuf.length/1024/1024).toFixed(1)}MB`); return dlBuf; }
                }
                console.log(`[xcasper/tools] JSON had no usable download URL`);
                return null;
            } catch {}
        }
        // Raw binary audio
        const hdr = text.toLowerCase();
        if (hdr.includes('<!doctype') || hdr.includes('<html') || hdr.includes('error code')) {
            console.log(`[xcasper/tools] got HTML/error`); return null;
        }
        console.log(`[xcasper/tools] ✅ raw binary ${(buf.length/1024/1024).toFixed(1)}MB`);
        return buf;
    }

    // 1. Try undici.request — more reliable than fetch for binary responses
    try {
        const undici = await import('undici');
        const { statusCode, body } = await undici.request(reqUrl, {
            method: 'GET',
            headers: HEADERS,
            bodyTimeout: 60_000,
            headersTimeout: 15_000,
            maxRedirections: 5
        });
        if (statusCode >= 200 && statusCode < 300) {
            const chunks = [];
            for await (const chunk of body) chunks.push(chunk);
            const buf = Buffer.concat(chunks);
            const result = await parseResponse(buf);
            if (result) return result;
        } else {
            console.log(`[xcasper/tools] undici HTTP ${statusCode}`);
            await body.dump().catch(() => {});
        }
    } catch (e) {
        console.log(`[xcasper/tools] undici error: ${e.message}`);
    }

    // 2. Fallback: axios with same headers
    try {
        const res = await axios.get(reqUrl, {
            timeout: 60000,
            responseType: 'arraybuffer',
            validateStatus: s => s >= 200 && s < 400,
            headers: HEADERS
        });
        const buf = Buffer.from(res.data);
        const result = await parseResponse(buf);
        if (result) return result;
    } catch (e) {
        console.log(`[xcasper/tools] axios error: ${e.message}`);
    }

    return null;
}

/**
 * Download YouTube audio.
 * Requires a YouTube URL. Returns Buffer or null.
 * Chain: y2mate → yt-audio → ytmp3
 */
export async function xcasperAudio(urlOrQuery) {
    if (!/^https?:\/\//i.test(urlOrQuery)) return null;

    let r;

    r = await y2mateDownload(urlOrQuery);
    if (r?.buf) { console.log(`[xcasper/audio] ✅ y2mate (${(r.buf.byteLength / 1024 / 1024).toFixed(1)}MB)`); return r.buf; }

    r = await ytAudioDownload(urlOrQuery);
    if (r?.buf) { console.log(`[xcasper/audio] ✅ yt-audio (${(r.buf.byteLength / 1024 / 1024).toFixed(1)}MB)`); return r.buf; }

    r = await ytmp3Download(urlOrQuery);
    if (r?.buf) { console.log(`[xcasper/audio] ✅ ytmp3 (${(r.buf.byteLength / 1024 / 1024).toFixed(1)}MB)`); return r.buf; }

    console.log(`[xcasper/audio] ❌ all sources failed`);
    return null;
}

/**
 * yt-video: full quality list endpoint — picks best mp4 (360p preferred) from videos[].
 * All URLs are xcasper proxy URLs — work directly from Replit.
 */
async function ytVideoDownload(ytUrl) {
    try {
        const res = await axios.get(`${BASE}/yt-video`, {
            params: { url: ytUrl },
            timeout: 30000
        });
        const d = res.data;
        if (!d?.success || !Array.isArray(d?.videos) || !d.videos.length) return null;

        // prefer mp4, in order: 360p → 480p → 720p → any mp4
        const mp4s = d.videos.filter(v => v.ext === 'mp4' && v.type === 'video');
        if (!mp4s.length) return null;

        const pick = mp4s.find(v => v.quality?.includes('360p'))
            || mp4s.find(v => v.quality?.includes('480p'))
            || mp4s.find(v => v.quality?.includes('720p'))
            || mp4s[mp4s.length - 1]; // smallest available

        if (!pick?.url) return null;

        const title = d.title || '';
        const thumbnail = d.thumbnail || '';
        const quality = pick.quality || '360p';
        console.log(`[xcasper/yt-video] downloading ${quality}: ${title}`);

        // Use proxyFetch (undici) — axios gets 403 from xcasper proxy stream URLs
        const buf = await proxyFetch(pick.url, 150_000);
        if (!buf || buf.length < 10_000) { console.log(`[xcasper/yt-video] buffer too small: ${buf?.length || 0}`); return null; }

        console.log(`[xcasper/yt-video] ✅ ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`);
        return { buf, title, thumbnail, quality };
    } catch (e) {
        console.log(`[xcasper/yt-video] error: ${e.message}`);
        return null;
    }
}

/**
 * Download YouTube video.
 * Chain: yt-video → ytmp5 → ytmp6.
 * yt-video picks 360p mp4 from full quality list via xcasper proxy.
 * ytmp5/ytmp6 are fallbacks — validate actual bytes, not the format label.
 * Proxy URLs are downloaded directly via axios (xcasper proxy works from Replit).
 * Returns Buffer or null.
 */
export async function xcasperVideo(urlOrQuery) {
    if (!/^https?:\/\//i.test(urlOrQuery)) return null;

    // PRIMARY: yt-video endpoint with quality selection
    const ytv = await ytVideoDownload(urlOrQuery);
    if (ytv?.buf) return ytv.buf;

    for (const ep of ['ytmp5', 'ytmp6']) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, {
                params: { url: urlOrQuery },
                timeout: 30000
            });
            const d = res.data;
            if (!d?.success) { console.log(`[xcasper/${ep}] failed`); continue; }

            const dlUrl = d.url;
            if (!dlUrl) { console.log(`[xcasper/${ep}] no URL`); continue; }

            console.log(`[xcasper/${ep}] downloading (format=${d.format}, quality=${d.quality})...`);

            // Download directly via axios — xcasper proxy URLs work from Replit
            const dlRes = await axios.get(dlUrl, {
                responseType: 'arraybuffer',
                timeout: 150_000,
                maxContentLength: 200 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://apis.xcasper.space/'
                }
            });

            const buf = Buffer.from(dlRes.data);
            if (!buf || buf.length < 10_000) {
                console.log(`[xcasper/${ep}] buffer too small: ${buf.length}`);
                continue;
            }

            // Check actual magic bytes — bytes 4-7 must be ftyp/moov (MP4), not ID3/audio
            const sig = buf.slice(4, 8).toString('ascii');
            if (!['ftyp', 'free', 'moov', 'mdat'].includes(sig)) {
                console.log(`[xcasper/${ep}] not MP4 bytes (sig="${sig}"), skipping for video`);
                continue;
            }

            console.log(`[xcasper/${ep}] ✅ ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB valid MP4`);
            return buf;
        } catch (e) {
            console.log(`[xcasper/${ep}] error: ${e.message}`);
        }
    }
    return null;
}

/**
 * Download a Spotify track.
 * Chain:
 *   1. sportify → cdn-spotify.zm.io.vn (works from Replit ✅)
 *   2. spotify4 → youtube_match.video_id → y2mate (works from Replit ✅)
 * Returns { buf, title, artist, thumbnail, duration } or null.
 */
export async function xcasperSpotify(spotifyUrl) {
    // ── 1. sportify endpoint (CDN works directly) ──
    try {
        const res = await axios.get(`${BASE}/sportify`, {
            params: { url: spotifyUrl },
            timeout: 30000
        });
        const d = res.data;
        if (d?.success && d?.track?.audio?.url) {
            const track = d.track;
            console.log(`[xcasper/sportify] found: ${track.title}`);
            const buf = await proxyFetch(track.audio.url, 90_000);
            if (buf) {
                return {
                    buf,
                    title:     track.title     || '',
                    artist:    track.artist    || '',
                    thumbnail: track.thumbnail || track.album?.cover || '',
                    duration:  track.duration  || ''
                };
            }
        }
    } catch (e) {
        console.log(`[xcasper/sportify] error: ${e.message}`);
    }

    // ── 2. spotify4 → youtube_match → y2mate ──
    try {
        const res = await axios.get(`${BASE}/spotify4`, {
            params: { url: spotifyUrl },
            timeout: 30000
        });
        const d = res.data;
        if (d?.success && d?.youtube_match?.video_id) {
            const track  = d.track || {};
            const ytUrl  = `https://youtube.com/watch?v=${d.youtube_match.video_id}`;
            console.log(`[xcasper/spotify4] YouTube match: ${ytUrl}`);
            const r = await y2mateDownload(ytUrl);
            if (r?.buf) {
                return {
                    buf:       r.buf,
                    title:     track.title  || r.title || '',
                    artist:    track.artist || d.youtube_match.channel || '',
                    thumbnail: track.cover  || '',
                    duration:  track.duration || ''
                };
            }
        }
    } catch (e) {
        console.log(`[xcasper/spotify4] error: ${e.message}`);
    }

    return null;
}

/**
 * Download Instagram media via ig → ig2 → ig3 → ig4 fallback chain.
 * Returns { mediaUrl, mediaUrls, isVideo } or null.
 */
export async function xcasperInstagram(igUrl) {
    for (const ep of ['ig', 'ig2', 'ig3', 'ig4']) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, {
                params: { url: igUrl },
                timeout: 20000
            });
            const d = res.data;
            if (!d?.success) { console.log(`[xcasper/${ep}] failed: ${d?.message || d?.error}`); continue; }

            const medias   = d.data?.medias || d.data?.media || d.medias || d.media || [];
            const mediaUrl = d.data?.url || d.url
                || (Array.isArray(medias) && medias[0]?.url)
                || null;

            if (!mediaUrl) { console.log(`[xcasper/${ep}] no media URL in response`); continue; }

            const isVideo = mediaUrl.includes('.mp4')
                || (Array.isArray(medias) && medias[0]?.type === 'video')
                || igUrl.includes('/reel/') || igUrl.includes('/tv/');

            const mediaUrls = Array.isArray(medias)
                ? medias.map(x => x.url).filter(Boolean)
                : [mediaUrl];

            console.log(`[xcasper/${ep}] ✅ ${mediaUrls.length} media item(s)`);
            return { mediaUrl, mediaUrls, isVideo };
        } catch (e) {
            console.log(`[xcasper/${ep}] error: ${e.message}`);
        }
    }
    return null;
}
