import { getBotName } from '../../lib/botname.js';

const LANG_NAMES = {
    af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', hy: 'Armenian',
    az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian',
    bg: 'Bulgarian', ca: 'Catalan', ceb: 'Cebuano', zh: 'Chinese', co: 'Corsican',
    hr: 'Croatian', cs: 'Czech', da: 'Danish', nl: 'Dutch', en: 'English',
    eo: 'Esperanto', et: 'Estonian', fi: 'Finnish', fr: 'French', fy: 'Frisian',
    gl: 'Galician', ka: 'Georgian', de: 'German', el: 'Greek', gu: 'Gujarati',
    ht: 'Haitian Creole', ha: 'Hausa', haw: 'Hawaiian', he: 'Hebrew', hi: 'Hindi',
    hmn: 'Hmong', hu: 'Hungarian', is: 'Icelandic', ig: 'Igbo', id: 'Indonesian',
    ga: 'Irish', it: 'Italian', ja: 'Japanese', jv: 'Javanese', kn: 'Kannada',
    kk: 'Kazakh', km: 'Khmer', rw: 'Kinyarwanda', ko: 'Korean', ku: 'Kurdish',
    ky: 'Kyrgyz', lo: 'Lao', la: 'Latin', lv: 'Latvian', lt: 'Lithuanian',
    lb: 'Luxembourgish', mk: 'Macedonian', mg: 'Malagasy', ms: 'Malay', ml: 'Malayalam',
    mt: 'Maltese', mi: 'Maori', mr: 'Marathi', mn: 'Mongolian', my: 'Myanmar',
    ne: 'Nepali', no: 'Norwegian', ny: 'Nyanja', or: 'Odia', ps: 'Pashto',
    fa: 'Persian', pl: 'Polish', pt: 'Portuguese', pa: 'Punjabi', ro: 'Romanian',
    ru: 'Russian', sm: 'Samoan', gd: 'Scots Gaelic', sr: 'Serbian', st: 'Sesotho',
    sn: 'Shona', sd: 'Sindhi', si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian',
    so: 'Somali', es: 'Spanish', su: 'Sundanese', sw: 'Swahili', sv: 'Swedish',
    tl: 'Filipino', tg: 'Tajik', ta: 'Tamil', tt: 'Tatar', te: 'Telugu',
    th: 'Thai', tr: 'Turkish', tk: 'Turkmen', uk: 'Ukrainian', ur: 'Urdu',
    ug: 'Uyghur', uz: 'Uzbek', vi: 'Vietnamese', cy: 'Welsh', xh: 'Xhosa',
    yi: 'Yiddish', yo: 'Yoruba', zu: 'Zulu',
};

async function googleTranslate(text, to) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const translated = data[0]?.map(s => s?.[0] || '').join('') || '';
    const detectedLang = data[2] || 'auto';
    if (!translated) throw new Error('Empty translation result');
    return { translated, detectedLang };
}

function getContextText(m) {
    const ctx = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!ctx) return null;
    return ctx.conversation ||
           ctx.extendedTextMessage?.text ||
           ctx.imageMessage?.caption ||
           ctx.videoMessage?.caption ||
           null;
}

export default {
    name: 'translate',
    alias: ['tr', 'trans'],
    description: 'Translate text to any language',
    category: 'utility',
    usage: '.translate <lang> <text> | reply to a message with .translate <lang>',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const targetLang = args[0]?.toLowerCase();

        if (!targetLang) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 TRANSLATE 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ ${PREFIX}translate fr Hello world\n` +
                      `├⊷ ${PREFIX}translate sw (reply to a message)\n` +
                      `├⊷ ${PREFIX}translate ar <text>\n` +
                      `│\n` +
                      `├⊷ *Common Codes:*\n` +
                      `├⊷ en=English  sw=Swahili  fr=French\n` +
                      `├⊷ ar=Arabic   de=German   es=Spanish\n` +
                      `├⊷ zh=Chinese  hi=Hindi    ru=Russian\n` +
                      `└⊷ pt=Portuguese  ja=Japanese  ko=Korean\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        const quotedText = getContextText(m);
        const bodyText = args.slice(1).join(' ').trim();
        const text = quotedText || bodyText;

        if (!text) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 TRANSLATE 』\n│\n` +
                      `├⊷ *No text provided.*\n` +
                      `├⊷ Either reply to a message or add text after the language code.\n` +
                      `└⊷ *Example:* ${PREFIX}translate ${targetLang} Hello world\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const { translated, detectedLang } = await googleTranslate(text, targetLang);

            const fromName = LANG_NAMES[detectedLang] || detectedLang.toUpperCase();
            const toName   = LANG_NAMES[targetLang]   || targetLang.toUpperCase();

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 TRANSLATION 』\n│\n` +
                      `├⊷ *From:* ${fromName}\n` +
                      `├⊷ *To:* ${toName}\n` +
                      `│\n` +
                      `├⊷ *Original:*\n` +
                      `│  ${text.length > 200 ? text.slice(0, 200) + '…' : text}\n` +
                      `│\n` +
                      `├⊷ *Translated:*\n` +
                      `│  ${translated}\n` +
                      `│\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 TRANSLATE 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `├⊷ *Tip:* Make sure the language code is valid\n` +
                      `└⊷ *Example codes:* en, fr, sw, ar, de, es, zh\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
