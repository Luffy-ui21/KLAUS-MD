// import { jidDecode } from "wolfsocket";

// export default {
//   name: "fangtrace",
//   description: "Trace number info: bio, number, and profile pic",
//   category: "group",
//   async execute(sock, m, args) {
//     try {
//       let jid;

//       // 1. Handle mention
//       if (
//         m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length
//       ) {
//         jid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
//       }

//       // 2. Handle manual input like `.fangtrace 254712345678`
//       else if (args[0]) {
//         const number = args[0].replace(/\D/g, ""); // remove non-digits
//         jid = `${number}@s.whatsapp.net`;
//       } else {
//         return sock.sendMessage(
//           m.key.remoteJid,
//           { text: "❌ Please tag a user or provide a phone number." },
//           { quoted: m }
//         );
//       }

//       // Decode number
//       const decoded = jidDecode(jid);
//       const number = decoded?.user || jid.split("@")[0];

//       // 3. Get Bio
//       let bio = "Not Available or Hidden";
//       try {
//         const status = await sock.fetchStatus(jid);
//         if (status?.status) {
//           bio = status.status;
//         }
//       } catch (err) {
//         console.log(`⚠️ Couldn't get bio for ${jid}:`, err.message);
//       }

//       // 4. Get Profile Picture
//       let dp = "Not Available";
//       try {
//         dp = await sock.profilePictureUrl(jid, "image");
//       } catch (err) {
//         console.log(`⚠️ Couldn't get profile picture:`, err.message);
//       }

//       // 5. Send Response
//       const response = ` *FANG TRACE RESULT*\n\n` +
//                        `📱 *Number:* +${number}\n` +
//                        `📝 *Bio:* ${bio}\n` +
//                        `🖼️ *DP URL:* ${dp}`;

//       await sock.sendMessage(m.key.remoteJid, { text: response }, { quoted: m });

//     } catch (error) {
//       console.error("Fangtrace Error:", error);
//       await sock.sendMessage(
//         m.key.remoteJid,
//         { text: `❌ An error occurred: ${error.message}` },
//         { quoted: m }
//       );
//     }
//   }
// };


export default {
  name: "fangtrace",
  description: "Trace user number, bio and profile picture",
  category: "group",
  async execute(sock, m, args) {
    try {
      let jid;

      // 1. Get mentioned number
      const mention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      if (mention) {
        jid = mention;
      } else if (args[0]) {
        // 2. If manual input
        let input = args[0].replace(/\D/g, "");
        if (!input) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "❌ Invalid number provided.",
          }, { quoted: m });
        }
        jid = input + "@s.whatsapp.net";
      } else {
        return sock.sendMessage(m.key.remoteJid, {
          text: "❌ Please tag a user or provide a number.",
        }, { quoted: m });
      }

      // 3. Get bio
      let bio = "Not Available or Private";
      try {
        const { status } = await sock.fetchStatus(jid);
        if (status) bio = status;
      } catch (e) {
        console.log("Bio fetch failed:", e.message);
      }

      // 4. Get number
      const number = jid.split("@")[0];

      // 5. Get profile picture
      let pp = "Not Available";
      try {
        pp = await sock.profilePictureUrl(jid, "image");
      } catch (e) {
        console.log("PP fetch failed:", e.message);
      }

      // 6. Send info
      const msg = ` *FANG TRACE RESULT*\n\n` +
                  `📱 *Number:* +${number}\n` +
                  `📝 *Bio:* ${bio}\n` +
                  `🖼️ *DP:* ${pp}`;

      await sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });

    } catch (err) {
      console.error("FANGTRACE ERROR:", err.message);
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Something went wrong while tracing.",
      }, { quoted: m });
    }
  }
};
