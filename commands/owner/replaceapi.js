import { getCommandInfo, setCommandApi, resetCommandApi, detectParamStyle, assembleUrl, PARAM_STYLE_LABELS } from '../../lib/apiRegistry.js';
import { getBotName } from '../../lib/botname.js';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
let _giftedBtns = null;
try { _giftedBtns = _require('wolfbtns'); } catch {}

const VALID_STYLES = ['gifted', 'yturl', 'keyword', 'raw'];

export default {
    name: 'replaceapi',
    aliases: ['setapi', 'swapapi'],
    category: 'owner',
    desc: 'Replace the API endpoint for a command (style auto-detected or specify manually)',
    usage: '.replaceapi <command> <newurl> [gifted|yturl|keyword|raw] | .replaceapi <command> reset',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatJid = msg.key.remoteJid;
        const reply = (text) => sock.sendMessage(chatJid, { text }, { quoted: msg });
        const BOT_NAME = extra?.BOT_NAME || getBotName() || 'WOLFBOT';
        const cmdName  = (args[0] || '').toLowerCase().trim();

        // Last arg might be a style keyword
        let styleArg = null;
        let urlArgs  = args.slice(1);
        if (urlArgs.length > 0 && VALID_STYLES.includes(urlArgs[urlArgs.length - 1].toLowerCase())) {
            styleArg = urlArgs.pop().toLowerCase();
        }
        const newUrl = urlArgs.join(' ').trim();

        if (!cmdName) {
            const styleList = VALID_STYLES.map(s => `│   • *${s}* — ${PARAM_STYLE_LABELS[s]}`).join('\n');
            await reply(
                `╭─⌈ 🔄 *REPLACE API* ⌋\n` +
                `│\n` +
                `├─⊷ *Usage:*\n` +
                `│   └⊷ ${PREFIX}replaceapi <cmd> <newurl> [style]\n` +
                `│   └⊷ ${PREFIX}replaceapi <cmd> reset\n` +
                `│\n` +
                `├─⊷ *Styles (auto-detected if omitted):*\n` +
                styleList + `\n` +
                `│\n` +
                `├─⊷ *Examples:*\n` +
                `│   └⊷ ${PREFIX}replaceapi ytmp3 https://api.giftedtech.co.ke/api/download/ytaudio gifted\n` +
                `│   └⊷ ${PREFIX}replaceapi ytmp3 https://apiskeith.top/download/audio yturl\n` +
                `│   └⊷ ${PREFIX}replaceapi gpt https://apis.xwolf.space/download/audio keyword\n` +
                `│   └⊷ ${PREFIX}replaceapi gpt reset\n` +
                `│\n` +
                `├─⊷ 📋 List all APIs: *${PREFIX}getapi*\n` +
                `│\n` +
                `╰⊷ *Powered by ${BOT_NAME.toUpperCase()}*`
            );
            return;
        }

        const info = getCommandInfo(cmdName);
        if (!info) {
            await reply(
                `❌ No API registered for *${cmdName}*.\n\n` +
                `Use *${PREFIX}getapi* to see all commands with APIs.`
            );
            return;
        }

        // ── RESET ───────────────────────────────────────────────────────────
        if (newUrl.toLowerCase() === 'reset') {
            const ok = resetCommandApi(cmdName);
            await reply(
                ok
                    ? `╭─⌈ ♻️ *API RESET — ${cmdName.toUpperCase()}* ⌋\n` +
                      `│\n` +
                      `├─⊷ ✅ *Restored to default:*\n` +
                      `│   └⊷ ${info.defaultUrl}\n` +
                      `├─⊷ 🎨 *Style:* ${info.paramStyle}\n` +
                      `│\n` +
                      `╰⊷ *Powered by ${BOT_NAME.toUpperCase()}*`
                    : `❌ Failed to reset API for *${cmdName}*.`
            );
            return;
        }

        if (!newUrl) {
            await reply(
                `⚠️ Please provide a new URL.\n\n` +
                `Usage: *${PREFIX}replaceapi ${cmdName} <newurl> [style]*\n` +
                `Reset: *${PREFIX}replaceapi ${cmdName} reset*\n\n` +
                `Current API: ${info.currentUrl}\n` +
                `Current Style: ${info.paramStyle}`
            );
            return;
        }

        if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            await reply(
                `❌ *Invalid URL.* Must start with http:// or https://\n\n` +
                `Example:\n${PREFIX}replaceapi ${cmdName} https://newapi.com/endpoint`
            );
            return;
        }

        // Auto-detect style if not explicitly given
        const resolvedStyle = styleArg || detectParamStyle(newUrl) || info.paramStyle || 'raw';

        // Build a preview of how the URL will be used
        const testQuery    = info.testQuery || 'test_query';
        const previewUrl   = assembleUrl(newUrl, resolvedStyle, testQuery);
        const styleLabel   = PARAM_STYLE_LABELS[resolvedStyle] || resolvedStyle;
        const autoDetected = !styleArg;

        const oldUrl   = info.currentUrl;
        const oldStyle = info.paramStyle;
        const ok       = setCommandApi(cmdName, newUrl, resolvedStyle);

        if (!ok) {
            await reply(`❌ Failed to save API override for *${cmdName}*. Check disk space or file permissions.`);
            return;
        }

        const text =
            `╭─⌈ ✅ *API REPLACED — ${cmdName.toUpperCase()}* ⌋\n` +
            `│\n` +
            `├─⊷ 📦 *Command:* ${PREFIX}${cmdName}\n` +
            `│\n` +
            `├─⊷ ❌ *Old API:*\n` +
            `│   └⊷ ${oldUrl}\n` +
            `├─⊷ 🎨 *Old Style:* ${oldStyle}\n` +
            `│\n` +
            `├─⊷ ✅ *New Base URL:*\n` +
            `│   └⊷ ${newUrl}\n` +
            `├─⊷ 🎨 *New Style:* ${resolvedStyle}${autoDetected ? ' *(auto-detected)*' : ' *(manual)*'}\n` +
            `│   └⊷ ${styleLabel}\n` +
            `│\n` +
            `├─⊷ 🔍 *Preview URL (with test query):*\n` +
            `│   └⊷ ${previewUrl}\n` +
            `│\n` +
            `├─⊷ ⚡ *Live:* Change is active immediately\n` +
            `├─⊷ 📡 *Test it:* ${PREFIX}fetchapi ${cmdName}\n` +
            `├─⊷ ♻️ *Undo:* ${PREFIX}replaceapi ${cmdName} reset\n` +
            `│\n` +
            `╰⊷ *Powered by ${BOT_NAME.toUpperCase()}*`;

        if (_giftedBtns?.sendInteractiveMessage) {
            try {
                await _giftedBtns.sendInteractiveMessage(sock, chatJid, {
                    text,
                    footer: BOT_NAME,
                    interactiveButtons: [
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📡 TEST NEW API',
                                id: `${PREFIX}fetchapi ${cmdName}`
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '♻️ RESET TO DEFAULT',
                                id: `${PREFIX}replaceapi ${cmdName} reset`
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🌐 Open New URL',
                                url: newUrl,
                                merchant_url: newUrl
                            })
                        }
                    ]
                });
                return;
            } catch (e) {
                console.log('[replaceapi] Buttons failed:', e?.message);
            }
        }

        await reply(text);
    }
};
