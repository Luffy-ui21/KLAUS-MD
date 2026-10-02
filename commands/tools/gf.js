import axios from 'axios';
import { createCanvas, loadImage, Image } from '../../lib/canvasWrapper.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'gf',
  description: 'Add girlfriend overlay to profile picture',
  category: 'fun',
  aliases: ['girlfriend', 'couplepic', 'love'],
  usage: 'gf (reply to any message)',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    
    // ====== SHOW HELP IF NO ARGS AND NO REPLY ======
    const hasReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (args.length === 0 && !hasReply) {
      const helpText = `╭─⌈ 💑 *GIRLFRIEND PROFILE* ⌋\n│\n├─⊷ *${PREFIX}gf*\n│  └⊷ Reply to any message to get girlfriend profile pic\n│\n├─⊷ *Aliases:* girlfriend, couple\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    if (args[0]?.toLowerCase() === 'help') {
      const helpText = `╭─⌈ 💑 *GIRLFRIEND PROFILE* ⌋\n│\n├─⊷ *${PREFIX}gf*\n│  └⊷ Reply to any message to create couple picture\n│\n├─⊷ *Aliases:* girlfriend, couple\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    try {
      // ====== DETERMINE TARGET USER ======
      let targetJid = null;
      let targetName = 'User';
      
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
          text: `❌ *COULDN'T FIND USER!*\n\nReply to someone's message first.\n\n💡 Example: Reply to a message with \`${PREFIX}gf\``
        }, { quoted: m });
      }
      
      // Get phone number for display
      const targetNumber = targetJid.split('@')[0] || 'Unknown';
      
      console.log(`📋 Processing for: ${targetName} (${targetNumber})`);

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
        
        // Draw background
        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(0, 0, 400, 400);
        
        // Draw circle
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(200, 200, 150, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw initial
        ctx.fillStyle = '#4A90E2';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const firstLetter = targetName.charAt(0).toUpperCase();
        ctx.fillText(firstLetter, 200, 200);
        
        profilePicBuffer = canvas.toBuffer();
        profilePicImage = await loadImage(profilePicBuffer);
      }
      
      // ====== GET RANDOM GIRL IMAGE ======
      let girlfriendImage = null;
      let girlfriendName = "";
      
      try {
        // Get random girlfriend image
        const result = await getRandomGirlImage();
        girlfriendImage = result.image;
        girlfriendName = result.name;
        
        console.log(`✅ Got girlfriend image: ${girlfriendName}`);
        
      } catch (error) {
        console.error('Girlfriend image error:', error);
        
        // Create default girlfriend image
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = '#FFB6C1';
        ctx.fillRect(0, 0, 400, 400);
        
        // Draw face
        ctx.fillStyle = '#FFD1DC';
        ctx.beginPath();
        ctx.arc(200, 150, 80, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw hair
        ctx.fillStyle = '#8B4513';
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
        
        // Draw heart
        ctx.fillStyle = '#FF6B8B';
        ctx.beginPath();
        ctx.moveTo(200, 250);
        ctx.bezierCurveTo(180, 280, 150, 300, 200, 340);
        ctx.bezierCurveTo(250, 300, 220, 280, 200, 250);
        ctx.closePath();
        ctx.fill();
        
        girlfriendImage = await loadImage(canvas.toBuffer());
        girlfriendName = "AI Girlfriend";
      }
      
      // ====== CREATE COUPLE PICTURE ======
      let finalImageBuffer;
      
      try {
        // Create couple picture
        finalImageBuffer = await createCouplePicture(profilePicImage, girlfriendImage, targetName, girlfriendName);
        console.log(`✅ Couple picture created successfully`);
        
      } catch (error) {
        console.error('Couple picture error:', error);
        // Fallback to simple overlay
        finalImageBuffer = await simpleOverlay(profilePicImage, girlfriendImage);
      }
      
      // ====== SEND FINAL IMAGE ======
      // Generate random girlfriend personality
      const personalities = [
        "The Sweet Romantic ❤️",
        "The Cool Girlfriend 😎",
        "The Caring Partner 🥰",
        "The Fun-loving Girl 💃",
        "The Smart & Beautiful 🧠💖",
        "The Loyal Companion 🤝"
      ];
      
      const loveQuotes = [
        "You found your perfect match! 💘",
        "Love is in the air! 💕",
        "A match made in heaven! ✨",
        "Your soulmate has arrived! 💑",
        "Destiny brought you together! 🌟"
      ];
      
      const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
      const randomQuote = loveQuotes[Math.floor(Math.random() * loveQuotes.length)];
      
      // Send the final image with reply
      await sock.sendMessage(jid, {
        image: finalImageBuffer,
        caption: `💑 *GIRLFRIEND PROFILE CREATED!*\n\n` +
                `👤 *Boyfriend:* ${targetName}\n` +
                `👩 *Girlfriend:* ${girlfriendName}\n` +
                `🌟 *Type:* ${randomPersonality}\n\n` +
                `💕 ${randomQuote}\n` +
                `✨ Use \`${PREFIX}gf\` to find more girlfriends!`,
        quoted: m
      });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
      console.error('❌ [GF] ERROR:', error);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `❌ Failed: ${error.message}`
      }, { quoted: m });
    }
  },
};

// ====== HELPER FUNCTIONS ======

async function getRandomGirlImage() {
  // List of free-to-use girl images from Unsplash (using direct image URLs)
  const girlImages = [
    {
      name: "Emma",
      url: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Sophia",
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Olivia",
      url: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Ava",
      url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Isabella",
      url: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400&h=400&fit=crop&crop=face"
    },
    {
      name: "Mia",
      url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face"
    }
  ];
  
  // Pick random girl
  const randomGirl = girlImages[Math.floor(Math.random() * girlImages.length)];
  
  try {
    // Download the image
    const response = await axios.get(randomGirl.url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'WhatsApp-Bot/1.0'
      }
    });
    
    const buffer = Buffer.from(response.data);
    const image = await loadImage(buffer);
    
    // Create circular image
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext('2d');
    
    // Create clipping path for circle
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // Draw the image
    ctx.drawImage(image, 0, 0, 400, 400);
    
    return {
      name: randomGirl.name,
      image: await loadImage(canvas.toBuffer())
    };
    
  } catch (error) {
    console.error('Error downloading girl image:', error);
    throw error;
  }
}

async function createCouplePicture(profileImage, girlfriendImage, boyName, girlName) {
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, '#FFB6C1'); // Pink
  gradient.addColorStop(1, '#87CEEB'); // Blue
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 400);
  
  // Draw profile picture (left side)
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 150, 100, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(profileImage, 50, 50, 200, 200);
  ctx.restore();
  
  // Draw girlfriend picture (right side)
  ctx.save();
  ctx.beginPath();
  ctx.arc(450, 150, 90, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(girlfriendImage, 360, 60, 180, 180);
  ctx.restore();
  
  // Draw heart between them
  drawHeart(ctx, 300, 150, 40, '#FF6B8B');
  
  // Draw plus sign
  ctx.fillStyle = 'white';
  ctx.fillRect(295, 145, 10, 30);
  ctx.fillRect(285, 155, 30, 10);
  
  // Draw boy name
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(boyName, 150, 280);
  
  // Draw girl name
  ctx.fillText(girlName, 450, 280);
  
  // Draw title
  ctx.fillStyle = '#FF1493';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('💑 Perfect Couple 💑', 300, 350);
  
  // Add decorative border
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 590, 390);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
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
  
  ctx.restore();
}

async function simpleOverlay(profileImage, girlfriendImage) {
  const canvas = createCanvas(600, 300);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 600, 300);
  gradient.addColorStop(0, '#87CEEB');
  gradient.addColorStop(1, '#FFB6C1');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 300);
  
  // Draw profile picture
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 150, 100, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(profileImage, 50, 50, 200, 200);
  ctx.restore();
  
  // Draw girlfriend picture
  ctx.save();
  ctx.beginPath();
  ctx.arc(450, 125, 80, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(girlfriendImage, 370, 45, 160, 160);
  ctx.restore();
  
  // Draw title
  ctx.fillStyle = 'white';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('💕 Girlfriend Added! 💕', 300, 250);
  
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}