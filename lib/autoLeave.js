// ============================================================
// lib/autoLeave.js  —  Auto-Leave Groups & Auto-Unfollow Channels
// ============================================================
//
// WHAT IT DOES:
//   • Detects when the bot is added to a group it should avoid
//     → automatically leaves the moment it joins
//   • Detects when the bot receives a message from a channel it
//     should not follow → automatically unfollows
//
// HOW TO CONFIGURE:
//   Add entries to BLOCKED_GROUPS and/or BLOCKED_CHANNELS below.
//   Set the value to `true` to block, `false` to temporarily skip.
//
//   For GROUPS, you can provide:
//     - The full group JID:   '120363xxxxxxxxxxxxxxxxx@g.us'
//     - An invite code:       'AbCdEfGhIjKl'
//     - A full invite link:   'https://chat.whatsapp.com/AbCdEfGhIjKl'
//       (the module strips the URL prefix automatically)
//
//   For CHANNELS, you can provide:
//     - The full newsletter JID: '120363xxxxxxxxxxxxxxxxx@newsletter'
//     - A channel invite slug:   'xwolf'
//     - A full invite link:      'https://whatsapp.com/channel/xwolf'
//       (the module strips the URL prefix automatically)
//
//   You can add as many entries as you want, or leave a section
//   empty — neither section is required.
//
// EXAMPLE:
//   const BLOCKED_GROUPS = {
//       '120363123456789012@g.us': true,
//       'AbCdEfGhIjKlMnOp': true,
//       'https://chat.whatsapp.com/SomeInviteCode': true,
//   };
//   const BLOCKED_CHANNELS = {
//       '120363987654321098@newsletter': true,
//       'mychannel': true,
//   };
// ============================================================

// ── EDIT BELOW THIS LINE ──────────────────────────────────────

const BLOCKED_GROUPS = {
    // '120363xxxxxxxxxxxxxxxxx@g.us': true,
    // 'YourInviteCodeHere': true,
};

const BLOCKED_CHANNELS = {
    // '120363xxxxxxxxxxxxxxxxx@newsletter': true,
    // 'your-channel-slug': true,
};

// ── DO NOT EDIT BELOW (unless you know what you are doing) ───

let _sock = null;

/**
 * Call this once when the WhatsApp socket is ready.
 * @param {object} sock  Baileys socket instance
 */
export function init(sock) {
    _sock = sock;
}

/**
 * Strip URL prefixes and whitespace from a raw config key so it
 * can be compared directly against JIDs or invite codes.
 * @param {string} raw
 * @returns {string}
 */
function _normalise(raw) {
    return String(raw)
        .trim()
        .replace(/^https?:\/\/chat\.whatsapp\.com\//i, '')
        .replace(/^https?:\/\/whatsapp\.com\/channel\//i, '');
}

/**
 * Returns true if the given group JID or invite code appears in
 * BLOCKED_GROUPS with value === true.
 * @param {string} groupJid  e.g. '120363...@g.us'
 * @param {string} [inviteCode]  optional invite code if known
 */
export function isGroupBlocked(groupJid, inviteCode) {
    for (const [raw, enabled] of Object.entries(BLOCKED_GROUPS)) {
        if (!enabled) continue;
        const key = _normalise(raw);
        if (groupJid && groupJid === key) return true;
        if (inviteCode && inviteCode === key) return true;
    }
    return false;
}

/**
 * Returns true if the given channel newsletter JID or slug appears
 * in BLOCKED_CHANNELS with value === true.
 * @param {string} newsletterJid  e.g. '120363...@newsletter'
 * @param {string} [slug]  optional channel slug if known
 */
export function isChannelBlocked(newsletterJid, slug) {
    for (const [raw, enabled] of Object.entries(BLOCKED_CHANNELS)) {
        if (!enabled) continue;
        const key = _normalise(raw);
        if (newsletterJid && newsletterJid === key) return true;
        if (slug && slug === key) return true;
    }
    return false;
}

/**
 * Call this when the bot is added to a group.
 * If the group is in BLOCKED_GROUPS, the bot leaves silently.
 * @param {string} groupJid
 * @param {string} [inviteCode]
 */
export async function handleGroupJoin(groupJid, inviteCode) {
    if (!_sock) return;
    if (!isGroupBlocked(groupJid, inviteCode)) return;

    try {
        await _sock.groupLeave(groupJid);
    } catch {
        // Connection may have dropped — ignore
    }
}

/**
 * Call this when the bot receives a message from a newsletter channel.
 * If the channel is in BLOCKED_CHANNELS, the bot unfollows it silently.
 * @param {string} newsletterJid  e.g. '120363...@newsletter'
 */
export async function handleChannelMessage(newsletterJid) {
    if (!_sock) return;
    const slug = newsletterJid.split('@')[0];
    if (!isChannelBlocked(newsletterJid, slug)) return;

    try {
        await _sock.newsletterUnfollow(newsletterJid);
    } catch {
        // API may not be available on all Baileys builds — ignore
    }
}
