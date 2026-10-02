// ── Migration Notice ─────────────────────────────────────────────────────────
// Controls whether a second notice is sent after the main success message.
//
// To STOP sending the notice:  change true → false  (one word, that's it)
// To START sending the notice: change false → true
// ─────────────────────────────────────────────────────────────────────────────

const ENABLED = false ;

// ─────────────────────────────────────────────────────────────────────────────

import { OWNER, PROFILE_URL, REPO_URL, AVATAR_URL } from './repoConfig.js';

const NEW_GITHUB_PROFILE = PROFILE_URL;
const NEW_GITHUB_REPO    = REPO_URL;

export async function sendMigrationNotice(sock, jid) {
    if (!ENABLED) return;
    try {
        const notice =
            `⚠️ *Important Notice from Silent Wolf*\n\n` +
            `My previous GitHub account has been *flagged* and is no longer accessible. 🚫\n\n` +
            `📌 *Please use my new official account going forward:*\n` +
            `🐙 Profile: ${NEW_GITHUB_PROFILE}\n` +
            `📦 Repo: ${NEW_GITHUB_REPO}\n\n` +
            `All future updates, releases, and source code will be published here.\n` +
            `Thanks for your continued support! `;

        await sock.sendMessage(jid, {
            text: notice,
            contextInfo: {
                externalAdReply: {
                    title: `⚠️ Account Migrated — Follow the New One`,
                    body: `github.com/${OWNER}`,
                    mediaType: 1,
                    thumbnailUrl: AVATAR_URL,
                    sourceUrl: NEW_GITHUB_REPO,
                    mediaUrl: NEW_GITHUB_REPO,
                    renderLargerThumbnail: false
                }
            }
        });
    } catch {
        // Silent fail — never crash the main flow
    }
}
