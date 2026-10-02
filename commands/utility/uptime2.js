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
    name: "uptime2",
    aliases: ["uptime2"],
    description: "Check bot uptime (forwarded style)",
    category: "utility",

    async execute(sock, m) {
        const jid = m.key.remoteJid;

        const uptime = process.uptime();
        const days = Math.floor(uptime / (3600 * 24));
        const hours = Math.floor((uptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        let timeString = "";
        if (days > 0)    timeString += `${days}d `;
        if (hours > 0)   timeString += `${hours}h `;
        if (minutes > 0) timeString += `${minutes}m `;
        timeString += `${seconds}s`;

        const uptimeText = `
╭━「 *${getBotName()} UPTIME* 」━╮
│  ⏱️ *Running:* ${timeString.trim()}
│  📅 *Since:* ${new Date(Date.now() - uptime * 1000).toLocaleString()}
╰━━━━━━━━━━━━━╯
_ The Wolf never sleeps..._
`.trim();

        await sock.sendMessage(
            jid,
            {
                text: uptimeText,
                contextInfo: forwardInfo.contextInfo
            },
            { quoted: m }
        );

        await sock.sendMessage(jid, {
            react: { text: '⏱️', key: m.key }
        });
    }
};
