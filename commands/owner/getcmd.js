import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMANDS_DIR = path.resolve(__dirname, '../../commands');

const BLOCKED_FILES = ['update.js', 'restart.js', 'start.js', 'getcmd.js'];

const PRIVATE_PATTERNS = [
    /nk-apex\/n7/i,
    /KLAUSMD-Ke\/klasumd/i,
    /klasumd\.git/i,
    /archive\/refs\/heads.*\.zip/i,
    /zipball/i,
    /api\.github\.com\/repos\/nk-apex/i,
];

function stripComments(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function findCommandFile(cmdName) {
    const search = cmdName.toLowerCase();

    function walkDir(dir) {
        let items;
        try { items = fs.readdirSync(dir); } catch { return null; }

        for (const item of items) {
            const fullPath = path.join(dir, item);
            let stat;
            try { stat = fs.statSync(fullPath); } catch { continue; }

            if (stat.isDirectory()) {
                const result = walkDir(fullPath);
                if (result) return result;
            } else if (item.endsWith('.js')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const stripped = stripComments(content);

                    const nameMatch = stripped.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
                    if (nameMatch && nameMatch[1].toLowerCase() === search) {
                        return { filePath: fullPath, fileName: item, content };
                    }

                    const aliasMatch = stripped.match(/alias(?:es)?\s*:\s*\[([^\]]+)\]/s);
                    if (aliasMatch) {
                        const aliases = [...aliasMatch[1].matchAll(/['"`]([^'"`]+)['"`]/g)]
                            .map(a => a[1].toLowerCase());
                        if (aliases.includes(search)) {
                            return { filePath: fullPath, fileName: item, content };
                        }
                    }
                } catch {}
            }
        }
        return null;
    }

    return walkDir(COMMANDS_DIR);
}

export default {
    name: 'getcmd',
    alias: ['getcommand', 'cmdcode', 'sourcecmd'],
    desc: 'Get the source code of a command',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, m, args, prefix) {
        const chatId = m.key.remoteJid;

        if (!args[0]) {
            await sock.sendMessage(chatId, {
                text: `╭─⌈ 🔍 *GETCMD* ⌋\n│\n├─⊷ *${prefix}getcmd <command>*\n│  └⊷ Get source code of a command\n├─⊷ *Example:* ${prefix}getcmd song\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
            return;
        }

        const cmdName = args[0].toLowerCase().replace(/^\./, '');

        const result = findCommandFile(cmdName);

        if (!result) {
            await sock.sendMessage(chatId, {
                text: `❌ Command *${cmdName}* not found.`
            }, { quoted: m });
            return;
        }

        const { fileName, content } = result;

        if (BLOCKED_FILES.includes(fileName)) {
            await sock.sendMessage(chatId, {
                text: `🔒 *${cmdName}* — source code is protected.`
            }, { quoted: m });
            return;
        }

        if (PRIVATE_PATTERNS.some(p => p.test(content))) {
            await sock.sendMessage(chatId, {
                text: `❌ *${cmdName}* — not available.`
            }, { quoted: m });
            return;
        }

        const cleanCode = stripComments(content);

        if (cleanCode.length > 3000) {
            const tmpFile = `/tmp/${fileName}`;
            fs.writeFileSync(tmpFile, cleanCode);
            await sock.sendMessage(chatId, {
                document: fs.readFileSync(tmpFile),
                fileName: fileName,
                mimetype: 'application/javascript',
                caption: `📄 *${fileName}* — ${cmdName} command source`
            }, { quoted: m });
            try { fs.unlinkSync(tmpFile); } catch {}
            return;
        }

        await sock.sendMessage(chatId, {
            text: `╭─⌈ 📄 *${fileName}* ⌋\n\`\`\`\n${cleanCode}\n\`\`\`\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
    }
};
