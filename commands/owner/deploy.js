// commands/owner/deploy.js
// .deploy / .deployment — hosting guide with interactive buttons
// Main menu: 6 quick-reply platform buttons
// Sub-command: guide text + single "Deploy Now" / "Watch Guide" cta_url button

import { createRequire } from 'module';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import { isButtonModeEnabled } from '../../lib/buttonMode.js';
import { isGiftedBtnsAvailable } from '../../lib/buttonHelper.js';

const _require = createRequire(import.meta.url);
let _giftedBtns = null;
try { _giftedBtns = _require('wolfbtns'); } catch {}

// ── Platform definitions ────────────────────────────────────────────────────
const PLATFORMS = {
    heroku: {
        icon: '🟣',
        name: 'Heroku',
        btnLabel: '🟣 Deploy Now',
        deployUrl: 'https://heroku.com',
        content: () =>
            `🟣 *DEPLOY ON HEROKU*\n\n` +
            `*📋 Steps:*\n` +
            `1️⃣ Create an account at *heroku.com* if you don't have one\n` +
            `2️⃣ Open the bot's *README.md* on GitHub\n` +
            `3️⃣ Click the *🟣 Deploy to Heroku* button in the README\n` +
            `4️⃣ A Heroku page opens — pre-filled from the bot's *app.json* template\n` +
            `5️⃣ Give your app a name (e.g. *mybot-wolf*)\n` +
            `6️⃣ Fill in all the *Config Vars* shown on the page:\n` +
            `   • SESSION_ID — your bot session ID\n` +
            `   • OWNER_NUMBER — your WhatsApp number\n` +
            `   • PREFIX — command prefix (default: .)\n` +
            `   • Any other required vars shown on the form\n` +
            `7️⃣ Click *Deploy app* at the bottom\n` +
            `8️⃣ Wait for Heroku to finish building — then click *View*\n\n` +
            `*⚡ Notes:*\n` +
            `• No CLI or Git needed — all done in the browser\n` +
            `• Free dynos are discontinued — use *Eco ($5/mo)*\n` +
            `• To update config later: App → *Settings → Config Vars*\n` +
            `• To redeploy: App → *Deploy → GitHub → Manual Deploy*`
    },
    bothosting: {
        icon: '🤖',
        name: 'Bothosting',
        btnLabel: '📹 Watch Guide',
        deployUrl: 'https://youtu.be/4Jq46fsEZsU?si=HyRE6CAYC6bESV6h',
        content: () =>
            `🤖 *BOTHOSTING GUIDE*\n\n` +
            `Watch the full video tutorial on how to deploy your bot on Bothosting.\n\n` +
            `Tap the button below to open the guide:`
    },
    katabump: {
        icon: '🎯',
        name: 'Katabump',
        btnLabel: '📹 Watch Guide',
        deployUrl: 'https://youtu.be/RviTwLfrK_Q?si=mz2Fy8QrXC-YiykR',
        content: () =>
            `🎯 *KATABUMP GUIDE*\n\n` +
            `Watch the full video tutorial on how to deploy your bot on Katabump.\n\n` +
            `Tap the button below to open the guide:`
    },
    panel: {
        icon: '🖥️',
        name: 'Panel (Pterodactyl)',
        btnLabel: '📹 Watch Guide',
        deployUrl: 'https://youtu.be/5ooHGLOKKVo?si=U3cJy4rkkigUagK5',
        content: () =>
            `🖥️ *PANEL (PTERODACTYL) GUIDE*\n\n` +
            `Watch the full video tutorial on how to deploy your bot on a Pterodactyl panel.\n\n` +
            `Tap the button below to open the guide:`
    },
    render: {
        icon: '⚡',
        name: 'Render',
        btnLabel: '⚡ Deploy Now',
        deployUrl: 'https://render.com',
        content: () =>
            `⚡ *DEPLOY ON RENDER*\n\n` +
            `*📋 Steps:*\n` +
            `1️⃣ Create an account at *render.com*\n` +
            `2️⃣ Click *New → Background Worker*\n` +
            `3️⃣ Connect your *GitHub repository*\n` +
            `4️⃣ Set *Build Command:* \`npm install\`\n` +
            `5️⃣ Set *Start Command:* \`node index.js\`\n` +
            `6️⃣ Add your env vars in the *Environment* tab\n` +
            `7️⃣ Click *Create Background Worker*\n\n` +
            `*⚡ Notes:*\n` +
            `• Use *Background Worker* (not Web Service) to keep the bot always-on\n` +
            `• Free tier: services sleep after 15 min — upgrade to *Starter ($7/mo)* for 24/7\n` +
            `• Set SESSION_ID, OWNER_NUMBER and PREFIX in Environment settings`
    },
    railway: {
        icon: '🚂',
        name: 'Railway',
        btnLabel: '🚂 Deploy Now',
        deployUrl: 'https://railway.app',
        content: () =>
            `🚂 *DEPLOY ON RAILWAY*\n\n` +
            `*📋 Steps:*\n` +
            `1️⃣ Create an account at *railway.app*\n` +
            `2️⃣ Click *New Project → Deploy from GitHub repo*\n` +
            `3️⃣ Select your repository and branch\n` +
            `4️⃣ Railway auto-detects Node.js and sets the start command\n` +
            `5️⃣ Go to *Variables* tab and add your env vars\n` +
            `6️⃣ Click *Deploy* — your bot goes live instantly\n\n` +
            `*⚡ Notes:*\n` +
            `• New accounts get *$5 trial credits* (no card needed)\n` +
            `• After trial: *Hobby plan ($5/mo)* keeps your app running 24/7\n` +
            `• Set SESSION_ID, OWNER_NUMBER and PREFIX in the Variables tab`
    }
};

export default {
    name: 'deploy',
    alias: ['deployment', 'hosting', 'host'],
    category: 'owner',
    description: 'Deployment & hosting guides for various platforms',
    ownerOnly: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const sub = args[0]?.toLowerCase();
        const buttonsActive = isButtonModeEnabled();
        const btnsReady = buttonsActive && isGiftedBtnsAvailable() && _giftedBtns;

        // ── Sub-command: show platform guide + Deploy Now button ──────────────
        if (sub && PLATFORMS[sub]) {
            const platform = PLATFORMS[sub];
            const guideText = platform.content();

            if (btnsReady) {
                const urlButton = [{
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: platform.btnLabel,
                        url: platform.deployUrl,
                        merchant_url: platform.deployUrl
                    })
                }];
                try {
                    await _giftedBtns.sendInteractiveMessage(sock, chatId, {
                        text: guideText,
                        interactiveButtons: urlButton
                    });
                    return;
                } catch (e) {
                    console.log('[Deploy] URL button failed:', e?.message);
                }
            }

            // Fallback: plain text with URL inline
            await sock.sendMessage(chatId, {
                text: `${guideText}\n\n🔗 ${platform.deployUrl}\n\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
            return;
        }

        // ── Unknown sub-command ───────────────────────────────────────────────
        if (sub && !PLATFORMS[sub]) {
            return sock.sendMessage(chatId, {
                text: `❌ Unknown platform *${sub}*.\n\nAvailable: heroku, bothosting, katabump, panel, render, railway`
            }, { quoted: msg });
        }

        // ── No args: show platform picker buttons ─────────────────────────────
        if (btnsReady) {
            const deployButtons = [
                { display: '🟣 Heroku',     id: 'heroku'     },
                { display: '🤖 Bothosting', id: 'bothosting' },
                { display: '🎯 Katabump',   id: 'katabump'   },
                { display: '🖥️ Panel',      id: 'panel'      },
                { display: '⚡ Render',     id: 'render'     },
                { display: '🚂 Railway',    id: 'railway'    },
            ];
            const interactiveButtons = deployButtons.map(btn => ({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.display,
                    id: `${PREFIX}deploy ${btn.id}`
                })
            }));
            try {
                await _giftedBtns.sendInteractiveMessage(sock, chatId, {
                    text: `🚀 *DEPLOYMENT GUIDE*\n\nSelect a platform to get the hosting guide:`,
                    interactiveButtons
                });
                return;
            } catch (e) {
                console.log('[Deploy] Main menu buttons failed:', e?.message);
            }
        }

        // ── Fallback plain text menu ──────────────────────────────────────────
        return sock.sendMessage(chatId, {
            text:
                `╭─⌈ 🚀 *DEPLOYMENT GUIDE* ⌋\n` +
                `│\n` +
                `├─⊷ *${PREFIX}deploy heroku*\n` +
                `│  └⊷ 🟣 Deploy on Heroku\n` +
                `├─⊷ *${PREFIX}deploy bothosting*\n` +
                `│  └⊷ 🤖 Bothosting video guide\n` +
                `├─⊷ *${PREFIX}deploy katabump*\n` +
                `│  └⊷ 🎯 Katabump video guide\n` +
                `├─⊷ *${PREFIX}deploy panel*\n` +
                `│  └⊷ 🖥️ Pterodactyl panel video guide\n` +
                `├─⊷ *${PREFIX}deploy render*\n` +
                `│  └⊷ ⚡ Deploy on Render\n` +
                `├─⊷ *${PREFIX}deploy railway*\n` +
                `│  └⊷ 🚂 Deploy on Railway\n` +
                `│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
        }, { quoted: msg });
    }
};
