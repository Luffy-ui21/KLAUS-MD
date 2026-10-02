const FALLBACK_PP = "https://files.catbox.moe/lvcwnf.jpg";

function isValidHttpUrl(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

export default {
    name: "getpp",
    alias: ["getprofilepic", "wolfgetpp"],
    desc: "Fetch someone's profile picture ",
    category: "utility",
    usage: ".getpp [@user | reply to message]",

    async execute(sock, m) {
        const chatId  = m.key.remoteJid;
        const isGroup = chatId.endsWith("@g.us");
        const isOwner = m.key.fromMe;

        if (!isGroup && !isOwner) {
            return sock.sendMessage(chatId, {
                text: "⚠️ Only the Alpha Wolf (Owner) can use this command in DMs.",
            }, { quoted: m });
        }

        const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const quoted    = m.message?.extendedTextMessage?.contextInfo?.participant;
        const target    = mentioned || quoted;

        if (!target) {
            return sock.sendMessage(chatId, {
                text: "⚠️ You must *mention* someone or *reply to* their message to fetch their profile picture.",
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            // Fetch profile pic URL and validate it before using
            let ppUrl = FALLBACK_PP;
            try {
                const fetched = await sock.profilePictureUrl(target, "image");
                if (isValidHttpUrl(fetched)) ppUrl = fetched;
            } catch {}

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                image:    { url: ppUrl },
                caption:  ` *Target:* @${target.split("@")[0]}\n📸 Profile picture retrieved successfully!`,
                mentions: [target],
            }, { quoted: m });

        } catch (error) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            console.error(" Error in getpp command:", error);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to retrieve profile picture!\n\n⚙️ Error: ${error.message}`,
            }, { quoted: m });
        }
    },
};
