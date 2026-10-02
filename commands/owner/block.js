import { delay } from 'wolfsocket';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { resolveJid } from '../tools/getjid.js';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// Find a blocklist entry matching this phone number across both
// @s.whatsapp.net and @lid formats. Returns:
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
        if (rawNum && rawNum === wantNum) return { fetchOk: true, foundJid: jid, error: null };
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

// Try a single IQ shape, return {ok, error}
async function tryBlockIQ(sock, label, node) {
    try {
        await sock.query(node);
        console.log(`[BLOCK] ${label} accepted by WA`);
        return { ok: true, method: label };
    } catch (e) {
        const errMsg = e?.message || String(e);
        console.log(`[BLOCK] ${label} failed: ${errMsg}`);
        return { ok: false, error: errMsg, method: label };
    }
}

async function attemptBlock(sock, jid) {
    const dt = Math.floor(Date.now() / 1000).toString();
    const attempts = [
        // 1) Baileys' documented format
        {
            label: 'baileys-item',
            node: {
                tag: 'iq',
                attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' },
                content: [{ tag: 'item', attrs: { action: 'block', jid } }],
            },
        },
        // 2) Baileys' format + `dt` decision-time attr (modern WA requirement)
        {
            label: 'baileys-item+dt',
            node: {
                tag: 'iq',
                attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' },
                content: [{ tag: 'item', attrs: { action: 'block', jid, dt } }],
            },
        },
        // 3) Wrapped in <list action='block'><item jid=.../></list>
        {
            label: 'list-wrapped',
            node: {
                tag: 'iq',
                attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' },
                content: [{
                    tag: 'list',
                    attrs: { action: 'block' },
                    content: [{ tag: 'item', attrs: { jid, dt } }],
                }],
            },
        },
    ];

    let lastErr = 'no-attempts';
    for (const a of attempts) {
        const r = await tryBlockIQ(sock, a.label, a.node);
        if (r.ok) return r;
        lastErr = r.error;
        // Stop trying more shapes if WA is rejecting the request itself, not the format
        if (r.error === 'not-authorized' || r.error === 'forbidden' || r.error === 'service-unavailable') {
            return { ok: false, error: r.error, method: a.label, fatal: true };
        }
    }
    return { ok: false, error: lastErr };
}

// Try to resolve a phone JID to its @lid form via WA usync
async function tryResolveLid(sock, pnJid) {
    try {
        if (typeof sock.executeUSyncQuery !== 'function') return null;
        const { USyncQuery, USyncUser } =
            await import('wolfsocket').catch(() => ({}));
        if (!USyncQuery || !USyncUser) return null;
        const q = new USyncQuery().withLIDProtocol().withContext('background');
        q.withUser(new USyncUser().withId(pnJid));
        const result = await sock.executeUSyncQuery(q);
        const entry = result?.list?.find(x => x.lid);
        if (entry?.lid) return entry.lid;
    } catch (e) {
        console.log(`[BLOCK] usync LID lookup failed: ${e?.message || e}`);
    }
    return null;
}

// Re-check blocklist a few times to confirm the entry actually appeared.
// Returns { verified, fetchOk }.
async function verifyBlocked(sock, targetNum) {
    const delays = [600, 1200, 2000];
    let lastFetchOk = false;
    for (const ms of delays) {
        await delay(ms);
        const r = await findBlockedJidByNumber(sock, targetNum);
        if (r.fetchOk) {
            lastFetchOk = true;
            if (r.foundJid) return { verified: true, fetchOk: true };
        }
    }
    return { verified: false, fetchOk: lastFetchOk };
}

export default {
    name: 'block',
    description: 'Block a user on WhatsApp (server + bot-side)',
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
                text: `╭─⌈ 🚫 *BLOCK* ⌋\n│\n├─⊷ */block <number>*\n│  └⊷ e.g. /block 254712345678\n├─⊷ *Tag* or *reply* to a user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            }, { quoted: msg });
        }

        if (rawTarget.endsWith('@g.us') || rawTarget.endsWith('@newsletter')) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Cannot block a group or newsletter.',
            }, { quoted: msg });
        }

        // ⏳ React while we work
        try { await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }); } catch {}

        try {
            const target = await resolveJid(sock, rawTarget);
            const targetNum = onlyDigits((target || rawTarget).split('@')[0].split(':')[0]);

            console.log(`[BLOCK] rawTarget=${rawTarget} resolved=${target} num=${targetNum}`);

            // Self-block guard
            const botNum = onlyDigits((sock.user?.id || '').split(':')[0].split('@')[0]);
            if (botNum && targetNum && botNum === targetNum) {
                try { await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `⚠️ Cannot block the bot's own number.`,
                }, { quoted: msg });
            }

            if (!targetNum || targetNum.length < 7) {
                try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `⚠️ Could not resolve this user.\n\nTry the number directly:\n*/block 254712345678*`,
                }, { quoted: msg });
            }

            const pnJid = `${targetNum}@s.whatsapp.net`;

            // ── 1) LOCAL SOFT BLOCK (ALWAYS first — guaranteed safety net) ──
            // Runs before any WA-side check so the bot stops responding to
            // this user even if WA validation/blocking fails downstream.
            let softBlockApplied = false;
            if (typeof globalThis.addBlockedUser === 'function') {
                try {
                    globalThis.addBlockedUser(pnJid);
                    softBlockApplied = true;
                } catch (e) {
                    console.log(`[BLOCK] addBlockedUser failed: ${e?.message || e}`);
                }
            }

            // ── 2) Validate the number actually exists on WhatsApp ──
            try {
                const check = await sock.onWhatsApp(pnJid);
                const ok = Array.isArray(check) && check[0]?.exists;
                if (!ok) {
                    try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
                    const softLine = softBlockApplied
                        ? '\n\n_Bot-side block was still applied (the bot will ignore this number)._'
                        : '';
                    return sock.sendMessage(chatId, {
                        text: `❌ +${targetNum} is not registered on WhatsApp.${softLine}`,
                    }, { quoted: msg });
                }
            } catch {} // if onWhatsApp fails, just continue and let WA decide

            // ── 3) Skip WA call if already on WA blocklist ────────
            const pre = await findBlockedJidByNumber(sock, targetNum);
            if (pre.fetchOk && pre.foundJid) {
                try { await sock.sendMessage(chatId, { react: { text: 'ℹ️', key: msg.key } }); } catch {}
                return sock.sendMessage(chatId, {
                    text: `ℹ️ *+${targetNum}* is already on your WhatsApp block list.`,
                }, { quoted: msg });
            }

            // ── 4) Attempt the WA-server block (phone form) ──
            let result = await attemptBlock(sock, pnJid);

            // ── 5) Verify with retries ──
            let verify = await verifyBlocked(sock, targetNum);

            // ── 5b) If phone-form failed/no-op'd, try LID form ──
            if (!verify.verified && !result.fatal) {
                const lid = await tryResolveLid(sock, pnJid);
                if (lid) {
                    console.log(`[BLOCK] Retrying with LID ${lid}`);
                    const lidResult = await attemptBlock(sock, lid);
                    const lidVerify = await verifyBlocked(sock, targetNum);
                    if (lidVerify.verified) {
                        result = lidResult;
                        verify = lidVerify;
                    } else {
                        // Keep the more informative error
                        if (lidResult.ok && !result.ok) result = lidResult;
                    }
                } else {
                    console.log(`[BLOCK] No LID available for ${pnJid}`);
                }
            }

            // ── 6) Four-state honest reporting ────────────────────
            // a) ✅ Fully blocked — WA verified
            if (verify.verified) {
                try { await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } }); } catch {}
                await sock.sendMessage(chatId, {
                    text: `🚫 *Blocked.*\n\n✅ +${targetNum} has been blocked at the WhatsApp level.`,
                }, { quoted: msg });
                return;
            }

            // Build the WA-side failure reason
            let reason;
            if (!verify.fetchOk) {
                reason = '_Could not re-verify the block list to confirm._';
            } else if (result.ok) {
                reason = '_WhatsApp accepted the request but the entry did not appear on the block list._';
            } else {
                reason = `_Reason: ${result.error || 'Unknown'}_`;
            }

            // b) ⚠️ Partial — soft-block worked, WA did not
            if (softBlockApplied) {
                try { await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } }); } catch {}
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Partial block.*\n\nBot-side block applied — the bot will ignore +${targetNum}.\n\nWhatsApp-level block did NOT take effect.\n${reason}\n\n*To fully block:* open their chat → tap their name → *Block*.`,
                }, { quoted: msg });
                return;
            }

            // c) ❌ Total failure — neither WA nor soft-block worked
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
            await sock.sendMessage(chatId, {
                text: `❌ *Block failed.*\n\nNeither the WhatsApp-level block nor the bot-side block was applied for +${targetNum}.\n${reason}\n\n*To block manually:* open their chat → tap their name → *Block*.`,
            }, { quoted: msg });
        } catch (err) {
            console.error('[BLOCK] unexpected error:', err?.message);
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
            try {
                await sock.sendMessage(chatId, {
                    text: `❌ Block failed.\n\n_Error: ${err?.message || 'Unknown'}_`,
                }, { quoted: msg });
            } catch {}
        }
    },
};
