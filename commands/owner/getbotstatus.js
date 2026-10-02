import { getFooter } from '../../lib/menuHelper.js';
function getServerPort() {
    if (process.env.PORT)        return parseInt(process.env.PORT);
    if (process.env.SERVER_PORT) return parseInt(process.env.SERVER_PORT);
    if (process.env.APP_PORT)    return parseInt(process.env.APP_PORT);
    return 3000;
}

async function fetchStatus(port) {
    const res = await fetch(`http://localhost:${port}/api/status`, {
        signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export default {
    name: 'getbotstatus',
    alias: ['botstatus', 'apistatus', 'statusjson'],
    desc: 'Returns full bot status as JSON',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, msg, args, prefix, extras) {
        const chatId = msg.key.remoteJid;
        const isOwner = extras?.isOwner ? extras.isOwner() : false;
        const isSudo  = extras?.isSudo  ? extras.isSudo()  : false;

        if (!isOwner && !isSudo) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command' }, { quoted: msg });
            return;
        }

        const port = getServerPort();

        let data;
        try {
            data = await fetchStatus(port);
        } catch (err) {
            await sock.sendMessage(chatId, {
                text: `❌ *Failed to fetch status*\n\nError: ${err.message}`
            }, { quoted: msg });
            return;
        }

        const json = JSON.stringify(data, null, 2);

        const footer = '\n\n${getFooter(msg.key.participant || msg.key.remoteJid)}';

        if (json.length > 3500) {
            const buf = Buffer.from(json, 'utf8');
            await sock.sendMessage(chatId, {
                document: buf,
                fileName: `botstatus_${Date.now()}.json`,
                mimetype: 'application/json',
                caption: `📄 Bot status (full JSON)${footer}`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `\`\`\`json\n${json}\n\`\`\`${footer}`
            }, { quoted: msg });
        }
    }
};
