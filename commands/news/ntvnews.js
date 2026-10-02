import axios from "axios";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: "ntvnews",
    alias: ["ntv", "ntvkenya"],
    description: "Get the latest news articles from NTV Kenya",
    category: "news",

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } });

        try {
            const { data } = await axios.get("https://www.apiskeith.top/news/ntv", { timeout: 12000 });

            if (!data.status || !data.result) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: "❌ Could not fetch NTV news. Try again later." }, { quoted: msg });
            }

            const articles = (data.result.articles || []).filter(a => a.title);

            if (!articles.length) {
                return sock.sendMessage(chatId, { text: "❌ No articles found right now." }, { quoted: msg });
            }

            const limit = Math.min(articles.length, 7);
            let text = `╭─⌈ 📰 *NTV KENYA NEWS* ⌋\n`;
            text    += `│ 🌐 ntv.nation.africa\n`;
            text    += `│ 🕒 ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}\n│\n`;

            for (let i = 0; i < limit; i++) {
                const a = articles[i];
                text += `├─⊷ *${i + 1}. ${a.title.trim()}*\n`;
                if (a.category)    text += `│   🏷️ ${a.category}\n`;
                if (a.summary)     text += `│   ${a.summary.substring(0, 110)}${a.summary.length > 110 ? '…' : ''}\n`;
                if (a.timePosted)  text += `│   🕐 ${a.timePosted}\n`;
                if (a.author)      text += `│   ✍️ ${a.author}\n`;
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
