'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

// ── Fix 1: dotenv index.js shim ─────────────────────────────────────────────
const dotenvDir = path.join(root, 'node_modules', 'dotenv');
if (fs.existsSync(dotenvDir)) {
  const idx = path.join(dotenvDir, 'index.js');
  const main = path.join(dotenvDir, 'lib', 'main.js');
  if (!fs.existsSync(idx) && fs.existsSync(main)) {
    fs.writeFileSync(idx, "'use strict';\nmodule.exports = require('./lib/main.js');\n");
  }
}

// ── Fix 2: ensure ffmpeg-static binary is downloaded ────────────────────────
// ffmpeg-static downloads its pre-compiled binary during `npm install` via its
// own `install` hook.  That hook can be silently skipped when:
//   • npm is invoked with --ignore-scripts
//   • the package-level install script fails / times out
//   • the host has npm cache but the binary was never fetched
//
// We re-run it here so the binary is guaranteed to exist on Heroku, Pterodactyl,
// Railway, Fly.io, Render, Koyeb, and any other platform that lacks system ffmpeg.
const ffmpegStaticDir = path.join(root, 'node_modules', 'ffmpeg-static');
if (fs.existsSync(ffmpegStaticDir)) {
  const binaryPath  = path.join(ffmpegStaticDir, 'ffmpeg');
  const binaryPathW = path.join(ffmpegStaticDir, 'ffmpeg.exe');
  const hasBinary   = fs.existsSync(binaryPath) || fs.existsSync(binaryPathW);
  if (!hasBinary) {
    try {
      console.log('[patch-modules] ffmpeg-static binary missing — downloading…');
      execSync('node install.js', {
        cwd:     ffmpegStaticDir,
        stdio:   'inherit',
        timeout: 120000,
      });
      console.log('[patch-modules] ffmpeg-static binary downloaded ✓');
    } catch (e) {
      // Non-fatal — the bot will fall back to system ffmpeg or `which ffmpeg`
      console.warn('[patch-modules] ffmpeg-static download failed (non-fatal):', e.message);
    }
  }
}
