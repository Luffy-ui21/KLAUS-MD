import fetch from "node-fetch";

export default {
    name: "yeet",
    alias: ["throw"],
    desc: "Anime yeet / throw reaction",
    category: "Anime",
    usage: ".yeet @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            const res = await fetch("https://api.waifu.pics/sfw/yeet");
            const data = await res.json();

            if (!data?.url) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch yeet reaction." },
                    { quoted: m }
                );
            }

            const caption = `💨 *YEET!* 💨\n@${target.split("@")[0]} got yeeted! 🚀`;

            await sock.sendMessage(
                jid,
                {
                    image: { url: data.url },
                    caption,
                    mentions: [target]
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Yeet command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while yeeting." },
                { quoted: m }
            );
        }
    }
};
