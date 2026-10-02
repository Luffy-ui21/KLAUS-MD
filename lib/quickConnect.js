// ====== lib/quickConnect.js ======
// Quick-Connect guard — solves the "long cold start" problem on session resume.
//
// PROBLEM:
//   When the bot reconnects with an old session, WhatsApp replays every missed
//   message in a rapid burst. These flood the event loop and block NEW messages
//   from being processed for minutes.
//
// SOLUTION (3-phase):
//   Phase 1 — DRAIN WINDOW (first 45 s after connection opens):
//     Any message older than 30 s is immediately dropped.
//   Phase 2 — BURST EXTENSION (auto):
//     If > 15 old msgs/s are still arriving, extend the window by 8 s.
//     Hard cap: no extension past MAX_DRAIN_MS (3 minutes) from connection open.
//   Phase 3 — BURST-END EARLY EXIT:
//     Once 3 consecutive 1-second windows have NO old-message burst, drain ends
//     immediately — even if the clock hasn't run out yet.
//     This means the bot becomes live as soon as the replay burst actually stops,
//     not after an arbitrary countdown.
//
// RESULT: bot always responds within ≤ 3 minutes of a reconnect, and usually
//         responds within a few seconds of the replay burst finishing.

// ── Tunables ───────────────────────────────────────────────────────────────
const INITIAL_DRAIN_MS      = 45_000;   // initial drain window (45 s)
const MAX_DRAIN_MS          = 180_000;  // hard cap: never drain > 3 minutes
const BURST_EXTENSION_MS    =  8_000;   // extend by 8 s per burst window
const BURST_THRESHOLD       = 15;       // msgs/s that counts as a "burst"
const QUIET_WINDOWS_NEEDED  = 3;        // consecutive quiet 1-s windows → end drain
const DRAIN_AGE_THRESHOLD_MS = 30_000;  // messages older than 30 s are replays

// ── State ──────────────────────────────────────────────────────────────────
let connectionOpenAt   = 0;
let drainWindowEnd     = 0;
let hardCapEnd         = 0;
let burstWindowStart   = 0;
let burstCount         = 0;
let quietWindowCount   = 0;
let totalDropped       = 0;
let totalPassed        = 0;
let isActive           = false;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Call once when `connection === 'open'` fires.
 */
export function markConnectionOpen() {
    const now          = Date.now();
    connectionOpenAt   = now;
    drainWindowEnd     = now + INITIAL_DRAIN_MS;
    hardCapEnd         = now + MAX_DRAIN_MS;
    burstWindowStart   = now;
    burstCount         = 0;
    quietWindowCount   = 0;
    totalDropped       = 0;
    totalPassed        = 0;
    isActive           = true;
    globalThis._wolfSysStats = globalThis._wolfSysStats || {};
    globalThis._wolfSysStats.quickConnect = `drain ${INITIAL_DRAIN_MS / 1000}s (cap ${MAX_DRAIN_MS / 1000}s)`;
    if (typeof globalThis._printSystemBox === 'function') {
        globalThis._printSystemBox({
            tag: 'QuickConnect', color: 'cyan', icon: '',
            message: 'Drain window opened',
            fields: {
                'Initial': `${INITIAL_DRAIN_MS / 1000}s`,
                'Hard Cap': `${MAX_DRAIN_MS / 1000}s`,
            },
        });
    } else {
        console.log(`[QuickConnect]  Drain window opened — ${INITIAL_DRAIN_MS / 1000}s initial, hard cap ${MAX_DRAIN_MS / 1000}s`);
    }
}

/**
 * Returns true if the message should be dropped (replay).
 * Call as the very first check inside messages.upsert.
 */
export function isReplayMessage(msg) {
    if (!isActive) return false;

    const now = Date.now();

    // Phase 3 — drain window expired (or hard cap reached)
    if (now > drainWindowEnd || now > hardCapEnd) {
        if (isActive) {
            isActive = false;
            const elapsed = Math.round((now - connectionOpenAt) / 1000);
            if (typeof globalThis._printSystemBox === 'function') {
                globalThis._printSystemBox({
                    tag: 'QuickConnect', color: 'green', icon: '✅',
                    message: 'Drain complete — bot is LIVE',
                    fields: {
                        'Elapsed': `${elapsed}s`,
                        'Dropped': totalDropped,
                        'Passed':  totalPassed,
                    },
                });
            } else {
                console.log(`[QuickConnect] ✅ Drain complete after ${elapsed}s — bot is LIVE (dropped ${totalDropped}, passed ${totalPassed})`);
            }
            globalThis._wolfSysStats = globalThis._wolfSysStats || {};
            globalThis._wolfSysStats.quickConnect = `done (${elapsed}s, ${totalDropped} dropped)`;
        }
        return false;
    }

    // Extract message timestamp
    const rawTs = msg.messageTimestamp;
    const msgTs = rawTs
        ? (typeof rawTs === 'object' ? (rawTs.low || 0) : Number(rawTs)) * 1000
        : 0;

    if (msgTs === 0) return false; // no timestamp — let through

    const ageMs = now - msgTs;

    // ── Burst detection and drain extension ────────────────────────────────
    if (ageMs > DRAIN_AGE_THRESHOLD_MS) {
        // Old message — track burst
        if (now - burstWindowStart < 1000) {
            burstCount++;
        } else {
            // New 1-second window
            if (burstCount >= BURST_THRESHOLD) {
                // Still bursting — extend drain window, respecting hard cap
                quietWindowCount = 0;
                const extended = Math.min(
                    Math.max(drainWindowEnd, now + BURST_EXTENSION_MS),
                    hardCapEnd
                );
                if (extended > drainWindowEnd) {
                    drainWindowEnd = extended;
                    const totalSec = Math.round((drainWindowEnd - connectionOpenAt) / 1000);
                    if (typeof globalThis._printSystemBox === 'function') {
                        globalThis._printSystemBox({
                            tag: 'QuickConnect', color: 'yellow', icon: '⚡',
                            message: 'Burst detected — drain extended',
                            fields: {
                                'Rate':     `${burstCount} msgs/s`,
                                'Window':   `${totalSec}s`,
                                'Hard Cap': `${MAX_DRAIN_MS / 1000}s`,
                            },
                        });
                    } else {
                        console.log(`[QuickConnect] ⚡ Burst (${burstCount} msgs/s) — window → ${totalSec}s (cap ${MAX_DRAIN_MS / 1000}s)`);
                    }
                }
            } else {
                // Quiet window — count toward early exit
                quietWindowCount++;
                if (quietWindowCount >= QUIET_WINDOWS_NEEDED) {
                    // Burst has stopped — end drain immediately
                    isActive = false;
                    const elapsed = Math.round((now - connectionOpenAt) / 1000);
                    if (typeof globalThis._printSystemBox === 'function') {
                        globalThis._printSystemBox({
                            tag: 'QuickConnect', color: 'green', icon: '✅',
                            message: 'Burst ended — bot is LIVE',
                            fields: {
                                'Closed Early At': `${elapsed}s`,
                                'Dropped':         totalDropped,
                                'Passed':          totalPassed,
                            },
                        });
                    } else {
                        console.log(`[QuickConnect] ✅ Burst ended — drain closed early at ${elapsed}s — bot is LIVE`);
                    }
                    globalThis._wolfSysStats = globalThis._wolfSysStats || {};
                    globalThis._wolfSysStats.quickConnect = `early-exit ${elapsed}s`;
                    return true; // drop this last old message
                }
            }
            burstWindowStart = now;
            burstCount       = 1;
        }

        totalDropped++;
        return true;
    }

    // Fresh message — passes through
    quietWindowCount = 0; // reset quiet counter if real messages are arriving
    totalPassed++;
    return false;
}

/**
 * True while the drain window is active.
 */
export function isDrainActive() {
    return isActive && Date.now() <= Math.min(drainWindowEnd, hardCapEnd);
}

/**
 * Snapshot of drain stats (for debug / .ping / status commands).
 */
export function getDrainStats() {
    const now = Date.now();
    const effectiveEnd = Math.min(drainWindowEnd, hardCapEnd);
    return {
        active:           isActive && now <= effectiveEnd,
        connectionOpenAt,
        drainWindowEndAt: effectiveEnd,
        remainingMs:      Math.max(0, effectiveEnd - now),
        hardCapMs:        MAX_DRAIN_MS,
        totalDropped,
        totalPassed,
    };
}
