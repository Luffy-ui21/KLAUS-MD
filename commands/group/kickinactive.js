import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { getGroupActivity, trackingStartedAt } from '../../lib/groupActivity.js';

const BRAND = () => getOwnerName().toUpperCase();

// Pending confirmations: confirmId → { groupJid, jids, expiresAt }
const _pending = new Map();
globalThis._kickInactivePending = _pending;

// Cleanup expired confirmations every minute
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _pending) if (v.expiresAt < now) _pending.delete(k);
}, 60_000).unref?.();

function fmtAge(ms) {
    const d = Math.floor(ms / 86_400_000);
    if (d >= 1) return `${d}d`;
    const h = Math.floor(ms / 3_600_000);
    if (h >= 1) return `${h}h`;
    const m = Math.floor(ms / 60_000);
    return `${m}m`;
}

export default {
    name: 'kickinactive',
    alias: ['kickidle', 'kickdead', 'inactivekick'],
    description: 'Kick group members who have not sent a message in N days',
    category: 'group',
    usage: '.kickinactive <days>  |  .kickinactive list <days>  |  .kickinactive confirm',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, {
                text: '❌ This command only works in groups.'
            }, { quoted: msg });
        }

        // ── Permissions ──────────────────────────────────────────────────
        let groupMeta;
        try { groupMeta = await sock.groupMetadata(chatId); }
        catch { return sock.sendMessage(chatId, { text: '❌ Failed to fetch group info.' }, { quoted: msg }); }

        const senderJid   = msg.key.participant || chatId;
        const senderClean = senderJid.split(':')[0].split('@')[0];
        const senderP     = groupMeta.participants.find(
            p => p.id.split(':')[0].split('@')[0] === senderClean
        );
        const isAdmin = senderP?.admin === 'admin' || senderP?.admin === 'superadmin';
        const isOwner = typeof extra?.isOwner === 'function' ? extra.isOwner() : !!extra?.isOwner;
        const isSudo  = typeof extra?.isSudo  === 'function' ? extra.isSudo()  : !!extra?.isSudo;

        if (!isAdmin && !isOwner && !isSudo) {
            return sock.sendMessage(chatId, {
                text: '❌ Only group admins can use this command.'
            }, { quoted: msg });
        }

        // Check bot is admin (needed to kick)
        const botNumClean = (sock.user?.id || '').split(':')[0].split('@')[0];
        const botP = groupMeta.participants.find(
            p => p.id.split(':')[0].split('@')[0] === botNumClean
        );
        const botIsAdmin = botP?.admin === 'admin' || botP?.admin === 'superadmin';
        if (!botIsAdmin) {
            return sock.sendMessage(chatId, {
                text: '❌ Bot must be a group admin to kick members.'
            }, { quoted: msg });
        }

        const sub = (args[0] || '').toLowerCase();

        // ── CONFIRM ──────────────────────────────────────────────────────
        if (sub === 'confirm') {
            const pending = _pending.get(chatId);
            if (!pending) {
                return sock.sendMessage(chatId, {
                    text: `❌ Nothing to confirm. Run \`${PREFIX}kickinactive <days>\` first.`
                }, { quoted: msg });
            }

            _pending.delete(chatId);
            const targets = pending.jids;
            await sock.sendMessage(chatId, {
                text: `⏳ Kicking ${targets.length} inactive member(s)...`
            }, { quoted: msg });

            let ok = 0, fail = 0;
            for (const jid of targets) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [jid], 'remove');
                    ok++;
                } catch { fail++; }
                await new Promise(r => setTimeout(r, 600)); // throttle to avoid bans
            }

            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🧹 *INACTIVE KICK DONE* ⌋\n` +
                    `├─⊷ ✅ Kicked: ${ok}\n` +
                    `├─⊷ ❌ Failed: ${fail}\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        // ── Parse days ───────────────────────────────────────────────────
        const isList = sub === 'list';
        const daysArg = isList ? args[1] : args[0];
        const days = parseInt(daysArg, 10);

        if (!days || days < 1 || days > 365) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 🧹 *KICK INACTIVE* ⌋\n` +
                    `│\n` +
                    `├─⊷ *${PREFIX}kickinactive <days>*\n` +
                    `│  └⊷ Find & kick members inactive for N days\n` +
                    `├─⊷ *${PREFIX}kickinactive list <days>*\n` +
                    `│  └⊷ Preview only (no kick)\n` +
                    `├─⊷ *${PREFIX}kickinactive confirm*\n` +
                    `│  └⊷ Confirm pending kick\n` +
                    `│\n` +
                    `├─⊷ *Days:* 1 – 365\n` +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        // ── Find inactive members ────────────────────────────────────────
        const cutoff = Date.now() - days * 86_400_000;
        const activity = getGroupActivity(chatId);
        const startedAt = trackingStartedAt(chatId);

        const inactive = [];
        for (const p of groupMeta.participants) {
            const pid = p.id;
            const pClean = pid.split(':')[0].split('@')[0];

            // Skip bot itself
            if (pClean === botNumClean) continue;
            // Skip admins (don't kick admins automatically — owner-only safety)
            if (p.admin === 'admin' || p.admin === 'superadmin') continue;
            // Skip command sender
            if (pClean === senderClean) continue;
            // Skip group owner
            if (groupMeta.owner && pid === groupMeta.owner) continue;

            const last = activity[pid] || 0;
            if (last < cutoff) {
                inactive.push({ jid: pid, last });
            }
        }

        // Sort: oldest inactive first
        inactive.sort((a, b) => a.last - b.last);

        // ── Warn if no tracking history yet ──────────────────────────────
        const trackingDays = startedAt ? Math.floor((Date.now() - startedAt) / 86_400_000) : 0;
        let warning = '';
        if (!startedAt) {
            warning = `\n⚠️ *No activity history yet.* Tracking just started — every member will appear inactive. Wait at least ${days} day(s) before using this.\n`;
        } else if (trackingDays < days) {
            warning = `\n⚠️ *Tracking only began ${trackingDays} day(s) ago.* Members with no recorded activity may simply have not sent a message during that window.\n`;
        }

        if (inactive.length === 0) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ✅ *NO INACTIVE MEMBERS* ⌋\n` +
                    `├─⊷ All non-admin members active in last ${days}d\n` +
                    (warning ? `│${warning}│\n` : '') +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        // ── Build preview list (first 30) ────────────────────────────────
        const preview = inactive.slice(0, 30);
        const mentions = preview.map(x => x.jid);
        let body = '';
        for (const x of preview) {
            const tag = `@${x.jid.split('@')[0]}`;
            const ageStr = x.last === 0 ? 'never' : `${fmtAge(Date.now() - x.last)} ago`;
            body += `│ • ${tag}  (${ageStr})\n`;
        }
        if (inactive.length > 30) {
            body += `│ ... and ${inactive.length - 30} more\n`;
        }

        // ── List mode: just show, no kick ────────────────────────────────
        if (isList) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 📋 *INACTIVE MEMBERS (${inactive.length})* ⌋\n` +
                    `├─⊷ Threshold: ${days} day(s)\n` +
                    (warning ? `│${warning}│\n` : '│\n') +
                    body +
                    `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
                mentions
            }, { quoted: msg });
        }

        // ── Stage the kick — require confirm ─────────────────────────────
        _pending.set(chatId, {
            groupJid: chatId,
            jids: inactive.map(x => x.jid),
            expiresAt: Date.now() + 5 * 60_000  // 5 min
        });

        return sock.sendMessage(chatId, {
            text:
                `╭─⌈ ⚠️ *CONFIRM KICK* ⌋\n` +
                `├─⊷ ${inactive.length} member(s) inactive for ${days}+ day(s)\n` +
                (warning ? `│${warning}│\n` : '│\n') +
                body +
                `│\n` +
                `├─⊷ Reply with *${PREFIX}kickinactive confirm*\n` +
                `├─⊷ Expires in 5 minutes\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`,
            mentions
        }, { quoted: msg });
    }
};
