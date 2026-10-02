/**
 * patch_lid_sync.js
 * Run once: node patch_lid_sync.js
 * Patches index.js to sync LIDs on startup and every 30 minutes.
 */

const fs = require('fs');
const path = require('path');

const TARGET = "/home/claude/wolfbot/k-7-main/index.js";
let code = fs.readFileSync(TARGET, 'utf8');

// ─── 1. Inject the syncAllLids function near the top of startBot ──────────────
// We add it just before the connection.update handler

const FUNC_ANCHOR = `        sock.ev.on('contacts.upsert', (contacts) => {`;

const LID_SYNC_FUNC = `
        // ── LID Sync Utility ─────────────────────────────────────────────────
        // Walks all cached contacts and populates BOTH directions of the LID
        // cache: lidPhoneCache (LID→phone) and phoneLidCache (phone→LID).
        // This ensures sendMessage can always find the right @lid endpoint for
        // any user who has ever messaged the bot, even after a restart.
        async function syncAllLids() {
            try {
                let synced = 0;
                // Source 1: signalRepository lidMapping — most complete source
                if (sock?.signalRepository?.lidMapping?.getPNForLID) {
                    try {
                        const _mapping = sock.signalRepository.lidMapping;
                        const _allLids = typeof _mapping.getAllLIDs === 'function'
                            ? await _mapping.getAllLIDs()
                            : (typeof _mapping.getAll === 'function' ? await _mapping.getAll() : null);
                        if (_allLids) {
                            for (const [lid, pn] of Object.entries(_allLids)) {
                                const lidNum = String(lid).split('@')[0].split(':')[0];
                                const phone  = String(pn).replace(/[^0-9]/g, '');
                                if (lidNum && phone && lidNum !== phone) {
                                    cacheLidPhone(lidNum, phone);
                                    phoneLidCache.set(phone, lidNum);
                                    synced++;
                                }
                            }
                        }
                    } catch {}
                }

                // Source 2: global.contactNames — has LID keys from contacts.upsert
                if (global.contactNames) {
                    for (const [key] of global.contactNames) {
                        if (key.endsWith('@lid') || /^[0-9]{10,}$/.test(key)) {
                            const lidNum = key.split('@')[0].split(':')[0];
                            try {
                                const resolved = await resolvePhoneFromLidAsync(lidNum + '@lid');
                                if (resolved) {
                                    const phone = resolved.replace(/[^0-9]/g, '');
                                    if (phone && lidNum !== phone) {
                                        cacheLidPhone(lidNum, phone);
                                        phoneLidCache.set(phone, lidNum);
                                        synced++;
                                    }
                                }
                            } catch {}
                        }
                    }
                }

                // Source 3: _lidDeviceHints — populated by sendMessage @lid echoes
                if (globalThis._lidDeviceHints) {
                    for (const [phone, lidJid] of Object.entries(globalThis._lidDeviceHints)) {
                        const lidNum = lidJid.split('@')[0].split(':')[0];
                        if (lidNum && phone && lidNum !== phone) {
                            cacheLidPhone(lidNum, phone);
                            phoneLidCache.set(phone, lidNum);
                            synced++;
                        }
                    }
                }

                if (synced > 0) UltraCleanLogger.info(\`[LID-SYNC] Synced \${synced} LID↔phone mappings\`);
            } catch (e) {
                UltraCleanLogger.info(\`[LID-SYNC] Error: \${e.message}\`);
            }
        }

        sock.ev.on('contacts.upsert', (contacts) => {`;

if (code.includes(FUNC_ANCHOR) && !code.includes('async function syncAllLids()')) {
    code = code.replace(FUNC_ANCHOR, LID_SYNC_FUNC);
    console.log('✅ Patch 1: syncAllLids function injected');
} else if (code.includes('async function syncAllLids()')) {
    console.log('⏭️  Patch 1: already applied');
} else {
    console.log('❌ Patch 1: anchor not found — skipping');
}

// ─── 2. Call syncAllLids on connection open + every 30 minutes ───────────────

const STARTUP_ANCHOR = `                setTimeout(() => {\n                    if (isConnected) discoverNewsletters(sock).catch(() => {});\n                }, 10000);`;

const STARTUP_PATCH = `                setTimeout(() => {
                    if (isConnected) discoverNewsletters(sock).catch(() => {});
                }, 10000);

                // Sync LID↔phone cache 5s after connect, then every 30 min.
                // Fixes "bot replies to @lid but message never shows" caused by
                // stale or missing phoneLidCache entries after a restart.
                setTimeout(() => {
                    if (isConnected && typeof syncAllLids === 'function') {
                        syncAllLids().catch(() => {});
                    }
                }, 5000);
                setInterval(() => {
                    if (isConnected && typeof syncAllLids === 'function') {
                        syncAllLids().catch(() => {});
                    }
                }, 30 * 60 * 1000); // every 30 minutes`;

if (code.includes(STARTUP_ANCHOR) && !code.includes('Sync LID↔phone cache 5s after connect')) {
    code = code.replace(STARTUP_ANCHOR, STARTUP_PATCH);
    console.log('✅ Patch 2: startup + interval LID sync added');
} else if (code.includes('Sync LID↔phone cache 5s after connect')) {
    console.log('⏭️  Patch 2: already applied');
} else {
    console.log('❌ Patch 2: anchor not found — skipping');
}

// ─── 3. Also sync immediately when any @lid message arrives in a DM ──────────
// This is the most important one — syncs the specific user right before reply

const DM_LID_ANCHOR = `        // ── DM LID pre-cache ─────────────────────────────────────────────────`;

const DM_LID_PATCH = `        // ── DM LID pre-cache ─────────────────────────────────────────────────
        // When ANY DM arrives (whether @lid or @s.whatsapp.net), try to ensure
        // the phoneLidCache has the correct mapping for this user before the
        // command runs and the bot tries to reply.`;

const DM_LID_EXISTING = `        // When a DM arrives with remoteJid as @lid (LID-only / LID-migrated`;

if (!code.includes('When ANY DM arrives') && code.includes(DM_LID_ANCHOR)) {
    code = code.replace(
        `        // ── DM LID pre-cache ─────────────────────────────────────────────────\n        // When a DM arrives with remoteJid as @lid`,
        `        // ── DM LID pre-cache ─────────────────────────────────────────────────\n        // When ANY DM arrives (whether @lid or @s.whatsapp.net), ensure\n        // phoneLidCache has the mapping BEFORE the command runs.\n        // When a DM arrives with remoteJid as @lid`
    );
    console.log('✅ Patch 3: DM pre-cache comment updated');
} else {
    console.log('⏭️  Patch 3: already applied or anchor mismatch — skipping');
}

// ─── Write ────────────────────────────────────────────────────────────────────
fs.writeFileSync(TARGET, code);
console.log('\n✅ All patches applied. Restart the bot with:');
console.log('   node --max-old-space-size=1024 --expose-gc index.js\n');