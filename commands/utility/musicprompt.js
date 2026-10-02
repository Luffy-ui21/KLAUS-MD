import { callAI } from '../../lib/aiHelper.js';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const GENRES = ['Pop','Afrobeat','Hip-hop','R&B','Rock','Jazz','Reggae','Country',
                'Electronic','Soul','Blues','Classical','Trap','Dancehall','Gospel',
                'Indie','Folk','Lo-fi'];
const MOODS  = ['Happy','Sad','Romantic','Energetic','Calm'];
const VOCALS = ['Male','Female'];

// ── System prompt sent to the AI ─────────────────────────────────────────────
function buildAIPrompt(userIdea) {
    return (
        `You are a music prompt engineer. A user wants to generate a song using an AI music tool. ` +
        `They have described their idea casually. Your job is to craft the best possible structured prompt.\n\n` +

        `The tool accepts these exact values:\n` +
        `  GENRE  (pick ONE): ${GENRES.join(', ')}\n` +
        `  MOOD   (pick ONE): ${MOODS.join(', ')}\n` +
        `  VOCAL  (pick ONE): Male, Female, or Instrumental\n\n` +

        `Rules:\n` +
        `1. PROMPT must be SHORT and DIRECT — one clear sentence that names the theme, ` +
        `   feeling, and story of the song. Think of it like a song brief: ` +
        `   "a sad Afrobeat song about missing home" or "a hype party banger for a Nairobi night". ` +
        `   Do NOT write long paragraphs or flowery descriptions — short works best.\n` +
        `2. GENRE, MOOD, VOCAL must be chosen ONLY from the lists above. ` +
        `   If the user implies no vocals or instrumental, set VOCAL to Instrumental.\n` +
        `3. Output ONLY the following 4 lines — nothing else, no explanations:\n\n` +

        `PROMPT: <short one-sentence song brief>\n` +
        `GENRE: <one genre from the list>\n` +
        `MOOD: <one mood from the list>\n` +
        `VOCAL: <Male | Female | Instrumental>\n\n` +

        `User's idea:\n"${userIdea}"`
    );
}

// ── Parse AI response into structured fields ─────────────────────────────────
function parseAIResponse(text) {
    const get = (key) => {
        const match = text.match(new RegExp(`^${key}:\\s*(.+)`, 'im'));
        return match ? match[1].trim() : null;
    };
    return {
        prompt: get('PROMPT'),
        genre:  get('GENRE'),
        mood:   get('MOOD'),
        vocal:  get('VOCAL'),
    };
}

function validate(parsed) {
    if (!parsed.prompt || parsed.prompt.length < 10) return false;
    if (!GENRES.includes(parsed.genre))  parsed.genre  = 'Pop';
    if (!MOODS.includes(parsed.mood))    parsed.mood   = 'Happy';
    if (!VOCALS.includes(parsed.vocal) && parsed.vocal?.toLowerCase() !== 'instrumental')
        parsed.vocal = 'Male';
    if (parsed.vocal?.toLowerCase() === 'instrumental') parsed.vocal = null; // use flag instead
    return true;
}

// ── Main command ─────────────────────────────────────────────────────────────
export default {
    name:        'musicprompt',
    alias:       ['promptmusic', 'songprompt', 'genmusicprompt', 'musicidea', 'promptgen', 'aimusic prompt'],
    category:    'utility',
    description: 'Describe your music idea in plain words — AI crafts a perfect genmusic prompt for you',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        if (!args.length) {
            return reply(
                `╭─⌈ 🎵 *MUSIC PROMPT GENERATOR* ⌋\n` +
                `│\n` +
                `│ Describe your idea in plain words — the AI\n` +
                `│ builds a ready-to-use *${PREFIX}genmusic* command.\n` +
                `│\n` +
                `│ *Usage:*\n` +
                `│  ${PREFIX}musicprompt <your music idea>\n` +
                `│\n` +
                `│ *Examples:*\n` +
                `│  ${PREFIX}musicprompt sad song about missing someone far away\n` +
                `│  ${PREFIX}musicprompt hype Afrobeat banger for a party, female vocals\n` +
                `│  ${PREFIX}musicprompt peaceful piano music, no vocals\n` +
                `│  ${PREFIX}musicprompt reggae about growing up poor but happy in Nairobi\n` +
                `│\n` +
                `│ *What you get back:*\n` +
                `│  A short, clean command like:\n` +
                `│  _${PREFIX}genmusic a sad Afrobeat song about missing home_\n` +
                `│  _| genre=Afrobeat | mood=Sad | vocal=Male_\n` +
                `│\n` +
                `│ Just copy and send it — done.\n` +
                `│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        const userIdea = args.join(' ').trim();

        await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } });

        let aiRaw;
        try {
            aiRaw = await callAI('gpt', buildAIPrompt(userIdea));
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ AI failed to respond.\n\n_${err.message}_\n\n💡 Try again in a moment.`);
        }

        const parsed = parseAIResponse(aiRaw);

        if (!validate(parsed)) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(
                `❌ The AI returned an unexpected format. Try rephrasing your idea.\n\n` +
                `_Raw AI response:_\n${aiRaw.slice(0, 300)}`
            );
        }

        const isInstrumental = !parsed.vocal;
        const vocalPart      = isInstrumental ? ` | instrumental` : ` | vocal=${parsed.vocal}`;
        const readyCommand   = `${PREFIX}genmusic ${parsed.prompt} | genre=${parsed.genre} | mood=${parsed.mood}${vocalPart}`;

        const out =
            `╭─⌈ 🎵 *MUSIC PROMPT READY* ⌋\n` +
            `│\n` +
            `│ 📝 *Your idea:*\n` +
            `│  _${userIdea}_\n` +
            `│\n` +
            `├─⊷ *🎸 Genre:* ${parsed.genre}\n` +
            `├─⊷ *😊 Mood:*  ${parsed.mood}\n` +
            `├─⊷ *🎤 Vocal:* ${isInstrumental ? 'Instrumental' : parsed.vocal}\n` +
            `│\n` +
            `├─⌈ *✅ READY-TO-USE COMMAND* ⌋\n` +
            `│\n` +
            `│  ${readyCommand}\n` +
            `│\n` +
            `│ 👆 Copy the command above and send it\n` +
            `│    to generate your song with *${PREFIX}genmusic*\n` +
            `│\n` +
            `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

        const _gb = globalThis._giftedBtns;
        if (_gb && typeof _gb.sendInteractiveMessage === 'function') {
            try {
                await _gb.sendInteractiveMessage(sock, chatId, {
                    text:   out,
                    footer: ` ${getOwnerName().toUpperCase()} TECH`,
                    interactiveButtons: [{
                        name: 'cta_copy',
                        buttonParamsJson: JSON.stringify({
                            display_text: '📋 Copy Prompt',
                            copy_code:    readyCommand
                        })
                    }]
                });
            } catch {
                await reply(out);
            }
        } else {
            await reply(out);
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
