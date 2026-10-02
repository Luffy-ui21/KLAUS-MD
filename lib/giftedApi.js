/**
 * lib/giftedApi.js
 * Wrappers for gifted.co.ke APIs used by song/play commands.
 *
 *  Search  → yts.gifted.co.ke?q=<query>
 *  Audio   → mcow.gifted.co.ke  (placeholder — endpoint TBD)
 */

import axios from 'axios';
import { sigLog } from './sigLog.js';

const YTS_BASE  = 'https://yts.gifted.co.ke';
const MCOW_BASE = 'https://mcow.gifted.co.ke';

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Search YouTube via yts.gifted.co.ke.
 * Returns a normalized array: [{ id, title, channelTitle, duration, thumbnail }]
 * Compatible with the shape used by song.js / play.js.
 */
export async function giftedYtsSearch(query, limit = 5) {
    try {
        const res = await axios.get(YTS_BASE, {
            params: { q: query },
            timeout: 12000
        });
        const videos = res.data?.videos;
        if (!Array.isArray(videos) || !videos.length) return [];

        return videos
            .filter(v => v.id && !v.isLive)
            .slice(0, limit)
            .map(v => ({
                id:           v.id,
                title:        v.name        || query,
                channelTitle: v.author      || '',
                duration:     v.duration    || '',
                thumbnail:    v.thumbnail   || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
                views:        v.views       || 0,
                published:    v.published   || ''
            }));
    } catch (e) {
        sigLog('❌', 'giftedYts', 'Search failed', { Error: e.message }, 'red');
        return [];
    }
}

// ── Audio download via mcow ───────────────────────────────────────────────────

/**
 * Download YouTube audio via mcow.gifted.co.ke.
 *
 * ⚠️  mcow.gifted.co.ke currently returns 404 for all tested paths.
 *     This function is a ready-made placeholder — update MCOW_PATH / params
 *     below once the correct endpoint is confirmed, then it will slot straight
 *     into audioDownloader.js's fallback chain.
 *
 * Expected response shape (adjust when endpoint is known):
 *   { success: true, result: { download_url: "https://..." } }
 *
 * Returns Buffer or null.
 */
export async function mcowDownloadAudio(ytUrl) {
    // Endpoint: https://mcow.gifted.co.ke/api/yta?url=<youtube_url>
    // Response: { success: true, result: { download_url, title, thumbnail } }
    try {
        sigLog('🌐', 'mcow/audio', 'Attempting download via /api/yta…');
        const res = await axios.get(`${MCOW_BASE}/api/yta`, {
            params:  { url: ytUrl },
            timeout: 30000
        });
        const d = res.data;
        if (!d?.success) {
            sigLog('⚠️', 'mcow/audio', 'Response not success', { body: JSON.stringify(d).slice(0, 80) }, 'yellow');
            return null;
        }
        const dlUrl = d.result?.download_url || d.download_url || d.url;
        if (!dlUrl) {
            sigLog('⚠️', 'mcow/audio', 'No download_url in response', null, 'yellow');
            return null;
        }
        const dlRes = await axios.get(dlUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buf = Buffer.from(dlRes.data);
        if (!buf || buf.length < 50000) throw new Error(`buffer too small (${buf?.length ?? 0} bytes)`);
        const hdr = buf.slice(0, 60).toString('utf8').toLowerCase();
        if (hdr.includes('<!doctype') || hdr.includes('<html')) throw new Error('server returned HTML instead of audio');
        sigLog('✅', 'mcow/audio', 'Downloaded', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
        return buf;
    } catch (e) {
        sigLog('⚠️', 'mcow/audio', 'Failed', { Error: e.message }, 'yellow');
        return null;
    }
}
