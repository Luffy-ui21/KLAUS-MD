import { downloadContentFromMessage } from 'wolfsocket';
let sharp = null;
import('sharp').then(m => { sharp = m.default; }).catch(() => {});
import fs from 'fs';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
  name: 'toimage',
  description: 'Convert sticker to image using sharp',
  category: 'converter',

  async execute(sock, m, args) {
    console.log('🖼️ [TOIMAGE] Command triggered');
    
    const jid = m.key.remoteJid;
    const prefix = '#';
    
    if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
      await sock.sendMessage(jid, { 
        text: `╭─⌈ 🖼️ *STICKER TO IMAGE* ⌋\n│\n├─⊷ *${prefix}toimage*\n│  └⊷ Reply to a sticker to convert it to image\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}` 
      }, { quoted: m });
      return;
    }

    const quoted = m.message.extendedTextMessage.contextInfo;
    
    await sock.sendMessage(jid, { 
      text: `⏳ *Converting sticker to image...*` 
    }, { quoted: m });

    try {
      console.log(`🖼️ [TOIMAGE] Downloading sticker...`);
      
      const stream = await downloadContentFromMessage(
        quoted.quotedMessage.stickerMessage, 
        'sticker'
      );
      
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      console.log(`🖼️ [TOIMAGE] Sticker size: ${buffer.length} bytes`);
      
      const isAnimated = buffer.toString('hex').includes('414e494d') ||
                         buffer.includes('ANMF');
      
      if (isAnimated) {
        throw new Error('Animated stickers cannot be converted to static images');
      }

      if (!sharp) throw new Error('sharp module not available on this platform');
      console.log(`🖼️ [TOIMAGE] Converting with sharp...`);
      
      const imageBuffer = await sharp(buffer)
        .png()
        .toBuffer();
      
      const fileSizeKB = (imageBuffer.length / 1024).toFixed(1);
      console.log(`✅ [TOIMAGE] Conversion complete: ${fileSizeKB}KB`);
      
      await sock.sendMessage(jid, {
        image: imageBuffer,
        caption: `╭⌈ 🖼️ *STICKER TO IMAGE* ⌋\n├⊷ 📦 *Size:* ${fileSizeKB}KB\n╰⊷ 🎨 *Format:* PNG\n> _Converted by ${getBotName()}_`
      }, { quoted: m });
      
      console.log(`✅ [TOIMAGE] Image sent successfully`);

    } catch (error) {
      console.error('❌ [TOIMAGE] Error:', error);
      
      let errorMsg = `❌ *Conversion failed*\n\n⚠️ *Error:* ${error.message}`;
      
      if (error.message.includes('sharp') || error.message.includes('libvips')) {
        errorMsg += "\n• Sharp library issue";
        errorMsg += "\n• Install: `npm install sharp`";
      } else if (error.message.includes('Animated')) {
        errorMsg += "\n• Animated stickers cannot be converted";
        errorMsg += "\n• Use static stickers only";
      }
      
      errorMsg += "\n\n💡 *Tips:*\n• Use static stickers (not animated)\n• Make sure sticker is not corrupted";
      
      await sock.sendMessage(jid, { 
        text: errorMsg
      }, { quoted: m });
    }
  }
};
