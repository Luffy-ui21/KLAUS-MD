import {
    normalizeMessageContent,
    extractMessageContent,
    getContentType
} from 'wolfsocket';

function safeJson(obj) {
    return JSON.stringify(obj, (k, v) => {
        if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
            return `<Buffer ${v.length}B>`;
        }
        if (typeof v === 'bigint') return v.toString() + 'n';
        return v;
    }, 2);
}

export default {
    name: 'messagetype',
    aliases: ['msgtype', 'mtype'],
    category: 'owner',
    description: 'Debug: reply to any message to see its raw JSON structure',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager, store } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, { text: '❌ *Owner Only Command!*' }, { quoted: msg });
        }

        // Get quoted message
        const ctxInfo = (() => {
            if (!msg.message) return null;
            for (const key of Object.keys(msg.message)) {
                const ctx = msg.message[key]?.contextInfo;
                if (ctx) return ctx;
            }
            return null;
        })();

        const quotedPartial = ctxInfo?.quotedMessage || null;
        const quotedId      = ctxInfo?.stanzaId || null;
        const quotedSender  = ctxInfo?.participant || msg.key.remoteJid;

        if (!quotedPartial && !quotedId) {
            return sock.sendMessage(chatId, {
                text: '↩️ *Reply to any message* with `.mtype` to inspect its raw JSON.'
            }, { quoted: msg });
        }

        // Try store first, fall back to partial
        let raw = quotedPartial;
        let source = 'contextInfo (partial)';
        if (store && quotedId) {
            try {
                for (const jid of [chatId, quotedSender]) {
                    const found = store.getMessage(jid, quotedId);
                    if (found?.message) { raw = found.message; source = 'store (full)'; break; }
                }
            } catch {}
        }

        // Build the summary + raw JSON as one object
        const extracted = raw ? extractMessageContent(raw) : null;
        const contentType = extracted ? getContentType(extracted) : null;
        const normalized = raw ? normalizeMessageContent(raw) : null;

        const debug = {
            source,
            topKeys:       raw        ? Object.keys(raw)        : [],
            contentType:   contentType || null,
            normalizedKeys: normalized ? Object.keys(normalized) : [],
            raw
        };

        const jsonText = safeJson(debug);
        const MAX = 59000; // WhatsApp message limit buffer
        const body = jsonText.length > MAX
            ? jsonText.slice(0, MAX) + '\n... (truncated)'
            : jsonText;

        await sock.sendMessage(chatId, {
            text: '```json\n' + body + '\n```'
        }, { quoted: msg });
    }
};
