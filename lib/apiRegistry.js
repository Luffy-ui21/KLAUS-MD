import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_FILE = join(__dirname, '..', 'data', 'api_overrides.json');

// paramStyle controls how the full URL is assembled:
//   'gifted'  → <base>/<endpoint>?apikey=gifted&url=<encoded_param>   (giftedtech multi-endpoint)
//   'yturl'   → <base>?url=<encoded_param>                            (url-based, e.g. apiskeith download)
//   'keyword' → <base>?q=<encoded_param>                              (keyword/search query)
//   'raw'     → URL used exactly as stored, no params injected

export const API_REGISTRY = {
    ytmp3:        { label: 'YouTube MP3',           category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    ytmp4:        { label: 'YouTube MP4',           category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    yta3:         { label: 'YouTube Audio 3',       category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    dlmp3:        { label: 'Download MP3',          category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    dlmp4:        { label: 'Download MP4',          category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    mp4:          { label: 'MP4 Download',          category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    song:         { label: 'Song Search & DL',      category: 'music',       paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    play:         { label: 'Play Music',            category: 'music',       paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    songdl:       { label: 'Song Download',         category: 'music',       paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    viddl:        { label: 'Video Download',        category: 'music',       paramStyle: 'gifted',  testQuery: 'https://youtu.be/dQw4w9WgXcQ', url: 'https://api.giftedtech.co.ke/api/download' },
    spotify:      { label: 'Spotify Download',      category: 'music',       paramStyle: 'gifted',  testQuery: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', url: 'https://api.giftedtech.co.ke/api/download/spotifydlv3' },
    instagram:    { label: 'Instagram Download',    category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://www.instagram.com/p/test/', url: 'https://api.giftedtech.co.ke/api/download/instadlv2' },
    mediafire:    { label: 'MediaFire Download',    category: 'downloaders', paramStyle: 'gifted',  testQuery: 'https://www.mediafire.com/file/test', url: 'https://api.giftedtech.co.ke/api/download/mediafire' },
    apk:          { label: 'APK Download',          category: 'downloaders', paramStyle: 'keyword', testQuery: 'whatsapp',                          url: 'https://api.giftedtech.co.ke/api/download/apkdl' },
    gitstalk:     { label: 'GitHub Stalk',          category: 'stalker',     paramStyle: 'keyword', testQuery: 'torvalds',                          url: 'https://api.giftedtech.co.ke/api/stalk/gitstalk' },
    igstalk:      { label: 'Instagram Stalk',       category: 'stalker',     paramStyle: 'keyword', testQuery: 'instagram',                         url: 'https://api.giftedtech.co.ke/api/stalk/igstalk' },
    ipstalk:      { label: 'IP Stalk',              category: 'stalker',     paramStyle: 'keyword', testQuery: '8.8.8.8',                           url: 'https://api.giftedtech.co.ke/api/stalk/ipstalk' },
    npmstalk:     { label: 'NPM Stalk',             category: 'stalker',     paramStyle: 'keyword', testQuery: 'axios',                             url: 'https://api.giftedtech.co.ke/api/stalk/npmstalk' },
    twitterstalk: { label: 'Twitter Stalk',         category: 'stalker',     paramStyle: 'keyword', testQuery: 'elonmusk',                          url: 'https://api.giftedtech.co.ke/api/stalk/twitterstalk' },
    wachannel:    { label: 'WhatsApp Channel',      category: 'stalker',     paramStyle: 'keyword', testQuery: 'news',                              url: 'https://api.giftedtech.co.ke/api/stalk/wachannel' },
    gpt:          { label: 'ChatGPT',               category: 'ai',          paramStyle: 'xwolf',   testQuery: 'hello',                             url: 'https://apis.xwolf.space/api/ai/gpt',      fallbackUrl: 'https://apis-e3qq.onrender.com/api/ai/gpt' },
    gemini:       { label: 'Gemini AI',             category: 'ai',          paramStyle: 'xwolf',   testQuery: 'hello',                             url: 'https://apis.xwolf.space/api/ai/gemini',   fallbackUrl: 'https://apis-e3qq.onrender.com/api/ai/gemini' },
    claude:       { label: 'Claude AI',             category: 'ai',          paramStyle: 'xwolf',   testQuery: 'hello',                             url: 'https://apis.xwolf.space/api/ai/claude',   fallbackUrl: 'https://apis-e3qq.onrender.com/api/ai/claude' },
    deepseek:     { label: 'DeepSeek AI',           category: 'ai',          paramStyle: 'xwolf',   testQuery: 'hello',                             url: 'https://apis.xwolf.space/api/ai/deepseek', fallbackUrl: 'https://apis-e3qq.onrender.com/api/ai/deepseek' },
    mistral:      { label: 'Mistral AI',            category: 'ai',          paramStyle: 'xwolf',   testQuery: 'hello',                             url: 'https://apis.xwolf.space/api/ai/mistral',  fallbackUrl: 'https://apis-e3qq.onrender.com/api/ai/mistral' },
    groq:         { label: 'Groq AI',               category: 'ai',          paramStyle: 'xwolf',   testQuery: 'hello',                             url: 'https://apis.xwolf.space/api/ai/groq',     fallbackUrl: 'https://apis-e3qq.onrender.com/api/ai/groq' },
    grok:         { label: 'Grok AI',               category: 'ai',          paramStyle: 'keyword', testQuery: 'hello',                             url: 'https://apiskeith.vercel.app/ai/grok' },
    blackbox:     { label: 'BlackBox AI',           category: 'ai',          paramStyle: 'keyword', testQuery: 'hello',                             url: 'https://apiskeith.vercel.app/ai/blackbox' },
    copilot:      { label: 'Copilot AI',            category: 'ai',          paramStyle: 'keyword', testQuery: 'hello',                             url: 'https://iamtkm.vercel.app/ai/copilot' },
    flux:         { label: 'Flux Image AI',         category: 'ai',          paramStyle: 'keyword', testQuery: 'a sunset over mountains',            url: 'https://apiskeith.vercel.app/ai/flux' },
    metai:        { label: 'MetAI',                 category: 'ai',          paramStyle: 'keyword', testQuery: 'hello',                             url: 'https://apiskeith.vercel.app/ai/metai' },
    remini:       { label: 'Remini HD Enhance',     category: 'tools',       paramStyle: 'yturl',   testQuery: 'https://example.com/photo.jpg',     url: 'https://api.elrayyxml.web.id/api/tools/remini' },
    removebg:     { label: 'Remove Background',     category: 'tools',       paramStyle: 'yturl',   testQuery: 'https://example.com/photo.jpg',     url: 'https://apiskeith.vercel.app/ai/removebg' },
    shazam:       { label: 'Shazam Song ID',        category: 'tools',       paramStyle: 'yturl',   testQuery: 'https://example.com/audio.mp3',     url: 'https://api.ryzendesu.vip/api/ai/shazam' },
    bbc:          { label: 'BBC News',              category: 'news',        paramStyle: 'raw',     testQuery: '',                                  url: 'https://www.apiskeith.top/news/bbc' },
    kbc:          { label: 'KBC News',              category: 'news',        paramStyle: 'raw',     testQuery: '',                                  url: 'https://www.apiskeith.top/news/kbc' },
    ntv:          { label: 'NTV News',              category: 'news',        paramStyle: 'raw',     testQuery: '',                                  url: 'https://www.apiskeith.top/news/ntv' },
    citizen:      { label: 'Citizen News',          category: 'news',        paramStyle: 'raw',     testQuery: '',                                  url: 'https://www.apiskeith.top/news/citizen' },
};

// ─── URL builder ────────────────────────────────────────────────────────────
// Assembles the full testable/callable URL from a base + param + style.
// Commands and fetchapi both call this for consistency.
export function buildApiUrl(cmdName, param) {
    const cmd      = cmdName.toLowerCase();
    const fullOvs  = globalThis._apiOverridesFull || loadOverrides();
    const override = fullOvs[cmd];
    const entry    = API_REGISTRY[cmd];
    if (!entry && !override) return null;

    const ovUrl = override ? (typeof override === 'string' ? override : override.url) : null;
    const base  = ovUrl || entry?.url || '';
    const style = (override && typeof override !== 'string' ? override.paramStyle : null)
                  || entry?.paramStyle || 'raw';
    const query = param || entry?.testQuery || '';

    return assembleUrl(base, style, query);
}

// Pure helper — no registry reads
export function assembleUrl(base, style, param) {
    if (!base) return null;
    const encoded = encodeURIComponent(param || '');
    switch (style) {
        case 'gifted':
            // giftedtech: base?apikey=gifted&url=<encoded>
            return `${base}?apikey=gifted&url=${encoded}`;
        case 'yturl':
            // url-param style: base?url=<encoded>
            return `${base}?url=${encoded}`;
        case 'keyword':
            // keyword/search: base?q=<encoded>
            return `${base}?q=${encoded}`;
        case 'xwolf': {
            // xwolf API: base?q=<encoded>&key=<api_key>
            const _xkey = process.env.XWOLF_API_KEY || process.env.XWOLF_BOT_KEY || 'wxa_u_xwk7sch6xj';
            return `${base}?q=${encoded}&key=${_xkey}`;
        }
        case 'raw':
        default:
            return base;
    }
}

// Auto-detect paramStyle from a URL string
export function detectParamStyle(url) {
    if (!url) return 'raw';
    if (/apikey=gifted/i.test(url))                        return 'gifted';
    if (/[?&]url=/i.test(url))                             return 'yturl';
    if (/[?&]q=/i.test(url))                               return 'keyword';
    return 'raw';
}

export const PARAM_STYLE_LABELS = {
    gifted:  'gifted  → ?apikey=gifted&url=<encoded_url>',
    yturl:   'yturl   → ?url=<encoded_url>',
    keyword: 'keyword → ?q=<encoded_keyword>',
    raw:     'raw     → URL used as-is (no params)',
};

// ─── Persistence ────────────────────────────────────────────────────────────
function loadOverrides() {
    try {
        if (existsSync(OVERRIDES_FILE)) {
            const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'));
            // Migrate old format (plain string) to new format ({ url, paramStyle })
            const migrated = {};
            for (const [k, v] of Object.entries(raw)) {
                if (typeof v === 'string') {
                    migrated[k] = { url: v, paramStyle: detectParamStyle(v) };
                } else {
                    migrated[k] = v;
                }
            }
            return migrated;
        }
    } catch {}
    return {};
}

function saveOverrides(overrides) {
    try {
        const dir = join(__dirname, '..', 'data');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2));
        // Full format for the smart URL builder
        globalThis._apiOverridesFull = overrides;
        // Flat URL-string format for backward compat (commands read this directly)
        const flat = {};
        for (const [k, v] of Object.entries(overrides)) {
            flat[k] = typeof v === 'string' ? v : v.url;
        }
        globalThis._apiOverrides = flat;
        return true;
    } catch {
        return false;
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function getApiUrl(cmdName) {
    const cmd = cmdName.toLowerCase();
    const overrides = globalThis._apiOverrides || loadOverrides();
    const ov = overrides[cmd];
    if (ov) return (typeof ov === 'string') ? ov : ov.url;
    return API_REGISTRY[cmd]?.url || null;
}

export function getCommandInfo(cmdName) {
    const cmd   = cmdName.toLowerCase();
    const entry = API_REGISTRY[cmd];
    if (!entry) return null;
    const fullOvs = globalThis._apiOverridesFull || loadOverrides();
    const ov      = fullOvs[cmd] || null;
    const ovUrl   = ov ? (typeof ov === 'string' ? ov : ov.url) : null;
    const ovStyle = ov ? (typeof ov === 'string' ? detectParamStyle(ov) : ov.paramStyle) : null;
    return {
        cmd,
        label:        entry.label,
        category:     entry.category,
        defaultUrl:   entry.url,
        currentUrl:   ovUrl || entry.url,
        paramStyle:   ovStyle || entry.paramStyle || 'raw',
        testQuery:    entry.testQuery || '',
        isOverridden: !!ov,
    };
}

export function setCommandApi(cmdName, newUrl, paramStyle) {
    const cmd = cmdName.toLowerCase();
    if (!API_REGISTRY[cmd]) return false;
    const overrides = loadOverrides();
    const style = paramStyle || detectParamStyle(newUrl);
    overrides[cmd] = { url: newUrl, paramStyle: style };
    return saveOverrides(overrides);
}

export function resetCommandApi(cmdName) {
    const cmd = cmdName.toLowerCase();
    const overrides = loadOverrides();
    delete overrides[cmd];
    return saveOverrides(overrides);
}

export function getAllApiCommands() {
    return Object.entries(API_REGISTRY).map(([cmd, info]) => ({
        cmd,
        label:    info.label,
        category: info.category,
    }));
}

// Populate both globals on module load
(function _initApiOverrides() {
    const full = loadOverrides();
    globalThis._apiOverridesFull = full;
    const flat = {};
    for (const [k, v] of Object.entries(full)) {
        flat[k] = typeof v === 'string' ? v : v.url;
    }
    globalThis._apiOverrides = flat;
})();
