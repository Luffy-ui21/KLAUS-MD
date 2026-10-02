import axios from "axios";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: "kbcnews",
    alias: ["kbc", "kbckenya"],
    description: "Get the latest breaking news from KBC Kenya",
    category: "news",

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } });

        try {
            const { data } = await axios.get("https://www.apiskeith.top/news/kbc", { timeout: 12000 });

            if (!data.status || !data.result) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: "❌ Could not fetch KBC news. Try again later." }, { quoted: msg });
            }

            const stories = (data.result.breakingNews || []).filter(s => s.title);

            if (!stories.length) {
                return sock.sendMessage(chatId, { text: "❌ No breaking news right now." }, { quoted: msg });
            }

            const limit = Math.min(stories.length, 7);
            let text = `╭─⌈ 📰 *KBC KENYA NEWS* ⌋\n`;
            text    += `│ 🌐 kbctv.co.ke\n`;
            text    += `│ 🕒 ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}\n│\n`;

            for (let i = 0; i < limit; i++) {
                const s = stories[i];
                text += `├─⊷ *${i + 1}. ${s.title.trim()}*\n`;
                if (s.text) text += `│   ${s.text.substring(0, 110)}${s.text.length > 110 ? '…' : ''}\n`;
                text += `│   🔗 ${s.url}\n│\n`;
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
