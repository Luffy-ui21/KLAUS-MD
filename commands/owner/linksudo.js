import { getSudoList, mapLidToPhone, isSudoNumber } from '../../lib/sudo-store.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

function resolveRealNumber(participant, sock) {
    if (!participant) return null;
    const jid = typeof participant === 'string' ? participant : (participant.id || participant.jid || '');
    const lid = typeof participant === 'string' ? null : (participant.lid || null);
    
    if (jid && !jid.includes('@lid')) {
        const raw = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (raw && raw.length >= 7 && raw.length <= 15) return raw;
    }
    
    const targetLid = lid || (jid && jid.includes('@lid') ? jid : null);
    if (targetLid && sock) {
        try {
            if (sock.signalRepository?.lidMapping?.getPNForLID) {
                const pn = sock.signalRepository.lidMapping.getPNForLID(targetLid);
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
    name: 'linksudo',
    alias: ['sudolink'],
    category: 'owner',
    description: 'Scan group to link sudo users WhatsApp IDs automatically',
    ownerOnly: true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command!*'
            }, { quoted: msg });
        }

        const isGroup = chatId.includes('@g.us');
        const { sudoers } = getSudoList();

        if (sudoers.length === 0) {
            return sock.sendMessage(chatId, {
                text: '❌ No sudo users to link. Add sudos first with `' + PREFIX + 'addsudo <number>`'
            }, { quoted: msg });
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (quoted) {
            const resolved = resolveRealNumber(quoted, sock);
            if (resolved) {
                if (isSudoNumber(resolved)) {
                    return sock.sendMessage(chatId, {
                        text: `✅ +${resolved} is a sudo user and their number resolves correctly. They should work in groups!`
                    }, { quoted: msg });
                } else {
                    return sock.sendMessage(chatId, {
                        text: `ℹ️ Resolved number: +${resolved}\nThis person is NOT a sudo user.\n\nAdd them first: \`${PREFIX}addsudo ${resolved}\``
                    }, { quoted: msg });
                }
            } else {
                const targetPhone = args[0]?.replace(/[^0-9]/g, '');
                if (targetPhone && targetPhone.length >= 7) {
                    if (!isSudoNumber(targetPhone)) {
                        return sock.sendMessage(chatId, {
                            text: `❌ +${targetPhone} is not a sudo user.\n\nAdd them first: \`${PREFIX}addsudo ${targetPhone}\``
                        }, { quoted: msg });
                    }
                    const lidNum = quoted.split('@')[0].split(':')[0];
                    if (lidNum !== targetPhone) {
                        mapLidToPhone(lidNum, targetPhone);
                        return sock.sendMessage(chatId, {
                            text: `✅ *Manually Linked!*\n\n👤 +${targetPhone}\n🔗 Linked to WhatsApp ID\n\n_This sudo should now work in groups._`
                        }, { quoted: msg });
                    }
                }
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ ⚠️ *LINK SUDO* ⌋\n│\n├─⊷ *Reply + ${PREFIX}linksudo <number>*\n│  └⊷ Link sudo number\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
                }, { quoted: msg });
            }
        }

        if (!isGroup) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 📋 *LINK SUDO* ⌋\n│\n├─⊷ *${PREFIX}linksudo*\n│  └⊷ Auto-scan members\n├─⊷ *Reply + ${PREFIX}linksudo*\n│  └⊷ Link specific sudo user\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
            text: '🔄 *Scanning group members for sudo users...*'
        }, { quoted: msg });

        try {
            const metadata = await sock.groupMetadata(chatId);
            const participants = metadata.participants || [];
            let linked = 0;
            let details = [];
            let notFound = [];

            for (const sudoNum of sudoers) {
                let found = false;
                for (const p of participants) {
                    const resolved = resolveRealNumber(p, sock);
                    if (resolved === sudoNum) {
                        found = true;
                        const pLid = p.lid || (p.id?.includes('@lid') ? p.id : null);
                        if (pLid) {
                            const lidNum = pLid.split('@')[0].split(':')[0];
                            if (lidNum !== sudoNum) {
                                mapLidToPhone(lidNum, sudoNum);
                                linked++;
                                details.push(`✅ +${sudoNum} → linked`);
                            } else {
                                details.push(`✅ +${sudoNum} → already linked`);
                            }
                        } else {
                            details.push(`✅ +${sudoNum} → found (phone-based ID)`);
                        }
                        break;
                    }
                }
                if (!found) {
                    notFound.push(sudoNum);
                }
            }

            let resultMsg = `🔗 *Sudo Link Scan Results*\n\n`;
            resultMsg += `👥 Group: ${metadata.subject}\n`;
            resultMsg += `👤 Members: ${participants.length}\n`;
            resultMsg += `🔑 Sudos: ${sudoers.length}\n\n`;

            if (details.length > 0) {
                resultMsg += details.join('\n') + '\n\n';
            }

            if (notFound.length > 0) {
                resultMsg += `❌ Not found in group: ${notFound.map(s => '+' + s).join(', ')}\n\n`;
            }

            if (linked > 0) {
                resultMsg += `✅ ${linked} sudo(s) linked! They should now work in this group.`;
            } else if (details.length > 0) {
                resultMsg += `ℹ️ All found sudos are already working.`;
            } else {
                resultMsg += `⚠️ No sudo users found in this group.\n\n*Manual link:* Reply to a sudo user's message →\n\`${PREFIX}linksudo\``;
            }

            await sock.sendMessage(chatId, { text: resultMsg });
        } catch (err) {
            await sock.sendMessage(chatId, {
                text: `❌ Error scanning group: ${err.message}\n\n*Manual method:* Reply to a sudo user's message with:\n\`${PREFIX}linksudo\``
            });
        }
    }
};
