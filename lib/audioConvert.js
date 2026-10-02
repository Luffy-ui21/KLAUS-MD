import { execFile } from 'child_process';
import FFMPEG from './ffmpegPath.js';

// Use the centrally-resolved ffmpeg path (see lib/ffmpegPath.js).
// Falls back gracefully to raw MP3 when FFMPEG is unavailable.
async function getFfmpegBin() {
    return FFMPEG || '';
}

// ── Convert any audio buffer to OGG Opus via ffmpeg ──────────────────────
// Always resolves — falls back to raw MP3 if ffmpeg is unavailable or fails.
// Returns { buffer, mimetype, ptt }
export async function toOggOpus(inputBuffer) {
    const bin = await getFfmpegBin();

    if (!bin) {
        return { buffer: inputBuffer, mimetype: 'audio/mpeg', ptt: false };
    }

    return new Promise((resolve) => {
        let done = false;

        const fallback = (reason) => {
            if (done) return;
            done = true;
            console.log(`⚠️ [AUDIO] Fallback to MP3 — ${reason}`);
            resolve({ buffer: inputBuffer, mimetype: 'audio/mpeg', ptt: false });
        };

        // Hard timeout — never hang the bot
        const timer = setTimeout(() => fallback('ffmpeg timed out after 60s'), 60000);

        let ff;
        try {
            ff = execFile(bin, [
                '-y',
                '-i',    'pipe:0',
                '-vn',
                '-c:a',  'libopus',
                '-b:a',  '128k',
                '-ar',   '48000',
                '-ac',   '1',
                '-f',    'ogg',
                'pipe:1'
            ], { maxBuffer: 50 * 1024 * 1024 }, (err) => {
                // Called when the process exits
                if (err && !done) {
                    clearTimeout(timer);
                    fallback(`ffmpeg exited with error: ${err.message}`);
                }
            });
        } catch (e) {
            clearTimeout(timer);
            fallback(`execFile threw: ${e.message}`);
            return;
        }

        const chunks = [];
        ff.stdout.on('data', (chunk) => chunks.push(chunk));
        ff.stdout.on('end', () => {
            clearTimeout(timer);
            if (done) return;
            if (chunks.length > 0) {
                done = true;
                console.log('✅ [AUDIO] Converted to OGG Opus successfully');
                resolve({
                    buffer:   Buffer.concat(chunks),
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true
                });
            } else {
                fallback('ffmpeg produced no output');
            }
        });

        ff.on('error', (e) => {
            clearTimeout(timer);
            fallback(`process error: ${e.message}`);
        });

        ff.stdin.on('error', () => {});

        try {
            ff.stdin.write(inputBuffer);
            ff.stdin.end();
        } catch (e) {
            clearTimeout(timer);
            fallback(`stdin write failed: ${e.message}`);
        }
    });
}

// ── Run detection once at module load so status appears in startup logs ────
getFfmpegBin().catch(() => {});
