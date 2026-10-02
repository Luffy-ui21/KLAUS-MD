import fetch from "node-fetch";

export default {
    name: "cry",
    alias: ["sad"],
    desc: "Anime crying reaction",
    category: "Anime",
    usage: ".cry",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;

            const res = await fetch("https://api.waifu.pics/sfw/cry");
            const data = await res.json();

            if (!data?.url) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch cry reaction." },
                    { quoted: m }
                );
            }

            await sock.sendMessage(
                jid,
                {
                    image: { url: data.url },
                    caption: "😢 *CRY* 😢\nSometimes even wolves feel sad… 💔"
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Cry command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while crying." },
                { quoted: m }
            );
        }
    }
};
