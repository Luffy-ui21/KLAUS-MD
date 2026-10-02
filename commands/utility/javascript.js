import { exec } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

const TIMEOUT_MS = 15000;
const MAX_OUTPUT = 3000;

export default {
    name: 'javascript',
    alias: ['js', 'eval', 'node', 'runjs'],
    description: 'Execute JavaScript code',
    category: 'utility',
    ownerOnly: false,
    usage: 'javascript <code>',

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;

        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `╭─⌈ 💻 *JAVASCRIPT EXECUTOR* ⌋\n│\n├─⊷ *${PREFIX}js <code>*\n│  └⊷ Run JavaScript code\n│\n├─⊷ *Examples:*\n│  └⊷ ${PREFIX}js console.log("Hello World")\n│  └⊷ ${PREFIX}js Math.random()\n│  └⊷ ${PREFIX}js [1,2,3].map(x => x*2)\n│\n├─⊷ *Features:*\n│  └⊷ 15s timeout\n│  └⊷ Auto-prints last expression\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        const code = args.join(' ');
        const tmpFile = join('/tmp', `wolfbot_js_${randomBytes(4).toString('hex')}.mjs`);

        try {
            const wrappedCode = `
const __start = Date.now();
const __originalLog = console.log;
const __output = [];
console.log = (...a) => __output.push(a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' '));
try {
    const __result = await (async () => { ${code} })();
    if (__result !== undefined && __output.length === 0) {
        __output.push(typeof __result === 'object' ? JSON.stringify(__result, null, 2) : String(__result));
    }
} catch (e) {
    __output.push('Error: ' + e.message);
}
const __elapsed = Date.now() - __start;
process.stdout.write(__output.join('\\n') + '\\n⏱️ ' + __elapsed + 'ms');
`;
            writeFileSync(tmpFile, wrappedCode);

            const result = await new Promise((resolve, reject) => {
                const proc = exec(`node --no-warnings ${tmpFile}`, {
                    timeout: TIMEOUT_MS,
                    maxBuffer: 1024 * 1024,
                    env: { ...process.env, NODE_OPTIONS: '' }
                }, (error, stdout, stderr) => {
                    if (error && error.killed) {
                        resolve({ output: '⏰ Execution timed out (15s limit)', error: true });
                    } else if (error) {
                        const errMsg = stderr || error.message;
                        resolve({ output: errMsg.slice(0, MAX_OUTPUT), error: true });
                    } else {
                        resolve({ output: stdout || '(no output)', error: false });
                    }
                });
            });

            let output = result.output.trim();
            if (output.length > MAX_OUTPUT) {
                output = output.slice(0, MAX_OUTPUT) + '\n... (truncated)';
            }

            const emoji = result.error ? '❌' : '✅';
            const header = result.error ? '❌ *ERROR*' : '✅ *OUTPUT*';

            await sock.sendMessage(chatId, {
                text: `╭─⌈ 💻 *JAVASCRIPT* ⌋\n│\n├─ *Input:*\n│ \`\`\`${code.length > 200 ? code.slice(0, 200) + '...' : code}\`\`\`\n│\n├─ ${header}\n│ \`\`\`${output}\`\`\`\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`
            }, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatId, {
                text: `❌ Execution error: ${err.message}`
            }, { quoted: msg });
        } finally {
            try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}
        }
    }
};
