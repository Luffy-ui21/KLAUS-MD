import axios from 'axios';

// ── Active AI providers ───────────────────────────────────────────────────────
// apis.xwolf.space is offline — disabled until it comes back.
// Chain: bk9.dev → cod3uchiha copilot → cod3uchiha gpt5
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT = 30000;
const HEADERS = { 'User-Agent': 'WolfBot/1.0', 'Accept': 'application/json' };

// ── WormGPT — uncensored.chat source ─────────────────────────────────────────
// Sends a pre-combined (system + user) prompt string to uncensored.chat.
// Falls back through two public endpoints if the first one is unavailable.
// ─────────────────────────────────────────────────────────────────────────────
export async function askUncensored(combined) {
    const sources = [
        // Primary: uncensored.chat Gradio predict endpoint
        {
            method: 'post',
            url: 'https://uncensored.chat/run/predict',
            data: { data: [combined, [], ''] },
            extract: (d) => d?.data?.[0],
        },
        // Fallback 1: query-param style
        {
            method: 'get',
            url: 'https://uncensored.chat/api/chat',
            params: { q: combined },
            extract: (d) => {
                if (typeof d === 'string') return d.trim() || null;
                return d?.result || d?.response || d?.text || d?.output || d?.reply || null;
            },
        },
        // Fallback 2: bk9 wormgpt endpoint
        {
            method: 'get',
            url: 'https://api.bk9.dev/ai/wormgpt',
            params: { q: combined },
            extract: (d) => d?.BK9 || d?.result || d?.response || null,
        },
    ];

    for (const src of sources) {
        try {
            const res = src.method === 'post'
                ? await axios.post(src.url, src.data, { timeout: TIMEOUT, headers: HEADERS })
                : await axios.get(src.url, { params: src.params, timeout: TIMEOUT, headers: HEADERS });
            const text = src.extract(res.data);
            if (text && typeof text === 'string' && text.trim().length > 2) return text.trim();
        } catch { /* try next */ }
    }

    throw new Error('WormGPT: all uncensored sources failed. Try again later.');
}

function extractText(data) {
    if (!data) return null;
    if (typeof data === 'string') {
        const t = data.trim();
        if (t.startsWith('<') || t.length < 2) return null;
        return t;
    }
    // bk9.dev returns { BK9: "..." }, cod3uchiha may return { result/response/text/... }
    for (const key of ['BK9', 'result', 'response', 'answer', 'text', 'output', 'message', 'content', 'reply']) {
        if (data[key] && typeof data[key] === 'string' && data[key].trim().length > 2) {
            return data[key].trim();
        }
    }
    return null;
}

export async function callAI(endpoint, query, overrideUrl = null) {
    const sources = overrideUrl
        ? [{ url: overrideUrl, params: { q: query } }]
        : [
            { url: 'https://api.bk9.dev/ai/gemini',              params: { q:    query } },
            { url: 'https://api.cod3uchiha.com/ai/copilot',       params: { text: query } },
            { url: 'https://api.cod3uchiha.com/ai/gpt5',          params: { text: query } },
        ];

    for (const { url, params } of sources) {
        try {
            const res  = await axios.get(url, { params, timeout: TIMEOUT, headers: HEADERS });
            const text = extractText(res.data);
            if (text) return text;
        } catch { /* try next */ }
    }

    throw new Error(`All AI providers failed for query: ${query.slice(0, 60)}`);
}
