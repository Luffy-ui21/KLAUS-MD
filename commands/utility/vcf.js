import { jidNormalizedUser } from 'wolfsocket';

function normalizeParticipantJid(p) {
    if (typeof p === 'string') return p;
    return p.id || p.jid || p.userJid || p.participant || p.user || '';
}

function extractNumberFromJid(jid) {
    if (!jid) return null;
    if (jid.includes('@lid')) return null;
    const raw = jid.split('@')[0].replace(/[^0-9]/g, '');
    if (!raw || raw.length < 7 || raw.length > 15) return null;
    return raw;
}

function resolveRealNumber(participant, sock) {
    if (participant.phoneNumber) {
        const num = String(participant.phoneNumber).replace(/[^0-9]/g, '');
        if (num.length >= 7) return num;
    }

    const jid = normalizeParticipantJid(participant);
    const fromJid = extractNumberFromJid(jid);
    if (fromJid) return fromJid;

    if (participant.lid || (jid && jid.includes('@lid'))) {
        const lid = participant.lid || jid;
        try {
            if (sock?.signalRepository?.lidMapping?.getPNForLID) {
                const pn = sock.signalRepository.lidMapping.getPNForLID(lid);
                if (pn) {
                    const num = String(pn).split('@')[0].replace(/[^0-9]/g, '');
                    if (num.length >= 7) return num;
                }
            }
        } catch {}
    }

    return null;
}

function getDisplayName(participant, sock) {
    if (participant.notify) return participant.notify;
    if (participant.name) return participant.name;
    if (participant.verifiedName) return participant.verifiedName;
    if (participant.pushName) return participant.pushName;

    const jid = normalizeParticipantJid(participant);
    const number = jid ? jid.split(':')[0].split('@')[0] : null;

    if (number && global.contactNames && global.contactNames.has(number)) {
        return global.contactNames.get(number);
    }

    if (number && sock?.store?.contacts) {
        const contact = sock.store.contacts[jid] || sock.store.contacts[`${number}@s.whatsapp.net`];
        if (contact) {
            return contact.notify || contact.name || contact.pushName || contact.verifiedName || null;
        }
    }

    return null;
}

const RANDOM_EMOJIS = [
    '', '🔥', '⚡', '💎', '🌟', '✨', '🎯', '🦁', '🐉', '🌙',
    '💫', '🗡️', '🛡️', '👑', '🎭', '🌀', '💠', '🔮', '🧿', '❄️',
    '🌊', '🍀', '🦅', '🐍', '🦊', '🐾', '💀', '🎪', '🏴', '⭐',
    '🌸', '🦋', '🔱', '🎖️', '🏆', '💥', '🌈', '🎩', '🧨', '🃏',
    '🦇', '🐲', '🦈', '🦂', '🕷️', '🐧', '🦌', '🦎', '🐊', '🦉'
];

function getRandomEmoji() {
    return RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
}

function escapeVcf(str) {
    if (!str) return '';
    return str.replace(/[\\;,]/g, c => '\\' + c);
}

export default {
    name: 'vcf',
    alias: ['groupvcf', 'groupcontacts', 'savecontacts'],
    category: 'utility',
    description: 'Creates a VCF contact file with KLAUS MD branded names and random emojis',
    groupOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const normalizedSender = jidNormalizedUser(senderJid);

        try {
            const metadata = await sock.groupMetadata(chatId);

            const senderEntry = metadata.participants.find(p => {
                const pJid = normalizeParticipantJid(p);
                try { return jidNormalizedUser(pJid) === normalizedSender; } catch { return false; }
            });
            const isAdmin = senderEntry?.admin === 'admin' || senderEntry?.admin === 'superadmin';

            if (!isAdmin && !extra?.jidManager?.isOwner(msg)) {
                return sock.sendMessage(chatId, {
                    text: '❌ *Admin Only Command*\nYou need to be admin to use this command.'
                }, { quoted: msg });
            }

            const customLabel = args.join(' ').trim() || '';
            const brandName = customLabel || 'KLAUS-MD';

            const participants = metadata.participants || [];
            const groupName = metadata.subject || 'Group';
            let vcfContent = '';
            let count = 0;
            let skipped = 0;

            for (const p of participants) {
                const number = resolveRealNumber(p, sock);
                if (!number) {
                    skipped++;
                    continue;
                }

                count++;
                const emoji = getRandomEmoji();
                const contactName = `${emoji} ${brandName} ${count}`;

                vcfContent += `BEGIN:VCARD\r\n`;
                vcfContent += `VERSION:3.0\r\n`;
                vcfContent += `FN:${escapeVcf(contactName)}\r\n`;
                vcfContent += `N:${escapeVcf(brandName)};${emoji} ${count};;;\r\n`;
                vcfContent += `NICKNAME:${escapeVcf(contactName)}\r\n`;
                vcfContent += `ORG:${escapeVcf(brandName)}\r\n`;
                vcfContent += `TEL;type=CELL;type=pref:+${number}\r\n`;
                vcfContent += `END:VCARD\r\n`;
            }

            if (count === 0) {
                return sock.sendMessage(chatId, {
                    text: '❌ No real WhatsApp numbers could be extracted from this group.'
                }, { quoted: msg });
            }

            const safeGroupName = groupName.replace(/[^a-zA-Z0-9 ]/g, '_').trim();
            let caption = `📇 *${count}* contacts saved as *${brandName}*\n From: *${groupName}*\n✨ Each contact has a unique emoji + number`;
            if (skipped > 0) {
                caption += `\n_${skipped} members had unavailable numbers_`;
            }

            await sock.sendMessage(chatId, {
                document: Buffer.from(vcfContent),
                fileName: `${safeGroupName}_SilentWolf.vcf`,
                mimetype: 'text/vcard',
                caption: caption
            }, { quoted: msg });

        } catch (error) {
            console.error('vcf error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to create VCF: ${error.message}`
            }, { quoted: msg });
        }
    }
};
