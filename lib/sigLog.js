// ── Shared WOLFBOT signature log style ────────────────────────────────────
// ╭─⌈ icon TAG ⌋
// » message
// » Field1 : value1  ·  Field2 : value2
// ╰⊷
//
// Tones:
//   'green'  — default / success         (neon green)
//   'yellow' — waiting / warning / retry (amber)
//   'red'    — failure / error           (red)
//   'cyan'   — info / network            (cyan-blue)
//
// Usage:
//   import { sigLog } from '../lib/sigLog.js';
//   sigLog('✅', 'PLAY', 'Sent track', { Title: name, Size: '5.8MB' });
//   sigLog('❌', 'PLAY', 'Download failed', { Error: err.message }, 'red');

const PALETTE = {
    green:  { NB: '\x1b[1m\x1b[38;2;0;255;156m',   N: '\x1b[38;2;0;255;156m'   },
    yellow: { NB: '\x1b[1m\x1b[38;2;250;204;21m',  N: '\x1b[38;2;250;204;21m'  },
    red:    { NB: '\x1b[1m\x1b[38;2;255;80;80m',   N: '\x1b[38;2;255;80;80m'   },
    cyan:   { NB: '\x1b[1m\x1b[38;2;34;193;255m',  N: '\x1b[38;2;34;193;255m'  },
};
const D   = '\x1b[2m\x1b[38;2;100;120;130m';
const W   = '\x1b[38;2;200;215;225m';
const R   = '\x1b[0m';

export function sigLog(icon, tag, message, fields, tone = 'green') {
    const { NB, N } = PALETTE[tone] || PALETTE.green;
    const sep = `${D}·${R}`;

    const lines = [`${NB}╭─⌈ ${icon} ${tag} ⌋${R}`];
    if (message) lines.push(`${NB}» ${R}${W}${message}${R}`);
    if (fields && typeof fields === 'object') {
        const parts = Object.entries(fields)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${D}${k}${R} ${N}:${R} ${W}${v}${R}`);
        if (parts.length) lines.push(`${NB}» ${R}${parts.join(`  ${sep}  `)}`);
    }
    lines.push(`${NB}╰⊷${R}`);
    console.log('\n' + lines.join('\n') + '\n');
}

export default sigLog;
