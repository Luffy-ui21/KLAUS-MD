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

function resolveUsername(participant, number, contactsMap) {
    if (participant.notify) return participant.notify;
    if (participant.name) return participant.name;
    if (participant.vname) return participant.vname;
    if (participant.short) return participant.short;
    if (participant.pushName) return participant.pushName;

    if (contactsMap instanceof Map) {
        const jid = normalizeParticipantJid(participant);
        if (jid) {
            const jidKey = jid.split('@')[0];
            const cached = contactsMap.get(jidKey);
            if (cached) return cached;
            const jidKeyClean = jidKey.split(':')[0];
            if (jidKeyClean !== jidKey) {
                const cached2 = contactsMap.get(jidKeyClean);
                if (cached2) return cached2;
            }
            const fullJid = jid;
            const fullCached = contactsMap.get(fullJid);
            if (fullCached) return fullCached;
        }

        if (number) {
            const cached = contactsMap.get(number);
            if (cached) return cached;
        }

        if (participant.lid) {
            const lidKey = participant.lid.split('@')[0].split(':')[0];
            const lidCached = contactsMap.get(lidKey);
            if (lidCached) return lidCached;
            const lidFull = participant.lid.split('@')[0];
            if (lidFull !== lidKey) {
                const lidFullCached = contactsMap.get(lidFull);
                if (lidFullCached) return lidFullCached;
            }
        }

        const jid2 = normalizeParticipantJid(participant);
        if (jid2 && jid2.includes('@lid')) {
            const lidFromJid = jid2.split('@')[0].split(':')[0];
            const lidCached2 = contactsMap.get(lidFromJid);
            if (lidCached2) return lidCached2;
            const lidFullJid = jid2.split('@')[0];
            const lidFullCached2 = contactsMap.get(lidFullJid);
            if (lidFullCached2) return lidFullCached2;
            const fullJidCached = contactsMap.get(jid2);
            if (fullJidCached) return fullJidCached;
        }
    }

    return null;
}

export default {
    name: 'getparticipants',
    alias: ['gp', 'participants', 'members', 'memberlist'],
    category: 'group',
    description: 'Shows all group participants with their real WhatsApp numbers and names',
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

            const participants = metadata.participants || [];

            const contactNames = (global.contactNames instanceof Map) ? global.contactNames : new Map();

            const contactStore = sock?.store?.contacts || {};
            const mergedContacts = new Map(contactNames);
            for (const [jid, contact] of Object.entries(contactStore)) {
                const name = contact?.notify || contact?.name || contact?.vname || contact?.short || contact?.pushName;
                if (name) {
                    const jidKey = jid.split('@')[0];
                    mergedContacts.set(jidKey, name);
                    const jidKeyClean = jidKey.split(':')[0];
                    if (jidKeyClean !== jidKey) mergedContacts.set(jidKeyClean, name);
                    const num = extractNumberFromJid(jid);
                    if (num) mergedContacts.set(num, name);
                }
            }

            const result = {
                group: metadata.subject || 'Unknown',
                totalMembers: participants.length,
                extractedAt: new Date().toISOString(),
                participants: []
            };

            for (const p of participants) {
                const realNumber = resolveRealNumber(p, sock);
                const username = resolveUsername(p, realNumber, mergedContacts);

                let role = 'member';
                if (p.admin === 'superadmin' || p.isSuperAdmin) role = 'superadmin';
                else if (p.admin === 'admin' || p.isAdmin) role = 'admin';

                const displayName = username || (realNumber ? `+${realNumber}` : 'Unknown');

                const entry = {
                    name: displayName,
                    number: realNumber ? `+${realNumber}` : 'unavailable',
                    role: role
                };

                result.participants.push(entry);
            }

            result.participants.sort((a, b) => {
                const order = { superadmin: 0, admin: 1, member: 2 };
                return (order[a.role] ?? 2) - (order[b.role] ?? 2);
            });

            const MAX_DISPLAY = 100;
            let truncated = false;
            const displayResult = { ...result };

            if (result.participants.length > MAX_DISPLAY) {
                displayResult.participants = result.participants.slice(0, MAX_DISPLAY);
                displayResult.showing = `${MAX_DISPLAY} of ${result.participants.length}`;
                truncated = true;
            }

            const jsonString = JSON.stringify(displayResult, null, 2);

            let footer = '';
            if (truncated) {
                footer = `\n\n_Showing first ${MAX_DISPLAY} of ${result.participants.length} members_`;
            }

            await sock.sendMessage(chatId, {
                text: `📋 *GROUP PARTICIPANTS*${footer}\n\n\`\`\`${jsonString}\`\`\``
            }, { quoted: msg });

        } catch (error) {
            console.error('getparticipants error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to get participants: ${error.message}`
            }, { quoted: msg });
        }
    }
};
