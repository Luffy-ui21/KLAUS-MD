// commands/group/hidetag.js

import baileys from 'wolfsocket';
const { proto } = baileys;

export default {
  name: 'hidetag',
  execute: async (sock, msg, args) => {
    const jid = msg.key.remoteJid;
    const text = args.join(' ') || '🔔';

    try {
      const metadata = await sock.groupMetadata(jid);
      const members = metadata.participants.map(p => p.id);

      await sock.sendMessage(jid, {
        text,
        mentions: members
      }, { quoted: msg });

    } catch (err) {
      console.error('❌ hidetag error:', err);
      await sock.sendMessage(jid, { text: '❌ Failed to send hidden tag message.' }, { quoted: msg });
    }
  }
};

















// export default {
//   name: 'hidetag',
//   description: 'Tag all group members invisibly',
//   category: 'group',
  
//   async execute(sock, m, args) {
//     const jid = m.key.remoteJid;
//     const text = args.join(' ') || '🔔';

//     try {
//       const metadata = await sock.groupMetadata(jid);
//       const members = metadata.participants.map(p => p.id);

//       // Send the tag message (THIS WORKS)
//       await sock.sendMessage(jid, {
//         text,
//         mentions: members
//       });

//       // Now IMMEDIATELY delete the command message
//       // This makes it look like the command was edited
//       try {
//         // Send a blank invisible message first to push command up
//         await sock.sendMessage(jid, { text: '‎' }); // Zero-width space
        
//         // Delete the command message
//         await sock.sendMessage(jid, { delete: m.key });
        
//         // Delete the blank message after a short delay
//         setTimeout(async () => {
//           try {
//             // Get recent messages and delete the blank one
//             const recent = await sock.loadMessages(jid, 1);
//             if (recent[0] && recent[0].key.fromMe) {
//               await sock.sendMessage(jid, { delete: recent[0].key });
//             }
//           } catch {}
//         }, 500);
        
//       } catch (deleteError) {
//         console.log('Could not clean up, but tag was sent');
//       }

//     } catch (err) {
//       console.error('❌ hidetag error:', err);
//       await sock.sendMessage(jid, { 
//         text: '❌ Failed to send hidden tag message.' 
//       }, { quoted: m });
//     }
//   }
// };