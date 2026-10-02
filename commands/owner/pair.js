// import axios from 'axios';
// import WebSocket from 'ws';

// export default {
//     name: 'pair',
//     alias: ['getcode', 'paircode'],
//     description: 'Generate a pairing code for linking a new WhatsApp device',
//     category: 'owner',
//     ownerOnly: true,

//     async execute(sock, m, args, PREFIX, extra) {
//         const chatId = m.key.remoteJid;
//         const number = args.join('').replace(/[^0-9]/g, '');

//         if (!number || number.length < 6 || number.length > 20) {
//             await sock.sendMessage(chatId, {
//                 text: `╭─⌈ ⚠️ *PAIR DEVICE* ⌋\n│\n├─⊷ *${PREFIX}pair <number>*\n│  └⊷ Full number, no +\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
//             }, { quoted: m });
//             await sock.sendMessage(chatId, { react: { text: '⚠️', key: m.key } });
//             return;
//         }

//         await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });
//         await sock.sendMessage(chatId, {
//             text: `🔄 *Generating pair code for ${number}...*`
//         }, { quoted: m });

//         const DOMAIN = 'pair.xwolf.space';

//         try {
//             console.log(`[PAIR] Starting pair for ${number}`);

//             const result = await new Promise((resolve, reject) => {
//                 let ws;
//                 let sessionId = null;
//                 let resolved = false;

//                 try {
//                     ws = new WebSocket(`wss://${DOMAIN}/ws`);
//                 } catch (err) {
//                     console.log(`[PAIR] WS create error: ${err.message}`);
//                     reject(new Error('Failed to create WebSocket connection'));
//                     return;
//                 }

//                 const timeout = setTimeout(() => {
//                     if (!resolved) {
//                         console.log('[PAIR] Timeout after 90s');
//                         resolved = true;
//                         try { ws.close(); } catch {}
//                         reject(new Error('Timed out waiting for pairing code (90s)'));
//                     }
//                 }, 90000);

//                 const cleanup = () => {
//                     clearTimeout(timeout);
//                     try { ws.close(); } catch {}
//                 };

//                 ws.on('open', async () => {
//                     console.log('[PAIR] WebSocket connected');
//                     try {
//                         const res = await axios.post(`https://${DOMAIN}/api/generate-session`, {
//                             phoneNumber: number,
//                             method: 'pairing'
//                         }, {
//                             timeout: 30000,
//                             headers: { 'Content-Type': 'application/json' }
//                         });

//                         console.log(`[PAIR] API response:`, JSON.stringify(res.data));

//                         sessionId = res.data?.sessionId;
//                         if (!sessionId) {
//                             cleanup();
//                             resolved = true;
//                             reject(new Error(res.data?.error || 'No session ID returned from API'));
//                             return;
//                         }

//                         console.log(`[PAIR] Got sessionId: ${sessionId}, subscribing...`);
//                         ws.send(JSON.stringify({ type: 'subscribe', sessionId }));

//                     } catch (err) {
//                         console.log(`[PAIR] API error: ${err.message}`);
//                         cleanup();
//                         if (!resolved) {
//                             resolved = true;
//                             reject(new Error(err.response?.data?.error || err.message));
//                         }
//                     }
//                 });

//                 ws.on('message', (data) => {
//                     if (resolved) return;
//                     try {
//                         const msg = JSON.parse(data.toString());
//                         console.log(`[PAIR] WS message:`, JSON.stringify(msg));

//                         if (msg.event === 'pairing_code') {
//                             const code = msg.data?.code || msg.code;
//                             if (code) {
//                                 resolved = true;
//                                 cleanup();
//                                 resolve({ pairingCode: code, credentialsBase64: null, status: 'pairing_code' });
//                                 return;
//                             }
//                         }

//                         if (msg.event === 'credentials_sent' || msg.event === 'connected') {
//                             const d = msg.data || {};
//                             if (d.credentialsBase64) {
//                                 resolved = true;
//                                 cleanup();
//                                 resolve({ pairingCode: null, credentialsBase64: d.credentialsBase64, status: 'connected' });
//                                 return;
//                             }
//                         }

//                         if (msg.event === 'status') {
//                             const d = msg.data || {};
//                             if (d.pairingCode) {
//                                 resolved = true;
//                                 cleanup();
//                                 resolve({ pairingCode: d.pairingCode, credentialsBase64: d.credentialsBase64 || null, status: d.status });
//                                 return;
//                             }
//                             if (d.credentialsBase64 && d.status === 'connected') {
//                                 resolved = true;
//                                 cleanup();
//                                 resolve({ pairingCode: null, credentialsBase64: d.credentialsBase64, status: 'connected' });
//                                 return;
//                             }
//                             if (d.status === 'failed') {
//                                 resolved = true;
//                                 cleanup();
//                                 reject(new Error(d.message || 'Pairing failed on server'));
//                                 return;
//                             }
//                         }

//                         if (msg.pairingCode || msg.pairing_code || msg.code) {
//                             const code = msg.pairingCode || msg.pairing_code || msg.code;
//                             resolved = true;
//                             cleanup();
//                             resolve({ pairingCode: code, credentialsBase64: msg.credentialsBase64 || null, status: 'pairing_code' });
//                             return;
//                         }
//                     } catch (parseErr) {
//                         console.log(`[PAIR] WS parse error: ${parseErr.message}`);
//                     }
//                 });

//                 ws.on('error', (err) => {
//                     console.log(`[PAIR] WS error: ${err.message}`);
//                     cleanup();
//                     if (!resolved) {
//                         resolved = true;
//                         reject(new Error('WebSocket error: ' + err.message));
//                     }
//                 });

//                 ws.on('close', (code, reason) => {
//                     console.log(`[PAIR] WS closed: code=${code}, reason=${reason}`);
//                     if (!resolved) {
//                         resolved = true;
//                         reject(new Error('WebSocket closed before pairing code received'));
//                     }
//                 });
//             });

//             const pairCode = result.pairingCode || '';
//             const formattedCode = pairCode ? pairCode.match(/.{1,4}/g)?.join('-') || pairCode : '';

//             const timestamp = new Date().toLocaleTimeString();
//             let msgText = `┌─  *SILENT WOLF PAIRING* ─┐\n│\n`;

//             msgText += `│ 📱 *Number:* ${number}\n`;

//             if (formattedCode) {
//                 msgText += `│ 🔐 *Pair Code:* \`${formattedCode}\`\n`;
//             }

//             msgText += `│\n`;

//             if (formattedCode) {
//                 msgText += `│ 📌 *How to Link:*\n` +
//                     `│ 1. Open WhatsApp → *Settings*\n` +
//                     `│ 2. Tap *Linked Devices*\n` +
//                     `│ 3. Tap *Link a Device*\n` +
//                     `│ 4. Enter code: *${formattedCode}*\n` +
//                     `│ 5. Wait for connection ✅\n│\n` +
//                     `│ ⏱️ Code expires in 60 seconds!\n`;
//             }

//             msgText += `│\n└─ _KLAUS MD • ${timestamp}_ ─┘`;

//             await sock.sendMessage(chatId, { react: { text: '🔐', key: m.key } });

//             if (pairCode) {
//                 try {
//                     const { createRequire } = await import('module');
//                     const require = createRequire(import.meta.url);
//                     const { sendInteractiveMessage } = require('wolfbtns');
//                     await sendInteractiveMessage(sock, chatId, {
//                         text: msgText,
//                         footer: ' Silent Wolf Bot',
//                         interactiveButtons: [{
//                             name: 'cta_copy',
//                             buttonParamsJson: JSON.stringify({
//                                 display_text: '🔐 Copy Pair Code',
//                                 copy_code: pairCode
//                             })
//                         }]
//                     });
//                 } catch (btnErr) {
//                     console.log(`[PAIR] Buttons failed: ${btnErr.message}`);
//                     await sock.sendMessage(chatId, { text: msgText }, { quoted: m });
//                 }
//             } else {
//                 await sock.sendMessage(chatId, { text: msgText }, { quoted: m });
//             }

//             await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

//         } catch (err) {
//             console.log(`[PAIR] Error: ${err.message}`);
//             await sock.sendMessage(chatId, {
//                 text: `❌ *Pairing Failed*\n\n${err.message}\n\n_Try again or check that the number is correct._`
//             }, { quoted: m });
//             await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
//         }
//     }
// };














import axios from 'axios';
import WebSocket from 'ws';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'pair',
    alias: ['getcode', 'paircode'],
    description: 'Generate a pairing code for linking a new WhatsApp device',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, m, args, PREFIX, extra) {
        const chatId = m.key.remoteJid;
        const number = args.join('').replace(/[^0-9]/g, '');

        if (!number || number.length < 6 || number.length > 20) {
            await sock.sendMessage(chatId, {
                text: `╭─⌈ ⚠️ *PAIR DEVICE* ⌋\n│\n├─⊷ *${PREFIX}pair <number>*\n│  └⊷ Full number, no +\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
            await sock.sendMessage(chatId, { react: { text: '⚠️', key: m.key } });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });
        await sock.sendMessage(chatId, {
            text: `🔄 *Generating pair code for ${number}...*`
        }, { quoted: m });

        const DOMAIN = 'pair.xwolf.space';

        try {
            console.log(`[PAIR] Starting pair for ${number}`);

            const result = await new Promise((resolve, reject) => {
                let ws;
                let sessionId = null;
                let resolved = false;

                try {
                    ws = new WebSocket(`wss://${DOMAIN}/ws`);
                } catch (err) {
                    console.log(`[PAIR] WS create error: ${err.message}`);
                    reject(new Error('Failed to create WebSocket connection'));
                    return;
                }

                const timeout = setTimeout(() => {
                    if (!resolved) {
                        console.log('[PAIR] Timeout after 90s');
                        resolved = true;
                        try { ws.close(); } catch {}
                        reject(new Error('Timed out waiting for pairing code (90s)'));
                    }
                }, 90000);

                const cleanup = () => {
                    clearTimeout(timeout);
                    try { ws.close(); } catch {}
                };

                ws.on('open', async () => {
                    console.log('[PAIR] WebSocket connected');
                    try {
                        const res = await axios.post(`https://${DOMAIN}/api/generate-session`, {
                            phoneNumber: number,
                            method: 'pairing'
                        }, {
                            timeout: 30000,
                            headers: { 'Content-Type': 'application/json' }
                        });

                        console.log(`[PAIR] API response:`, JSON.stringify(res.data));

                        sessionId = res.data?.sessionId;
                        if (!sessionId) {
                            cleanup();
                            resolved = true;
                            reject(new Error(res.data?.error || 'No session ID returned from API'));
                            return;
                        }

                        console.log(`[PAIR] Got sessionId: ${sessionId}, subscribing...`);
                        ws.send(JSON.stringify({ type: 'subscribe', sessionId }));

                    } catch (err) {
                        console.log(`[PAIR] API error: ${err.message}`);
                        cleanup();
                        if (!resolved) {
                            resolved = true;
                            reject(new Error(err.response?.data?.error || err.message));
                        }
                    }
                });

                ws.on('message', (data) => {
                    if (resolved) return;
                    try {
                        const msg = JSON.parse(data.toString());
                        console.log(`[PAIR] WS message:`, JSON.stringify(msg));

                        if (msg.event === 'pairing_code') {
                            const code = msg.data?.code || msg.code;
                            if (code) {
                                resolved = true;
                                cleanup();
                                resolve({ pairingCode: code, credentialsBase64: null, status: 'pairing_code' });
                                return;
                            }
                        }

                        if (msg.event === 'credentials_sent' || msg.event === 'connected') {
                            const d = msg.data || {};
                            if (d.credentialsBase64) {
                                resolved = true;
                                cleanup();
                                resolve({ pairingCode: null, credentialsBase64: d.credentialsBase64, status: 'connected' });
                                return;
                            }
                        }

                        if (msg.event === 'status') {
                            const d = msg.data || {};
                            if (d.pairingCode) {
                                resolved = true;
                                cleanup();
                                resolve({ pairingCode: d.pairingCode, credentialsBase64: d.credentialsBase64 || null, status: d.status });
                                return;
                            }
                            if (d.credentialsBase64 && d.status === 'connected') {
                                resolved = true;
                                cleanup();
                                resolve({ pairingCode: null, credentialsBase64: d.credentialsBase64, status: 'connected' });
                                return;
                            }
                            if (d.status === 'failed') {
                                resolved = true;
                                cleanup();
                                reject(new Error(d.message || 'Pairing failed on server'));
                                return;
                            }
                        }

                        if (msg.pairingCode || msg.pairing_code || msg.code) {
                            const code = msg.pairingCode || msg.pairing_code || msg.code;
                            resolved = true;
                            cleanup();
                            resolve({ pairingCode: code, credentialsBase64: msg.credentialsBase64 || null, status: 'pairing_code' });
                            return;
                        }
                    } catch (parseErr) {
                        console.log(`[PAIR] WS parse error: ${parseErr.message}`);
                    }
                });

                ws.on('error', (err) => {
                    console.log(`[PAIR] WS error: ${err.message}`);
                    cleanup();
                    if (!resolved) {
                        resolved = true;
                        reject(new Error('WebSocket error: ' + err.message));
                    }
                });

                ws.on('close', (code, reason) => {
                    console.log(`[PAIR] WS closed: code=${code}, reason=${reason}`);
                    if (!resolved) {
                        resolved = true;
                        reject(new Error('WebSocket closed before pairing code received'));
                    }
                });
            });

            const pairCode = result.pairingCode || '';
            const formattedCode = pairCode ? pairCode.match(/.{1,4}/g)?.join('-') || pairCode : '';

            const timestamp = new Date().toLocaleTimeString();
            let msgText = `┌─  *SILENT WOLF PAIRING* ─┐\n│\n`;

            msgText += `│ 📱 *Number:* ${number}\n`;

            if (formattedCode) {
                msgText += `│ 🔐 *Pair Code:* \`${formattedCode}\`\n`;
            }

            msgText += `│\n`;

            if (formattedCode) {
                msgText += `│ 📌 *How to Link:*\n` +
                    `│ 1. Open WhatsApp → *Settings*\n` +
                    `│ 2. Tap *Linked Devices*\n` +
                    `│ 3. Tap *Link a Device*\n` +
                    `│ 4. Enter code: *${formattedCode}*\n` +
                    `│ 5. Wait for connection ✅\n│\n` +
                    `│ ⏱️ Code expires in 60 seconds!\n`;
            }

            msgText += `│\n└─ _KLAUS MD • ${timestamp}_ ─┘`;

            await sock.sendMessage(chatId, { react: { text: '🔐', key: m.key } });

            if (pairCode) {
                try {
                    const { createRequire } = await import('module');
                    const require = createRequire(import.meta.url);
                    const { sendInteractiveMessage } = require('wolfbtns');
                    await sendInteractiveMessage(sock, chatId, {
                        text: msgText,
                        footer: ' Silent Wolf Bot',
                        interactiveButtons: [{
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🔐 Copy Pair Code',
                                copy_code: pairCode
                            })
                        }]
                    });
                } catch (btnErr) {
                    console.log(`[PAIR] Buttons failed: ${btnErr.message}`);
                    await sock.sendMessage(chatId, { text: msgText }, { quoted: m });
                }
            } else {
                await sock.sendMessage(chatId, { text: msgText }, { quoted: m });
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.log(`[PAIR] Error: ${err.message}`);
            await sock.sendMessage(chatId, {
                text: `❌ *Pairing Failed*\n\n${err.message}\n\n_Try again or check that the number is correct._`
            }, { quoted: m });
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
        }
    }
};
