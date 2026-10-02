import axios from "axios";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: "technews",
    alias: ["tech", "technews", "latesttechnews"],
    description: "Get the latest featured technology news",
    category: "news",

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } });

        try {
            const { data } = await axios.get("https://www.apiskeith.top/news/tech", { timeout: 12000 });

            if (!data.status || !data.result) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: "❌ Could not fetch tech news. Try again later." }, { quoted: msg });
            }

            const articles = (data.result.featuredArticles || []).filter(a => a.title);

            if (!articles.length) {
                return sock.sendMessage(chatId, { text: "❌ No tech articles found right now." }, { quoted: msg });
            }

            const limit = Math.min(articles.length, 7);
            let text = `╭─⌈ 💻 *TECH NEWS* ⌋\n`;
            text    += `│ 🌐 Featured Tech Articles\n`;
            text    += `│ 🕒 ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}\n│\n`;

            for (let i = 0; i < limit; i++) {
                const a = articles[i];
                text += `├─⊷ *${i + 1}. ${a.title.trim()}*\n`;
                if (a.description) text += `│   ${a.description.substring(0, 110)}${a.description.length > 110 ? '…' : ''}\n`;
                if (a.type)        text += `│   🏷️ ${a.type}\n`;
                text += `│   🔗 ${a.link}\n│\n`;
            }

            text += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(chatId, { text }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    }
};
