export default {
    name: "lick",
    alias: ["licking", "slurp"],
    desc: "Anime lick reaction",
    category: "Anime",
    usage: ".lick @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Try waifu.pics API first (has lick endpoint)
            const res = await fetch("https://api.waifu.pics/sfw/lick");
            const data = await res.json();

            if (!data?.url) {
                // Fallback to nekos.life API
                const fallbackRes = await fetch("https://nekos.life/api/v2/img/lick");
                const fallbackData = await fallbackRes.json();
                
                if (!fallbackData?.url) {
                    // Alternative fallback to nekos.best API
                    const altRes = await fetch("https://nekos.best/api/v2/pat");
                    const altData = await altRes.json();
                    
                    if (!altData?.results?.[0]?.url) {
                        return sock.sendMessage(
                            jid,
                            { text: "❌ Failed to fetch lick reaction. Try again later! 👅" },
                            { quoted: m }
                        );
                    }
                    
                    const caption = `👅 *LICK* 👅\n@${target.split("@")[0]} got licked by @${sender.split("@")[0]}! 💦`;
                    
                    await sock.sendMessage(
                        jid,
                        {
                            image: { url: altData.results[0].url },
                            caption,
                            mentions: [target, sender]
                        },
                        { quoted: m }
                    );
                    return;
                }
                
                const caption = `👅 *LICK* 👅\n@${target.split("@")[0]} got licked by @${sender.split("@")[0]}! 💦`;
                
                await sock.sendMessage(
                    jid,
                    {
                        image: { url: fallbackData.url },
                        caption,
                        mentions: [target, sender]
                    },
                    { quoted: m }
                );
                return;
            }

            const caption = `👅 *LICK* 👅\n@${target.split("@")[0]} got licked by @${sender.split("@")[0]}! 💦`;

            await sock.sendMessage(
                jid,
                {
                    image: { url: data.url },
                    caption,
                    mentions: [target, sender]
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("Lick command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while processing the lick command." },
                { quoted: m }
            );
        }
    }
};