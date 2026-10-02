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
    name: "alive2",
    aliases: ["alive2"],
    description: "Check if bot is running (forwarded style)",
    category: "utility",

    async execute(sock, m) {
        const jid = m.key.remoteJid;

        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const totalMemory = process.memoryUsage().heapTotal / 1024 / 1024;
        const memoryPercent = ((usedMemory / totalMemory) * 100).toFixed(1);
        const statusEmoji = memoryPercent < 60 ? "🟢" : memoryPercent < 80 ? "🟡" : "🔴";

        const aliveText = `
╭━「 *${getBotName()} ALIVE* 」━╮
│  ${statusEmoji} *Status:* Online
│  ⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s
│  💾 *Memory:* ${memoryPercent}%
╰━━━━━━━━━━━━━╯
_ The pack survives together..._
`.trim();

        await sock.sendMessage(
            jid,
            {
                text: aliveText,
                contextInfo: forwardInfo.contextInfo
            },
            { quoted: m }
        );

        await sock.sendMessage(jid, {
            react: { text: '', key: m.key }
        });
    }
};
