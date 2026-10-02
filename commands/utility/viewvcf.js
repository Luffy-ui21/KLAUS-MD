import { downloadMediaMessage } from 'wolfsocket';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

function parseVcf(vcfText) {
    const contacts = [];
    const cards = vcfText.split(/END:VCARD/i);

    for (const card of cards) {
        if (!card.trim()) continue;

        let fullName = '';
        let nickname = '';
        let number = '';

        const fnMatch = card.match(/FN[;:](.+)/i);
        if (fnMatch) {
            fullName = fnMatch[1].trim().replace(/\\(.)/g, '$1');
        }

        const nickMatch = card.match(/NICKNAME[;:](.+)/i);
        if (nickMatch) {
            nickname = nickMatch[1].trim().replace(/\\(.)/g, '$1');
        }

        const nMatch = card.match(/\nN[;:]([^\n]+)/i);
        let nFirstName = '';
        if (nMatch) {
            const nParts = nMatch[1].split(';');
            nFirstName = (nParts[1] || '').trim().replace(/\\(.)/g, '$1');
        }

        const telMatch = card.match(/TEL[^:]*:(.+)/i);
        if (telMatch) {
            number = telMatch[1].trim().replace(/[^0-9+]/g, '');
        }

        if (!number && !fullName) continue;

        let username = nickname || '';

        if (!username) {
            const candidate = nFirstName || fullName || '';
            if (candidate && !/^\+?\d[\d\s-]{5,}$/.test(candidate.trim())) {
                username = candidate;
            }
        }

        if (!username && number) {
            const cleanNum = number.replace(/[^0-9]/g, '');
            if (global.contactNames && global.contactNames.has(cleanNum)) {
                username = global.contactNames.get(cleanNum);
            }
        }

        contacts.push({
            username: username || null,
            phone: number || 'N/A'
        });
    }

    return contacts;
}

export default {
    name: 'viewvcf',
    alias: ['readvcf', 'vcfview', 'vcfread'],
    category: 'utility',
    description: 'Reply to a VCF file to view contacts as JSON with username and phone number',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 📇 *VIEW VCF* ⌋\n├─⊷ Reply to a *.vcf* file with\n│  └⊷ *${PREFIX}viewvcf*\n├─⊷ Lists contacts as JSON\n╰─── *${getBotName()}* ───\n╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        const docMsg = quoted.documentMessage || quoted.documentWithCaptionMessage?.message?.documentMessage;
        if (!docMsg) {
            return sock.sendMessage(chatId, {
                text: '❌ Please reply to a VCF/contact file.'
            }, { quoted: msg });
        }

        const mime = (docMsg.mimetype || '').toLowerCase();
        const fileName = (docMsg.fileName || '').toLowerCase();
        if (!mime.includes('vcard') && !mime.includes('vcf') && !fileName.endsWith('.vcf')) {
            return sock.sendMessage(chatId, {
                text: '❌ That doesn\'t look like a VCF file. Please reply to a *.vcf* file.'
            }, { quoted: msg });
        }

        try {
            const quotedMsg = {
                key: {
                    ...msg.message.extendedTextMessage.contextInfo.stanzaId ? {
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        remoteJid: chatId,
                        participant: msg.message.extendedTextMessage.contextInfo.participant
                    } : msg.key
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            const vcfText = buffer.toString('utf-8');
            const contacts = parseVcf(vcfText);

            if (contacts.length === 0) {
                return sock.sendMessage(chatId, {
                    text: '❌ No contacts found in this VCF file.'
                }, { quoted: msg });
            }

            const MAX_DISPLAY = 50;
            const total = contacts.length;
            const truncated = total > MAX_DISPLAY;
            const displayContacts = truncated ? contacts.slice(0, MAX_DISPLAY) : contacts;

            const jsonOutput = {
                total: total,
                contacts: displayContacts
            };

            let text = `╭─⌈ 📇 *VCF CONTACTS* ⌋\n├─⊷ *Total:* ${total} contacts`;
            if (truncated) {
                text += ` _(first ${MAX_DISPLAY})_`;
            }
            text += `\n╰─── *${getBotName()}* ───\n\n`;
            text += '```\n';
            text += JSON.stringify(jsonOutput, null, 2);
            text += '\n```';

            if (truncated) {
                text += `\n\n_...and ${total - MAX_DISPLAY} more_`;
            }

            await sock.sendMessage(chatId, { text }, { quoted: msg });

        } catch (error) {
            console.error('viewvcf error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to read VCF file: ${error.message}`
            }, { quoted: msg });
        }
    }
};
