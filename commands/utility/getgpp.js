import fs from "fs";
import path from "path";
import axios from "axios";
import { getOwnerName, getFooter} from "../../lib/menuHelper.js";

const BRAND = () => getOwnerName().toUpperCase();

export default {
  name: "getgpp",
  alias: ["getgrouppic", "wolfgetgpp"],
  desc: "Fetch a group's profile picture. Run inside a group or pass a group JID from anywhere.",
  category: "utility",
  usage: ".getgpp [group JID]",

  async execute(sock, m, args, PREFIX) {
    const chatId = m.key.remoteJid;
    const isInGroup = chatId.endsWith("@g.us");

    // Resolve target group JID
    let targetJid = null;

    if (args[0]) {
      let input = args[0].trim();
      if (!input.endsWith("@g.us")) {
        input = input.replace(/[^0-9\-]/g, "");
        input = `${input}@g.us`;
      }
      targetJid = input;
    } else if (isInGroup) {
      targetJid = chatId;
    } else {
      return sock.sendMessage(chatId, {
        text:
          `╭⌈ ❌ *NO GROUP SPECIFIED* ⌋\n` +
          `├⊷ Run inside a group, or provide a JID:\n` +
          `├⊷ *${PREFIX}getgpp 1234567890-1234567890@g.us*\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    try {
      // Fetch group name for the caption
      let groupName = targetJid;
      try {
        const meta = await sock.groupMetadata(targetJid);
        groupName = meta.subject || targetJid;
      } catch {}

      // Fetch profile picture URL
      let ppUrl;
      try {
        ppUrl = await sock.profilePictureUrl(targetJid, "image");
      } catch {
        ppUrl = "https://files.catbox.moe/lvcwnf.jpg";
      }

      // Download temporarily then send
      const tmpDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, `wolf_getgpp_${Date.now()}.jpg`);

      const response = await axios.get(ppUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(filePath, Buffer.from(response.data));

      const usedJid = !!args[0];
      await sock.sendMessage(chatId, {
        image: { url: filePath },
        caption:
          `╭⌈ 🖼️ *GROUP PROFILE PICTURE* ⌋\n` +
          `├⊷ Group : *${groupName}*\n` +
          (!usedJid ? `├⊷ 💡 Tip: Use *${PREFIX}getgpp <JID>* to fetch any group's pic from anywhere\n` : '') +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });

      fs.unlinkSync(filePath);

    } catch (error) {
      console.error(" Error in getgpp command:", error);
      await sock.sendMessage(chatId, {
        text: `❌ Failed to retrieve group profile picture!\n\n⚙️ Error: ${error.message}`
      }, { quoted: m });
    }
  },
};
