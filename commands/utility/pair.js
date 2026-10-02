import fs from 'fs';
import path from 'path';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const activePairJobs = new Map();

export default {
    name: "pair",
    alias: ["paircode", "linkdevice", "getcode"],
    description: "Generate a pairing code for another WhatsApp number",
    category: "utility",
    usage: ".pair <phone_number>",

    async execute(sock, m, args) {
        const jid = m.key.remoteJid;
        const prefix = global.prefix || '/';

        if (!args[0]) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ ⚠️ *PAIR DEVICE* ⌋\n│\n` +
                    `├─⊷ *${prefix}pair <number>*\n` +
                    `│  └⊷ Full number, no +\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        const phone = args[0].replace(/\D/g, '');

        if (phone.length < 7 || phone.length > 15) {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid number*\n\nMust be 7–15 digits with country code.\n*Example:* ${prefix}pair 254712345678`
            }, { quoted: m });
        }

        if (activePairJobs.has(phone)) {
            return sock.sendMessage(jid, {
                text: `⏳ *Already generating a code for +${phone}*\n\nPlease wait...`
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        const tmpDir = path.join('/tmp', `pair_${phone}_${Date.now()}`);

        activePairJobs.set(phone, tmpDir);

        const cleanup = () => {
            activePairJobs.delete(phone);
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
        };

        const autoCleanTimer = setTimeout(cleanup, 5 * 60 * 1000);

        try {
            const { useMultiFileAuthState } = await import('wolfsocket');
            const _baileys = await import('wolfsocket');
            const makeWASocket = (typeof _baileys.default === 'function' ? _baileys.default : null) ?? _baileys.makeWASocket;
            const { fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = _baileys;
            const pino = (await import('pino')).default;

            fs.mkdirSync(tmpDir, { recursive: true });

            const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
            const { version } = await fetchLatestBaileysVersion();

            const silentLogger = pino({ level: 'silent' });

            const pairSock = makeWASocket({
                version,
                logger: silentLogger,
                browser: Browsers.ubuntu('Chrome'),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
                },
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                connectTimeoutMs: 60000,
                emitOwnEvents: false,
                mobile: false,
                shouldSyncHistoryMessage: () => false,
            });

            pairSock.ev.on('creds.update', saveCreds);

            let codeSent = false;

            // Timeout: if no QR appears within 45s, WA server never responded
            const failTimer = setTimeout(async () => {
                if (!codeSent) {
                    try { pairSock.ev.removeAllListeners(); pairSock.ws.close(); } catch (_) {}
                    clearTimeout(autoCleanTimer);
                    cleanup();
                    await sock.sendMessage(jid, {
                        text: `❌ *Pair code timed out for +${phone}*\n\nWhatsApp did not respond. Try again.`
                    }, { quoted: m });
                }
            }, 45000);

            pairSock.ev.on('connection.update', async (update) => {
                const { connection, qr, lastDisconnect } = update;

                // ── Request the pairing code the moment WA sends the QR challenge ──
                // This is the correct trigger: WA's server has completed the handshake
                // and is waiting for either a QR scan or a pairing code exchange.
                // Calling requestPairingCode() earlier (e.g. on 'connecting') fails
                // because the WS is still negotiating and can't send frames yet.
                if (qr && !state.creds.registered && !codeSent) {
                    codeSent = true;
                    clearTimeout(failTimer);
                    try {
                        const code = await pairSock.requestPairingCode(phone);

                        const clean = code.replace(/\s+/g, '');
                        const formatted = clean.length === 8
                            ? `${clean.slice(0, 4)}-${clean.slice(4)}`
                            : clean;

                        const resultText =
                            `╭─⌈ 📲 *PAIR CODE* ⌋\n│\n` +
                            `├─⊷ *Phone:*  +${phone}\n` +
                            `├─⊷ *Code:*   \`${formatted}\`\n│\n` +
                            `├─⊷ *How to enter it:*\n` +
                            `│  1️⃣  Open WhatsApp on that phone\n` +
                            `│  2️⃣  Tap ⋮ Menu → *Linked Devices*\n` +
                            `│  3️⃣  Tap *Link a Device*\n` +
                            `│  4️⃣  Tap *Link with Phone Number*\n` +
                            `│  5️⃣  Enter: *${formatted}*\n│\n` +
                            `├─⊷ ⚠️ Valid for *~3 minutes* only\n` +
                            `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

                        try {
                            const { createRequire } = await import('module');
                            const require = createRequire(import.meta.url);
                            const { sendInteractiveMessage } = require('wolfbtns');
                            await sendInteractiveMessage(sock, jid, {
                                text: resultText,
                                footer: getBotName(),
                                interactiveButtons: [
                                    {
                                        name: 'cta_copy',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '📋 Copy Code',
                                            copy_code: formatted
                                        })
                                    }
                                ]
                            });
                        } catch (_) {
                            await sock.sendMessage(jid, { text: resultText }, { quoted: m });
                        }

                        await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

                    } catch (codeErr) {
                        await sock.sendMessage(jid, {
                            text: `❌ *Failed to get code for +${phone}*\n\n_${codeErr.message}_`
                        }, { quoted: m });
                    } finally {
                        setTimeout(() => {
                            try { pairSock.ev.removeAllListeners(); pairSock.ws.close(); } catch (_) {}
                            clearTimeout(autoCleanTimer);
                            cleanup();
                        }, 3000);
                    }
                }

                if (connection === 'close' && !codeSent) {
                    clearTimeout(failTimer);
                    clearTimeout(autoCleanTimer);
                    cleanup();
                    // Extract the actual disconnect reason so the user knows why
                    const reason = lastDisconnect?.error?.output?.statusCode
                        || lastDisconnect?.error?.message
                        || 'unknown reason';
                    await sock.sendMessage(jid, {
                        text: `❌ *Connection closed for +${phone}*\n\n_Reason: ${reason}_\n\nWait a few seconds and try again.`
                    }, { quoted: m });
                }
            });

        } catch (err) {
            clearTimeout(autoCleanTimer);
            cleanup();
            console.error('[PAIR] Fatal error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, {
                text: `❌ *Error:* ${err.message}`
            }, { quoted: m });
        }
    }
};
