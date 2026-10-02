const LBL = '\x1b[1m\x1b[38;2;255;165;0m';
const W   = '\x1b[38;2;200;215;225m';
const D   = '\x1b[2m\x1b[38;2;120;140;155m';

function _printBox({ color, icon, label, rows }) {
    const NB = `\x1b[1m${color}`;
    const R  = '\x1b[0m';
    const rowLine = (k, v) => `${D}»${R} ${LBL}${k}:${R} ${W}${v}${R}`;
    const lines = ['', `${NB}╭─⌈ ${icon} ${label} ⌋${R}`];
    for (const { key, val } of rows) {
        if (val !== null && val !== undefined && val !== '') {
            lines.push(rowLine(key, String(val)));
        }
    }
    lines.push(`${NB}╰⊷${R}`, '');
    process.stdout.write(lines.join('\n') + '\n');
}

const _BL  = '\x1b[38;2;34;193;255m';
const _ORG = '\x1b[38;2;255;110;0m';
const _MAG = '\x1b[38;2;180;0;255m';

export const WolfLogger = {
    statusReply(action, from) {
        _printBox({
            color: _BL,
            icon:  '📲',
            label: 'STATUS REPLY',
            rows: [
                { key: 'Action', val: action },
                ...(from ? [{ key: 'From', val: from }] : []),
            ],
        });
    },

    antidelete(action, type, id) {
        _printBox({
            color: _ORG,
            icon:  '🗑️',
            label: 'ANTIDELETE',
            rows: [
                { key: 'Action', val: action },
                ...(type ? [{ key: 'Type', val: type }] : []),
                ...(id   ? [{ key: 'ID',   val: String(id).slice(0, 12) + '...' }] : []),
            ],
        });
    },

    statusAD(action, type, id) {
        _printBox({
            color: _MAG,
            icon:  '🗑️',
            label: 'STATUS AD',
            rows: [
                { key: 'Action', val: action },
                ...(type ? [{ key: 'Type', val: type }] : []),
                ...(id   ? [{ key: 'ID',   val: String(id).slice(0, 12) + '...' }] : []),
            ],
        });
    },
};
