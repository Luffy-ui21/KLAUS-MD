// import { addSudo, mapLidToPhone, addSudoJid, getSudoList } from '../../lib/sudo-store.js';
// import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

// function resolveRealNumber(jid, sock) {
//     if (!jid) return null;
//     if (!jid.includes('@lid')) {
//         const raw = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
//         if (raw && raw.length >= 7 && raw.length <= 15) return raw;
//         return null;
//     }
//     if (sock) {
//         try {
//             if (sock.signalRepository?.lidMapping?.getPNForLID) {
//                 const pn = sock.signalRepository.lidMapping.getPNForLID(jid);
//                 if (pn) {
//                     const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
//                     if (num.length >= 7) return num;
//                 }
//             }
//         } catch {}
//     }
//     return null;
// }

// export default {
//     name: 'addsudo',
//     alias: ['sudo'],
//     category: 'owner',
//     description: 'Add a user to the sudo list (trusted users who can use owner commands)',
//     ownerOnly: true,
//     sudoAllowed: false,

//     async execute(sock, msg, args, PREFIX, extra) {
//         const chatId = msg.key.remoteJid;
//         const { jidManager } = extra;

//         if (!jidManager.isOwner(msg)) {
//             return sock.sendMessage(chatId, {
//                 text: '❌ *Owner Only Command!*\n\nOnly the bot owner can add sudo users.'
//             }, { quoted: msg });
//         }

//         let targetNumber = null;

//         const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
//         const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

//         if (quoted) {
//             const resolved = resolveRealNumber(quoted, sock);
//             if (resolved) {
//                 targetNumber = resolved;
//             } else if (args[0]) {
//                 targetNumber = args[0].replace(/[^0-9]/g, '');
//             } else {
//                 return sock.sendMessage(chatId, {
//                     text: `╭─⌈ ⚠️ *ADD SUDO* ⌋\n│\n├─⊷ *${PREFIX}addsudo <phone number>*\n│  └⊷ Reply with number\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
//                 }, { quoted: msg });
//             }
//         } else if (mentioned) {
//             const resolved = resolveRealNumber(mentioned, sock);
//             if (resolved) {
//                 targetNumber = resolved;
//             } else if (args.length > 1) {
//                 targetNumber = args[1]?.replace(/[^0-9]/g, '') || args[0]?.replace(/[^0-9]/g, '');
//             }
//         } else if (args[0]) {
//             targetNumber = args[0].replace(/[^0-9]/g, '');
//         }

//         if (!targetNumber || targetNumber.length < 7) {
//             return sock.sendMessage(chatId, {
//                 text: `╭─⌈ 📋 *ADD SUDO* ⌋\n│\n├─⊷ *${PREFIX}addsudo <number>*\n│  └⊷ Add by number\n├─⊷ *Reply + ${PREFIX}addsudo*\n│  └⊷ Add via reply\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
//             }, { quoted: msg });
//         }

//         const ownerNumber = extra.OWNER_NUMBER?.split(':')[0];
//         if (targetNumber === ownerNumber) {
//             return sock.sendMessage(chatId, {
//                 text: '❌ You are already the owner! No need to add yourself as sudo.'
//             }, { quoted: msg });
//         }

//         // const quotedLid = quoted && quoted.includes('@lid') ? quoted.split('@')[0].split(':')[0] : null;
//         // const result = addSudo(targetNumber, quotedLid);

//         // if (quotedLid && quotedLid !== targetNumber) {
//         //     mapLidToPhone(quotedLid, targetNumber);
//         // }



//         const senderJid = msg.key.participant || msg.key.remoteJid;
// const quotedLid = quoted && quoted.includes('@lid') ? quoted.split('@')[0].split(':')[0] : null;

// // Always pass the resolved JID so isSudo() can match it later
// const jidToStore = quotedLid || (senderJid && !senderJid.includes('@lid') ? null : null);
// const result = addSudo(targetNumber, jidToStore);

// if (quotedLid && quotedLid !== targetNumber) {
//     mapLidToPhone(quotedLid, targetNumber);
// }

// // Also register the target number's JID if we can derive it
// const targetJid = `${targetNumber}@s.whatsapp.net`;
// if (result.success) {
//     const { addSudoJid } = await import('../../lib/sudo-store.js').catch(() => ({}));
//     if (typeof addSudoJid === 'function') addSudoJid(targetNumber, targetJid);
// }

//         if (result.success) {
//             let successMsg = `✅ *Sudo User Added*\n\n👤 Number: +${result.number}\n🔑 Access: Owner-level commands`;
//             if (quotedLid) successMsg += `\n🔗 Group ID: Linked ✅`;
//             successMsg += `\n\n_This user can now use owner commands._`;
//             await sock.sendMessage(chatId, { text: successMsg }, { quoted: msg });
//         } else {
//             if (result.reason === 'Already a sudo user') {
//                 let replyMsg = `ℹ️ +${targetNumber} is already a sudo user.`;
//                 if (quotedLid) replyMsg += ` Group ID re-linked ✅`;
//                 await sock.sendMessage(chatId, { text: replyMsg }, { quoted: msg });
//             } else {
//                 await sock.sendMessage(chatId, {
//                     text: `❌ *Failed:* ${result.reason}`
//                 }, { quoted: msg });
//             }
//         }
//     }
// };




import { addSudo, addSudoJid, mapLidToPhone, getSudoList } from '../../lib/sudo-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

function resolveRealNumber(jid, sock) {
    if (!jid) return null;
    if (!jid.includes('@lid')) {
        const raw = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (raw && raw.length >= 7 && raw.length <= 15) return raw;
        return null;
    }
    if (sock) {
        try {
            if (sock.signalRepository?.lidMapping?.getPNForLID) {
                const pn = sock.signalRepository.lidMapping.getPNForLID(jid);
                if (pn) {
                    const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                    if (num.length >= 7) return num;
                }
            }
        } catch {}
    }
    return null;
}

export default {
    name: 'addsudo',
    alias: ['sudo'],
    category: 'owner',
    description: 'Add a user to the sudo list (trusted users who can use owner commands)',
    ownerOnly: true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command!*\n\nOnly the bot owner can add sudo users.'
            }, { quoted: msg });
        }

        let targetNumber = null;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (quoted) {
            const resolved = resolveRealNumber(quoted, sock);
            if (resolved) {
                targetNumber = resolved;
            } else if (args[0]) {
                targetNumber = args[0].replace(/[^0-9]/g, '');
            } else {
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ ⚠️ *ADD SUDO* ⌋\n│\n├─⊷ *${PREFIX}addsudo <phone number>*\n│  └⊷ Reply with number\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }
        } else if (mentioned) {
            const resolved = resolveRealNumber(mentioned, sock);
            if (resolved) {
                targetNumber = resolved;
            } else if (args.length > 1) {
                targetNumber = args[1]?.replace(/[^0-9]/g, '') || args[0]?.replace(/[^0-9]/g, '');
            }
        } else if (args[0]) {
            targetNumber = args[0].replace(/[^0-9]/g, '');
        }

        if (!targetNumber || targetNumber.length < 7) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 📋 *ADD SUDO* ⌋\n│\n├─⊷ *${PREFIX}addsudo <number>*\n│  └⊷ Add by number\n├─⊷ *Reply + ${PREFIX}addsudo*\n│  └⊷ Add via reply\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const ownerNumber = extra.OWNER_NUMBER?.split(':')[0];
        if (targetNumber === ownerNumber) {
            return sock.sendMessage(chatId, {
                text: '❌ You are already the owner! No need to add yourself as sudo.'
            }, { quoted: msg });
        }

        const quotedLid = quoted && quoted.includes('@lid') ? quoted.split('@')[0].split(':')[0] : null;
        const mentionedLid = mentioned && mentioned.includes('@lid') ? mentioned.split('@')[0].split(':')[0] : null;

        const result = addSudo(targetNumber, quotedLid || mentionedLid || null);

        // Register the standard @s.whatsapp.net JID so isSudo() matches
        // even when the sender is not using a LID and no reply was used
        addSudoJid(targetNumber, targetNumber);
        addSudoJid(targetNumber, `${targetNumber}@s.whatsapp.net`);

        if (quotedLid && quotedLid !== targetNumber) {
            mapLidToPhone(quotedLid, targetNumber);
        }
        if (mentionedLid && mentionedLid !== targetNumber) {
            mapLidToPhone(mentionedLid, targetNumber);
        }

        if (result.success) {
            let successMsg = `✅ *Sudo User Added*\n\n👤 Number: +${result.number}\n🔑 Access: Owner-level commands`;
            if (quotedLid || mentionedLid) successMsg += `\n🔗 Group ID: Linked ✅`;
            successMsg += `\n\n_This user can now use owner commands._`;
            await sock.sendMessage(chatId, { text: successMsg }, { quoted: msg });
        } else {
            if (result.reason === 'Already a sudo user') {
                // Even on "already exists", re-register JIDs in case they were missing
                addSudoJid(targetNumber, targetNumber);
                addSudoJid(targetNumber, `${targetNumber}@s.whatsapp.net`);
                if (quotedLid) mapLidToPhone(quotedLid, targetNumber);
                if (mentionedLid) mapLidToPhone(mentionedLid, targetNumber);

                let replyMsg = `ℹ️ +${targetNumber} is already a sudo user.`;
                if (quotedLid || mentionedLid) replyMsg += ` Group ID re-linked ✅`;
                await sock.sendMessage(chatId, { text: replyMsg }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, {
                    text: `❌ *Failed:* ${result.reason}`
                }, { quoted: msg });
            }
        }
    }
};