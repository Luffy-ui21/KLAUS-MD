import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

function getDevice(id) {
    if (!id) return 'unknown';
    if (/^3A.{18}$/.test(id)) return 'ios';
    if (/^3E.{20}$/.test(id)) return 'web';
    if (/^(.{21}|.{32})$/.test(id)) return 'android';
    if (/^(3F|.{18}$)/.test(id)) return 'desktop';
    return 'unknown';
}

const DEVICE_INFO = {
    ios: {
        emoji: '🍎',
        label: 'iOS',
        desc: 'iPhone / iPad'
    },
    android: {
        emoji: '🤖',
        label: 'Android',
        desc: 'Android Phone / Tablet'
    },
    web: {
        emoji: '🌐',
        label: 'WhatsApp Web',
        desc: 'Browser / Web App'
    },
    desktop: {
        emoji: '🖥️',
        label: 'Desktop',
        desc: 'Mac / Windows App'
    },
    unknown: {
        emoji: '❓',
        label: 'Unknown',
        desc: 'Could not detect device'
    }
};

export default {
    name: 'device',
    alias: ['mydevice', 'checkdevice', 'getdevice'],
    category: 'utility',
    description: 'Detect the device someone is using (Android, iOS, Web, Desktop)',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant
            || msg.message?.extendedTextMessage?.contextInfo?.remoteJid;

        let targetId;
        let targetLabel;

        if (quoted && quotedKey) {
            targetId = quotedKey;
            const num = (quotedSender || '').split('@')[0].split(':')[0].replace(/\D/g, '');
            targetLabel = num ? `+${num}` : 'that user';
        } else {
            targetId = msg.key.id;
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const num = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '');
            targetLabel = num ? `+${num}` : 'you';
        }

        const deviceKey = getDevice(targetId);
        const info = DEVICE_INFO[deviceKey];

        const text =
            `╭─⌈ ${info.emoji} *DEVICE DETECTOR* ⌋\n` +
            `│\n` +
            `├─⊷ *User:* ${targetLabel}\n` +
            `├─⊷ *Device:* ${info.emoji} ${info.label}\n` +
            `├─⊷ *Type:* ${info.desc}\n` +
            `│\n` +
            `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

        await sock.sendMessage(chatId, { text }, { quoted: msg });
    }
};
