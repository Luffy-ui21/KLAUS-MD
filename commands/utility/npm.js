import { exec } from 'child_process';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const TIMEOUT_MS = 120000;
const MAX_OUTPUT = 3000;

export default {
    name: 'npm',
    alias: ['npmi', 'npminstall', 'dependency'],
    description: 'Install or manage npm packages',
    category: 'utility',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        if (!extra?.jidManager?.isOwner(msg)) {
            return reply('❌ *Owner Only Command*');
        }

        if (!args.length) {
            return reply(
                `╭─⌈ 📦 *NPM PACKAGE MANAGER* ⌋\n│\n` +
                `├─⊷ *${PREFIX}npm install <pkg>*\n│  └⊷ Install a package\n` +
                `├─⊷ *${PREFIX}npm install <p1> <p2>*\n│  └⊷ Install multiple\n` +
                `├─⊷ *${PREFIX}npm uninstall <pkg>*\n│  └⊷ Remove a package\n` +
                `├─⊷ *${PREFIX}npm update [pkg]*\n│  └⊷ Update package(s)\n` +
                `├─⊷ *${PREFIX}npm list*\n│  └⊷ Show installed packages\n` +
                `├─⊷ *${PREFIX}npm outdated*\n│  └⊷ Check for outdated\n│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        const subcommand = args[0].toLowerCase();
        const packages   = args.slice(1);

        const ALLOWED = ['install', 'i', 'uninstall', 'remove', 'un', 'update', 'up', 'list', 'ls', 'outdated'];
        if (!ALLOWED.includes(subcommand)) {
            return reply(`❌ Unknown subcommand: \`${subcommand}\`\nUse \`${PREFIX}npm\` for help.`);
        }

        const BLOCKED = ['node-pty', 'electron', 'puppeteer-core'];
        if (['install', 'i'].includes(subcommand) && packages.length > 0) {
            for (const pkg of packages) {
                const clean = pkg.split('@')[0].toLowerCase();
                if (BLOCKED.includes(clean)) return reply(`❌ *Blocked Package:* \`${pkg}\``);
                if (pkg.includes('..') || (pkg.includes('/') && !pkg.startsWith('@'))) {
                    return reply(`❌ *Invalid package name:* \`${pkg}\``);
                }
            }
        }

        let npmCmd, actionMsg, isInstall = false;

        switch (subcommand) {
            case 'install':
            case 'i':
                if (packages.length === 0) {
                    npmCmd    = 'npm install';
                    actionMsg = '📦 Installing all dependencies...';
                } else {
                    const pkgList = packages.join(' ');
                    npmCmd    = `npm install --save ${pkgList}`;
                    actionMsg = `📦 Installing: *${pkgList}*`;
                    isInstall = true;
                }
                break;

            case 'uninstall':
            case 'remove':
            case 'un':
                if (!packages.length) return reply(`❌ Specify package(s) to uninstall.\nExample: \`${PREFIX}npm uninstall chalk\``);
                npmCmd    = `npm uninstall ${packages.join(' ')}`;
                actionMsg = `🗑️ Uninstalling: *${packages.join(' ')}*`;
                break;

            case 'update':
            case 'up':
                npmCmd    = packages.length ? `npm update ${packages.join(' ')}` : 'npm update';
                actionMsg = packages.length ? `🔄 Updating: *${packages.join(' ')}*` : '🔄 Updating all packages...';
                break;

            case 'list':
            case 'ls':
                npmCmd    = 'npm list --depth=0 2>&1';
                actionMsg = '📋 Fetching installed packages...';
                break;

            case 'outdated':
                npmCmd    = 'npm outdated 2>&1 || true';
                actionMsg = '🔍 Checking for outdated packages...';
                break;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
        await reply(actionMsg);

        const startTime = Date.now();

        try {
            const result = await new Promise((resolve, reject) => {
                exec(npmCmd, {
                    timeout:   TIMEOUT_MS,
                    cwd:       process.cwd(),
                    env:       { ...process.env, NODE_ENV: 'development' },
                    maxBuffer: 1024 * 1024
                }, (error, stdout, stderr) => {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    if (error && !['list', 'ls', 'outdated'].includes(subcommand)) {
                        reject({ output: (stderr || error.message || 'Unknown error').trim(), elapsed });
                        return;
                    }
                    resolve({ output: (stdout || stderr || 'No output').trim(), elapsed });
                });
            });

            let output = result.output;
            if (output.length > MAX_OUTPUT) output = output.substring(0, MAX_OUTPUT) + '\n\n... (truncated)';

            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

            const restartNote = isInstall
                ? '\n\n⚠️ *Restart the bot for the new package to take effect.*'
                : '';

            await reply(`✅ *Done* ⏱️ ${result.elapsed}s${restartNote}\n\n\`\`\`\n${output}\n\`\`\``);

        } catch (err) {
            let errOutput = err.output || err.message || 'Unknown error';
            if (errOutput.length > MAX_OUTPUT) errOutput = errOutput.substring(0, MAX_OUTPUT) + '\n\n... (truncated)';
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await reply(`❌ *NPM Failed* ⏱️ ${err.elapsed || '?'}s\n\n\`\`\`\n${errOutput}\n\`\`\``);
        }
    }
};
