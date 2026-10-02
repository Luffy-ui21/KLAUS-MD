import fetch from "node-fetch";

export default {
    name: "shinobu",
    alias: ["kochou", "butterfly"],
    desc: "Get a random Shinobu Kochou anime image",
    category: "Anime",
    usage: ".shinobu",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;

            // Fetch Shinobu image
            const res = await fetch("https://api.waifu.pics/sfw/shinobu");
            const data = await res.json();

            if (!data || !data.url) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch Shinobu image." },
                    { quoted: m }
                );
            }

            // Send image
            await sock.sendMessage(
                jid,
                {
                    image: { url: data.url },
                    caption: "🦋 *Shinobu Kochou* 🦋\nGraceful, deadly, and beautiful ✨"
                },
                { quoted: m }
            );

        } catch (error) {
            console.error("Shinobu command error:", error);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while fetching Shinobu." },
                { quoted: m }
            );
        }
    }
};
