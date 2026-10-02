import { getConfigSync, setConfigSync } from './database.js';

const DEFAULT_EMOJI = '';
const KEY_PREFIX = 'user_emoji:';

export function getEmoji(jid) {
    if (!jid) return DEFAULT_EMOJI;
    const num = jid.split('@')[0].split(':')[0];
    try {
        const cfg = getConfigSync(`${KEY_PREFIX}${num}`, {});
        return cfg?.emoji || DEFAULT_EMOJI;
    } catch {
        return DEFAULT_EMOJI;
    }
}

export function setEmoji(jid, emoji) {
    const num = jid.split('@')[0].split(':')[0];
    setConfigSync(`${KEY_PREFIX}${num}`, { emoji });
}

export function resetEmoji(jid) {
    const num = jid.split('@')[0].split(':')[0];
    setConfigSync(`${KEY_PREFIX}${num}`, { emoji: DEFAULT_EMOJI });
}
