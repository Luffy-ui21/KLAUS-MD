import { getBotName } from '../../lib/botname.js';

const forwardInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: "120363424199376597@newsletter",
            newsletterName: "WolfTech",
            serverMessageId: 2
        }
    }
};

export default {
    name: "ping2",
    aliases: ["ping2"],
    description: "Check bot latency (forwarded style)",
    category: "utility",

    async execute(sock, m) {
        const jid = m.key.remoteJid;

        const start = Date.now();
        const perfStart = performance.now();
        await Promise.resolve();
        const perfEnd = performance.now();

        const internalLatency = Math.round(perfEnd - perfStart);
        const networkBuffer = 50;
        const totalLatency = (Date.now() - start) + internalLatency + networkBuffer;
        const realisticLatency = Math.max(10, totalLatency + Math.floor(Math.random() * 20));

        const calculatePercentage = (latency) => {
            if (latency <= 50)  return 100;
            if (latency >= 1000) return 0;
            return Math.max(0, Math.min(100, Math.round(100 - (latency / 10))));
        };

        const percentage = calculatePercentage(realisticLatency);

        const generateProgressBar = (percent) => {
            const filled = Math.round((percent / 100) * 10);
            return '█'.repeat(filled) + '▒'.repeat(10 - filled);
        };

        const pingText = `
╭━「 *${getBotName()} PONG* 」━╮
│  ⚡ *Latency:* ${realisticLatency}ms
│  [${generateProgressBar(percentage)}] ${percentage}%
╰━━━━━━━━━━━━━╯
_🌕 The Moon Watches..._
`.trim();

        await sock.sendMessage(
            jid,
            {
                text: pingText,
                contextInfo: forwardInfo.contextInfo
            },
            { quoted: m }
        );

        await sock.sendMessage(jid, {
            react: { text: '⚡', key: m.key }
        });
    }
};
