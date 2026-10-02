// // ── Comeback Notice ──────────────────────────────────────────────────────────
// // Sent to the owner after the bot reconnects, announcing that the GitHub
// // account / repository is back online after being temporarily flagged or
// // reviewed.
// //
// // To STOP sending the notice:  change true → false  (one word, that's it)
// // To START sending the notice: change false → true
// // ─────────────────────────────────────────────────────────────────────────────

// const ENABLED = true;

// // ─────────────────────────────────────────────────────────────────────────────

// import { OWNER, REPO_URL, PROFILE_URL, AVATAR_URL } from './repoConfig.js';

// const OWNER_NAME   = 'WOLF';
// const CHANNEL_LINK = 'https://whatsapp.com/channel/0029VbBLCPaJUM2TGTpRfP3F';

// export async function sendComebackNotice(sock, jid) {
//     if (!ENABLED) return;
//     try {
//         const notice =
//             `╭─⌈ 🎉 *GOOD NEWS!* ⌋\n` +
//             `│\n` +
//             `├─⊷ My GitHub account is *back online* ✅\n` +
//             `├─⊷ The review is complete — repo is fully restored\n` +
//             `├─⊷ Updates and source code are flowing again\n` +
//             `│\n` +
//             `├─⊷ 🐙 GitHub:  ${PROFILE_URL}\n` +
//             `├─⊷ 📦 Repo:    ${REPO_URL}\n` +
//             `├─⊷ 📣 Channel: ${CHANNEL_LINK}\n` +
//             `╰⊷ Thanks for sticking around! \n\n` +
//             `*Powered by ${OWNER_NAME} TECH*`;

//         await sock.sendMessage(jid, {
//             text: notice,
//             contextInfo: {
//                 externalAdReply: {
//                     title: `🎉 GitHub Account Restored — ${OWNER}`,
//                     body:  'Repo is back online — all systems go',
//                     mediaType: 1,
//                     thumbnailUrl: AVATAR_URL,
//                     sourceUrl:    REPO_URL,
//                     mediaUrl:     REPO_URL,
//                     renderLargerThumbnail: false
//                 }
//             }
//         });
//     } catch {
//         // Silent fail — never crash the main flow
//     }
// }














// ── Advert Slot ──────────────────────────────────────────────────────────────
// This file is your general-purpose advert broadcaster.
// It fires once to the owner whenever the bot reconnects.
//
// To run a new advert:  edit the ADVERT_MESSAGE block below and set ENABLED = true
// To pause adverts:     change true → false  (one word, that's it)
// ─────────────────────────────────────────────────────────────────────────────

const ENABLED = false;

// ─────────────────────────────────────────────────────────────────────────────

import { OWNER, AVATAR_URL } from './repoConfig.js';

const OWNER_NAME   = 'WOLF';
//const CHANNEL_LINK = 'https://whatsapp.com/channel/0029VbBLCPaJUM2TGTpRfP3F';

// ── Current Advert: VCF Site ─────────────────────────────────────────────────
const VCF_SITE     = 'https://vcf-by-wolftech.vercel.app/';
const ADVERT_TITLE = '📲 Get the KLAUS MD VCF Contact File';
const ADVERT_BODY  = 'Submit your contact & unlock the VCF file';

export async function sendComebackNotice(sock, jid) {
    if (!ENABLED) return;
    try {
        const notice =
            `╭─⌈ 📲 *VCF CONTACT FILE* ⌋\n` +
            `│\n` +
            `├⊷ Want all *KLAUS MD* contacts in one tap?\n` +
            `├⊷ Visit the link below 👇\n` +
            `│\n` +
            `├⊷ 🌐 *Site:*    ${VCF_SITE}\n` +
            `│\n` +
            `├⊷ ✅ Submit your contact\n` +
            `├⊷ ✅ Join our WA Group\n` +
            `├⊷ ✅ Follow our WA Channel\n` +
            `│\n` +
            `╰⊷ *Powered by ${OWNER_NAME} TECH* `;

        await sock.sendMessage(jid, {
            text: notice,
            contextInfo: {
                externalAdReply: {
                    title:                 ADVERT_TITLE,
                    body:                  ADVERT_BODY,
                    mediaType:             1,
                    thumbnailUrl:          AVATAR_URL,
                    sourceUrl:             VCF_SITE,
                    mediaUrl:              VCF_SITE,
                    renderLargerThumbnail: true
                }
            }
        });
    } catch {
        // Silent fail — never crash the main flow
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── OLD COMEBACK NOTICE (commented out — uncomment to restore) ───────────────
// ─────────────────────────────────────────────────────────────────────────────
//
// const notice =
//     `╭─⌈ 🎉 *GOOD NEWS!* ⌋\n` +
//     `│\n` +
//     `├─⊷ My GitHub account is *back online* ✅\n` +
//     `├─⊷ The review is complete — repo is fully restored\n` +
//     `├─⊷ Updates and source code are flowing again\n` +
//     `│\n` +
//     `├─⊷ 🐙 GitHub:  ${PROFILE_URL}\n` +
//     `├─⊷ 📦 Repo:    ${REPO_URL}\n` +
//     `├─⊷ 📣 Channel: ${CHANNEL_LINK}\n` +
//     `╰⊷ Thanks for sticking around! \n\n` +
//     `*Powered by ${OWNER_NAME} TECH*`;
//
// contextInfo for old notice:
//     title:       `🎉 GitHub Account Restored — ${OWNER}`,
//     body:        'Repo is back online — all systems go',
//     sourceUrl:   REPO_URL,
//     mediaUrl:    REPO_URL,
//     renderLargerThumbnail: false