import fetch from "node-fetch";

export default {
    name: "bully",
    alias: ["tease"],
    desc: "Bully / tease someone with an anime reaction",
    category: "Anime",
    usage: ".bully @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;

            // Mentioned user (if any)
            const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Fetch bully reaction
            const res = await fetch("https://api.waifu.pics/sfw/bully");
            const data = await res.json();

            if (!data || !data.url) {
                return sock.sendMessage(
                    jid,
                    { text: "❌ Failed to fetch bully reaction." },
                    { quoted: m }
                );
            }

            // Caption text
            const caption = `😈 *BULLY MODE* 😈\n@${target.split("@")[0]} is being teased! `;

            await sock.sendMessage(
                jid,
                {
                    image: { url: data.url },
                    caption,
                    mentions: [target]
                },
                { quoted: m }
            );

        } catch (error) {
            console.error("Bully command error:", error);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while fetching bully reaction." },
                { quoted: m }
            );
        }
    }
};
