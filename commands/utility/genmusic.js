import axios from 'axios';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const BASE          = 'https://apis.xcasper.space/api/tools/text-to-music';
const START_URL     = `${BASE}/start`;
const POLL_URL      = `${BASE}/poll`;
const POLL_INTERVAL = 12000;    // poll every 12 s
const MAX_WAIT      = 220000;   // 3m40s per attempt (server limit is 3 min)
const REQ_TIMEOUT   = 20000;    // per-request timeout
const MAX_RETRIES   = 2;        // retry up to 2 extra times on server timeout

const GENRES = ['Pop','Afrobeat','Hip-hop','R&B','Rock','Jazz','Reggae','Country',
                'Electronic','Soul','Blues','Classical','Trap','Dancehall','Gospel',
                'Indie','Folk','Lo-fi'];
const MOODS  = ['Happy','Sad','Romantic','Energetic','Calm'];
const VOCALS = ['Male','Female'];

// ── Argument parser ──────────────────────────────────────────────────────────
// Usage:  .genmusic <prompt> | genre=Afrobeat | mood=Energetic | vocal=Female | instrumental
function parseArgs(args) {
    const raw   = args.join(' ');
    const parts = raw.split('|').map(s => s.trim());

    const prompt = parts[0] || '';
    const opts   = {};

    for (let i = 1; i < parts.length; i++) {
        const seg = parts[i].toLowerCase();
        if (seg === 'instrumental') { opts.instrumental = true; continue; }
        const eq = parts[i].indexOf('=');
        if (eq === -1) continue;
        const key = parts[i].slice(0, eq).trim().toLowerCase();
        const val = parts[i].slice(eq + 1).trim();
        if (!val) continue;
        switch (key) {
            case 'genre':           opts.genre  = val; break;
            case 'mood':            opts.mood   = val; break;
            case 'vocal': case 'voice': opts.vocal = val; break;
            case 'title':           opts.title  = val; break;
            case 'lyrics':          opts.lyrics = val; break;
        }
    }
    return { prompt, opts };
}

function findBestMatch(input, list) {
    if (!input) return null;
    const low = input.toLowerCase();
    return list.find(x => x.toLowerCase() === low)
        || list.find(x => x.toLowerCase().startsWith(low))
        || null;
}

async function downloadBuffer(url) {
    const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 40000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(resp.data);
}

// ── Status emoji mapping ─────────────────────────────────────────────────────
const STATUS_EMOJI = { lyrics: '✍️', composing: '🎼', recording: '🎙️', done: '✅', failed: '❌' };

// ── Main command ─────────────────────────────────────────────────────────────
export default {
    name:        'genmusic',
    alias:       ['makemusic', 'aimusic', 'musicai', 'songgen', 'generatesong', 'createmusic', 'genai'],
    category:    'utility',
    description: 'Generate a full AI-composed MP3 song from a text prompt',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        // ── Help / no args ─────────────────────────────────────────────────
        if (!args.length || args.join(' ').trim() === '') {
            return reply(
                `╭─⌈ 🎵 *AI MUSIC GENERATOR* ⌋\n` +
                `│\n` +
                `│ *Usage:*\n` +
                `│  ${PREFIX}genmusic <theme> | genre=<genre> | mood=<mood>\n` +
                `│\n` +
                `│ *Best style — short & direct:*\n` +
                `│  ${PREFIX}genmusic a sad Afrobeat song about missing home | genre=Afrobeat | mood=Sad\n` +
                `│  ${PREFIX}genmusic hype party banger for a Nairobi night | genre=Afrobeat | mood=Energetic\n` +
                `│  ${PREFIX}genmusic a love song for a girl far away | genre=R&B | mood=Romantic | vocal=Female\n` +
                `│  ${PREFIX}genmusic peaceful piano for late night studying | genre=Classical | instrumental\n` +
                `│\n` +
                `│ 💡 *Tip:* Keep your theme short and clear.\n` +
                `│    Use *${PREFIX}musicprompt* to auto-generate\n` +
                `│    the full command from a casual description.\n` +
                `│\n` +
                `├─⊷ *🎸 Genres:* ${GENRES.join(' • ')}\n` +
                `├─⊷ *😊 Moods:* ${MOODS.join(' • ')}\n` +
                `├─⊷ *🎤 Vocal:* Male • Female  *(default: Male)*\n` +
                `│\n` +
                `│ ⏳ Generation takes 2–3 minutes.\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        const { prompt, opts } = parseArgs(args);
        if (!prompt) {
            return reply(`❌ Please describe your song.\n\nExample: *${PREFIX}genmusic a love song about Nairobi nights*`);
        }

        // ── Normalise options ──────────────────────────────────────────────
        const genre        = findBestMatch(opts.genre, GENRES) || 'Pop';
        const mood         = findBestMatch(opts.mood,  MOODS)  || 'Happy';
        const vocal        = findBestMatch(opts.vocal, VOCALS) || 'Male';
        const title        = opts.title        || null;
        const customLyrics = opts.lyrics       || null;
        const instrumental = opts.instrumental || false;

        // ── React + status message ─────────────────────────────────────────
        await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } });

        const infoHeader = [
            `🎵 *Generating your song…*`,
            ``,
            `📝 *Prompt:* _${prompt}_`,
            `🎸 *Genre:* ${genre}  •  😊 *Mood:* ${mood}`,
            instrumental ? `🎹 *Instrumental* (no vocals)` : `🎤 *Vocal:* ${vocal}`,
            customLyrics ? `✍️ *Custom lyrics provided*` : '',
            ``,
        ].filter(l => l !== null).join('\n');

        let statusMsg = null;
        try {
            statusMsg = await sock.sendMessage(chatId, {
                text: infoHeader + `✍️ Starting generation…\n⏳ This takes 2–3 minutes. Stand by!`
            }, { quoted: msg });
        } catch { /* no status message */ }

        const editStatus = async (line1, line2 = '') => {
            if (!statusMsg) return;
            try {
                await sock.sendMessage(chatId, {
                    text: infoHeader + line1 + (line2 ? `\n${line2}` : ''),
                    edit: statusMsg.key
                });
            } catch { /* edit not supported */ }
        };

        // ── Build start params (reused on every attempt) ──────────────────
        const startParams = { prompt, genre, mood };
        if (!instrumental) startParams.vocal = vocal;   // omit vocal when instrumental
        if (title)        startParams.title        = title;
        if (customLyrics) startParams.lyrics       = customLyrics;
        if (instrumental) startParams.instrumental = 'true';

        // ── Helper: start one job and poll until done/failed/timeout ───────
        const runAttempt = async (attemptNum) => {
            // Start a new job
            let jobId;
            try {
                const resp = await axios.get(START_URL, {
                    params:  startParams,
                    timeout: REQ_TIMEOUT,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (!resp.data?.success || !resp.data?.job_id) {
                    throw new Error(resp.data?.message || 'No job_id returned');
                }
                jobId = resp.data.job_id;
            } catch (err) {
                throw new Error(`Could not start: ${err.response?.data?.message || err.message}`);
            }

            // Poll until done, failed, or deadline
            const deadline = Date.now() + MAX_WAIT;
            let lastStep   = '';

            while (Date.now() < deadline) {
                await new Promise(r => setTimeout(r, POLL_INTERVAL));

                let poll;
                try {
                    const resp = await axios.get(POLL_URL, {
                        params:  { job_id: jobId },
                        timeout: REQ_TIMEOUT,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    poll = resp.data;
                } catch { continue; }

                const status     = poll.status  || '';
                const step       = poll.step    || status;
                const emoji      = STATUS_EMOJI[status] || '⏳';
                const elapsedS   = Math.round((poll.elapsed_ms || 0) / 1000);
                const elapsedStr = elapsedS < 60
                    ? `${elapsedS}s`
                    : `${Math.floor(elapsedS / 60)}m ${elapsedS % 60}s`;
                const attemptTag = attemptNum > 1 ? ` _(attempt ${attemptNum})_` : '';

                if (step !== lastStep) {
                    lastStep = step;
                    await editStatus(`${emoji} ${step}${attemptTag}`, `⏱️ ${elapsedStr} elapsed…`);
                }

                if (status === 'done') {
                    return poll.result || poll;   // success
                }

                if (!poll.success || status === 'failed') {
                    // All server-side failures are transient (proxy errors, timeouts, overload)
                    // — always mark as retriable so the retry loop kicks in
                    throw Object.assign(new Error(poll.error || 'Generation failed'), { isTimeout: true });
                }
            }

            // Our own deadline exceeded
            throw Object.assign(new Error('Generation timed out — server is busy'), { isTimeout: true });
        };

        // ── Retry loop ────────────────────────────────────────────────────
        let result   = null;
        let lastErr  = null;

        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            try {
                result = await runAttempt(attempt);
                break;
            } catch (err) {
                lastErr = err;
                if (!err.isTimeout || attempt > MAX_RETRIES) break;
                // Server error — silently retry with a status update
                await editStatus(
                    `⏳ Server error — retrying… _(attempt ${attempt + 1} of ${MAX_RETRIES + 1})_`,
                    `Please wait, starting a fresh job…`
                );
                await new Promise(r => setTimeout(r, 3000)); // small gap before retry
            }
        }

        // ── Handle final failure ───────────────────────────────────────────
        if (!result || !result.music_url) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            const errMsg = lastErr?.message || 'Unknown error';
            return reply(
                `❌ *Music generation failed after ${MAX_RETRIES + 1} attempts.*\n\n` +
                `_Last error: ${errMsg}_\n\n` +
                `💡 Tips:\n` +
                `• The server may be overloaded — try again in a few minutes\n` +
                `• Try a shorter or simpler prompt\n` +
                `• Try a different genre or mood`
            );
        }

        // ── Send results ───────────────────────────────────────────────────
        const songTitle  = result.title     || result.song_title || prompt.slice(0, 60);
        const musicUrl   = result.music_url || result.audio_url  || result.url;
        const coverUrl   = result.cover_url || result.image_url  || null;
        const lyricsOut  = result.lyrics    || null;

        // 1. Cover image
        if (coverUrl) {
            try {
                const coverBuf = await downloadBuffer(coverUrl);
                await sock.sendMessage(chatId, {
                    image:   coverBuf,
                    caption: `🎵 *${songTitle}*\n🎸 ${genre}  •  😊 ${mood}${instrumental ? '  •  🎹 Instrumental' : ''}\n📝 _${prompt}_`
                }, { quoted: msg });
            } catch {
                await reply(`🎵 *${songTitle}*\n🎸 ${genre}  •  😊 ${mood}\n📝 _${prompt}_`);
            }
        } else {
            await reply(`🎵 *${songTitle}*\n🎸 ${genre}  •  😊 ${mood}\n📝 _${prompt}_`);
        }

        // 2. MP3 audio
        try {
            const audioBuf = await downloadBuffer(musicUrl);
            await sock.sendMessage(chatId, {
                audio:    audioBuf,
                mimetype: 'audio/mpeg',
                ptt:      false,
                fileName: `${songTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim()}.mp3`
            }, { quoted: msg });
        } catch {
            await reply(`🔗 *Download your song:*\n${musicUrl}`);
        }

        // 3. Lyrics
        if (lyricsOut && !instrumental) {
            const trimmed = lyricsOut.length > 3500
                ? lyricsOut.slice(0, 3500) + '\n\n_…(truncated)_'
                : lyricsOut;
            await reply(`📜 *Lyrics — ${songTitle}*\n\n${trimmed}`);
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
