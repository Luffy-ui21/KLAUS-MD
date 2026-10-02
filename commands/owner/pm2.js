import { exec } from 'child_process';
import { promisify } from 'util';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

const execAsync = promisify(exec);

async function runPm2(cmd, timeoutMs = 15000) {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return (stdout || stderr || '').trim();
}

function isPm2Available() {
    return new Promise(resolve => {
        exec('pm2 --version', { timeout: 5000 }, (err) => resolve(!err));
    });
}

function formatLogs(raw, maxLines = 40) {
    const lines = raw.split('\n').filter(l => l.trim());
    const recent = lines.slice(-maxLines);

    const cleaned = recent.map(line => {
        return line
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '')
            .trim();
    }).filter(l => l.length > 0);

    return cleaned.join('\n');
}

function formatStatus(raw) {
    const lines = raw.split('\n').filter(l => l.trim());
    const appLines = lines.filter(l =>
        /│/.test(l) && !/id\s*│\s*name/.test(l) && !/─/.test(l)
    );

    if (!appLines.length) return raw.replace(/\x1b\[[0-9;]*m/g, '').trim();

    const out = [];
    for (const line of appLines) {
        const cols = line.split('│').map(c => c.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
        if (cols.length >= 5) {
            const [id, name, , status, cpu, mem] = cols;
            const icon = status === 'online' ? '🟢' : status === 'stopped' ? '🔴' : '🟡';
            out.push(`├⊷ ${icon} *${name}* · ${status} · CPU:${cpu || '?'} · MEM:${mem || '?'}`);
        }
    }
    return out.length ? out.join('\n') : raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
}

export default {
    name: 'pm2',
    alias: ['pm2cmd', 'pm2control'],
    category: 'owner',
    description: 'Control and monitor PM2 process manager',
    ownerOnly: true,
    usage: 'pm2 [restart|logs|status|stop|start] [app?]',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const isOwner = extra?.isOwner?.() || false;
        const botName = getBotName();
        const ownerName = getOwnerName();

        if (!isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ This command is owner-only.'
            }, { quoted: msg });
        }

        const action = (args[0] || '').toLowerCase();
        const appTarget = args[1] || 'all';

        if (!action) {
            const help = `╭─⌈ ⚙️ *PM2 MANAGER* ⌋\n│\n`
                + `├⊷ *${PREFIX}pm2 status*\n`
                + `├⊷ *${PREFIX}pm2 restart*\n`
                + `├⊷ *${PREFIX}pm2 restart <app>*\n`
                + `├⊷ *${PREFIX}pm2 logs*\n`
                + `├⊷ *${PREFIX}pm2 logs <app>*\n`
                + `├⊷ *${PREFIX}pm2 stop <app>*\n`
                + `├⊷ *${PREFIX}pm2 start <app>*\n`
                + `│\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`;
            return await sock.sendMessage(chatId, { text: help }, { quoted: msg });
        }

        const available = await isPm2Available();
        if (!available) {
            return await sock.sendMessage(chatId, {
                text: `╭─⌈ ❌ *PM2 NOT FOUND* ⌋\n│\n├─⊷ PM2 is not installed or not accessible\n├─⊷ on this server.\n│\n├─⊷ *To install:*\n│  └⊷ npm install -g pm2\n│\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        try {
            switch (action) {
                case 'status':
                case 'list':
                case 'ls': {
                    const raw = await runPm2('pm2 list');
                    const formatted = formatStatus(raw);
                    const text = `╭─⌈ 📊 *PM2 STATUS* ⌋\n│\n${formatted}\n│\n╰⊷ *${ownerName.toUpperCase()} TECH*`;
                    await sock.sendMessage(chatId, { text }, { quoted: msg });
                    break;
                }

                case 'restart':
                case 'rs': {
                    const raw = await runPm2(`pm2 restart ${appTarget}`, 20000);
                    const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\n{3,}/g, '\n\n').trim();
                    const preview = clean.split('\n').slice(0, 8).join('\n');
                    const text = `╭─⌈ 🔄 *PM2 RESTART* ⌋\n│\n`
                        + `├─⊷ *Target:* ${appTarget}\n`
                        + `├─⊷ *Result:* ✅ Restarted successfully\n│\n`
                        + (preview ? `├─ \`\`\`${preview}\`\`\`\n│\n` : '')
                        + `╰───────────────\n> *${ownerName.toUpperCase()} TECH*`;
                    await sock.sendMessage(chatId, { text }, { quoted: msg });
                    break;
                }

                case 'logs':
                case 'log': {
                    const logCmd = appTarget === 'all'
                        ? 'pm2 logs --nostream --lines 40'
                        : `pm2 logs ${appTarget} --nostream --lines 40`;
                    const raw = await runPm2(logCmd, 20000);
                    const formatted = formatLogs(raw, 40);

                    if (!formatted.trim()) {
                        await sock.sendMessage(chatId, {
                            text: `╭─⌈ 📋 *PM2 LOGS* ⌋\n│\n├─⊷ No logs found for: ${appTarget}\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`
                        }, { quoted: msg });
                        break;
                    }

                    const lines = formatted.split('\n');
                    const chunks = [];
                    let current = '';
                    for (const line of lines) {
                        if ((current + '\n' + line).length > 3500) {
                            chunks.push(current.trim());
                            current = line;
                        } else {
                            current += (current ? '\n' : '') + line;
                        }
                    }
                    if (current.trim()) chunks.push(current.trim());

                    const header = `╭─⌈ 📋 *PM2 LOGS* (${appTarget}) ⌋\n│\n`;
                    const footer = `\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`;

                    for (let i = 0; i < chunks.length; i++) {
                        const prefix2 = i === 0 ? header : `📋 *Continued (${i + 1}/${chunks.length}):*\n`;
                        const suffix  = i === chunks.length - 1 ? footer : '';
                        await sock.sendMessage(chatId, {
                            text: `${prefix2}\`\`\`${chunks[i]}\`\`\`${suffix}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'stop': {
                    if (appTarget === 'all') {
                        return await sock.sendMessage(chatId, {
                            text: `⚠️ Stopping ALL apps is blocked for safety.\nUse: *${PREFIX}pm2 stop <appname>*`
                        }, { quoted: msg });
                    }
                    await runPm2(`pm2 stop ${appTarget}`, 15000);
                    await sock.sendMessage(chatId, {
                        text: `╭─⌈ 🛑 *PM2 STOP* ⌋\n│\n├─⊷ *App:* ${appTarget}\n├─⊷ *Result:* ✅ Stopped\n│\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`
                    }, { quoted: msg });
                    break;
                }

                case 'start': {
                    await runPm2(`pm2 start ${appTarget}`, 15000);
                    await sock.sendMessage(chatId, {
                        text: `╭─⌈ ▶️ *PM2 START* ⌋\n│\n├─⊷ *App:* ${appTarget}\n├─⊷ *Result:* ✅ Started\n│\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`
                    }, { quoted: msg });
                    break;
                }

                default:
                    await sock.sendMessage(chatId, {
                        text: `❓ Unknown PM2 action: *${action}*\n\nUse *${PREFIX}pm2* to see available commands.`
                    }, { quoted: msg });
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatId, {
                text: `╭─⌈ ❌ *PM2 ERROR* ⌋\n│\n├─⊷ *Action:* ${action} ${appTarget}\n├─⊷ *Error:* ${err.message.split('\n')[0]}\n│\n╰───────────────\n> *${ownerName.toUpperCase()} TECH*`
            }, { quoted: msg });
        }
    }
};
