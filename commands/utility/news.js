// commands/utility/news.js
export default {
  name: "news",
  alias: ["wolfnews", "headlines"],
  description: "Get the latest news headlines in a wolf-themed style",
  category: "utility",

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid; // ✅ safer than m.chat
      const apiKey = "13eb152f04d94647ac129c408439ae2d"; // Your NewsAPI key
      const query = args.length > 0 ? args.join(" ") : "technology";
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.articles || data.articles.length === 0) {
        await sock.sendMessage(
          chatId,
          { text: `❌ No news found for *${query}*. The wolf found nothing in the shadows...` },
          { quoted: m }
        );
        return;
      }

      let newsList = `\n🌙 *SILENT WOLF NEWS* 🌙\n`;
      newsList += `━━━━━━━━━━━━━━━━━━\n`;
      newsList += `🔎 Topic: *${query.toUpperCase()}*\n\n`;

      data.articles.slice(0, 5).forEach((article, i) => {
        newsList += `*${i + 1}. ${article.title}*\n`;
        newsList += `🌐 ${article.url}\n\n`;
      });

      newsList += `━━━━━━━━━━━━━━━━━━\n`;
      newsList += `⚡ Alpha Wolf delivers the freshest headlines\n`;

      await sock.sendMessage(chatId, { text: newsList }, { quoted: m });
    } catch (err) {
      console.error("❌ Error in news command:", err);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "⚠️ The wolf couldn’t fetch the news... try again later." },
        { quoted: m }
      );
    }
  }
};
