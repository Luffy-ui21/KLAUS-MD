import axios from 'axios';
import { createCanvas, loadImage } from '../../lib/canvasWrapper.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'bf',
  description: 'Add boyfriend overlay to profile picture',
  category: 'fun',
  aliases: ['boyfriend', 'boyfriendpic', 'man', 'hubby'],
  usage: 'bf (reply to any message)',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    
    // ====== SHOW HELP IF NO ARGS AND NO REPLY ======
    const hasReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (args.length === 0 && !hasReply) {
      const helpText = `╭─⌈ 💙 *BOYFRIEND PROFILE* ⌋\n│\n├─⊷ *${PREFIX}bf*\n│  └⊷ Reply to any message to get boyfriend profile pic\n│\n├─⊷ *Aliases:* boyfriend, hubby\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    if (args[0]?.toLowerCase() === 'help') {
      const helpText = `╭─⌈ 💙 *BOYFRIEND PROFILE* ⌋\n│\n├─⊷ *${PREFIX}bf*\n│  └⊷ Reply to any message to create couple picture\n│\n├─⊷ *Aliases:* boyfriend, hubby\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    try {
      // ====== DETERMINE TARGET USER ======
      let targetJid = null;
      let targetName = 'User';
      let isFemale = false;
      
      // CHECK 1: Is user replying to a message?
      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        console.log('✅ Detected reply to message');
        
        const quoted = m.message.extendedTextMessage.contextInfo;
        
        // Get the sender of the quoted message
        if (quoted.participant) {
          targetJid = quoted.participant;
          targetName = quoted.pushName || 'User';
          console.log(`🎯 Target from reply: ${targetJid} (${targetName})`);
        } else {
          // If no participant, use the remoteJid (group chat)
          targetJid = quoted.remoteJid || jid;
          targetName = 'User';
          console.log(`🎯 Target from remoteJid: ${targetJid}`);
        }
      } 
      // CHECK 2: If no reply, use command sender
      else {
        targetJid = m.key.participant || jid;
        targetName = 'You';
        console.log(`🎯 Using sender as target: ${targetJid} (${targetName})`);
      }
      
      // Validate we have a target
      if (!targetJid) {
        return sock.sendMessage(jid, {
          text: `❌ *COULDN'T FIND USER!*\n\nReply to someone's message first.\n\n💡 Example: Reply to a message with \`${PREFIX}bf\``
        }, { quoted: m });
      }
      
      // Get phone number for display
      const targetNumber = targetJid.split('@')[0] || 'Unknown';
      
      // Check if name suggests female (for better context)
      const femaleNames = ['sarah', 'emma', 'sophia', 'olivia', 'ava', 'mia', 'charlotte', 'amelia', 'isabella', 'evelyn'];
      isFemale = femaleNames.some(name => targetName.toLowerCase().includes(name));
      
      console.log(`📋 Processing for: ${targetName} (${targetNumber}) - ${isFemale ? '♀️ Female' : '♂️ Male'}`);

      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // ====== GET PROFILE PICTURE ======
      let profilePicBuffer = null;
      let profilePicImage = null;
      
      try {
        // Get profile picture URL
        const profilePicUrl = await sock.profilePictureUrl(targetJid, 'image');
        
        if (!profilePicUrl) {
          throw new Error('No profile picture found');
        }
        
        console.log(`📸 Downloading profile picture...`);
        
        // Download the image
        const response = await axios.get(profilePicUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: {
            'User-Agent': 'WhatsApp-Bot/1.0'
          }
        });
        
        profilePicBuffer = Buffer.from(response.data);
        profilePicImage = await loadImage(profilePicBuffer);
        console.log(`✅ Profile picture downloaded: ${profilePicBuffer.length} bytes`);
        
      } catch (error) {
        console.log(`⚠️ Profile picture error: ${error.message}`);
        
        // Create simple avatar
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        
        // Draw background (pink for female, blue for male/neutral)
        const bgColor = isFemale ? '#FFB6C1' : '#87CEEB';
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
        const firstLetter = targetName.charAt(0).toUpperCase();
        ctx.fillText(firstLetter, 200, 200);
        
        profilePicBuffer = canvas.toBuffer();
        profilePicImage = await loadImage(profilePicBuffer);
      }
      
      // ====== GET RANDOM BOYFRIEND IMAGE ======
      let boyfriendImage = null;
      let boyfriendName = "";
      let boyfriendType = "";
      
      try {
        // Get random boyfriend image
        const result = await getRandomBoyfriendImage();
        boyfriendImage = result.image;
        boyfriendName = result.name;
        boyfriendType = result.type;
        
        console.log(`✅ Got boyfriend image: ${boyfriendName} (${boyfriendType})`);
        
      } catch (error) {
        console.error('Boyfriend image error:', error);
        
        // Create default boyfriend image
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(0, 0, 400, 400);
        
        // Draw face
        ctx.fillStyle = '#F5D0A9';
        ctx.beginPath();
        ctx.arc(200, 150, 80, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw hair
        ctx.fillStyle = '#2C3E50';
        ctx.beginPath();
        ctx.ellipse(200, 120, 100, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(170, 140, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(230, 140, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw smile
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(160, 180);
        ctx.quadraticCurveTo(200, 220, 240, 180);
        ctx.stroke();
        
        // Draw tie
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.moveTo(200, 240);
        ctx.lineTo(180, 280);
        ctx.lineTo(220, 280);
        ctx.closePath();
        ctx.fill();
        
        boyfriendImage = await loadImage(canvas.toBuffer());
        boyfriendName = "AI Boyfriend";
        boyfriendType = "Handsome";
      }
      
      // ====== CREATE COUPLE PICTURE ======
      let finalImageBuffer;
      
      try {
        // Create couple picture
        finalImageBuffer = await createCouplePicture(
          profilePicImage, 
          boyfriendImage, 
          targetName, 
          boyfriendName,
          isFemale ? '👩' : '👤'
        );
        console.log(`✅ Couple picture created successfully`);
        
      } catch (error) {
        console.error('Couple picture error:', error);
        // Fallback to simple overlay
        finalImageBuffer = await simpleOverlay(profilePicImage, boyfriendImage, isFemale);
      }
      
      // ====== SEND FINAL IMAGE ======
      // Generate random boyfriend personality
      const personalities = [
        "The Handsome Protector 🛡️",
        "The Romantic Gentleman 💐",
        "The Cool Boyfriend 😎",
        "The Strong & Caring 💪",
        "The Smart & Successful 🧠💼",
        "The Loyal Partner 🤝",
        "The Charming Prince 🤴",
        "The Athletic Hunk 🏋️"
      ];
      
      const loveQuotes = [
        "You found your perfect match! 💘",
        "Love is in the air! 💕",
        "A match made in heaven! ✨",
        "Your soulmate has arrived! 💑",
        "Destiny brought you together! 🌟",
        "True love detected! 💖",
        "He's the one for you! 👑"
      ];
      
      const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
      const randomQuote = loveQuotes[Math.floor(Math.random() * loveQuotes.length)];
      
      // Determine relationship term
      const relationshipTerm = isFemale ? "Girlfriend" : "Partner";
      
      // Send the final image with reply
      await sock.sendMessage(jid, {
        image: finalImageBuffer,
        caption: `💙 *BOYFRIEND PROFILE CREATED!*\n\n` +
                `${isFemale ? '👩' : '👤'} *${relationshipTerm}:* ${targetName}\n` +
                `🤵 *Boyfriend:* ${boyfriendName}\n` +
                `🌟 *Type:* ${randomPersonality}\n` +
                `🏷️ *Style:* ${boyfriendType}\n\n` +
                `💕 ${randomQuote}\n` +
                `✨ Use \`${PREFIX}bf\` to find more boyfriends!`,
        quoted: m
      });
      
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [BF] ERROR:', error);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Failed: ${error.message}`
      }, { quoted: m });
    }
  }
};

// ====== HELPER FUNCTIONS ======

async function getRandomBoyfriendImage() {
  // List of handsome men images from Unsplash
  const boyfriendImages = [
    {
      name: "James",
      type: "Professional",
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Michael",
      type: "Casual",
      url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "David",
      type: "Formal",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Robert",
      type: "Athletic",
      url: "https://images.unsplash.com/photo-1528892952291-009c663ce843?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "William",
      type: "Stylish",
      url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Richard",
      type: "Business",
      url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Joseph",
      type: "Cool",
      url: "https://images.unsplash.com/photo-1514222709107-a180c68d72b4?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Thomas",
      type: "Charming",
      url: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Charles",
      type: "Classic",
      url: "https://images.unsplash.com/photo-1507591064344-4c6ce005-128?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Christopher",
      type: "Trendy",
      url: "https://images.unsplash.com/photo-1517423568366-8b83523034fd?w=400&h=400&fit=crop&crop=face"
    }
  ];
  
  // Pick random boyfriend
  const randomGuy = boyfriendImages[Math.floor(Math.random() * boyfriendImages.length)];
  
  try {
    // Download the image
    const response = await axios.get(randomGuy.url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'WhatsApp-Bot/1.0'
      }
    });
    
    const buffer = Buffer.from(response.data);
    
    // Create circular image
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext('2d');
    
    // Create clipping path for circle
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // Draw the image
    ctx.drawImage(await loadImage(buffer), 0, 0, 400, 400);
    
    return {
      name: randomGuy.name,
      type: randomGuy.type,
      image: await loadImage(canvas.toBuffer())
    };
    
  } catch (error) {
    console.error('Error downloading boyfriend image:', error);
    throw error;
  }
}

async function createCouplePicture(userImage, boyfriendImage, userName, boyfriendName, userEmoji = '👤') {
  const canvas = createCanvas(700, 450);
  const ctx = canvas.getContext('2d');
  
  // Create masculine gradient background
  const gradient = ctx.createLinearGradient(0, 0, 700, 450);
  gradient.addColorStop(0, '#4A90E2'); // Blue
  gradient.addColorStop(0.5, '#87CEEB'); // Light blue
  gradient.addColorStop(1, '#1E3A8A'); // Dark blue
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 700, 450);
  
  // Add subtle geometric pattern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 700;
    const y = Math.random() * 450;
    const size = Math.random() * 15 + 5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw user profile picture (circular)
  ctx.save();
  ctx.beginPath();
  ctx.arc(175, 175, 100, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(userImage, 75, 75, 200, 200);
  ctx.restore();
  
  // Add border to user picture
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(175, 175, 100, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw boyfriend picture (circular)
  ctx.save();
  ctx.beginPath();
  ctx.arc(525, 175, 100, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(boyfriendImage, 425, 75, 200, 200);
  ctx.restore();
  
  // Add border to boyfriend picture
  ctx.beginPath();
  ctx.arc(525, 175, 100, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw heart between them
  drawHeart(ctx, 350, 175, 50, '#FF6B8B');
  
  // Draw plus sign with arrow (→❤️←)
  ctx.fillStyle = 'white';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('→', 300, 185);
  ctx.fillText('❤️', 350, 195);
  ctx.fillText('←', 400, 185);
  
  // Draw names with emojis
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.fillText(`${userEmoji} ${userName}`, 175, 320);
  ctx.fillText(`🤵 ${boyfriendName}`, 525, 320);
  ctx.shadowBlur = 0;
  
  // Draw main title with masculine theme
  ctx.fillStyle = '#FFD700'; // Gold color
  ctx.font = 'bold 32px Arial';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 3;
  ctx.fillText('💙 PERFECT COUPLE 💙', 350, 390);
  ctx.shadowBlur = 0;
  
  // Add decorative corners
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 4;
  
  // Draw corner lines
  drawCorner(ctx, 50, 50, 30);
  drawCorner(ctx, 650, 50, 30);
  drawCorner(ctx, 50, 400, 30);
  drawCorner(ctx, 650, 400, 30);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.95 });
}

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  
  ctx.fillStyle = color;
  ctx.beginPath();
  
  // Top left curve
  ctx.moveTo(0, size / 4);
  ctx.bezierCurveTo(
    -size / 2, -size / 3,
    -size, size / 3,
    0, size
  );
  
  // Top right curve
  ctx.bezierCurveTo(
    size, size / 3,
    size / 2, -size / 3,
    0, size / 4
  );
  
  ctx.closePath();
  ctx.fill();
  
  // Add shine effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(-size/6, -size/4, size/8, size/6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawCorner(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - size, y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - size, y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
}

async function simpleOverlay(userImage, boyfriendImage, isFemale = false) {
  const canvas = createCanvas(600, 350);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 600, 350);
  if (isFemale) {
    gradient.addColorStop(0, '#FFB6C1');
    gradient.addColorStop(1, '#87CEEB');
  } else {
    gradient.addColorStop(0, '#4A90E2');
    gradient.addColorStop(1, '#1E3A8A');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 350);
  
  // Draw user picture
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 150, 80, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(userImage, 70, 70, 160, 160);
  ctx.restore();
  
  // Draw boyfriend picture
  ctx.save();
  ctx.beginPath();
  ctx.arc(450, 125, 70, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(boyfriendImage, 380, 55, 140, 140);
  ctx.restore();
  
  // Draw title
  ctx.fillStyle = 'white';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🤵 Boyfriend Added! 💙', 300, 300);
  
  // Draw arrow
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(250, 150);
  ctx.lineTo(380, 125);
  ctx.stroke();
  
  // Draw arrowhead
  ctx.beginPath();
  ctx.moveTo(380, 125);
  ctx.lineTo(370, 115);
  ctx.lineTo(370, 135);
  ctx.closePath();
  ctx.fillStyle = 'white';
  ctx.fill();
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}