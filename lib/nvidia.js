/**
 * lib/nvidia.js
 * ─────────────────────────────────────────────────────────────
 * Single point of integration for NVIDIA NIM (build.nvidia.com).
 *
 * • Pulls the API key from a remote JSON endpoint (cached in memory).
 * • Exposes `chat()`     — simple prompt -> text helper.
 * • Exposes `chatRaw()`  — full messages array + custom params.
 * • Exposes `vision()`   — multimodal (text + image) helper.
 *
 * If NVIDIA ever goes down, just stop importing this file from your
 * commands — nothing else in the bot touches it.
 * ─────────────────────────────────────────────────────────────
 */

const KEY_URL          = 'https://7-w.vercel.app/nvidia.json';
const API_BASE         = 'https://integrate.api.nvidia.com/v1';     // chat / embeddings
const IMAGE_API_BASE   = 'https://ai.api.nvidia.com/v1/genai';      // image generation (FLUX, SDXL, etc.)
// gemma-4-31b-it is listed but not yet served via the API (requests hang).
// Sticking with the latest model that actually responds today.
const DEFAULT_MODEL    = 'google/gemma-3-27b-it';
const KEY_TTL_MS       = 30 * 60 * 1000;   // refetch key every 30 min
const REQUEST_TIMEOUT  = 90 * 1000;        // 90 s default — big reasoning models need it

let _cachedKey      = null;
let _cachedKeyAt    = 0;

/* ───────────────────────── key handling ──────────────────────── */

async function fetchKey(force = false) {
    if (!force && _cachedKey && (Date.now() - _cachedKeyAt) < KEY_TTL_MS) {
        return _cachedKey;
    }

    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 15000);
    try {
        const res = await fetch(KEY_URL, {
            signal:  ctrl.signal,
            headers: { 'User-Agent': 'WolfBot/1.0', 'Accept': 'application/json' },
            cache:   'no-store'
        });
        if (!res.ok) throw new Error(`Key endpoint HTTP ${res.status}`);
        const data = await res.json();
        const key  = data?.NVIDIA_API_KEY || data?.key || data?.apiKey;
        if (!key || typeof key !== 'string' || !key.startsWith('nvapi-')) {
            throw new Error('Key endpoint returned no usable NVIDIA_API_KEY');
        }
        _cachedKey   = key;
        _cachedKeyAt = Date.now();
        return key;
    } finally {
        clearTimeout(t);
    }
}

/** Force a fresh key fetch on the next request (e.g. after 401). */
export function invalidateKey() {
    _cachedKey   = null;
    _cachedKeyAt = 0;
}

/* ───────────────────────── core request ──────────────────────── */

async function postChat(body, { retried = false, timeoutMs = REQUEST_TIMEOUT } = {}) {
    const key  = await fetchKey();
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(`${API_BASE}/chat/completions`, {
            method:  'POST',
            signal:  ctrl.signal,
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept':        'application/json',
                'Content-Type':  'application/json',
                'User-Agent':    'WolfBot/1.0'
            },
            body: JSON.stringify(body)
        });
    } finally {
        clearTimeout(t);
    }

    // Auth expired? Refresh key once and retry.
    if (res.status === 401 && !retried) {
        invalidateKey();
        return postChat(body, { retried: true, timeoutMs });
    }

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`NVIDIA API ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
    }

    return res.json();
}

/* ───────────────────────── public helpers ────────────────────── */

/**
 * Send a single user prompt, return assistant text.
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.model]
 * @param {string} [opts.system]    optional system instruction
 * @param {number} [opts.temperature=0.6]
 * @param {number} [opts.topP=0.95]
 * @param {number} [opts.maxTokens=1024]
 */
export async function chat(prompt, opts = {}) {
    if (!prompt || !prompt.trim()) throw new Error('Empty prompt');

    const messages = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    const data = await postChat({
        model:       opts.model       || DEFAULT_MODEL,
        messages,
        temperature: opts.temperature ?? 0.6,
        top_p:       opts.topP        ?? 0.95,
        max_tokens:  opts.maxTokens   ?? 1024,
        stream:      false
    }, { timeoutMs: opts.timeoutMs });

    const msg  = data?.choices?.[0]?.message;
    const text = (msg?.content && msg.content.trim())
        ? msg.content
        : msg?.reasoning_content;          // reasoning models put answer here
    if (!text || !text.trim()) throw new Error('NVIDIA returned an empty response');
    return text.trim();
}

/**
 * Full-control variant — caller supplies the `messages` array
 * and any extra parameters (top_k, frequency_penalty, etc.).
 */
export async function chatRaw(messages, opts = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('messages[] required');
    }
    const data = await postChat({
        model:       opts.model       || DEFAULT_MODEL,
        messages,
        temperature: opts.temperature ?? 0.6,
        top_p:       opts.topP        ?? 0.95,
        max_tokens:  opts.maxTokens   ?? 1024,
        stream:      false,
        ...opts.extra
    }, { timeoutMs: opts.timeoutMs });
    return data;
}

/**
 * Multimodal helper — Gemma 4 supports image input.
 * @param {string} prompt
 * @param {string|Buffer} image  data URL, https URL, or raw Buffer
 */
export async function vision(prompt, image, opts = {}) {
    let imageUrl;
    if (Buffer.isBuffer(image)) {
        imageUrl = `data:image/jpeg;base64,${image.toString('base64')}`;
    } else if (typeof image === 'string') {
        imageUrl = image;
    } else {
        throw new Error('image must be a Buffer, data URL, or https URL');
    }

    const messages = [{
        role: 'user',
        content: [
            { type: 'text',      text: prompt || 'Describe this image.' },
            { type: 'image_url', image_url: { url: imageUrl } }
        ]
    }];

    const data = await chatRaw(messages, opts);
    const msg  = data?.choices?.[0]?.message;
    const text = (msg?.content && msg.content.trim())
        ? msg.content
        : msg?.reasoning_content;
    if (!text || !text.trim()) throw new Error('NVIDIA returned an empty response');
    return text.trim();
}

/**
 * Multi-image variant of vision() — send multiple images in a single
 * user message. Useful for video-frame analysis or image comparison.
 * @param {string} prompt
 * @param {Array<Buffer|string>} images   each item can be a Buffer, data URL, or https URL
 */
export async function visionMulti(prompt, images, opts = {}) {
    if (!Array.isArray(images) || images.length === 0) {
        throw new Error('images[] required and must be non-empty');
    }

    const content = [{ type: 'text', text: prompt || 'Describe these images.' }];
    for (const img of images) {
        let imageUrl;
        if (Buffer.isBuffer(img)) {
            imageUrl = `data:image/jpeg;base64,${img.toString('base64')}`;
        } else if (typeof img === 'string') {
            imageUrl = img;
        } else {
            throw new Error('each image must be a Buffer, data URL, or https URL');
        }
        content.push({ type: 'image_url', image_url: { url: imageUrl } });
    }

    const data = await chatRaw([{ role: 'user', content }], opts);
    const msg  = data?.choices?.[0]?.message;
    const text = (msg?.content && msg.content.trim())
        ? msg.content
        : msg?.reasoning_content;
    if (!text || !text.trim()) throw new Error('NVIDIA returned an empty response');
    return text.trim();
}

/* ───────────────────────── image generation ─────────────────── */

/**
 * Generate an image from a text prompt via NVIDIA hosted models
 * (FLUX, SDXL, etc.). Returns a raw Buffer (JPEG/PNG) ready to send.
 *
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.model='black-forest-labs/flux.1-dev']
 * @param {number} [opts.width=1024]
 * @param {number} [opts.height=1024]
 * @param {number} [opts.steps=30]
 * @param {number} [opts.cfgScale=3.5]
 * @param {number} [opts.seed]            integer; omitted -> random
 * @param {number} [opts.timeoutMs=120000]
 */
export async function image(prompt, opts = {}) {
    if (!prompt || !prompt.trim()) throw new Error('Empty prompt');
    const model      = opts.model     || 'black-forest-labs/flux.1-dev';
    const timeoutMs  = opts.timeoutMs ?? 120000;
    const seed       = Number.isInteger(opts.seed) ? opts.seed : Math.floor(Math.random() * 2_147_483_647);

    // ── Model-aware defaults ──
    // FLUX.2 Klein is a distilled fast model: max 4 steps, cfg_scale ≤ 1.
    const isKlein = /klein/i.test(model);
    const defSteps    = isKlein ? 4   : 30;
    const defCfgScale = isKlein ? 1   : 3.5;

    const body = {
        prompt,
        width:     opts.width    ?? 1024,
        height:    opts.height   ?? 1024,
        steps:     opts.steps    ?? defSteps,
        cfg_scale: opts.cfgScale ?? defCfgScale,
        seed
    };
    if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio;

    const key  = await fetchKey();
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(`${IMAGE_API_BASE}/${model}`, {
            method:  'POST',
            signal:  ctrl.signal,
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept':        'application/json',
                'Content-Type':  'application/json',
                'User-Agent':    'WolfBot/1.0'
            },
            body: JSON.stringify(body)
        });
    } finally {
        clearTimeout(t);
    }

    if (res.status === 401) {
        invalidateKey();
        throw new Error('NVIDIA API 401 — key invalidated, please retry');
    }
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`NVIDIA image API ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
    }

    const data    = await res.json();
    const b64     = data?.artifacts?.[0]?.base64 || data?.image || data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('NVIDIA image API returned no image data');
    return Buffer.from(b64, 'base64');
}

/* ───────────────────────── asset upload (for image-to-image) ──── */

const ASSETS_API = 'https://api.nvcf.nvidia.com/v2/nvcf/assets';

/** Detect image MIME from buffer magic bytes. Defaults to image/jpeg. */
function detectImageMime(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 12) return 'image/jpeg';
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
        && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
    return 'image/jpeg';
}

/**
 * Upload a buffer to NVIDIA's NVCF asset store and return the asset ID.
 * Required for image-to-image models (FLUX.1 Kontext dev, etc.) that
 * cannot accept inline base64 in the request body.
 */
async function uploadAsset(buffer, contentType = 'image/jpeg', description = 'input image') {
    if (!Buffer.isBuffer(buffer)) throw new Error('uploadAsset: buffer required');
    const key = await fetchKey();

    console.log(`[NVCF-ASSET] Reserving slot: contentType=${contentType}, size=${buffer.length}b`);

    // ── 1) Reserve an asset ID + signed PUT URL ──
    const reserveRes = await fetch(ASSETS_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type':  'application/json',
            'Accept':        'application/json',
            'User-Agent':    'WolfBot/1.0'
        },
        body: JSON.stringify({ contentType, description })
    });
    if (!reserveRes.ok) {
        const errText = await reserveRes.text().catch(() => '');
        throw new Error(`NVCF asset reserve ${reserveRes.status}: ${errText.slice(0, 200) || reserveRes.statusText}`);
    }
    const reserveData = await reserveRes.json();
    console.log(`[NVCF-ASSET] Reserve response keys: ${Object.keys(reserveData).join(',')}`);
    const { uploadUrl, assetId } = reserveData;
    if (!uploadUrl || !assetId) throw new Error(`NVCF asset reserve missing fields: ${JSON.stringify(reserveData).slice(0, 200)}`);
    console.log(`[NVCF-ASSET] Reserved assetId=${assetId}`);

    // ── 2) PUT the bytes to the signed URL ──
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type':                       contentType,
            'x-amz-meta-nvcf-asset-description':  description
        },
        body: buffer
    });
    console.log(`[NVCF-ASSET] PUT status=${putRes.status}`);
    if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        throw new Error(`NVCF asset upload ${putRes.status}: ${errText.slice(0, 200) || putRes.statusText}`);
    }

    return assetId;
}

/* ───────────────────────── image editing ─────────────────────── */

/**
 * Edit an existing image using a text prompt via FLUX.1 Kontext dev
 * (image-to-image instruction-following). Returns a raw Buffer ready to send.
 *
 * NVIDIA's flux-kontext API requires the input image to be uploaded
 * first to the NVCF asset store and referenced by asset ID — inline
 * base64 is rejected (HTTP 422 "Expected: example_id, got: base64").
 *
 * @param {string} prompt              edit instruction
 * @param {Buffer} image               input image as a Buffer
 * @param {object} [opts]
 * @param {string} [opts.model='black-forest-labs/flux.1-kontext-dev']
 * @param {number} [opts.steps=30]
 * @param {number} [opts.cfgScale=2.5]
 * @param {number} [opts.seed]                 integer; omitted -> random
 * @param {string} [opts.aspectRatio='match_input_image']
 * @param {string} [opts.contentType='image/jpeg']
 * @param {number} [opts.timeoutMs=180000]
 */
export async function imageEdit(prompt, image, opts = {}) {
    if (!prompt || !prompt.trim()) throw new Error('Empty prompt');
    if (!Buffer.isBuffer(image))   throw new Error('image must be a Buffer');

    const model       = opts.model       || 'black-forest-labs/flux.1-kontext-dev';
    const timeoutMs   = opts.timeoutMs   ?? 180000;
    const contentType = opts.contentType || detectImageMime(image);
    const seed        = Number.isInteger(opts.seed) ? opts.seed : Math.floor(Math.random() * 2_147_483_647);

    console.log(`[FLUX-KONTEXT] Detected MIME=${contentType}, prompt="${prompt.slice(0, 60)}"`);

    // ── 1) Upload the image to NVCF asset store ──
    const assetId = await uploadAsset(image, contentType, 'flux-kontext input');

    // ── 2) Call the generation endpoint, referencing the asset ──
    // Bare `data:<mime>;example_id,<UUID>` is the only form the validator accepts.
    // Keep the body minimal — extra fields like aspect_ratio cause server-side 500s.
    const body = {
        prompt,
        image: `data:${contentType};example_id,${assetId}`
    };
    if (opts.cfgScale     != null) body.cfg_scale    = opts.cfgScale;
    if (opts.steps        != null) body.steps        = opts.steps;
    if (opts.seed         != null) body.seed         = seed;
    if (opts.aspectRatio)          body.aspect_ratio = opts.aspectRatio;

    console.log(`[FLUX-KONTEXT] Body: ${JSON.stringify({ ...body, image: body.image }).slice(0, 300)}`);

    const key  = await fetchKey();
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(`${IMAGE_API_BASE}/${model}`, {
            method:  'POST',
            signal:  ctrl.signal,
            headers: {
                'Authorization':               `Bearer ${key}`,
                'Accept':                      'application/json',
                'Content-Type':                'application/json',
                'NVCF-INPUT-ASSET-REFERENCES': assetId,
                'User-Agent':                  'WolfBot/1.0'
            },
            body: JSON.stringify(body)
        });
    } finally {
        clearTimeout(t);
    }

    console.log(`[FLUX-KONTEXT] Generation status=${res.status}`);

    if (res.status === 401) {
        invalidateKey();
        throw new Error('NVIDIA API 401 — key invalidated, please retry');
    }
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log(`[FLUX-KONTEXT] Error response body: ${errText.slice(0, 500)}`);
        throw new Error(`NVIDIA flux-kontext API ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
    }

    const data = await res.json();
    console.log(`[FLUX-KONTEXT] Success response keys: ${Object.keys(data).join(',')}`);
    const b64  = data?.artifacts?.[0]?.base64
              || data?.image
              || data?.data?.[0]?.b64_json
              || data?.images?.[0];
    if (!b64) throw new Error(`NVIDIA flux-kontext returned no image. Response: ${JSON.stringify(data).slice(0, 300)}`);
    return Buffer.from(b64, 'base64');
}

/* ───────────────────────── meta ──────────────────────────────── */

export const NVIDIA = {
    KEY_URL,
    API_BASE,
    IMAGE_API_BASE,
    DEFAULT_MODEL
};

export default { chat, chatRaw, vision, visionMulti, image, imageEdit, invalidateKey, NVIDIA };
