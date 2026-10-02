// ====== lib/pteroRestart.js ======
// Restart the bot's Pterodactyl server via the Client API.
//
// Priority order:
//   1. Pterodactyl Client API  (PTERO_CLIENT_KEY + PTERO_PANEL_URL + PTERO_SERVER_ID)
//   2. pm2 restart all         (if bot is managed by pm2)
//   3. process.exit(0)         (Wings / pm2 / systemd will restart the process)
//
// Usage:
//   import { restartBot } from '../lib/pteroRestart.js';
//   await restartBot();   // throws only if all three methods fail

import { exec } from 'child_process';

function run(cmd, timeout = 10000) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || stdout || err.message));
            resolve(stdout.toString().trim());
        });
    });
}

function extractServerId(raw) {
    if (!raw) return null;
    const m = raw.match(/\/server\/([0-9a-f]{8})/i) || raw.match(/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/i) || raw.match(/([0-9a-f]{8})/i);
    return m ? m[1] : raw.trim();
}

export async function pterodactylRestart() {
    const panelUrl  = process.env.PTERO_PANEL_URL;
    const clientKey = process.env.PTERO_CLIENT_KEY;
    const rawId     = process.env.PTERO_SERVER_ID;

    if (!panelUrl || !clientKey || !rawId) {
        throw new Error('PTERO_PANEL_URL, PTERO_CLIENT_KEY, or PTERO_SERVER_ID not set');
    }

    const serverId = extractServerId(rawId);
    const url = `${panelUrl.replace(/\/$/, '')}/api/client/servers/${serverId}/power`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${clientKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signal: 'restart' }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Pterodactyl API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return true;
}

export async function restartBot({ logger } = {}) {
    const log = logger || ((msg) => console.log('[pteroRestart]', msg));

    if (typeof globalThis.preExitSave === 'function') {
        try { await globalThis.preExitSave(); } catch (e) { log('preExitSave error: ' + e.message); }
    }

    try {
        await pterodactylRestart();
        log('Pterodactyl API restart signal sent ✓');
        return 'pterodactyl';
    } catch (e) {
        log('Pterodactyl API restart failed: ' + e.message + ' — trying pm2...');
    }

    try {
        await run('pm2 restart all', 10000);
        log('pm2 restart triggered ✓');
        return 'pm2';
    } catch (e) {
        log('pm2 not available: ' + e.message + ' — calling process.exit(0)');
    }

    process.exit(0);
}
