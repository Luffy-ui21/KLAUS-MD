import fetch from "node-fetch";

export default {
    name: "cuddle",
    alias: ["snuggle"],
    desc: "Cuddle someone with an anime reaction",
    category: "Anime",
    usage: ".cuddle @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            const res = await fetch("https://api.waifu.pics/sfw/cuddle");
            const data = await res.json();

            if (!data?.url) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch cuddle reaction." },
                    { quoted: m }
                );
            }

            const caption = `🤗 *CUDDLES* 🤗\n@${target.split("@")[0]} gets a warm cuddle ❤️`;

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
            console.error("Cuddle command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while cuddling." },
                { quoted: m }
            );
        }
    }
};
