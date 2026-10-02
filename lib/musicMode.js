// ====== lib/musicMode.js ======
// Manages "Music Mode" — a feature where the bot automatically sends audio
// clips to any chat when the owner triggers it.
//
// How it works:
//   • A list of song search queries (or direct audio URLs) is stored in
//     data/musicmode.json.
//   • When Music Mode is active, sendMusicClip() picks a random entry from
//     that list, fetches a 30-second preview from the iTunes Search API
//     (or downloads the direct URL), and sends it as a WhatsApp audio message.
//   • The owner can add/remove songs and toggle the mode via bot commands.
//
// State is persisted in data/musicmode.json so it survives restarts.
// global.MUSIC_MODE is kept in sync for fast in-process reads.

import axios from 'axios';
import db from './database.js';

const DB_KEY = 'music_mode';

// ── Default song list ──────────────────────────────────────────────────────
// Each entry is a search query sent to the iTunes Search API.
// iTunes returns official 30-second previews with full vocals.
// The list is used as a fallback when the owner hasn't customised it.
const DEFAULT_SONGS = [
    // Alan Walker
    'alan walker faded',
    'alan walker alone',
    'alan walker darkside',
    'alan walker all falls down',
    'alan walker on my way',
    'alan walker different world',
    'alan walker sing me to sleep',
    'alan walker spectre',
    // NF
    'NF the search',
    'NF mansion',
    'NF leave me alone',
    'NF paralyzed',
    'NF got you on my mind',
    'NF remember this',
    'NF therapy session',
    // Similar vibes
    'kygo stole the show',
    'imagine dragons demons',
    'imagine dragons believer',
    'twenty one pilots stressed out',
    'twenty one pilots ride',
    'the chainsmokers closer',
    'marshmello alone',
    'marshmello happier',
    'billie eilish bad guy',
    'post malone circles',
    'juice wrld lucid dreams',
    'juice wrld legends never die',
    'xxxtentacion SAD',
    'xxxtentacion changes',
    'lil peep star shopping',
    'khalid young dumb broke',
    'khalid better',
    'gnash i hate u i love u',
];

// ── DB helpers ─────────────────────────────────────────────────────────────

function _load() {
    const stored = db.getConfigSync(DB_KEY, null);
    return (stored && typeof stored === 'object' && Array.isArray(stored.songs))
        ? stored
        : { enabled: false, songs: [...DEFAULT_SONGS], setBy: null, setAt: null };
}

function _save(data) {
    db.setConfigSync(DB_KEY, data);
}

// ── Startup initialisation ─────────────────────────────────────────────────

// Sync global.MUSIC_MODE from disk the first time this module loads,
// so the flag is always explicitly true/false (never undefined) after startup.
// This ensures settings survive restarts without relying on the fallthrough.
(function _initFromDisk() {
    try {
        global.MUSIC_MODE = _load().enabled === true;
    } catch {
        global.MUSIC_MODE = false;
    }
})();

// ── Public API ─────────────────────────────────────────────────────────────

// Returns true if Music Mode is currently active.
// global.MUSIC_MODE is always a boolean (set at startup from disk, and updated
// by setMusicMode) so this never falls through to a slow disk read.
export function isMusicModeEnabled() {
    if (global.MUSIC_MODE === true) return true;
    if (global.MUSIC_MODE === false) return false;
    return _load().enabled === true;
}

// Enable or disable Music Mode.
// Persists to disk and updates global.MUSIC_MODE for instant effect.
export function setMusicMode(enabled, setBy = 'Unknown') {
    const data = _load();
    data.enabled = enabled;
    data.setBy = setBy;
    data.setAt = new Date().toISOString();
    _save(data);
    global.MUSIC_MODE = enabled;
}

// Return the current song list (owner's custom list, or the default if not set).
export function getMusicSongs() {
    return _load().songs || [...DEFAULT_SONGS];
}

// Add a new search query or URL to the song list.
// Returns false (and does nothing) if the entry already exists.
export function addMusicSong(query) {
    const data = _load();
    if (!data.songs) data.songs = [...DEFAULT_SONGS];
    if (data.songs.includes(query)) return false;
    data.songs.push(query);
    _save(data);
    return true;
}

// Remove a song from the list by its index number (0-based).
// Returns the removed entry, or null if the index is out of range.
export function removeMusicSong(index) {
    const data = _load();
    if (!data.songs || index < 0 || index >= data.songs.length) return null;
    const [removed] = data.songs.splice(index, 1);
    _save(data);
    return removed;
}

// Restore the song list to the built-in default list.
export function resetMusicSongs() {
    const data = _load();
    data.songs = [...DEFAULT_SONGS];
    _save(data);
}

// Empty the song list completely (useful before the owner adds their own set).
export function clearMusicSongs() {
    const data = _load();
    data.songs = [];
    _save(data);
}

// ── iTunes preview fetcher ─────────────────────────────────────────────────

// Search iTunes for a song and return the 30-second preview URL + metadata.
// Picks randomly from the top 5 results that have a preview available,
// adding variety so the same query doesn't always play the same clip.
async function fetchItunesPreview(query) {
    const res = await axios.get('https://itunes.apple.com/search', {
        params: { term: query, entity: 'song', limit: 5, media: 'music' },
        timeout: 8000
    });
    const results = res.data?.results || [];

    // Only consider tracks that actually have a 30-second preview stream
    const withPreview = results.filter(r => r.previewUrl);
    if (!withPreview.length) return null;

    // Pick one at random so repeated calls to the same query vary
    const pick = withPreview[Math.floor(Math.random() * withPreview.length)];
    return { previewUrl: pick.previewUrl, trackName: pick.trackName, artistName: pick.artistName };
}

// ── Main send function ─────────────────────────────────────────────────────

// Pick a random song from the list and send it as a WhatsApp audio message.
// Shuffles the list first so a fresh song is picked each time.
//
// Each entry can be:
//   • A direct audio URL (https://…)  — downloaded and sent as-is
//   • A search query string           — looked up via iTunes first
//
// Skips entries that fail (network error, no preview, file too small) and
// tries the next one until one succeeds or the list is exhausted.
export async function sendMusicClip(sock, chatId, quotedMsg = null) {
    const songs = getMusicSongs();
    if (!songs.length) return;

    // Shuffle so the order is different every time
    const shuffled = [...songs].sort(() => Math.random() - 0.5);

    for (const entry of shuffled) {
        try {
            // Decide whether this entry is a direct URL or a search term
            const isDirectUrl = /^https?:\/\//i.test(entry);
            let audioUrl, mimeType, fileName;

            if (isDirectUrl) {
                // Direct URL — determine mime type from extension
                audioUrl  = entry;
                mimeType  = entry.endsWith('.ogg') ? 'audio/ogg' : entry.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';
                fileName  = 'clip.mp3';
            } else {
                // Search query — fetch a 30 s preview from iTunes
                const track = await fetchItunesPreview(entry);
                if (!track?.previewUrl) continue; // no preview available — try next song
                audioUrl  = track.previewUrl;
                mimeType  = 'audio/mp4';
                fileName  = `${track.artistName} - ${track.trackName}.m4a`;
            }

            // Download the audio bytes (max 5 MB, 20 s timeout)
            const resp = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
                maxContentLength: 5 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const buf = Buffer.from(resp.data);
            // Sanity check — anything under ~5 KB is probably an error page
            if (buf.length < 5000) continue;

            // Send the audio to WhatsApp, optionally quoting the trigger message
            const msgOptions = quotedMsg ? { quoted: quotedMsg } : {};
            await sock.sendMessage(chatId, {
                audio: buf,
                mimetype: mimeType,
                ptt: false,   // false = music player, true = voice note player
                fileName
            }, msgOptions);

            return; // successfully sent — stop trying further entries
        } catch {
            continue; // network or API error — silently try the next song
        }
    }
}
