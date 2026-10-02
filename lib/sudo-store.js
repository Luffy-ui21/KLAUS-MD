// // ====== lib/sudo-store.js ======
// // Manages the "sudo" (trusted admin) user list.
// //
// // Sudo users can run owner-level commands on the bot.  The owner can add,
// // remove, and list sudo users at runtime via bot commands.
// //
// // This module keeps an in-memory copy of the sudo list for instant lookups
// // and writes any changes to the SQLite database (via lib/database.js) so
// // they persist across restarts.
// //
// // WhatsApp LID complication:
// //   WhatsApp Linked Devices (multi-device) give contacts a second ID called
// //   a LID (e.g. "123456@lid") which looks different from the normal phone
// //   JID (e.g. "254712345678@s.whatsapp.net").  The same contact may message
// //   the bot from either ID.  This file maintains a lidMap (lid → phone) so
// //   isSudo checks work regardless of which ID the contact is using.

// import db from './database.js';

// // ── In-memory state ────────────────────────────────────────────────────────

// // sudoers : string[] — list of clean phone numbers for all sudo users
// // addedAt : { [number]: ISO timestamp } — when each sudo was added
// // jidMap  : { [number]: string[] } — all known JIDs for each sudo number
// let sudoData = { sudoers: [], addedAt: {}, jidMap: {} };

// // sudomode: when true, ALL group members act as sudo (open admin access)
// let configData = { sudomode: false };

// // lidMap: maps LID strings to phone numbers so LID-based messages can
// // be matched against the sudoers list
// let lidMap = {};

// // The bot's own phone number used to scope DB rows (allows multi-bot setups)
// let currentBotId = 'default';

// // ── Helpers ────────────────────────────────────────────────────────────────

// // Strip everything that isn't a digit from a number string.
// // E.g. "+254 712-345 678" → "254712345678"
// function cleanNumber(num) {
//     return num.replace(/[^0-9]/g, '');
// }

// function getBotId() {
//     return currentBotId;
// }

// // ── Public API ─────────────────────────────────────────────────────────────

// // Update the bot ID used for database scoping.
// // Called once at startup with the bot's WhatsApp JID.
// export function setBotId(botId) {
//     if (botId) {
//         const cleaned = botId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
//         currentBotId = cleaned || botId.split('@')[0] || 'default';
//     }
// }

// // Load the sudo list from the database into memory.
// // Also loads the sudomode flag and the LID → phone mapping.
// // Called once after the WhatsApp connection is established.
// export async function initSudo(botId) {
//     try {
//         if (botId) setBotId(botId);

//         if (!db.isAvailable()) return;

//         // Load all sudoers for this bot from the 'sudoers' table
//         const rows = await db.getAll('sudoers', { bot_id: getBotId() });
//         if (rows && rows.length > 0) {
//             sudoData.sudoers = [];
//             sudoData.addedAt = {};
//             sudoData.jidMap = {};
//             for (const row of rows) {
//                 const num = row.phone_number;
//                 sudoData.sudoers.push(num);
//                 if (row.added_at) sudoData.addedAt[num] = row.added_at;
//                 // jid column is a comma-separated list of known JIDs
//                 if (row.jid) {
//                     sudoData.jidMap[num] = row.jid.split(',').filter(Boolean);
//                 }
//             }
//         } else {
//             // No rows — start with empty lists
//             sudoData.sudoers = [];
//             sudoData.addedAt = {};
//             sudoData.jidMap = {};
//         }

//         // Load sudomode flag from the 'sudo_config' table
//         const configRow = await db.get('sudo_config', getBotId(), 'bot_id');
//         if (configRow) {
//             configData.sudomode = configRow.sudomode || false;
//         } else {
//             configData.sudomode = false;
//         }

//         // Load LID → phone mappings from the 'lid_map' table
//         const lidRows = await db.getAll('lid_map');
//         if (lidRows && lidRows.length > 0) {
//             lidMap = {};
//             for (const row of lidRows) {
//                 lidMap[row.lid] = row.phone_number;
//             }
//         }

//     } catch (err) {
//         console.error('⚠️ Sudo: Init error:', err.message);
//     }
// }

// // Write the current in-memory sudo list to the database.
// // Upserts each sudoer row (insert or update) in case a row already exists.
// function syncSudoToDb(data) {
//     if (!db.isAvailable()) return;
//     try {
//         for (const num of data.sudoers) {
//             const jids = (data.jidMap && data.jidMap[num]) || [];
//             db.upsert('sudoers', {
//                 phone_number: num,
//                 bot_id: getBotId(),
//                 jid: jids.join(',') || null,
//                 added_at: (data.addedAt && data.addedAt[num]) || new Date().toISOString()
//             }, 'phone_number,bot_id').catch(() => {});
//         }
//     } catch {}
// }

// // Add a phone number to the sudo list.
// // `jid` is optional — the WhatsApp JID of the contact (may differ from number).
// // Returns { success, reason/number } so the caller can reply with a status.
// export function addSudo(number, jid) {
//     const clean = cleanNumber(number);
//     if (!clean) return { success: false, reason: 'Invalid number' };

//     // If already a sudo, just record the new JID if one was provided
//     if (sudoData.sudoers.includes(clean)) {
//         if (jid && jid !== clean) {
//             sudoData.jidMap = sudoData.jidMap || {};
//             sudoData.jidMap[clean] = sudoData.jidMap[clean] || [];
//             if (!sudoData.jidMap[clean].includes(jid)) {
//                 sudoData.jidMap[clean].push(jid);
//             }
//             syncSudoToDb(sudoData);
//         }
//         return { success: false, reason: 'Already a sudo user' };
//     }

//     // Add to in-memory list
//     sudoData.sudoers.push(clean);
//     sudoData.addedAt = sudoData.addedAt || {};
//     sudoData.addedAt[clean] = new Date().toISOString();

//     // Record the JID mapping if a JID was supplied and it differs from number
//     if (jid && jid !== clean) {
//         sudoData.jidMap = sudoData.jidMap || {};
//         sudoData.jidMap[clean] = [jid];
//     }

//     syncSudoToDb(sudoData);

//     // Mirror to PostgreSQL async
//     if (globalThis.pg?.isReady) {
//         globalThis.pg.query(
//             `INSERT INTO sudoers (bot_id, phone, added_at) VALUES ($1, $2, NOW())
//              ON CONFLICT (bot_id, phone) DO NOTHING`,
//             [getBotId(), clean]
//         ).catch(() => {});
//     }

//     return { success: true, number: clean };
// }

// // Associate an additional JID with an existing sudo number.
// // Called when the bot discovers a new LID or device JID for a known sudo.
// export function addSudoJid(number, jid) {
//     const clean = cleanNumber(number);
//     if (!clean) return;
//     if (!sudoData.sudoers.includes(clean)) return; // not a sudo — ignore

//     sudoData.jidMap = sudoData.jidMap || {};
//     sudoData.jidMap[clean] = sudoData.jidMap[clean] || [];

//     // Strip the @s.whatsapp.net and device ID prefix to get the raw number
//     const rawJid = jid.split('@')[0].split(':')[0];
//     if (!sudoData.jidMap[clean].includes(rawJid)) {
//         sudoData.jidMap[clean].push(rawJid);
//         syncSudoToDb(sudoData);
//     }
// }

// // Remove a phone number from the sudo list.
// // Also deletes the corresponding row from the database.
// // Returns { success, reason/number }.
// export function removeSudo(number) {
//     const clean = cleanNumber(number);
//     if (!clean) return { success: false, reason: 'Invalid number' };

//     const index = sudoData.sudoers.indexOf(clean);
//     if (index === -1) {
//         return { success: false, reason: 'Not a sudo user' };
//     }

//     // Remove from all in-memory structures
//     sudoData.sudoers.splice(index, 1);
//     if (sudoData.addedAt) delete sudoData.addedAt[clean];
//     if (sudoData.jidMap) delete sudoData.jidMap[clean];

//     // Remove from database
//     if (db.isAvailable()) {
//         db.removeWhere('sudoers', { phone_number: clean, bot_id: getBotId() }).catch(() => {});
//     }

//     // Mirror to PostgreSQL async
//     if (globalThis.pg?.isReady) {
//         globalThis.pg.query(
//             `DELETE FROM sudoers WHERE bot_id = $1 AND phone = $2`,
//             [getBotId(), clean]
//         ).catch(() => {});
//     }

//     return { success: true, number: clean };
// }

// // Return a copy of the full sudo list with addedAt timestamps and JID maps.
// export function getSudoList() {
//     return { sudoers: sudoData.sudoers || [], addedAt: sudoData.addedAt || {}, jidMap: sudoData.jidMap || {} };
// }

// // Check if a raw phone number string belongs to a sudo user.
// // Also checks all known JIDs for each sudo number so LID-format messages match.
// export function isSudoNumber(number) {
//     const clean = cleanNumber(number);
//     if (!clean) return false;

//     // Direct match — the number itself is in the sudoers list
//     if (sudoData.sudoers.includes(clean)) return true;

//     // JID map match — the number appears as a JID alias for a known sudo
//     if (sudoData.jidMap) {
//         for (const [sudoNum, jids] of Object.entries(sudoData.jidMap)) {
//             if (sudoData.sudoers.includes(sudoNum) && jids.includes(clean)) {
//                 return true;
//             }
//         }
//     }
//     return false;
// }

// // Check if a full WhatsApp JID (e.g. "254712345678@s.whatsapp.net") belongs
// // to a sudo user.  Strips the @suffix and device prefix before comparing.
// export function isSudoJid(senderJid) {
//     if (!senderJid) return false;
//     const rawNumber = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
//     if (!rawNumber) return false;

//     if (sudoData.sudoers.includes(rawNumber)) return true;

//     if (sudoData.jidMap) {
//         for (const [sudoNum, jids] of Object.entries(sudoData.jidMap)) {
//             if (sudoData.sudoers.includes(sudoNum) && jids.includes(rawNumber)) {
//                 return true;
//             }
//         }
//     }
//     return false;
// }

// // Remove ALL sudo users at once.
// // Called by the ?clearsudo command.
// // Returns { removed } with the count of users that were removed.
// export function clearAllSudo(ownerNumber) {
//     const removed = sudoData.sudoers.length;
//     const oldSudoers = [...sudoData.sudoers];
//     sudoData.sudoers = [];
//     sudoData.addedAt = {};
//     sudoData.jidMap = {};

//     // Delete each row from the database individually
//     if (db.isAvailable()) {
//         for (const num of oldSudoers) {
//             db.removeWhere('sudoers', { phone_number: num, bot_id: getBotId() }).catch(() => {});
//         }
//     }

//     return { removed };
// }

// // Get the current sudomode flag.
// // When true, ALL group members are treated as sudo (open admin access).
// export function getSudoMode() {
//     return configData.sudomode || false;
// }

// // Enable or disable sudomode and persist the change to the database.
// export function setSudoMode(enabled) {
//     configData.sudomode = enabled;

//     if (db.isAvailable()) {
//         db.upsert('sudo_config', {
//             id: 'main',
//             bot_id: getBotId(),
//             sudomode: enabled,
//             updated_at: new Date().toISOString()
//         }, 'id,bot_id').catch(() => {});
//     }

//     // Mirror to pg bot_configs so sudomode survives Heroku dyno resets
//     if (globalThis.pg?.isReady) {
//         globalThis.pg.query(
//             `INSERT INTO bot_configs (bot_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
//              ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
//             [getBotId(), '__sudomode__', enabled ? 'true' : 'false']
//         ).catch(() => {});
//     }

//     return enabled;
// }

// // Return the total number of sudo users currently registered.
// export function getSudoCount() {
//     return sudoData.sudoers.length;
// }

// // ── LID mapping ────────────────────────────────────────────────────────────
// // WhatsApp Linked Device IDs (LIDs) look like a plain number but have a
// // different format to normal phone JIDs.  When the bot sees a message from
// // a LID it doesn't recognise, it can't tell if the sender is a sudo user.
// // Mapping LIDs → phone numbers fixes that.

// // Record that a LID belongs to a given phone number.
// // Both values must be digits-only strings.  No-op if the mapping already exists.
// export function mapLidToPhone(lidNumber, phoneNumber) {
//     if (!lidNumber || !phoneNumber || lidNumber === phoneNumber) return;
//     if (lidMap[lidNumber] === phoneNumber) return; // already mapped

//     lidMap[lidNumber] = phoneNumber;

//     // Persist to the lid_map table so the mapping survives restarts
//     if (db.isAvailable()) {
//         db.upsert('lid_map', {
//             lid: lidNumber,
//             phone_number: phoneNumber,
//             updated_at: new Date().toISOString()
//         }, 'lid').catch(() => {});
//     }

//     // Mirror to PostgreSQL async (fire-and-forget — never blocks SQLite)
//     if (globalThis.pg?.isReady) {
//         globalThis.pg.query(
//             `INSERT INTO lid_map (lid, phone, updated_at) VALUES ($1, $2, NOW())
//              ON CONFLICT (lid) DO UPDATE SET phone = excluded.phone, updated_at = NOW()`,
//             [lidNumber, phoneNumber]
//         ).catch(() => {});
//     }
// }

// // Look up the phone number for a LID.
// // Returns null if the LID has never been seen before.
// export function getPhoneFromLid(lidNumber) {
//     return lidMap[lidNumber] || null;
// }

// // Returns true if a LID can be resolved to a phone number that is on the
// // sudo list — combines LID lookup with isSudoNumber.
// export function isSudoByLid(lidNumber) {
//     if (!lidNumber) return false;
//     const phone = lidMap[lidNumber];
//     if (!phone) return false;
//     return sudoData.sudoers.includes(phone);
// }

// // Returns true if any sudo user's phone number has NOT yet been seen as a
// // WhatsApp JID / LID.  Used by autoScanGroupsForSudo() at startup to decide
// // whether it needs to scan groups to build the LID mapping.
// export function hasUnmappedSudos() {
//     if (!sudoData.sudoers || sudoData.sudoers.length === 0) return false;
//     const mappedPhones = new Set(Object.values(lidMap));
//     return sudoData.sudoers.some(phone => !mappedPhones.has(phone));
// }

// // ── Migration helper ────────────────────────────────────────────────────────
// // Push the entire in-memory sudo state into the database in one go.
// // Useful after a database reset or when first setting up a new bot instance.
// export async function migrateSudoToSupabase() {
//     if (!db.isAvailable()) return false;
//     try {
//         for (const num of sudoData.sudoers) {
//             const jids = (sudoData.jidMap && sudoData.jidMap[num]) || [];
//             await db.upsert('sudoers', {
//                 phone_number: num,
//                 bot_id: getBotId(),
//                 jid: jids.join(',') || null,
//                 added_at: (sudoData.addedAt && sudoData.addedAt[num]) || new Date().toISOString()
//             }, 'phone_number,bot_id');
//         }

//         await db.upsert('sudo_config', {
//             id: 'main',
//             bot_id: getBotId(),
//             sudomode: configData.sudomode || false,
//             updated_at: new Date().toISOString()
//         }, 'id,bot_id');

//         for (const [lid, phone] of Object.entries(lidMap)) {
//             await db.upsert('lid_map', {
//                 lid,
//                 phone_number: phone,
//                 updated_at: new Date().toISOString()
//             }, 'lid');
//         }

//         return true;
//     } catch (err) {
//         console.error('⚠️ Supabase: Sudo migration error:', err.message);
//         return false;
//     }
// }


















































// ====== lib/sudo-store.js ======
// Manages the "sudo" (trusted admin) user list.
//
// Sudo users can run owner-level commands on the bot.  The owner can add,
// remove, and list sudo users at runtime via bot commands.
//
// This module keeps an in-memory copy of the sudo list for instant lookups
// and writes any changes to the SQLite database (via lib/database.js) so
// they persist across restarts.
//
// WhatsApp LID complication:
//   WhatsApp Linked Devices (multi-device) give contacts a second ID called
//   a LID (e.g. "123456@lid") which looks different from the normal phone
//   JID (e.g. "254712345678@s.whatsapp.net").  The same contact may message
//   the bot from either ID.  This file maintains a lidMap (lid → phone) so
//   isSudo checks work regardless of which ID the contact is using.

import db from './database.js';

// ── In-memory state ────────────────────────────────────────────────────────

// sudoers : string[] — list of clean phone numbers for all sudo users
// addedAt : { [number]: ISO timestamp } — when each sudo was added
// jidMap  : { [number]: string[] } — all known JIDs for each sudo number
let sudoData = { sudoers: [], addedAt: {}, jidMap: {} };

// sudomode: when true, ALL group members act as sudo (open admin access)
let configData = { sudomode: false };

// lidMap: maps LID strings to phone numbers so LID-based messages can
// be matched against the sudoers list
let lidMap = {};

// The bot's own phone number used to scope DB rows (allows multi-bot setups)
let currentBotId = 'default';

// ── Helpers ────────────────────────────────────────────────────────────────

// Strip everything that isn't a digit from a number string.
// E.g. "+254 712-345 678" → "254712345678"
function cleanNumber(num) {
    return num.replace(/[^0-9]/g, '');
}

function getBotId() {
    return currentBotId;
}

// ── Public API ─────────────────────────────────────────────────────────────

// Update the bot ID used for database scoping.
// Called once at startup with the bot's WhatsApp JID.
export function setBotId(botId) {
    if (botId) {
        const cleaned = botId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        currentBotId = cleaned || botId.split('@')[0] || 'default';
    }
}

// Load the sudo list from the database into memory.
// Also loads the sudomode flag and the LID → phone mapping.
// Called once after the WhatsApp connection is established.
export async function initSudo(botId) {
    try {
        if (botId) setBotId(botId);

        if (!db.isAvailable()) return;

        // Load all sudoers for this bot from the 'sudoers' table
   // WITH this:
// Query both 'default' and the real bot_id so a mismatch never loses data
const botIds = [...new Set(['default', getBotId()])];
let allRows = [];
for (const bid of botIds) {
    try {
        const r = await db.getAll('sudoers', { bot_id: bid });
        if (r?.length) allRows.push(...r);
    } catch {}
}

// Deduplicate by phone_number — real bot_id rows win over 'default' rows
const seen = new Map();
for (const row of allRows) {
    if (!seen.has(row.phone_number)) seen.set(row.phone_number, row);
}

if (seen.size > 0) {
    sudoData.sudoers = [];
    sudoData.addedAt = {};
    sudoData.jidMap = {};
    for (const [num, row] of seen) {
        sudoData.sudoers.push(num);
        if (row.added_at) sudoData.addedAt[num] = row.added_at;
        if (row.jid) sudoData.jidMap[num] = row.jid.split(',').filter(Boolean);
    }

    // Re-save all rows under the current (real) bot_id so they're correct next time
    if (getBotId() !== 'default') syncSudoToDb(sudoData);
} else {
    sudoData.sudoers = [];
    sudoData.addedAt = {};
    sudoData.jidMap = {};
}

        // Load sudomode flag from the 'sudo_config' table
        const configRow = await db.get('sudo_config', getBotId(), 'bot_id');
        if (configRow) {
            configData.sudomode = configRow.sudomode || false;
        } else {
            configData.sudomode = false;
        }

        // Load LID → phone mappings from the 'lid_map' table
        const lidRows = await db.getAll('lid_map');
        if (lidRows && lidRows.length > 0) {
            lidMap = {};
            for (const row of lidRows) {
                lidMap[row.lid] = row.phone_number;
            }
        }

    } catch (err) {
        console.error('⚠️ Sudo: Init error:', err.message);
    }
}

// Write the current in-memory sudo list to the database.
// Upserts each sudoer row (insert or update) in case a row already exists.
function syncSudoToDb(data) {
    if (!db.isAvailable()) return;
    try {
        for (const num of data.sudoers) {
            const jids = (data.jidMap && data.jidMap[num]) || [];
            db.upsert('sudoers', {
                phone_number: num,
                bot_id: getBotId(),
                jid: jids.join(',') || null,
                added_at: (data.addedAt && data.addedAt[num]) || new Date().toISOString()
            }, 'phone_number,bot_id').catch(() => {});
        }
    } catch {}
}

// Add a phone number to the sudo list.
// `jid` is optional — the WhatsApp JID of the contact (may differ from number).
// Returns { success, reason/number } so the caller can reply with a status.
export function addSudo(number, jid) {
    const clean = cleanNumber(number);
    if (!clean) return { success: false, reason: 'Invalid number' };

    // If already a sudo, just record the new JID if one was provided
    if (sudoData.sudoers.includes(clean)) {
        if (jid && jid !== clean) {
            sudoData.jidMap = sudoData.jidMap || {};
            sudoData.jidMap[clean] = sudoData.jidMap[clean] || [];
            if (!sudoData.jidMap[clean].includes(jid)) {
                sudoData.jidMap[clean].push(jid);
            }
            syncSudoToDb(sudoData);
        }
        return { success: false, reason: 'Already a sudo user' };
    }

    // Add to in-memory list
    sudoData.sudoers.push(clean);
    sudoData.addedAt = sudoData.addedAt || {};
    sudoData.addedAt[clean] = new Date().toISOString();

    // Record the JID mapping if a JID was supplied and it differs from number
    if (jid && jid !== clean) {
        sudoData.jidMap = sudoData.jidMap || {};
        sudoData.jidMap[clean] = [jid];
    }

    syncSudoToDb(sudoData);

    // Mirror to PostgreSQL async
    if (globalThis.pg?.isReady) {
        globalThis.pg.query(
            `INSERT INTO sudoers (bot_id, phone, added_at) VALUES ($1, $2, NOW())
             ON CONFLICT (bot_id, phone) DO NOTHING`,
            [getBotId(), clean]
        ).catch(() => {});
    }

    return { success: true, number: clean };
}

// Associate an additional JID with an existing sudo number.
// Called when the bot discovers a new LID or device JID for a known sudo.
export function addSudoJid(number, jid) {
    const clean = cleanNumber(number);
    if (!clean) return;
    if (!sudoData.sudoers.includes(clean)) return; // not a sudo — ignore

    sudoData.jidMap = sudoData.jidMap || {};
    sudoData.jidMap[clean] = sudoData.jidMap[clean] || [];

    // Strip the @s.whatsapp.net and device ID prefix to get the raw number
    const rawJid = jid.split('@')[0].split(':')[0];
    if (!sudoData.jidMap[clean].includes(rawJid)) {
        sudoData.jidMap[clean].push(rawJid);
        syncSudoToDb(sudoData);
    }
}

// Remove a phone number from the sudo list.
// Also deletes the corresponding row from the database.
// Returns { success, reason/number }.
export function removeSudo(number) {
    const clean = cleanNumber(number);
    if (!clean) return { success: false, reason: 'Invalid number' };

    const index = sudoData.sudoers.indexOf(clean);
    if (index === -1) {
        return { success: false, reason: 'Not a sudo user' };
    }

    // Remove from all in-memory structures
    sudoData.sudoers.splice(index, 1);
    if (sudoData.addedAt) delete sudoData.addedAt[clean];
    if (sudoData.jidMap) delete sudoData.jidMap[clean];

    // Remove from database
    if (db.isAvailable()) {
        db.removeWhere('sudoers', { phone_number: clean, bot_id: getBotId() }).catch(() => {});
    }

    // Mirror to PostgreSQL async
    if (globalThis.pg?.isReady) {
        globalThis.pg.query(
            `DELETE FROM sudoers WHERE bot_id = $1 AND phone = $2`,
            [getBotId(), clean]
        ).catch(() => {});
    }

    return { success: true, number: clean };
}

// Return a copy of the full sudo list with addedAt timestamps and JID maps.
export function getSudoList() {
    return { sudoers: sudoData.sudoers || [], addedAt: sudoData.addedAt || {}, jidMap: sudoData.jidMap || {} };
}

// Check if a raw phone number string belongs to a sudo user.
// Also checks all known JIDs for each sudo number so LID-format messages match.
export function isSudoNumber(number) {
    const clean = cleanNumber(number);
    if (!clean) return false;

    // Direct match — the number itself is in the sudoers list
    if (sudoData.sudoers.includes(clean)) return true;

    // JID map match — the number appears as a JID alias for a known sudo
    if (sudoData.jidMap) {
        for (const [sudoNum, jids] of Object.entries(sudoData.jidMap)) {
            if (sudoData.sudoers.includes(sudoNum) && jids.includes(clean)) {
                return true;
            }
        }
    }
    return false;
}

// Check if a full WhatsApp JID (e.g. "254712345678@s.whatsapp.net") belongs
// to a sudo user.  Strips the @suffix and device prefix before comparing.
export function isSudoJid(senderJid) {
    if (!senderJid) return false;
    const rawNumber = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (!rawNumber) return false;

    if (sudoData.sudoers.includes(rawNumber)) return true;

    if (sudoData.jidMap) {
        for (const [sudoNum, jids] of Object.entries(sudoData.jidMap)) {
            if (sudoData.sudoers.includes(sudoNum) && jids.includes(rawNumber)) {
                return true;
            }
        }
    }
    return false;
}

// Remove ALL sudo users at once.
// Called by the ?clearsudo command.
// Returns { removed } with the count of users that were removed.
export function clearAllSudo(ownerNumber) {
    const removed = sudoData.sudoers.length;
    const oldSudoers = [...sudoData.sudoers];
    sudoData.sudoers = [];
    sudoData.addedAt = {};
    sudoData.jidMap = {};

    // Delete each row from the database individually
    if (db.isAvailable()) {
        for (const num of oldSudoers) {
            db.removeWhere('sudoers', { phone_number: num, bot_id: getBotId() }).catch(() => {});
        }
    }

    return { removed };
}

// Get the current sudomode flag.
// When true, ALL group members are treated as sudo (open admin access).
export function getSudoMode() {
    return configData.sudomode || false;
}

// Enable or disable sudomode and persist the change to the database.
export function setSudoMode(enabled) {
    configData.sudomode = enabled;

    if (db.isAvailable()) {
        db.upsert('sudo_config', {
            id: 'main',
            bot_id: getBotId(),
            sudomode: enabled,
            updated_at: new Date().toISOString()
        }, 'id,bot_id').catch(() => {});
    }

    // Mirror to pg bot_configs so sudomode survives Heroku dyno resets
    if (globalThis.pg?.isReady) {
        globalThis.pg.query(
            `INSERT INTO bot_configs (bot_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
             ON CONFLICT (bot_id, key) DO UPDATE SET value = excluded.value, updated_at = NOW()`,
            [getBotId(), '__sudomode__', enabled ? 'true' : 'false']
        ).catch(() => {});
    }

    return enabled;
}

// Return the total number of sudo users currently registered.
export function getSudoCount() {
    return sudoData.sudoers.length;
}

// ── LID mapping ────────────────────────────────────────────────────────────
// WhatsApp Linked Device IDs (LIDs) look like a plain number but have a
// different format to normal phone JIDs.  When the bot sees a message from
// a LID it doesn't recognise, it can't tell if the sender is a sudo user.
// Mapping LIDs → phone numbers fixes that.

// Record that a LID belongs to a given phone number.
// Both values must be digits-only strings.  No-op if the mapping already exists.
export function mapLidToPhone(lidNumber, phoneNumber) {
    if (!lidNumber || !phoneNumber || lidNumber === phoneNumber) return;
    if (lidMap[lidNumber] === phoneNumber) return; // already mapped

    lidMap[lidNumber] = phoneNumber;

    // Persist to the lid_map table so the mapping survives restarts
    if (db.isAvailable()) {
        db.upsert('lid_map', {
            lid: lidNumber,
            phone_number: phoneNumber,
            updated_at: new Date().toISOString()
        }, 'lid').catch(() => {});
    }

    // Mirror to PostgreSQL async (fire-and-forget — never blocks SQLite)
    if (globalThis.pg?.isReady) {
        globalThis.pg.query(
            `INSERT INTO lid_map (lid, phone, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (lid) DO UPDATE SET phone = excluded.phone, updated_at = NOW()`,
            [lidNumber, phoneNumber]
        ).catch(() => {});
    }
}

// Look up the phone number for a LID.
// Returns null if the LID has never been seen before.
export function getPhoneFromLid(lidNumber) {
    return lidMap[lidNumber] || null;
}

// Returns true if a LID can be resolved to a phone number that is on the
// sudo list — combines LID lookup with isSudoNumber.
export function isSudoByLid(lidNumber) {
    if (!lidNumber) return false;
    const phone = lidMap[lidNumber];
    if (!phone) return false;
    return sudoData.sudoers.includes(phone);
}

// Returns true if any sudo user's phone number has NOT yet been seen as a
// WhatsApp JID / LID.  Used by autoScanGroupsForSudo() at startup to decide
// whether it needs to scan groups to build the LID mapping.
export function hasUnmappedSudos() {
    if (!sudoData.sudoers || sudoData.sudoers.length === 0) return false;
    const mappedPhones = new Set(Object.values(lidMap));
    return sudoData.sudoers.some(phone => !mappedPhones.has(phone));
}

// ── Migration helper ────────────────────────────────────────────────────────
// Push the entire in-memory sudo state into the database in one go.
// Useful after a database reset or when first setting up a new bot instance.
export async function migrateSudoToSupabase() {
    if (!db.isAvailable()) return false;
    try {
        for (const num of sudoData.sudoers) {
            const jids = (sudoData.jidMap && sudoData.jidMap[num]) || [];
            await db.upsert('sudoers', {
                phone_number: num,
                bot_id: getBotId(),
                jid: jids.join(',') || null,
                added_at: (sudoData.addedAt && sudoData.addedAt[num]) || new Date().toISOString()
            }, 'phone_number,bot_id');
        }

        await db.upsert('sudo_config', {
            id: 'main',
            bot_id: getBotId(),
            sudomode: configData.sudomode || false,
            updated_at: new Date().toISOString()
        }, 'id,bot_id');

        for (const [lid, phone] of Object.entries(lidMap)) {
            await db.upsert('lid_map', {
                lid,
                phone_number: phone,
                updated_at: new Date().toISOString()
            }, 'lid');
        }

        return true;
    } catch (err) {
        console.error('⚠️ Supabase: Sudo migration error:', err.message);
        return false;
    }
}
