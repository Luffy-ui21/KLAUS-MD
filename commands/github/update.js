import { exec } from 'child_process';
import { getBotName } from '../../lib/botname.js';

const _R = 'origin';

function sanitizeGitErr(msg = '') {
    return msg
        .replace(/https?:\/\/[^\s'"]+/g, '[remote]')
        .replace(/git@[^\s'"]+/g, '[remote]')
        .trim();
}

async function run(cmd, timeout = 60000) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || stdout || err.message));
            resolve(stdout.toString().trim());
        });
    });
}

export default {
    name: 'update',
    aliases: ['botupdate', 'checkupdate'],
    description: 'Pull latest updates from GitHub then restart the bot',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, m, args) {
        const jid    = m.key.remoteJid;
        const botName = getBotName();

        let statusMsg;
        const edit = async (text) => {
            try {
                if (statusMsg?.key) {
                    await sock.sendMessage(jid, { text, edit: statusMsg.key });
                } else {
                    statusMsg = await sock.sendMessage(jid, { text }, { quoted: m });
                }
            } catch {
                statusMsg = await sock.sendMessage(jid, { text }, { quoted: m });
            }
        };

        try {
            statusMsg = await sock.sendMessage(jid, {
                text: `🔄 *${botName} Update*\nChecking for latest updates...`
            }, { quoted: m });

            // ── 1. Git fetch ──────────────────────────────────────────────
            await edit('🌐 *Fetching latest changes from GitHub...*');
            let oldRev, newRev, currentBranch;

            try {
                oldRev        = await run('git rev-parse HEAD').catch(() => 'unknown');
                currentBranch = await run('git rev-parse --abbrev-ref HEAD').catch(() => 'main');
                await run(`git fetch ${_R} --depth=5 --prune`, 30000);

                try {
                    newRev = await run(`git rev-parse ${_R}/${currentBranch}`);
                } catch {
                    newRev = await run(`git rev-parse ${_R}/main`);
                }
            } catch (fetchErr) {
                await edit(`⚠️ *Could not reach GitHub:*\n${sanitizeGitErr(fetchErr.message)}\n\nBot will restart with current version.`);
                newRev = oldRev;
            }

            // ── 2. Apply update if available ──────────────────────────────
            if (oldRev && newRev && oldRev === newRev) {
                await edit(`✅ *Already up to date!*\nCommit: \`${oldRev.slice(0, 7)}\`\n\nRestarting bot...`);
            } else {
                try {
                    try {
                        await run(`git merge --ff-only ${newRev}`);
                    } catch {
                        await run(`git merge --no-edit --allow-unrelated-histories ${newRev}`);
                    }
                    const applied = await run('git rev-parse HEAD').catch(() => newRev);
                    await edit(`✅ *Updated successfully!*\n📦 \`${oldRev?.slice(0, 7) || '?'}\` → \`${applied?.slice(0, 7) || '?'}\`\n\nRestarting bot...`);
                } catch (mergeErr) {
                    await edit(`⚠️ *Merge failed:* ${sanitizeGitErr(mergeErr.message)}\nRestarting with current version...`);
                }
            }

            // ── 3. Restart ────────────────────────────────────────────────
            await new Promise(r => setTimeout(r, 2500));

            await sock.sendMessage(jid, {
                text: `🔄 *Restarting ${botName}...*\nBot will be back in a moment!`
            }, { quoted: m });

            if (typeof globalThis.preExitSave === 'function') {
                try { await globalThis.preExitSave(); } catch {}
            }

            try {
                await run('pm2 restart all', 10000);
            } catch {
                process.exit(0);
            }

        } catch (err) {
            const errText =
                `❌ *Update failed*\n⚠️ ${sanitizeGitErr(err.message || 'Unknown error')}\n\n` +
                `*Usage:*\n` +
                `› \`.update\` — pull latest + restart\n`;
            try {
                await edit(errText);
            } catch {
                await sock.sendMessage(jid, { text: errText }, { quoted: m });
            }
        }
    }
};
