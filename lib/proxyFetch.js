/**
 * Proxy-aware media downloader.
 *
 * Priority:
 *   1. BOT_PROXY_URL  (set in Replit Secrets)
 *   2. HTTPS_PROXY    (standard env var)
 *   3. HTTP_PROXY     (standard env var)
 *   4. Direct (no proxy)
 *
 * Transport priority:
 *   1. undici (Node 18+ built-in, better streaming) — loaded dynamically
 *   2. axios  — fallback for older Node / panels where undici isn't available
 */

import axios from 'axios';

const PROXY_URL = process.env.BOT_PROXY_URL
    || process.env.HTTPS_PROXY
    || process.env.HTTP_PROXY
    || null;

const MIN_BYTES = 50 * 1024;

// Try to load undici once at startup — silently skip if unavailable (Node 16, some panels)
let _undiciReady = false;
let _undiciFetch = null;
let _dispatcher  = null;

async function initUndici() {
    if (_undiciReady !== false) return _undiciReady;
    try {
        const undici = await import('undici');
        _undiciFetch = undici.fetch;
        if (PROXY_URL) {
            _dispatcher = new undici.ProxyAgent({
                uri: PROXY_URL,
                keepAliveTimeout: 30_000,
                keepAliveMaxTimeout: 60_000
            });
        } else {
            _dispatcher = new undici.Agent({
                keepAliveTimeout: 30_000,
                keepAliveMaxTimeout: 60_000,
                connect: { rejectUnauthorized: false }
            });
        }
        _undiciReady = true;
    } catch {
        _undiciReady = null; // null = unavailable
    }
    return _undiciReady;
}

// ── undici path ─────────────────────────────────────────────────────────────
async function fetchViaUndici(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await _undiciFetch(url, {
            dispatcher: _dispatcher,
            signal:     controller.signal,
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept':          '*/*',
                'Accept-Encoding': 'gzip, deflate, br'
            },
            redirect: 'follow'
        });
        if (!res.ok) {
            let body = '';
            try { body = await res.text(); } catch {}
            console.log(`[proxyFetch] HTTP ${res.status} for ${url.substring(0, 80)} | ${body.substring(0, 120)}`);
            return null;
        }
        const ct  = res.headers.get('content-type') || '';
        const arr = await res.arrayBuffer();
        const buf = Buffer.from(arr);
        if (buf.byteLength < MIN_BYTES) { console.log(`[proxyFetch] too small: ${buf.byteLength} bytes`); return null; }
        if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain')) {
            console.log(`[proxyFetch] bad content-type: ${ct}`); return null;
        }
        console.log(`[proxyFetch] ✅ ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB | ${ct}`);
        return buf;
    } catch (e) {
        if (e.name === 'AbortError') console.log(`[proxyFetch] timeout after ${timeout}ms`);
        else console.log(`[proxyFetch] error: ${e.message}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ── axios fallback path ──────────────────────────────────────────────────────
async function fetchViaAxios(url, timeout) {
    try {
        const opts = {
            responseType: 'arraybuffer',
            timeout,
            maxContentLength: 200 * 1024 * 1024,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept':     '*/*'
            }
        };
        if (PROXY_URL) {
            // axios proxy config from URL string
            try {
                const pu = new URL(PROXY_URL);
                opts.proxy = {
                    protocol: pu.protocol.replace(':', ''),
                    host:     pu.hostname,
                    port:     parseInt(pu.port) || 8080,
                    auth:     pu.username ? { username: pu.username, password: pu.password } : undefined
                };
            } catch {}
        }
        const res = await axios.get(url, opts);
        const buf = Buffer.from(res.data);
        if (buf.byteLength < MIN_BYTES) { console.log(`[proxyFetch/axios] too small: ${buf.byteLength} bytes`); return null; }
        const ct = res.headers['content-type'] || '';
        if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain')) {
            console.log(`[proxyFetch/axios] bad content-type: ${ct}`); return null;
        }
        console.log(`[proxyFetch/axios] ✅ ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB | ${ct}`);
        return buf;
    } catch (e) {
        console.log(`[proxyFetch/axios] error: ${e.message}`);
        return null;
    }
}

/**
 * Download a URL and return a validated Buffer, or null on failure.
 * @param {string} url      - The URL to download
 * @param {number} timeout  - Milliseconds (default 120 s)
 * @returns {Promise<Buffer|null>}
 */
export async function proxyFetch(url, timeout = 120_000) {
    const ready = await initUndici();
    if (ready) {
        return fetchViaUndici(url, timeout);
    }
    // undici unavailable (older Node / panel environments) — use axios
    console.log(`[proxyFetch] undici unavailable, using axios fallback`);
    return fetchViaAxios(url, timeout);
}

export const hasProxy = Boolean(PROXY_URL);
