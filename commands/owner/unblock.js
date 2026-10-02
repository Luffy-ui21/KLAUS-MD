import { delay } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { resolveJid } from '../tools/getjid.js';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// Find the actual blocked JID (in its real WA-server format) that matches the
// requested phone number. Returns a tri-state result so callers can
// distinguish "fetch failed" from "not on the blocklist".
//   { fetchOk: true,  foundJid: '<jid>'|null, error: null }
//   { fetchOk: false, foundJid: null,         error: '<msg>' }
async function findBlockedJidByNumber(sock, targetNum) {
    if (!targetNum) return { fetchOk: true, foundJid: null, error: null };

    let blocklist;
    try {
        blocklist = await sock.fetchBlocklist();
    } catch (err) {
        return { fetchOk: false, foundJid: null, error: err?.message || String(err) };
    }
    if (!Array.isArray(blocklist) || blocklist.length === 0) {
        return { fetchOk: true, foundJid: null, error: null };
    }

    const resolveLid = globalThis.resolvePhoneFromLidAsync;
    const wantNum = onlyDigits(targetNum);

    for (const jid of blocklist) {
        if (!jid || typeof jid !== 'string') continue;
        const rawNum = onlyDigits(jid.split('@')[0].split(':')[0]);

        // Direct digit match (covers @s.whatsapp.net entries)
        if (rawNum && rawNum === wantNum) return { fetchOk: true, foundJid: jid, error: null };

        // LID entry — resolve to phone number and compare on digits only
        if (jid.endsWith('@lid') && typeof resolveLid === 'function') {
            try {
                const phone = await resolveLid(jid);
                const phoneNum = onlyDigits(phone);
                if (phoneNum && phoneNum === wantNum) {
                    return { fetchOk: true, foundJid: jid, error: null };
                }
            } catch {}
        }
    }
    return { fetchOk: true, foundJid: null, error: null };
}

async function attemptUnblock(sock, jid) {
    // Primary: Baileys' documented API (same one unblockall uses successfully)
    try {
        await sock.updateBlockStatus(jid, 'unblock');
        return { ok: true, method: 'updateBlockStatus' };
    } catch (e1) {
        const errMsg = e1?.message || String(e1);
        console.log(`[UNBLOCK] updateBlockStatus failed for ${jid}: ${errMsg}`);

        // Fallback: raw IQ in case the high-level helper has a JID-format quirk
        try {
            await sock.query({
                tag: 'iq',
                attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' },
                content: [{
                    tag: 'list',
                    attrs: { action: 'unblock' },
                    content: [{ tag: 'item', attrs: { jid } }],
                }],
            });
            return { ok: true, method: 'iq-query' };
        } catch (e2) {
            const errMsg2 = e2?.message || String(e2);
            console.log(`[UNBLOCK] IQ fallback failed for ${jid}: ${errMsg2}`);
            return { ok: false, error: errMsg2 };
        }
    }
}

// Re-check blocklist multiple times to confirm the entry is gone.
// Returns { verified: true|false, fetchOk: true|false }.
async function verifyUnblocked(sock, targetNum, attemptedJid) {
    const delays = [600, 1200, 2000];
    let lastFetchOk = false;
    for (const ms of delays) {
        await delay(ms);
        const r = await findBlockedJidByNumber(sock, targetNum);
        if (r.fetchOk) {
            lastFetchOk = true;
            // Also tolerate the case where the matched JID is gone but blocklist
            // still has an unrelated stale entry under another format.
            if (!r.foundJid || r.foundJid !== attemptedJid) {
                if (!r.foundJid) return { verified: true, fetchOk: true };
                // foundJid changed format — re-attempt may be needed
                return { verified: false, fetchOk: true, foundJid: r.foundJid };
            }
        }
    }
    return { verified: false, fetchOk: lastFetchOk };
}

export default {
    name: 'unblock',
    description: 'Unblock a user by number, mention, or reply',
    category: 'owner',
    async execute(sock, msg, args) {
        const { key, message } = msg;
        const chatId = key.remoteJid;

        // ── Resolve target ─────────────────────────────────────────
        let rawTarget = null;
        if (args[0]) {
            const num = onlyDigits(args[0]);
            if (num.length >= 7) rawTarget = `${num}@s.whatsapp.net`;
        }
        if (!rawTarget) {
            const mentioned = message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentioned?.length > 0) rawTarget = mentioned[0];
        }
        if (!rawTarget) {
            const quoted = message?.extendedTextMessage?.contextInfo?.participant;
            if (quoted) rawTarget = quoted;
        }

        if (!rawTarget) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🕊️ *UNBLOCK* ⌋\n│\n├─⊷ */unblock <number>*\n│  └⊷ e.g. /unblock 254712345678\n├─⊷ *Tag* or *reply* to a user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        if (rawTarget.endsWith('@g.us') || rawTarget.endsWith('@newsletter')) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Cannot unblock a group or newsletter.',
            }, { quoted: msg });
        }

        // React with hourglass while we work
        try { await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }); } catch {}

        try {
            const target = await resolveJid(sock, rawTarget);
            const targetNum = onlyDigits((target || rawTarget).split('@')[0].split(':')[0]);

            console.log(`[UNBLOCK] rawTarget=${rawTarget} resolved=${target} num=${targetNum}`);

            const botNum = onlyDigits((sock.user?.id || '').split(':')[0].split('@')[0]);
            if (botNum && targetNum && botNum === targetNum) {
                try { await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `⚠️ Cannot unblock the bot's own number.`,
                }, { quoted: msg });
            }

            if (!targetNum || targetNum.length < 7) {
                try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `⚠️ Could not resolve this user.\n\nTry the number directly:\n*/unblock 254712345678*`,
                }, { quoted: msg });
            }

            // ── Always remove from bot-side cache first (PN form) ──
            // This stops the bot from ignoring the user even if WA-side fails.
            const removeFromBotCache = (jid) => {
                if (typeof globalThis.removeBlockedUser === 'function') {
                    try { globalThis.removeBlockedUser(jid); } catch {}
                }
            };
            removeFromBotCache(`${targetNum}@s.whatsapp.net`);

            // ── Find the EXACT blocked JID format on the WA server ──
            const lookup = await findBlockedJidByNumber(sock, targetNum);

            if (!lookup.fetchOk) {
                // Honest failure — we couldn't confirm anything
                try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `❌ *Could not verify block list.*\n\nFailed to fetch the WhatsApp block list, so the unblock could not be performed safely.\n\n_Reason: ${lookup.error || 'Unknown'}_\n\nTry again in a moment.`,
                }, { quoted: msg });
            }

            if (!lookup.foundJid) {
                // Definitively not on the WA blocklist
                try { await sock.sendMessage(chatId, { react: { text: 'ℹ️', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `ℹ️ *+${targetNum}* is not on your WhatsApp block list.\n\n_If the bot was ignoring them locally, that has now been cleared._`,
                }, { quoted: msg });
            }

            const matchedJid = lookup.foundJid;
            console.log(`[UNBLOCK] Matched blocklist entry: ${matchedJid}`);

            // Also clear the matched JID from bot-side cache (handles @lid keys)
            removeFromBotCache(matchedJid);

            // ── Attempt the WA-level unblock and AWAIT the result ──
            const result = await attemptUnblock(sock, matchedJid);

            // ── Verify with retries (handles WA propagation lag) ──
            const verify = await verifyUnblocked(sock, targetNum, matchedJid);

            if (verify.verified) {
                try { await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }); } catch {}
                await sock.sendMessage(chatId, {
                    text: `🌕 *Unblocked.*\n\n✅ +${targetNum} has been unblocked.`,
                }, { quoted: msg });
                return;
            }

            // Could not verify — be honest about the state
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
            let errLine;
            if (!verify.fetchOk) {
                errLine = '_Could not re-verify the block list to confirm. Check WhatsApp app: Settings → Privacy → Blocked Contacts._';
            } else if (result.ok) {
                errLine = '_WhatsApp accepted the request but the entry is still on the block list. Try again, or unblock manually: Settings → Privacy → Blocked Contacts._';
            } else {
                errLine = `_Reason: ${result.error || 'Unknown'}_`;
            }
            await sock.sendMessage(chatId, {
                text: `❌ *Unblock failed.*\n\nCould not remove +${targetNum} from the WhatsApp block list.\n\n${errLine}`,
            }, { quoted: msg });
        } catch (err) {
            console.error('[UNBLOCK] unexpected error:', err?.message);
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
            try {
                await sock.sendMessage(chatId, {
                    text: `❌ Unblock failed.\n\n_Error: ${err?.message || 'Unknown'}_`,
                }, { quoted: msg });
            } catch {}
        }
    },
};
