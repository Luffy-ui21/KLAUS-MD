import axios from "axios";
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: "citizennews",
    alias: ["citizen", "citizendigital"],
    description: "Get the latest headlines from Citizen Digital (Kenya)",
    category: "news",

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, { react: { text: '🔍', key: msg.key } });

        try {
            const { data } = await axios.get("https://www.apiskeith.top/news/citizen", { timeout: 12000 });

            if (!data.status || !data.result) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: "❌ Could not fetch Citizen news. Try again later." }, { quoted: msg });
            }

            const result  = data.result;
            const stories = [
                ...(result.pinnedStories || []),
                ...(result.topStories   || [])
            ].filter(s => s.title);

            if (!stories.length) {
                return sock.sendMessage(chatId, { text: "❌ No stories found right now." }, { quoted: msg });
            }

            const limit = Math.min(stories.length, 7);
            let text = `╭─⌈ 📰 *CITIZEN DIGITAL NEWS* ⌋\n`;
            text    += `│ 🌐 citizen.digital\n`;
            text    += `│ 🕒 ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}\n│\n`;

            for (let i = 0; i < limit; i++) {
                const s = stories[i];
                const title   = s.title?.replace(/(.+?)\1$/, '$1').trim();
                const excerpt = s.excerpt || s.articleDetails?.summary || '';
                const time    = s.timestamp || s.articleDetails?.publishedDate || '';
                text += `├─⊷ *${i + 1}. ${title}*\n`;
                if (excerpt) text += `│   ${excerpt.substring(0, 100)}${excerpt.length > 100 ? '…' : ''}\n`;
                if (time)    text += `│   🕐 ${time}\n`;
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
