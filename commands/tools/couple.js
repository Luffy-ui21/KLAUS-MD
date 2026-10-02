// import axios from 'axios';
// import { createCanvas, loadImage } from 'canvas';

// export default {
//   name: 'couple',
//   description: 'Combine two people\'s profile pictures into a couple picture',
//   category: 'fun',
//   aliases: ['couplepic', 'lovematch'],
//   usage: 'couple @tag1 @tag2',
  
//   async execute(sock, m, args, PREFIX, extra) {
//     const jid = m.key.remoteJid;
    
//     // Show help if no arguments
//     if (args[0]?.toLowerCase() === 'help' || args.length === 0) {
//       const helpText = `💑 *COUPLE PICTURE MAKER*\n\n` +
//         `💡 *Usage:*\n` +
//         `• \`${PREFIX}couple @tag1 @tag2\`\n` +
//         `• \`${PREFIX}couplepic @person1 @person2\`\n\n` +
        
//         `✨ *How it works:*\n` +
//         `1. Tag two people in the group\n` +
//         `2. Bot fetches their profile pictures\n` +
//         `3. Creates beautiful couple picture\n` +
//         `4. Adds romantic decorations\n\n` +
        
//         `🎯 *Examples:*\n` +
//         `\`${PREFIX}couple @John @Sarah\`\n` +
//         `\`${PREFIX}lovematch @user1 @user2\`\n\n` +
        
//         `💕 *Perfect for:*\n` +
//         `• Shipping friends\n` +
//         `• Creating romantic memes\n` +
//         `• Group entertainment\n` +
//         `• Making couple avatars`;
      
//       return sock.sendMessage(jid, { text: helpText }, { quoted: m });
//     }

//     try {
//       // Check if we're in a group
//       if (!jid.endsWith('@g.us')) {
//         return sock.sendMessage(jid, {
//           text: `❌ *GROUP ONLY COMMAND!*\n\nThis command only works in groups.\n\nPlease use it in a group chat and tag two people.`
//         }, { quoted: m });
//       }

//       // Get mentioned users
//       const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      
//       if (mentions.length < 2) {
//         return sock.sendMessage(jid, {
//           text: `❌ *TAG TWO PEOPLE!*\n\nPlease tag two people in the group.\n\n💡 Example: \`${PREFIX}couple @user1 @user2\``
//         }, { quoted: m });
//       }

//       if (mentions.length > 2) {
//         return sock.sendMessage(jid, {
//           text: `⚠️ *TOO MANY TAGS!*\n\nPlease tag only TWO people.\n\nUse: \`${PREFIX}couple @person1 @person2\``
//         }, { quoted: m });
//       }

//       const [person1Jid, person2Jid] = mentions;
      
//       // Send initial processing message
//       const statusMsg = await sock.sendMessage(jid, {
//         text: `💑 *CREATING COUPLE PICTURE*\n\n⏳ Fetching profiles...\n\n👤 Person 1: Loading...\n👤 Person 2: Loading...`
//       }, { quoted: m });

//       // Get group metadata for names
//       let person1Name = 'Person 1';
//       let person2Name = 'Person 2';
      
//       try {
//         const metadata = await sock.groupMetadata(jid);
//         const participants = metadata.participants;
        
//         // Find participant names
//         const person1 = participants.find(p => p.id === person1Jid);
//         const person2 = participants.find(p => p.id === person2Jid);
        
//         person1Name = person1?.notify || person1?.name || person1Jid.split('@')[0] || 'Person 1';
//         person2Name = person2?.notify || person2?.name || person2Jid.split('@')[0] || 'Person 2';
        
//       } catch (error) {
//         console.log('Error getting group metadata:', error);
//         person1Name = person1Jid.split('@')[0] || 'Person 1';
//         person2Name = person2Jid.split('@')[0] || 'Person 2';
//       }

//       console.log(`Creating couple: ${person1Name} + ${person2Name}`);

//       // ====== GET PROFILE PICTURES ======
//       let person1Image = null;
//       let person2Image = null;
      
//       try {
//         // Update status for person 1
//         await sock.sendMessage(jid, {
//           text: `💑 *CREATING COUPLE PICTURE*\n\n⏳ Fetching profiles...\n\n👤 Person 1: ${person1Name} 🔄\n👤 Person 2: Loading...`,
//           edit: statusMsg.key
//         });

//         // Get person 1 profile
//         person1Image = await getProfilePicture(sock, person1Jid, person1Name);
        
//         // Update status for person 2
//         await sock.sendMessage(jid, {
//           text: `💑 *CREATING COUPLE PICTURE*\n\n⏳ Fetching profiles...\n\n👤 Person 1: ${person1Name} ✅\n👤 Person 2: ${person2Name} 🔄`,
//           edit: statusMsg.key
//         });

//         // Get person 2 profile
//         person2Image = await getProfilePicture(sock, person2Jid, person2Name);
        
//         // Update status for processing
//         await sock.sendMessage(jid, {
//           text: `💑 *CREATING COUPLE PICTURE*\n\n⏳ Fetching profiles... ✅\n\n👤 Person 1: ${person1Name} ✅\n👤 Person 2: ${person2Name} ✅\n\n🎨 Creating couple picture... 🔄`,
//           edit: statusMsg.key
//         });

//       } catch (error) {
//         console.error('Error getting profile pictures:', error);
        
//         await sock.sendMessage(jid, {
//           text: `❌ *PROFILE FETCH FAILED!*\n\nCould not get profile pictures.\n\nError: ${error.message}`,
//           edit: statusMsg.key
//         });
//         return;
//       }

//       // ====== CREATE COUPLE PICTURE ======
//       let finalImageBuffer;
      
//       try {
//         finalImageBuffer = await createCouplePicture(
//           person1Image, 
//           person2Image, 
//           person1Name, 
//           person2Name
//         );
        
//         console.log('✅ Couple picture created successfully');
        
//       } catch (error) {
//         console.error('Error creating couple picture:', error);
        
//         await sock.sendMessage(jid, {
//           text: `❌ *CREATION FAILED!*\n\nCould not create couple picture.\n\nError: ${error.message}`,
//           edit: statusMsg.key
//         });
//         return;
//       }

//       // ====== SEND FINAL RESULT ======
//       // Update status
//       await sock.sendMessage(jid, {
//         text: `💑 *CREATING COUPLE PICTURE*\n\n⏳ Fetching profiles... ✅\n\n👤 Person 1: ${person1Name} ✅\n👤 Person 2: ${person2Name} ✅\n\n🎨 Creating couple picture... ✅\n\n📤 Sending result... 🔄`,
//         edit: statusMsg.key
//       });

//       // Get random love percentage
//       const lovePercentage = Math.floor(Math.random() * 41) + 60; // 60% to 100%
//       const loveBar = generateLoveBar(lovePercentage);
      
//       // Get random love message
//       const loveMessages = [
//         "A match made in heaven! ✨",
//         "Destiny brought you together! 💫",
//         "Love is in the air! 💕",
//         "Perfect chemistry! 💖",
//         "Soulmates found! 💑",
//         "The stars aligned for you! 🌟",
//         "True love detected! 💘",
//         "A beautiful connection! 🥰"
//       ];
      
//       const randomLoveMessage = loveMessages[Math.floor(Math.random() * loveMessages.length)];
      
//       // Get compatibility message based on percentage
//       let compatibilityMessage = '';
//       if (lovePercentage >= 90) {
//         compatibilityMessage = "🔥 PERFECT MATCH! 🔥";
//       } else if (lovePercentage >= 80) {
//         compatibilityMessage = "💖 EXCELLENT COMPATIBILITY!";
//       } else if (lovePercentage >= 70) {
//         compatibilityMessage = "💕 GOOD MATCH!";
//       } else {
//         compatibilityMessage = "👍 DECENT COMPATIBILITY!";
//       }

//       // Send the final image
//       await sock.sendMessage(jid, {
//         image: finalImageBuffer,
//         caption: `💑 *COUPLE PICTURE CREATED!*\n\n` +
//                 `👤 *${person1Name}* + 👤 *${person2Name}*\n\n` +
//                 `💝 *Love Compatibility:* ${lovePercentage}%\n` +
//                 `${loveBar}\n` +
//                 `✨ *${compatibilityMessage}*\n\n` +
//                 `💌 *Message:* ${randomLoveMessage}\n\n` +
//                 `🏷️ Tag them to see their reaction! 😉`,
//         mentions: [person1Jid, person2Jid] // Tag both people in the caption
//       });

//       // Final success message
//       await sock.sendMessage(jid, {
//         text: `✅ *COUPLE PICTURE SENT!*\n\n` +
//               `💑 Created couple picture for:\n` +
//               `👤 ${person1Name} + 👤 ${person2Name}\n\n` +
//               `💝 Love Score: ${lovePercentage}%\n` +
//               `✨ Check the beautiful picture above!`,
//         edit: statusMsg.key
//       });

//     } catch (error) {
//       console.error('❌ [COUPLE] ERROR:', error);
      
//       await sock.sendMessage(jid, {
//         text: `❌ *FATAL ERROR!*\n\nSomething went wrong.\n\nError: ${error.message}\n\nPlease try again.`
//       }, { quoted: m });
//     }
//   }
// };

// // ====== HELPER FUNCTIONS ======

// async function getProfilePicture(sock, jid, name) {
//   try {
//     // Try to get profile picture
//     const profilePicUrl = await sock.profilePictureUrl(jid, 'image');
    
//     if (!profilePicUrl) {
//       throw new Error('No profile picture');
//     }
    
//     // Download the image
//     const response = await axios.get(profilePicUrl, {
//       responseType: 'arraybuffer',
//       timeout: 10000,
//       headers: {
//         'User-Agent': 'WhatsApp-Bot/1.0'
//       }
//     });
    
//     const buffer = Buffer.from(response.data);
//     return await loadImage(buffer);
    
//   } catch (error) {
//     console.log(`Creating default avatar for ${name}:`, error.message);
    
//     // Create default avatar
//     const canvas = createCanvas(400, 400);
//     const ctx = canvas.getContext('2d');
    
//     // Generate a color based on name
//     const colors = [
//       '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
//       '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
//     ];
    
//     const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
//     const bgColor = colors[colorIndex];
    
//     // Draw background
//     ctx.fillStyle = bgColor;
//     ctx.fillRect(0, 0, 400, 400);
    
//     // Draw circle
//     ctx.fillStyle = 'white';
//     ctx.beginPath();
//     ctx.arc(200, 200, 150, 0, Math.PI * 2);
//     ctx.fill();
    
//     // Draw initial
//     ctx.fillStyle = bgColor;
//     ctx.font = 'bold 120px Arial';
//     ctx.textAlign = 'center';
//     ctx.textBaseline = 'middle';
//     const firstLetter = name.charAt(0).toUpperCase();
//     ctx.fillText(firstLetter, 200, 200);
    
//     return await loadImage(canvas.toBuffer());
//   }
// }

// async function createCouplePicture(image1, image2, name1, name2) {
//   const canvas = createCanvas(800, 500);
//   const ctx = canvas.getContext('2d');
  
//   // Create beautiful gradient background
//   const gradient = ctx.createLinearGradient(0, 0, 800, 500);
//   gradient.addColorStop(0, '#FF9A9E'); // Pink
//   gradient.addColorStop(0.5, '#FAD0C4'); // Light pink
//   gradient.addColorStop(1, '#A1C4FD'); // Light blue
  
//   ctx.fillStyle = gradient;
//   ctx.fillRect(0, 0, 800, 500);
  
//   // Add decorative hearts in background
//   ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
//   for (let i = 0; i < 15; i++) {
//     const x = Math.random() * 800;
//     const y = Math.random() * 500;
//     const size = Math.random() * 20 + 10;
//     drawSimpleHeart(ctx, x, y, size);
//   }
  
//   // Draw first profile picture (circular)
//   ctx.save();
//   ctx.beginPath();
//   ctx.arc(200, 200, 120, 0, Math.PI * 2);
//   ctx.closePath();
//   ctx.clip();
//   ctx.drawImage(image1, 80, 80, 240, 240);
//   ctx.restore();
  
//   // Add border to first picture
//   ctx.strokeStyle = 'white';
//   ctx.lineWidth = 8;
//   ctx.beginPath();
//   ctx.arc(200, 200, 120, 0, Math.PI * 2);
//   ctx.stroke();
  
//   // Draw second profile picture (circular)
//   ctx.save();
//   ctx.beginPath();
//   ctx.arc(600, 200, 120, 0, Math.PI * 2);
//   ctx.closePath();
//   ctx.clip();
//   ctx.drawImage(image2, 480, 80, 240, 240);
//   ctx.restore();
  
//   // Add border to second picture
//   ctx.beginPath();
//   ctx.arc(600, 200, 120, 0, Math.PI * 2);
//   ctx.stroke();
  
//   // Draw heart between them
//   ctx.fillStyle = '#FF6B8B';
//   drawHeart(ctx, 400, 200, 60);
  
//   // Draw plus sign
//   ctx.fillStyle = 'white';
//   ctx.fillRect(395, 185, 10, 30);
//   ctx.fillRect(385, 195, 30, 10);
  
//   // Draw names
//   ctx.fillStyle = '#333333';
//   ctx.font = 'bold 28px Arial';
//   ctx.textAlign = 'center';
//   ctx.shadowColor = 'white';
//   ctx.shadowBlur = 5;
//   ctx.fillText(name1, 200, 350);
//   ctx.fillText(name2, 600, 350);
//   ctx.shadowBlur = 0;
  
//   // Draw main title
//   ctx.fillStyle = '#FF1493';
//   ctx.font = 'bold 36px Arial';
//   ctx.fillText('💑 Perfect Couple 💑', 400, 420);
  
//   // Add decorative border
//   ctx.strokeStyle = '#FF6B8B';
//   ctx.lineWidth = 8;
//   ctx.strokeRect(10, 10, 780, 480);
  
//   // Add corner decorations
//   ctx.strokeStyle = '#FFB6C1';
//   ctx.lineWidth = 4;
  
//   // Top-left corner
//   ctx.beginPath();
//   ctx.moveTo(50, 10);
//   ctx.lineTo(10, 10);
//   ctx.lineTo(10, 50);
//   ctx.stroke();
  
//   // Top-right corner
//   ctx.beginPath();
//   ctx.moveTo(750, 10);
//   ctx.lineTo(790, 10);
//   ctx.lineTo(790, 50);
//   ctx.stroke();
  
//   // Bottom-left corner
//   ctx.beginPath();
//   ctx.moveTo(10, 450);
//   ctx.lineTo(10, 490);
//   ctx.lineTo(50, 490);
//   ctx.stroke();
  
//   // Bottom-right corner
//   ctx.beginPath();
//   ctx.moveTo(750, 490);
//   ctx.lineTo(790, 490);
//   ctx.lineTo(790, 450);
//   ctx.stroke();
  
//   return canvas.toBuffer('image/jpeg', { quality: 0.95 });
// }

// function drawHeart(ctx, x, y, size) {
//   ctx.save();
//   ctx.translate(x, y);
  
//   ctx.beginPath();
  
//   // Draw heart shape
//   const topCurveHeight = size * 0.3;
//   ctx.moveTo(0, size / 4);
  
//   // Left curve
//   ctx.bezierCurveTo(
//     -size / 2, -size / 3,
//     -size, size / 3,
//     0, size
//   );
  
//   // Right curve
//   ctx.bezierCurveTo(
//     size, size / 3,
//     size / 2, -size / 3,
//     0, size / 4
//   );
  
//   ctx.closePath();
//   ctx.fill();
  
//   // Add shine effect
//   ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
//   ctx.beginPath();
//   ctx.ellipse(-size/6, -size/4, size/8, size/6, 0, 0, Math.PI * 2);
//   ctx.fill();
  
//   ctx.restore();
// }

// function drawSimpleHeart(ctx, x, y, size) {
//   ctx.save();
//   ctx.translate(x, y);
  
//   ctx.beginPath();
//   ctx.moveTo(0, size / 4);
//   ctx.bezierCurveTo(-size/2, -size/3, -size, size/3, 0, size);
//   ctx.bezierCurveTo(size, size/3, size/2, -size/3, 0, size/4);
  
//   ctx.closePath();
//   ctx.fill();
  
//   ctx.restore();
// }

// function generateLoveBar(percentage) {
//   const filled = Math.floor(percentage / 10);
//   const empty = 10 - filled;
  
//   let bar = '';
  
//   // Add filled hearts
//   for (let i = 0; i < filled; i++) {
//     bar += '❤️';
//   }
  
//   // Add empty hearts
//   for (let i = 0; i < empty; i++) {
//     bar += '🤍';
//   }
  
//   return bar;
// }























import axios from 'axios';
import { createCanvas, loadImage } from '../../lib/canvasWrapper.js';

export default {
  name: 'couple',
  description: 'Combine two people\'s profile pictures into a couple picture',
  category: 'fun',
  aliases: ['couplepic', 'lovematch'],
  usage: 'couple @tag1 @tag2',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    
    // Show help if no arguments
    if (args[0]?.toLowerCase() === 'help' || args.length === 0) {
      const helpText = `💑 *COUPLE PICTURE MAKER*\n\n` +
        `💡 *Usage:*\n` +
        `• \`${PREFIX}couple @tag1 @tag2\`\n` +
        `• \`${PREFIX}couplepic @person1 @person2\`\n\n` +
        
        `✨ *How it works:*\n` +
        `1. Tag two people in the group\n` +
        `2. Bot fetches their profile pictures\n` +
        `3. Creates beautiful couple picture\n` +
        `4. Adds romantic decorations\n\n` +
        
        `🎯 *Examples:*\n` +
        `\`${PREFIX}couple @John @Sarah\`\n` +
        `\`${PREFIX}lovematch @user1 @user2\`\n\n` +
        
        `💕 *Perfect for:*\n` +
        `• Shipping friends\n` +
        `• Creating romantic memes\n` +
        `• Group entertainment\n` +
        `• Making couple avatars`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    try {
      // Check if we're in a group
      if (!jid.endsWith('@g.us')) {
        return sock.sendMessage(jid, {
          text: `❌ *GROUP ONLY COMMAND!*\n\nThis command only works in groups.\n\nPlease use it in a group chat and tag two people.`
        }, { quoted: m });
      }

      // Get mentioned users
      const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      
      if (mentions.length < 2) {
        return sock.sendMessage(jid, {
          text: `❌ *TAG TWO PEOPLE!*\n\nPlease tag two people in the group.\n\n💡 Example: \`${PREFIX}couple @user1 @user2\``
        }, { quoted: m });
      }

      if (mentions.length > 2) {
        return sock.sendMessage(jid, {
          text: `⚠️ *TOO MANY TAGS!*\n\nPlease tag only TWO people.\n\nUse: \`${PREFIX}couple @person1 @person2\``
        }, { quoted: m });
      }

      const [person1Jid, person2Jid] = mentions;

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Get group metadata for names
      let person1Name = 'Person 1';
      let person2Name = 'Person 2';
      
      try {
        const metadata = await sock.groupMetadata(jid);
        const participants = metadata.participants;
        
        // Find participant names
        const person1 = participants.find(p => p.id === person1Jid);
        const person2 = participants.find(p => p.id === person2Jid);
        
        person1Name = person1?.notify || person1?.name || person1Jid.split('@')[0] || 'Person 1';
        person2Name = person2?.notify || person2?.name || person2Jid.split('@')[0] || 'Person 2';
        
      } catch (error) {
        console.log('Error getting group metadata:', error);
        person1Name = person1Jid.split('@')[0] || 'Person 1';
        person2Name = person2Jid.split('@')[0] || 'Person 2';
      }

      console.log(`Creating couple: ${person1Name} + ${person2Name}`);

      // ====== GET PROFILE PICTURES ======
      let person1Image = null;
      let person2Image = null;
      
      try {
        // Get person 1 profile
        person1Image = await getProfilePicture(sock, person1Jid, person1Name);

        // Get person 2 profile
        person2Image = await getProfilePicture(sock, person2Jid, person2Name);

      } catch (error) {
        console.error('Error getting profile pictures:', error);
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, {
          text: `❌ Failed to get profile pictures: ${error.message}`
        }, { quoted: m });
        return;
      }

      // ====== CREATE COUPLE PICTURE ======
      let finalImageBuffer;
      
      try {
        finalImageBuffer = await createCouplePicture(
          person1Image, 
          person2Image, 
          person1Name, 
          person2Name
        );
        
        console.log('✅ Couple picture created successfully');
        
      } catch (error) {
        console.error('Error creating couple picture:', error);
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        await sock.sendMessage(jid, {
          text: `❌ Failed to create couple picture: ${error.message}`
        }, { quoted: m });
        return;
      }

      // ====== SEND FINAL RESULT ======
      // Get random love percentage
      const lovePercentage = Math.floor(Math.random() * 41) + 60; // 60% to 100%
      const loveBar = generateLoveBar(lovePercentage);
      
      // Get random love message
      const loveMessages = [
        "A match made in heaven! ✨",
        "Destiny brought you together! 💫",
        "Love is in the air! 💕",
        "Perfect chemistry! 💖",
        "Soulmates found! 💑",
        "The stars aligned for you! 🌟",
        "True love detected! 💘",
        "A beautiful connection! 🥰"
      ];
      
      const randomLoveMessage = loveMessages[Math.floor(Math.random() * loveMessages.length)];
      
      // Get compatibility message based on percentage
      let compatibilityMessage = '';
      if (lovePercentage >= 90) {
        compatibilityMessage = "🔥 PERFECT MATCH! 🔥";
      } else if (lovePercentage >= 80) {
        compatibilityMessage = "💖 EXCELLENT COMPATIBILITY!";
      } else if (lovePercentage >= 70) {
        compatibilityMessage = "💕 GOOD MATCH!";
      } else {
        compatibilityMessage = "👍 DECENT COMPATIBILITY!";
      }

      // Create caption with proper tagging format
      const caption = `💑 *COUPLE PICTURE CREATED!*\n\n` +
        `👤 @${person1Jid.split('@')[0]} + 👤 @${person2Jid.split('@')[0]}\n\n` +
        `💝 *Love Compatibility:* ${lovePercentage}%\n` +
        `✨ *${compatibilityMessage}*\n` +
        `💌 *Message:* ${randomLoveMessage}\n` +
``;

      // Send the final image WITH PROPER MENTIONS
      await sock.sendMessage(jid, {
        image: finalImageBuffer,
        caption: caption,
        mentions: [person1Jid, person2Jid], // This is KEY - must be in the message object
        quoted: m // Reply to the original message
      });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [COUPLE] ERROR:', error);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Failed: ${error.message}`
      }, { quoted: m });
    }
  }
};

// ====== HELPER FUNCTIONS ======

async function getProfilePicture(sock, jid, name) {
  try {
    // Try to get profile picture
    const profilePicUrl = await sock.profilePictureUrl(jid, 'image');
    
    if (!profilePicUrl) {
      throw new Error('No profile picture');
    }
    
    // Download the image
    const response = await axios.get(profilePicUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'WhatsApp-Bot/1.0'
      }
    });
    
    const buffer = Buffer.from(response.data);
    return await loadImage(buffer);
    
  } catch (error) {
    console.log(`Creating default avatar for ${name}:`, error.message);
    
    // Create default avatar
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext('2d');
    
    // Generate a color based on name
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const bgColor = colors[colorIndex];
    
    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 400, 400);
    
    // Draw circle
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(200, 200, 150, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw initial
    ctx.fillStyle = bgColor;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const firstLetter = name.charAt(0).toUpperCase();
    ctx.fillText(firstLetter, 200, 200);
    
    return await loadImage(canvas.toBuffer());
  }
}

async function createCouplePicture(image1, image2, name1, name2) {
  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext('2d');
  
  // Create beautiful gradient background
  const gradient = ctx.createLinearGradient(0, 0, 800, 500);
  gradient.addColorStop(0, '#FF9A9E'); // Pink
  gradient.addColorStop(0.5, '#FAD0C4'); // Light pink
  gradient.addColorStop(1, '#A1C4FD'); // Light blue
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 500);
  
  // Add decorative hearts in background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 500;
    const size = Math.random() * 20 + 10;
    drawSimpleHeart(ctx, x, y, size);
  }
  
  // Draw first profile picture (circular)
  ctx.save();
  ctx.beginPath();
  ctx.arc(200, 200, 120, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image1, 80, 80, 240, 240);
  ctx.restore();
  
  // Add border to first picture
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(200, 200, 120, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw second profile picture (circular)
  ctx.save();
  ctx.beginPath();
  ctx.arc(600, 200, 120, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image2, 480, 80, 240, 240);
  ctx.restore();
  
  // Add border to second picture
  ctx.beginPath();
  ctx.arc(600, 200, 120, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw heart between them
  ctx.fillStyle = '#FF6B8B';
  drawHeart(ctx, 400, 200, 60);
  
  // Draw plus sign
  ctx.fillStyle = 'white';
  ctx.fillRect(395, 185, 10, 30);
  ctx.fillRect(385, 195, 30, 10);
  
  // Draw names
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'white';
  ctx.shadowBlur = 5;
  ctx.fillText(name1, 200, 350);
  ctx.fillText(name2, 600, 350);
  ctx.shadowBlur = 0;
  
  // Draw main title
  ctx.fillStyle = '#FF1493';
  ctx.font = 'bold 36px Arial';
  ctx.fillText('💑 Perfect Couple 💑', 400, 420);
  
  // Add decorative border
  ctx.strokeStyle = '#FF6B8B';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 780, 480);
  
  // Add corner decorations
  ctx.strokeStyle = '#FFB6C1';
  ctx.lineWidth = 4;
  
  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(50, 10);
  ctx.lineTo(10, 10);
  ctx.lineTo(10, 50);
  ctx.stroke();
  
  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(750, 10);
  ctx.lineTo(790, 10);
  ctx.lineTo(790, 50);
  ctx.stroke();
  
  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(10, 450);
  ctx.lineTo(10, 490);
  ctx.lineTo(50, 490);
  ctx.stroke();
  
  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(750, 490);
  ctx.lineTo(790, 490);
  ctx.lineTo(790, 450);
  ctx.stroke();
  
  return canvas.toBuffer('image/jpeg', { quality: 0.95 });
}

function drawHeart(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  
  ctx.beginPath();
  
  // Draw heart shape
  const topCurveHeight = size * 0.3;
  ctx.moveTo(0, size / 4);
  
  // Left curve
  ctx.bezierCurveTo(
    -size / 2, -size / 3,
    -size, size / 3,
    0, size
  );
  
  // Right curve
  ctx.bezierCurveTo(
    size, size / 3,
    size / 2, -size / 3,
    0, size / 4
  );
  
  ctx.closePath();
  ctx.fill();
  
  // Add shine effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-size/6, -size/4, size/8, size/6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawSimpleHeart(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  
  ctx.beginPath();
  ctx.moveTo(0, size / 4);
  ctx.bezierCurveTo(-size/2, -size/3, -size, size/3, 0, size);
  ctx.bezierCurveTo(size, size/3, size/2, -size/3, 0, size/4);
  
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function generateLoveBar(percentage) {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  
  let bar = '';
  
  // Add filled hearts
  for (let i = 0; i < filled; i++) {
    bar += '❤️';
  }
  
  // Add empty hearts
  for (let i = 0; i < empty; i++) {
    bar += '🤍';
  }
  
  return bar;
}
