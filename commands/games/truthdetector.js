import { getBotName } from '../../lib/botname.js';

const VERDICTS = [
    // 0–15% (extremely honest)
    { min: 0,  max: 15,  label: '🟢 CRYSTAL HONEST',    color: '🟢', emoji: '😇' },
    // 16–30% (mostly honest)
    { min: 16, max: 30,  label: '🟩 MOSTLY TRUTHFUL',   color: '🟩', emoji: '😊' },
    // 31–50% (borderline)
    { min: 31, max: 50,  label: '🟡 SUSPICIOUS',        color: '🟡', emoji: '🤔' },
    // 51–70% (leaning liar)
    { min: 51, max: 70,  label: '🟠 SHAKY TRUTH',       color: '🟠', emoji: '😬' },
    // 71–85% (likely lying)
    { min: 71, max: 85,  label: '🔴 PROBABLE LIAR',     color: '🔴', emoji: '😈' },
    // 86–100% (confirmed)
    { min: 86, max: 100, label: '💀 CERTIFIED LIAR',    color: '💀', emoji: '🤥' },
];

const STATEMENTS = {
    0:  [
        'Their aura radiates pure honesty — even angels take notes. 😇',
        'This person could pass a lie detector in their sleep.',
        'Honesty is literally their superpower. No cap.',
        'So honest it hurts. WhatsApp has never seen such purity.',
    ],
    16: [
        'Pretty honest — but there\'s a tiny "it depends" tucked somewhere.',
        'Mostly truthful. The occasional white lie doesn\'t count, right?',
        'Solid truth energy. A small shady corner, but nothing alarming.',
        'Their conscience is 85% clear. The other 15%? We don\'t talk about it.',
    ],
    31: [
        'Half honest, half... creative with the truth. 🤔',
        'They tell the truth. Just not always the *whole* truth.',
        'Suspicious vibes detected. The polygraph is sweating.',
        'This person believes in "selective honesty". A diplomat, really.',
    ],
    51: [
        'Truth is in there — it\'s just hiding under a lot of "I forgot".',
        'The story keeps changing slightly each time. Classic.',
        'They\'re not lying. They\'re just... narrating differently.',
        'One eyebrow is raised on the truth scale. 👀',
    ],
    71: [
        'This person has a complicated relationship with the truth.',
        'The facts don\'t match the statement. The vibe doesn\'t match either.',
        'Even their mirror is starting to doubt them.',
        'The lie detector is blinking red and sweating. It\'s nervous.',
    ],
    86: [
        'The machine has spoken. Liar liar, pants on fire. 🔥',
        'Even the Wi-Fi signal bent the truth to match theirs.',
        'Scientists are studying this level of dishonesty. Historic.',
        '100% organic, grade-A, certified, world-class liar. Respect? Maybe a little.',
    ],
};

function getVerdict(pct) {
    return VERDICTS.find(v => pct >= v.min && pct <= v.max) || VERDICTS[0];
}

function getStatement(pct) {
    let bucket = 0;
    for (const key of [0, 16, 31, 51, 71, 86]) {
        if (pct >= key) bucket = key;
    }
    const pool = STATEMENTS[bucket];
    return pool[Math.floor(Math.random() * pool.length)];
}

function buildBar(pct) {
    const filled = Math.round(pct / 10);
    const empty  = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function seedRandom(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i);
    return ((s * 9301 + 49297) % 233280) / 233280;
}

export default {
    name: 'truthdetector',
    alias: ['liedetector', 'truthmeter', 'liar', 'tdect', 'truthcheck', 'truthscan'],
    desc: 'Fun lie/truth detector — shows a honesty % and verdict',
    category: 'games',
    usage: '.truthdetector [name or @mention]',

    async execute(sock, m, args, PREFIX, extra) {
        const chatJid  = m.key.remoteJid;
        const userName = m.pushName || 'You';

        try {
            // Determine the subject name
            let subject = userName;
            let subjectDisplay = `*${userName}*`;

            // Mentioned someone?
            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mentioned) {
                const num = mentioned.split('@')[0];
                subject       = num;
                subjectDisplay = `*+${num}*`;
            } else if (args.length) {
                subject       = args.join(' ').trim();
                subjectDisplay = `*${subject}*`;
            }

            // Generate a % that's consistent for the same subject+day so it feels "real"
            const today = new Date().toDateString();
            const seed  = `${subject}${today}`;
            const base  = seedRandom(seed);
            // Add a small random daily wobble so it isn't purely deterministic
            const wobble = (Math.random() - 0.5) * 10;
            const pct    = Math.min(100, Math.max(0, Math.round(base * 100 + wobble)));

            const verdict   = getVerdict(pct);
            const statement = getStatement(pct);
            const bar       = buildBar(pct);

            const botName = getBotName();

            const reply =
                `🔍 *TRUTH DETECTOR v2.0*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Subject : ${subjectDisplay}\n` +
                `🎯 Scanning... analysing... beep boop...\n\n` +
                `📊 *LIE PROBABILITY*\n` +
                `[${bar}] ${pct}%\n\n` +
                `${verdict.emoji} *VERDICT : ${verdict.label}*\n\n` +
                `💬 _${statement}_\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `*Powered by ${botName} Neural Truth Engine™*\n` +
                `_Results are 100% scientifically accurate*_\n` +
                `_*not actually_`;

            await sock.sendMessage(chatJid, { text: reply }, { quoted: m });

        } catch (err) {
            console.error('[TruthDetector] error:', err.message);
            await sock.sendMessage(chatJid, {
                text: `❌ Truth Detector malfunction: ${err.message}`
            }, { quoted: m });
        }
    }
};
