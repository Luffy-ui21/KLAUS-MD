import { callAI } from '../../lib/aiHelper.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const TONES = {
    happy:       { label: '😊 Happy',        desc: 'upbeat, joyful, celebratory with a feel-good chorus' },
    sad:         { label: '😢 Sad',           desc: 'melancholic, emotional, heartfelt and slow-paced' },
    rap:         { label: '🎤 Rap',           desc: 'rhythmic rap with clever wordplay, punchlines and a hard-hitting flow' },
    trap:        { label: '🔥 Trap',          desc: 'dark trap style with ad-libs, heavy 808 references and street energy' },
    evening:     { label: '🌆 Evening',       desc: 'laid-back, reflective evening vibes — winding down after a long day' },
    morning:     { label: '🌅 Morning',       desc: 'fresh and hopeful, like a new sunrise and a brand new start' },
    romantic:    { label: '💕 Romantic',      desc: 'tender love song — soft, sweet and deeply affectionate' },
    heartbreak:  { label: '💔 Heartbreak',    desc: 'raw pain of losing someone you love, bittersweet and aching' },
    motivational:{ label: '💪 Motivational',  desc: 'powerful anthem to push through struggle and never give up' },
    chill:       { label: '😎 Chill',         desc: 'smooth and relaxed lo-fi or RnB style, easy on the ears' },
    angry:       { label: '😤 Angry',         desc: 'aggressive and intense, venting frustration and raw emotion' },
    nostalgic:   { label: '🕰️ Nostalgic',    desc: 'longing for the past, warm memories fading like old photographs' },
    party:       { label: '🎉 Party',         desc: 'high-energy club banger, made for dancing and celebrating' },
    rnb:         { label: '🎷 R&B',           desc: 'soulful RnB with smooth vocal runs, groovy rhythm and emotion' },
    gospel:      { label: '🙏 Gospel',        desc: 'spiritual and uplifting, full of faith, hope and worship' },
    afrobeat:    { label: '🥁 Afrobeat',      desc: 'vibrant Afrobeats energy — rhythm-heavy, danceable and expressive' },
    reggae:      { label: '🌴 Reggae',        desc: 'laid-back reggae with one-love vibes, unity and positivity' },
    pop:         { label: '🎵 Pop',           desc: 'radio-ready pop with a catchy hook and universal appeal' },
    soul:        { label: '🎶 Soul',          desc: 'deep soul music — raw emotion, vulnerability and powerful delivery' },
    lofi:        { label: '🎧 Lo-fi',         desc: 'quiet, introspective lo-fi — late nights, coffee and deep thoughts' },
};

const TONE_KEYS = Object.keys(TONES);

function pickTone(args) {
    if (!args.length) return null;
    const input = args.join(' ').toLowerCase().replace(/\s+tone$/i, '').trim();
    if (TONES[input]) return input;
    for (const key of TONE_KEYS) {
        if (input.includes(key)) return key;
    }
    return input || null;
}

function randomTone() {
    return TONE_KEYS[Math.floor(Math.random() * TONE_KEYS.length)];
}

function buildPrompt(toneKey, toneInfo) {
    return (
        `Write original song lyrics in a ${toneInfo.label.replace(/^.\s/, '')} style. ` +
        `The tone should be: ${toneInfo.desc}. ` +
        `Structure the lyrics with: an intro line, two verses (4–6 lines each), a catchy chorus (4 lines, repeated twice), and a short outro. ` +
        `Label each section clearly (e.g. [Verse 1], [Chorus], [Outro]). ` +
        `Make the lyrics feel genuine, poetic and emotionally resonant. ` +
        `Do not include any explanation — output lyrics only.`
    );
}

export default {
    name:        'genlyrics',
    alias:       ['genrandomlyrics', 'generatelyrics', 'ailyrics', 'lyricsgen', 'maklyrics'],
    category:    'utility',
    description: 'Generate AI song lyrics with a chosen mood/tone',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const reply  = (text, opts = {}) => sock.sendMessage(chatId, { text }, { quoted: msg, ...opts });

        if (!args.length) {
            const rows = [...TONE_KEYS, 'random'].map(k => `│  • ${k}`);
            return reply(
                `╭─⌈ *GENLYRICS* ⌋\n` +
                `│\n` +
                `├─⊷ *Usage:* ${PREFIX}genlyrics <tone>\n` +
                `│\n` +
                `├─⊷ *Available Tones:*\n` +
                `│\n` +
                rows.join('\n') + '\n' +
                `│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        let toneKey;
        if (args[0].toLowerCase() === 'random') {
            toneKey = randomTone();
        } else {
            toneKey = pickTone(args);
            if (!toneKey || !TONES[toneKey]) {
                toneKey = randomTone();
                await reply(`⚠️ Unknown tone "_${args.join(' ')}_" — picking a random one instead: *${TONES[toneKey].label}*`);
            }
        }

        const toneInfo = TONES[toneKey];
        const prompt   = buildPrompt(toneKey, toneInfo);

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        let lyrics;
        try {
            lyrics = await callAI('gpt', prompt);
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Failed to generate lyrics.\n\n_${err.message}_\n\n💡 Try again in a moment.`);
        }

        if (!lyrics || lyrics.trim().length < 30) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ The AI returned an empty response. Try again.`);
        }

        const trimmed   = lyrics.length > 3500 ? lyrics.slice(0, 3500) + '\n…' : lyrics;
        const msgText   =
            `🎤 *AI GENERATED LYRICS*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `${toneInfo.label} Tone\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${trimmed}`;

        const _gb = globalThis._giftedBtns;
        if (_gb && typeof _gb.sendInteractiveMessage === 'function') {
            try {
                await _gb.sendInteractiveMessage(sock, chatId, {
                    text:   msgText,
                    footer: ` ${getOwnerName().toUpperCase()} TECH`,
                    interactiveButtons: [{
                        name: 'cta_copy',
                        buttonParamsJson: JSON.stringify({
                            display_text: '📋 Copy Lyrics',
                            copy_code:    trimmed
                        })
                    }]
                });
            } catch {
                await reply(msgText + `\n\n${getFooter(msg.key.participant || msg.key.remoteJid)}`);
            }
        } else {
            await reply(msgText + `\n\n${getFooter(msg.key.participant || msg.key.remoteJid)}`);
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
