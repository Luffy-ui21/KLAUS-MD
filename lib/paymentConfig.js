import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'payment_config.json');

const DEFAULT = {
    unlimitedPrice: 0,
    limitedPrice:   0,
    adminPrice:     0
};

export function loadPaymentConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return { ...DEFAULT, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
        }
    } catch {}
    return { ...DEFAULT };
}

export function savePaymentConfig(config) {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getPlanPrice(plan) {
    const config = loadPaymentConfig();
    if (plan === 'unlimited') return config.unlimitedPrice || 0;
    if (plan === 'admin')     return config.adminPrice     || 0;
    return config.limitedPrice || 0;
}
