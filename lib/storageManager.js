/**
 * storageManager.js — Disk space guard for weak/small servers (Pterodactyl, etc.)
 *
 * Problems it solves:
 *   • yt-dlp writes temp files to /tmp that accumulate over hours → ENOSPC
 *     audio effects, etc.) that are never cleaned up when the process is killed
 *   • No space check before downloading → download fails mid-way, leaving partials
 *   • No periodic sweep for orphaned temp dirs/files
 *
 * What it does:
 *   1. checkFreeSpace(minMB)   — returns true if at least minMB is free in /tmp
 *   2. cleanOrphanTempFiles()  — removes /tmp/ytdlp-* dirs and /tmp/wolfbot_* files
 *                                older than ORPHAN_AGE_MS (default 30 min)
 *   3. initStorageManager()    — starts a periodic cleanup timer (every 5 min)
 *   4. onENOSPC()              — call when ENOSPC is caught — emergency full cleanup
 */

import { statfs, readdir, rm, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const TMP = tmpdir();

// Directory prefixes created by this bot inside /tmp
const WOLF_DIR_PREFIXES = ['ytdlp-', 'wolf-dl-', 'wolf-vid-', 'wolf-tmp-'];

// File prefixes created by this bot inside /tmp
const WOLF_FILE_PREFIXES = [
    'wolf_',      // any future wolf-prefixed files
];

// How old (ms) a temp entry must be before we consider it orphaned.
// 30 minutes covers any legitimate in-progress download or ffmpeg operation.
const ORPHAN_AGE_MS = 30 * 60 * 1000;

let cleanupTimer = null;

/**
 * Returns free space available in the given path in megabytes.
 * Uses fs.statfs (Node 19+). Falls back to `df` if unavailable.
 */
export async function getFreeSpaceMB(path = TMP) {
    try {
        const stats = await statfs(path);
        const freeBytes = stats.bavail * stats.bsize;
        return freeBytes / (1024 * 1024);
    } catch {
        try {
            const { execFile } = await import('child_process');
            const { promisify } = await import('util');
            const execFileAsync = promisify(execFile);
            const { stdout } = await execFileAsync('df', ['-k', path]);
            const lines = stdout.trim().split('\n');
            const parts = lines[lines.length - 1].trim().split(/\s+/);
            const availKB = parseInt(parts[3], 10);
            if (!isNaN(availKB)) return availKB / 1024;
        } catch {}
        // If both methods fail, assume there is space so we don't block downloads
        return 9999;
    }
}

/**
 * Returns true if at least `minMB` is free in /tmp.
 */
export async function checkFreeSpace(minMB = 100) {
    const freeMB = await getFreeSpaceMB();
    const ok = freeMB >= minMB;
    if (!ok) {
        console.log(`[storage] ⚠️  Low disk: ${freeMB.toFixed(0)}MB free, need ${minMB}MB`);
    }
    return ok;
}

/**
 * Scans /tmp and removes:
 *   • Directories matching WOLF_DIR_PREFIXES older than ORPHAN_AGE_MS
 *   • Files matching WOLF_FILE_PREFIXES older than ORPHAN_AGE_MS
 *
 * Returns total number of entries removed.
 */
export async function cleanOrphanTempFiles(maxAgeMs = ORPHAN_AGE_MS) {
    let removed = 0;
    const now = Date.now();

    let entries;
    try {
        entries = await readdir(TMP, { withFileTypes: true });
    } catch (e) {
        console.log(`[storage] readdir error: ${e.message}`);
        return 0;
    }

    for (const entry of entries) {
        const name = entry.name;
        const isWolfDir  = entry.isDirectory() && WOLF_DIR_PREFIXES.some(p => name.startsWith(p));
        const isWolfFile = entry.isFile()      && WOLF_FILE_PREFIXES.some(p => name.startsWith(p));
        if (!isWolfDir && !isWolfFile) continue;

        const fullPath = join(TMP, name);
        try {
            const info = await stat(fullPath);
            const ageMs = now - info.mtimeMs;
            if (ageMs < maxAgeMs) continue; // still fresh — might be in use

            if (isWolfDir) {
                await rm(fullPath, { recursive: true, force: true });
            } else {
                await unlink(fullPath);
            }
            removed++;
        } catch {
            // Entry may have been removed by the owning command already — ignore
        }
    }

    if (removed > 0) {
        console.log(`[storage] 🗑️  Cleaned ${removed} orphan temp entry(s) from /tmp`);
    }
    return removed;
}

/**
 * Aggressively removes ALL wolf temp dirs/files regardless of age.
 * Called when ENOSPC is detected — we need disk space immediately.
 */
export async function emergencyCleanup() {
    let removed = 0;
    console.log(`[storage] 🚨 EMERGENCY CLEANUP triggered (ENOSPC / low space)`);

    let entries;
    try {
        entries = await readdir(TMP, { withFileTypes: true });
    } catch {
        return 0;
    }

    for (const entry of entries) {
        const name = entry.name;
        const isWolfDir  = entry.isDirectory() && WOLF_DIR_PREFIXES.some(p => name.startsWith(p));
        const isWolfFile = entry.isFile()      && WOLF_FILE_PREFIXES.some(p => name.startsWith(p));
        if (!isWolfDir && !isWolfFile) continue;

        try {
            if (isWolfDir) {
                await rm(join(TMP, name), { recursive: true, force: true });
            } else {
                await unlink(join(TMP, name));
            }
            removed++;
        } catch {}
    }

    const freeMB = await getFreeSpaceMB();
    console.log(`[storage] 🚨 Emergency cleanup: removed ${removed} entry(s). Free now: ${freeMB.toFixed(0)}MB`);
    return removed;
}

/**
 * Call this anywhere you catch an ENOSPC error.
 */
export async function onENOSPC() {
    await emergencyCleanup();
}

/**
 * Starts the periodic background cleanup timer.
 * Safe to call multiple times — only one timer will run.
 */
export function initStorageManager(intervalMs = 5 * 60 * 1000) {
    if (cleanupTimer) return;

    cleanupTimer = setInterval(async () => {
        try {
            const freeMB = await getFreeSpaceMB();
            if (freeMB < 300) {
                console.log(`[storage] 🔄 Periodic cleanup (${freeMB.toFixed(0)}MB free)`);
            }
            await cleanOrphanTempFiles();
        } catch (e) {
            console.log(`[storage] cleanup timer error: ${e.message}`);
        }
    }, intervalMs);

    if (cleanupTimer.unref) cleanupTimer.unref();

    console.log(`[storage] ✅ Storage manager active (sweeps /tmp every ${intervalMs / 60000}min)`);

    // Run an initial sweep to catch anything left over from a previous crash
    cleanOrphanTempFiles().catch(() => {});
}
