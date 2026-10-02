import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

// Resolve the full ffmpeg binary path and patch process.env.PATH so that
// every child_process call (execFile, exec, spawn) in the entire bot finds
// ffmpeg without needing its full path hard-coded everywhere.
//
// Resolution order (first hit wins):
//   1. FFMPEG_PATH env var  — explicit override, always honoured
//   2. /usr/bin/ffmpeg      — standard Linux system install
//   3. /usr/local/bin/ffmpeg — Homebrew / manual Linux install
//   4. /usr/bin/local/ffmpeg — alternate manual path
//   5. ffmpeg-static pkg    — bundled cross-platform binary (Heroku, Pterodactyl,
//                             Railway, Fly.io, Render, Koyeb, Windows, macOS…)
//   6. which ffmpeg         — Nix/Replit store, any other $PATH install
//   7. 'ffmpeg'             — last resort bare name; fails fast with ENOENT
//
// Import this module ONCE, as early as possible in index.js.

const _require = createRequire(import.meta.url);

function tryFfmpegStatic() {
    try {
        const p = _require('ffmpeg-static');
        // ffmpeg-static exports the binary path as its default (string)
        const resolved = typeof p === 'string' ? p : (p?.default ?? null);
        if (resolved && fs.existsSync(resolved)) return resolved;
    } catch {}
    return null;
}

function resolveFfmpeg() {
    // --- 1-3: env var + common system paths ---
    const candidates = [
        process.env.FFMPEG_PATH,
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/local/ffmpeg',
    ].filter(Boolean);

    for (const p of candidates) {
        try { if (fs.existsSync(p)) return p; } catch {}
    }

    // --- 4: ffmpeg-static bundled binary ---
    // Works on Heroku, Pterodactyl, Railway, Fly.io, Render, Koyeb, Windows,
    // macOS — any platform that cannot install a system ffmpeg.
    const staticPath = tryFfmpegStatic();
    if (staticPath) return staticPath;

    // --- 5: ask the shell (Nix store on Replit, any $PATH install) ---
    try {
        const found = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim();
        if (found && fs.existsSync(found)) return found;
    } catch {}

    // --- 6: last resort — bare name; will throw ENOENT at call time ---
    return 'ffmpeg';
}

const FFMPEG = resolveFfmpeg();

// Patch PATH so every child process inherits the ffmpeg directory.
// This fixes both execFile('ffmpeg', …) and shell exec('ffmpeg …') calls,
// including the many commands that use bare 'ffmpeg' strings directly.
if (FFMPEG !== 'ffmpeg') {
    const ffmpegDir = path.dirname(FFMPEG);
    const currentPath = process.env.PATH || '';
    if (!currentPath.split(':').includes(ffmpegDir)) {
        process.env.PATH = `${ffmpegDir}:${currentPath}`;
    }
    // Also expose via FFMPEG_PATH so any library that reads it directly benefits
    if (!process.env.FFMPEG_PATH) {
        process.env.FFMPEG_PATH = FFMPEG;
    }
}

console.log(`[ffmpegPath] resolved → ${FFMPEG}`);

export default FFMPEG;
