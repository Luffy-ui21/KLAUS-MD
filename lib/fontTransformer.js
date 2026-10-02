// ─── Font character maps (only letters A-Z / a-z are replaced) ────────────

const GOTHIC_UPPER = [
    '𝕬','𝕭','𝕮','𝕯','𝕰','𝕱','𝕲','𝕳','𝕴','𝕵','𝕶','𝕷','𝕸',
    '𝕹','𝕺','𝕻','𝕼','𝕽','𝕾','𝕿','𝖀','𝖁','𝖂','𝖃','𝖄','𝖅'
];
const GOTHIC_LOWER = [
    '𝖆','𝖇','𝖈','𝖉','𝖊','𝖋','𝖌','𝖍','𝖎','𝖏','𝖐','𝖑','𝖒',
    '𝖓','𝖔','𝖕','𝖖','𝖗','𝖘','𝖙','𝖚','𝖛','𝖜','𝖝','𝖞','𝖟'
];
const CURSIVE_UPPER = [
    '𝒜','ℬ','𝒞','𝒟','ℰ','ℱ','𝒢','ℋ','ℐ','𝒥','𝒦','ℒ','ℳ',
    '𝒩','𝒪','𝒫','𝒬','ℛ','𝒮','𝒯','𝒰','𝒱','𝒲','𝒳','𝒴','𝒵'
];
const CURSIVE_LOWER = [
    '𝒶','𝒷','𝒸','𝒹','ℯ','𝒻','ℊ','𝒽','𝒾','𝒿','𝓀','𝓁','𝓂',
    '𝓃','ℴ','𝓅','𝓆','𝓇','𝓈','𝓉','𝓊','𝓋','𝓌','𝓍','𝓎','𝓏'
];
const MONO_UPPER = [
    '𝙰','𝙱','𝙲','𝙳','𝙴','𝙵','𝙶','𝙷','𝙸','𝙹','𝙺','𝙻','𝙼',
    '𝙽','𝙾','𝙿','𝚀','𝚁','𝚂','𝚃','𝚄','𝚅','𝚆','𝚇','𝚈','𝚉'
];
const MONO_LOWER = [
    '𝚊','𝚋','𝚌','𝚍','𝚎','𝚏','𝚐','𝚑','𝚒','𝚓','𝚔','𝚕','𝚖',
    '𝚗','𝚘','𝚙','𝚚','𝚛','𝚜','𝚝','𝚞','𝚟','𝚠','𝚡','𝚢','𝚣'
];
const BUBBLE_UPPER = [
    'Ⓐ','Ⓑ','Ⓒ','Ⓓ','Ⓔ','Ⓕ','Ⓖ','Ⓗ','Ⓘ','Ⓙ','Ⓚ','Ⓛ','Ⓜ',
    'Ⓝ','Ⓞ','Ⓟ','Ⓠ','Ⓡ','Ⓢ','Ⓣ','Ⓤ','Ⓥ','Ⓦ','Ⓧ','Ⓨ','Ⓩ'
];
const BUBBLE_LOWER = [
    'ⓐ','ⓑ','ⓒ','ⓓ','ⓔ','ⓕ','ⓖ','ⓗ','ⓘ','ⓙ','ⓚ','ⓛ','ⓜ',
    'ⓝ','ⓞ','ⓟ','ⓠ','ⓡ','ⓢ','ⓣ','ⓤ','ⓥ','ⓦ','ⓧ','ⓨ','ⓩ'
];
// Greek/aesthetic — same char for upper and lower (style has no case distinction)
const GREEK_CHARS = [
    'α','в','¢','∂','є','ƒ','g','н','ι','j','к','ℓ','м',
    'η','σ','ρ','q','я','ѕ','т','υ','ν','ω','χ','γ','z'
];

// Combining Long Stroke Overlay — applied after each char for strikethrough
const STRIKE_CHAR = '\u0336';
// Combining Tilde Overlay — applied after each char for glitch effect
const GLITCH_CHAR = '\u0334';

// ─── Build O(1) lookup maps ────────────────────────────────────────────────
function buildCharMap(upper, lower) {
    const map = new Map();
    for (let i = 0; i < 26; i++) {
        map.set(String.fromCharCode(65 + i), upper[i]);
        map.set(String.fromCharCode(97 + i), lower[i]);
    }
    return map;
}

const FONT_MAPS = {
    gothic:    buildCharMap(GOTHIC_UPPER,   GOTHIC_LOWER),
    cursive:   buildCharMap(CURSIVE_UPPER,  CURSIVE_LOWER),
    monospace: buildCharMap(MONO_UPPER,     MONO_LOWER),
    bubbles:   buildCharMap(BUBBLE_UPPER,   BUBBLE_LOWER),
    greek:     buildCharMap(GREEK_CHARS,    GREEK_CHARS),
};

// ─── URL regex (shared, reset before each use) ────────────────────────────
const URL_REGEX = /https?:\/\/[^\s\n\r<>"{}|\\^`\[\]]+/g;

// ─── Transform a single non-URL text segment ──────────────────────────────
function transformSegment(text, font) {
    if (font === 'strike' || font === 'glitch') {
        const overlay = font === 'glitch' ? GLITCH_CHAR : STRIKE_CHAR;
        let result = '';
        for (const char of text) {
            const code = char.codePointAt(0);
            if (code < 32) { result += char; continue; }
            if (code > 0x2FFF) { result += char; continue; }
            result += char + overlay;
        }
        return result;
    }

    const map = FONT_MAPS[font];
    if (!map) return text;

    let result = '';
    for (const char of text) {
        result += map.get(char) ?? char;
    }
    return result;
}

// ─── Public: apply font to a full message string, preserving URLs ──────────
export function applyFont(text, font) {
    if (!text || !font || font === 'default' || font === 'none' || font === 'reset') {
        return text;
    }

    URL_REGEX.lastIndex = 0;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = URL_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ t: text.slice(lastIndex, match.index), url: false });
        }
        parts.push({ t: match[0], url: true });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ t: text.slice(lastIndex), url: false });
    }

    return parts.map(p => p.url ? p.t : transformSegment(p.t, font)).join('');
}

// ─── Font catalogue (used by setfont command) ─────────────────────────────
export const AVAILABLE_FONTS = {
    gothic: {
        name: 'Gothic',
        description: 'Old English / Fraktur style',
        example: 'Hello Wolf → 𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖑𝖋'
    },
    cursive: {
        name: 'Cursive',
        description: 'Elegant handwriting / script style',
        example: 'Hello Wolf → ℋℯ𝓁𝓁ℴ 𝒲ℴ𝓁𝒻'
    },
    monospace: {
        name: 'Monospace',
        description: 'Fixed-width typewriter style',
        example: 'Hello Wolf → 𝙷𝚎𝚕𝚕𝚘 𝚆𝚘𝚕𝚏'
    },
    bubbles: {
        name: 'Bubbles',
        description: 'Circled letter bubble style',
        example: 'Hello Wolf → Ⓗⓔⓛⓛⓞ Ⓦⓞⓛⓕ'
    },
    greek: {
        name: 'Greek',
        description: 'Greek / Cyrillic aesthetic style',
        example: 'Hello Wolf → нєℓℓσ ωσℓƒ'
    },
    glitch: {
        name: 'Glitch',
        description: 'Tilde overlay glitch wave style',
        example: 'Hello Wolf → H̴e̴l̴l̴o̴ W̴o̴l̴f̴'
    },
    strike: {
        name: 'Strikethrough',
        description: 'Crossed-out text style',
        example: 'Hello Wolf → H̶e̶l̶l̶o̶ W̶o̶l̶f̶'
    },
};

export default { applyFont, AVAILABLE_FONTS };
