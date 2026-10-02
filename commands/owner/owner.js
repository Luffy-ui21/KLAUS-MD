import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

const CONTACT_FILE = path.join(process.cwd(), 'bot_owner_contact.json');

function getOwnerContact() {
    try {
        if (fs.existsSync(CONTACT_FILE)) {
            const d = JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8'));
            if (d.number) return d.number;
        }
    } catch {}
    return '254713046497';
}

function saveOwnerContact(number) {
    fs.writeFileSync(CONTACT_FILE, JSON.stringify({ number }, null, 2));
}

export default {
    name: 'owner',
    alias: ['creator', 'dev', 'developer'],
    description: 'Show or update bot owner contact',
    category: 'owner',

    async execute(sock, m, args, PREFIX, extra) {
        const jid = m.key.remoteJid;
        const { jidManager } = extra || {};
        const isOwner = jidManager?.isOwner(m) || false;

        if (args[0]) {
            if (!isOwner) {
                return sock.sendMessage(jid, {
                    text: `❌ *Owner Only Command!*`
                }, { quoted: m });
            }

            const newNumber = args[0].replace(/\D/g, '');
            if (newNumber.length < 7) {
                return sock.sendMessage(jid, {
                    text: `❌ Invalid number. Example: \`${PREFIX}owner 254703397679\``
                }, { quoted: m });
            }

            saveOwnerContact(newNumber);
            return sock.sendMessage(jid, {
                text: `✅ *Owner number updated*\n\`+${newNumber}\``
            }, { quoted: m });
        }

        const ownerNumber = getOwnerContact();
        const ownerJid = `${ownerNumber}@s.whatsapp.net`;

        try { await sock.sendMessage(jid, { react: { text: '👑', key: m.key } }); } catch {}

        const vcard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${getOwnerName()} (Bot Owner)\n` +
            `ORG:${getBotName()};\n` +
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
            'END:VCARD';

        if (giftedBtns?.sendInteractiveMessage) {
            try {
                await giftedBtns.sendInteractiveMessage(sock, jid, {
                    text: `👑 *${getBotName()} OWNER*\n\n📱 *+${ownerNumber}*`,
                    footer: ` ${getBotName()}`,
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy Number',
                                copy_code: `+${ownerNumber}`
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '💬 Message Owner',
                                url: `https://wa.me/${ownerNumber}`
                            })
                        }
                    ]
                });
                await sock.sendMessage(jid, {
                    contacts: { displayName: `${getOwnerName()} (Bot Owner)`, contacts: [{ vcard }] }
                }, { quoted: m });
                return;
            } catch {}
        }

        await sock.sendMessage(jid, {
            text: `👑 *${getBotName()} OWNER*\n\n📱 *+${ownerNumber}*\n\n💬 https://wa.me/${ownerNumber}`
        }, { quoted: m });
        await sock.sendMessage(jid, {
            contacts: { displayName: `${getOwnerName()} (Bot Owner)`, contacts: [{ vcard }] }
        }, { quoted: m });
    }
};
