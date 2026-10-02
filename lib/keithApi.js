import axios from 'axios';

const BASE = 'https://apiskeith.top/download';
const API_TIMEOUT = 30000;

const AUDIO_ENDPOINTS = ['ytmp3', 'mp3', 'yta', 'yta3', 'yta4'];
const VIDEO_ENDPOINTS = ['ytv', 'ytv4', 'mp4'];

// Both { status: true, result: url } and { success: true, result: url } are used
function isOk(d) {
    return d?.status === true || d?.success === true;
}

async function downloadBuffer(url, timeout = 120000) {
    const res = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        validateStatus: s => s >= 200 && s < 400
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 500) throw new Error('File too small');
    const hdr = buf.slice(0, 60).toString('utf8').toLowerCase();
    if (hdr.includes('<!doctype') || hdr.includes('<html') || hdr.includes('bad gateway')) {
        throw new Error('Received HTML instead of media');
    }
    return buf;
}

/**
 * Download YouTube audio as MP3 buffer.
 * Tries each audio endpoint in speed order, skips Google CDN URLs (IP-locked).
 * Returns Buffer or null.
 */
export async function keithAudio(ytUrl) {
    for (const ep of AUDIO_ENDPOINTS) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, {
                params: { url: ytUrl },
                timeout: API_TIMEOUT
            });
            const d = res.data;
            if (!isOk(d) || typeof d?.result !== 'string' || !d.result.startsWith('http')) {
                console.log(`[keith/${ep}] no result URL`);
                continue;
            }
            if (d.result.includes('googlevideo.com')) {
                console.log(`[keith/${ep}] skipping IP-locked Google CDN URL`);
                continue;
            }
            console.log(`[keith/${ep}] got URL, downloading...`);
            const buf = await downloadBuffer(d.result, 120000);
            console.log(`[keith/${ep}] ✅ ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
            return buf;
        } catch (e) {
            console.log(`[keith/${ep}] error: ${e.message}`);
        }
    }
    console.log(`[keithAudio] ❌ all endpoints failed`);
    return null;
}

/**
 * Download YouTube video as MP4 buffer.
 * Tries each video endpoint in speed order, skips Google CDN URLs (IP-locked).
 * Returns Buffer or null.
 */
export async function keithVideo(ytUrl) {
    for (const ep of VIDEO_ENDPOINTS) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, {
                params: { url: ytUrl },
                timeout: API_TIMEOUT
            });
            const d = res.data;
            if (!isOk(d) || typeof d?.result !== 'string' || !d.result.startsWith('http')) {
                console.log(`[keith/${ep}] no result URL`);
                continue;
            }
            if (d.result.includes('googlevideo.com')) {
                console.log(`[keith/${ep}] skipping IP-locked Google CDN URL`);
                continue;
            }
            console.log(`[keith/${ep}] got URL, downloading...`);
            const buf = await downloadBuffer(d.result, 120000);
            console.log(`[keith/${ep}] ✅ ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
            return buf;
        } catch (e) {
            console.log(`[keith/${ep}] error: ${e.message}`);
        }
    }
    console.log(`[keithVideo] ❌ all endpoints failed`);
    return null;
}

/**
 * Legacy query helpers — kept for compatibility with commands that call
 * queryKeithAudio/queryKeithVideo to get a URL (not a buffer).
 * Returns { success, data: { download_url, title, quality, thumbnail }, endpoint }
 */
async function queryKeith(ytUrl, endpoints, isAudio = true) {
    for (const ep of endpoints) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, {
                params: { url: ytUrl },
                timeout: API_TIMEOUT
            });
            const d = res.data;
            if (!isOk(d) || typeof d?.result !== 'string' || !d.result.startsWith('http')) continue;
            if (d.result.includes('googlevideo.com')) continue;
            return {
                success: true,
                data: {
                    download_url: d.result,
                    title: '',
                    quality: isAudio ? '128kbps' : '360p',
                    thumbnail: ''
                },
                endpoint: `keith/${ep}`
            };
        } catch {}
    }
    return { success: false };
}

export function queryKeithAudio(ytUrl) { return queryKeith(ytUrl, AUDIO_ENDPOINTS, true); }
export function queryKeithVideo(ytUrl) { return queryKeith(ytUrl, VIDEO_ENDPOINTS, false); }

/**
 * Download a Facebook video as MP4 buffer.
 * Tries /fbdown then /fbdl endpoints on apiskeith.top.
 * Returns Buffer or null.
 */
export async function keithFacebook(fbUrl) {
    for (const ep of ['fbdown', 'fbdl']) {
        try {
            const res = await axios.get(`${BASE}/${ep}`, {
                params: { url: fbUrl },
                timeout: API_TIMEOUT
            });
            const d = res.data;
            if (!isOk(d)) { console.log(`[keith/${ep}] status not ok`); continue; }
            // result can be a direct URL string or nested object with hd/sd
            let dlUrl = null;
            if (typeof d.result === 'string' && d.result.startsWith('http')) {
                dlUrl = d.result;
            } else if (typeof d.result === 'object') {
                dlUrl = d.result?.hd || d.result?.sd || d.result?.url || null;
            }
            if (!dlUrl) { console.log(`[keith/${ep}] no usable URL in result`); continue; }
            if (dlUrl.includes('googlevideo.com')) { console.log(`[keith/${ep}] skipping IP-locked URL`); continue; }
            console.log(`[keith/${ep}] got URL, downloading...`);
            const buf = await downloadBuffer(dlUrl, 120000);
            console.log(`[keith/${ep}] ✅ ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
            return buf;
        } catch (e) {
            console.log(`[keith/${ep}] error: ${e.message}`);
        }
    }
    console.log(`[keithFacebook] ❌ all endpoints failed`);
    return null;
}
