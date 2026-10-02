import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {}
    return {};
}

function writeJson(filePath, data) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function seedConfigsFromEnv() {
    const pteroKey  = process.env.PTERODACTYL_KEY  || '';
    const pteroUrl  = process.env.PTERODACTYL_URL  || '';
    const paystackKey = process.env.PAYSTACK_KEY   || '';

    const cpanelPath   = path.join(DATA_DIR, 'cpanel_config.json');
    const paystackPath = path.join(DATA_DIR, 'paystack_config.json');

    // ── Pterodactyl ──────────────────────────────────────────────────────────
    if (pteroKey || pteroUrl) {
        const existing = readJson(cpanelPath);
        let changed = false;
        if (pteroKey && !existing.apiKey) { existing.apiKey   = pteroKey;  changed = true; }
        if (pteroUrl && !existing.panelUrl) { existing.panelUrl = pteroUrl;  changed = true; }
        if (changed) writeJson(cpanelPath, existing);
    }

    // ── Paystack ─────────────────────────────────────────────────────────────
    if (paystackKey) {
        const existing = readJson(paystackPath);
        if (!existing.secretKey) {
            existing.secretKey = paystackKey;
            writeJson(paystackPath, existing);
        }
    }

    // ── Status for startup log ────────────────────────────────────────────────
    const cpanelFinal   = readJson(cpanelPath);
    const paystackFinal = readJson(paystackPath);

    const pteroStatus    = (cpanelFinal.apiKey && cpanelFinal.panelUrl)
        ? `✅ Set${pteroKey ? ' (ENV)' : ' (command)'}`
        : '❌ Not set';
    const paystackStatus = cpanelFinal.secretKey || paystackFinal.secretKey
        ? `✅ Set${paystackKey ? ' (ENV)' : ' (command)'}`
        : '❌ Not set';

    const dbUrl       = process.env.DATABASE_URL || '';
    const dbStatus    = dbUrl ? '✅ Set' : '❌ Not set';

    return { pteroStatus, paystackStatus, dbStatus };
}

export function getKeyStatus() {
    const cpanelPath   = path.join(DATA_DIR, 'cpanel_config.json');
    const paystackPath = path.join(DATA_DIR, 'paystack_config.json');

    const cpanel   = readJson(cpanelPath);
    const paystack = readJson(paystackPath);

    const pteroOk    = !!(cpanel.apiKey && cpanel.panelUrl);
    const paystackOk = !!(paystack.secretKey);
    const dbOk       = !!(process.env.DATABASE_URL);

    return {
        pteroStatus:    pteroOk    ? '✅ Set' : '❌ Not set',
        paystackStatus: paystackOk ? '✅ Set' : '❌ Not set',
        dbStatus:       dbOk       ? '✅ Set' : '❌ Not set'
    };
}
