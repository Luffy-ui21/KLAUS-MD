import fetch from "node-fetch";

export default {
    name: "pat",
    alias: ["headpat"],
    desc: "Anime pat / headpat reaction",
    category: "Anime",
    usage: ".pat @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            const res = await fetch("https://api.waifu.pics/sfw/pat");
            const data = await res.json();

            if (!data?.url) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch pat reaction." },
                    { quoted: m }
                );
            }

            const caption = `😊 *HEADPAT* 😊\n@${target.split("@")[0]} got a cute pat 💛`;

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
            console.error("Pat command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while patting." },
                { quoted: m }
            );
        }
    }
};
