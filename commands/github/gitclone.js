import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const execAsync = promisify(exec);

export default {
    name: 'gitclone',
    alias: ['clone', 'githubdl'],
    description: 'Clone GitHub repositories and send as ZIP',
    category: 'utility',
    ownerOnly: false,

    async execute(sock, m, args, PREFIX, extras) {
        const chatId = m.key.remoteJid;

        if (!args[0]) {
            return sock.sendMessage(chatId, {
                text:
                    `╭─⌈ 📦 *GIT CLONE* ⌋\n` +
                    `│\n` +
                    `│ Clones and sends a repo as ZIP.\n` +
                    `│\n` +
                    `│ *Usage:*\n` +
                    `│ • \`${PREFIX}gitclone username/repo\`\n` +
                    `│ • \`${PREFIX}gitclone https://github.com/user/repo\`\n` +
                    `│\n` +
                    `│ *Related:*\n` +
                    `│ • \`${PREFIX}zip\` - Get bot source code\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        let repoFullName = '';
        let repoName = '';
        let tempDir = '';

        try {
            let repoUrl = args[0];

            if (!repoUrl.includes('://') && !repoUrl.includes('.')) {
                repoUrl = `https://github.com/${repoUrl}`;
            }

            if (!repoUrl.includes('github.com')) {
                return sock.sendMessage(chatId, {
                    text: '❌ Only GitHub repositories are supported.'
                }, { quoted: m });
            }

            const urlParts = repoUrl.split('github.com/')[1]?.split('/');
            if (!urlParts || urlParts.length < 2) {
                return sock.sendMessage(chatId, {
                    text: '❌ Invalid GitHub URL format.'
                }, { quoted: m });
            }

            const username = urlParts[0];
            repoName = urlParts[1].replace('.git', '').replace(/\/$/, '');
            repoFullName = `${username}/${repoName}`;

            try { await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } }); } catch {}

            const timestamp = Date.now();
            tempDir = `./temp/clone_${timestamp}`;
            if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });
            fs.mkdirSync(tempDir, { recursive: true });

            const zipPath = path.join(tempDir, `${repoName}.zip`);
            let downloaded = false;

            for (const branch of ['main', 'master']) {
                if (downloaded) break;
                try {
                    const zipUrl = `https://github.com/${repoFullName}/archive/refs/heads/${branch}.zip`;
                    const response = await axios({
                        method: 'GET',
                        url: zipUrl,
                        responseType: 'stream',
                        timeout: 120000,
                        maxContentLength: 200 * 1024 * 1024
                    });
                    const writer = createWriteStream(zipPath);
                    await pipeline(response.data, writer);
                    downloaded = true;
                } catch {}
            }

            if (!downloaded) {
                try {
                    const repoDir = path.join(tempDir, repoName);
                    await execAsync(
                        `git clone --depth 1 --single-branch "${repoUrl}" "${repoDir}"`,
                        { timeout: 120000, maxBuffer: 50 * 1024 * 1024 }
                    );

                    if (fs.existsSync(repoDir) && fs.readdirSync(repoDir).length > 0) {
                        await execAsync(
                            `cd "${tempDir}" && zip -r "${zipPath}" "${repoName}" -x "${repoName}/.git/*"`,
                            { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
                        );
                        downloaded = fs.existsSync(zipPath);
                    }
                } catch {}
            }

            if (!downloaded || !fs.existsSync(zipPath)) {
                throw new Error('Failed to download repository. Check if repo exists and is public.');
            }

            try { await sock.sendMessage(chatId, { react: { text: '📤', key: m.key } }); } catch {}

            const zipSize = fs.statSync(zipPath).size;
            const sizeMB = (zipSize / (1024 * 1024)).toFixed(2);

            if (zipSize > 100 * 1024 * 1024) {
                throw new Error(`ZIP too large (${sizeMB}MB). Max is 100MB.`);
            }

            let repoInfo = '';
            try {
                const apiResp = await axios.get(`https://api.github.com/repos/${repoFullName}`, { timeout: 5000 });
                const data = apiResp.data;
                repoInfo =
                    `│ ✧ *Stars:* ${data.stargazers_count || 0}\n` +
                    `│ ✧ *Forks:* ${data.forks_count || 0}\n` +
                    `│ ✧ *Language:* ${data.language || 'N/A'}\n`;
            } catch {}

            await sock.sendMessage(chatId, {
                document: fs.readFileSync(zipPath),
                fileName: `${repoName}.zip`,
                mimetype: 'application/zip',
                caption:
                    `╭─⌈ 📦 *GIT CLONE* ⌋\n` +
                    `│\n` +
                    `│ ✧ *Repo:* ${repoFullName}\n` +
                    `│ ✧ *Size:* ${sizeMB}MB\n` +
                    `${repoInfo}` +
                    `│\n` +
                    `│ ✅ Clone complete!\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });

            this.cleanup(tempDir);
            try { await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } }); } catch {}

        } catch (error) {
            console.error('GitClone error:', error);

            await sock.sendMessage(chatId, {
                text:
                    `╭─⌈ ❌ *CLONE FAILED* ⌋\n` +
                    `│\n` +
                    `│ ✧ *Repo:* ${repoFullName || args[0]}\n` +
                    `│ ✧ *Error:* ${error.message}\n` +
                    `│\n` +
                    `│ 💡 *Check that:*\n` +
                    `│ • \`Repo exists and is public\`\n` +
                    `│ • \`URL format is correct\`\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });

            if (tempDir) this.cleanup(tempDir);
            try { await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } }); } catch {}
        }
    },

    cleanup(dir) {
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch {}
    }
};
