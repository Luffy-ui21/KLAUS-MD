export default {
    name: "kiss",
    alias: ["kisses", "smooch"],
    desc: "Anime kiss reaction",
    category: "Anime",
    usage: ".kiss @user",

    async execute(sock, m) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || jid;

            const mentionedJid =
                m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentionedJid[0] || sender;

            // Try waifu.pics API first
            const res = await fetch("https://api.waifu.pics/sfw/kiss");
            const data = await res.json();

            if (!data?.url) {
                // Fallback to nekos.best API
                const fallbackRes = await fetch("https://nekos.best/api/v2/kiss");
                const fallbackData = await fallbackRes.json();
                
                if (!fallbackData?.results?.[0]?.url) {
                    // Second fallback to nekos.life API
                    const secondRes = await fetch("https://nekos.life/api/v2/img/kiss");
                    const secondData = await secondRes.json();
                    
                    if (!secondData?.url) {
                        return sock.sendMessage(
                            jid,
                            { text: "❌ Failed to fetch kiss reaction. Please try again later." },
                            { quoted: m }
                        );
                    }
                    
                    const caption = `💋 *KISS* 💋\n@${target.split("@")[0]} got a kiss from @${sender.split("@")[0]}! 💘`;
                    
                    await sock.sendMessage(
                        jid,
                        {
                            image: { url: secondData.url },
                            caption,
                            mentions: [target, sender]
                        },
                        { quoted: m }
                    );
                    return;
                }
                
                const caption = `💋 *KISS* 💋\n@${target.split("@")[0]} got a kiss from @${sender.split("@")[0]}! 💘`;
                
                await sock.sendMessage(
                    jid,
                    {
                        image: { url: fallbackData.results[0].url },
                        caption,
                        mentions: [target, sender]
                    },
                    { quoted: m }
                );
                return;
            }

            const caption = `💋 *KISS* 💋\n@${target.split("@")[0]} got a kiss from @${sender.split("@")[0]}! 💘`;

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
            console.error("Kiss command error:", err);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "⚠️ An error occurred while processing the kiss command." },
                { quoted: m }
            );
        }
    }
};