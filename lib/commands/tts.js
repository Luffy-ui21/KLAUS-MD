/**
 * .tts — Text to speech with multiple fallback sources
 *
 * Usage:
 *   .tts Hello how are you
 *   .tts fr Bonjour comment ça va    (French)
 *   .tts sw Habari yako               (Swahili)
 *
 * Voice notes are sent as proper audio (ptt: true = voice note).
 */

const axios = require('axios');

module.exports = {
  name: 'tts',
  aliases: ['speak', 'voice', 'say'],
  desc: 'Convert text to speech audio (voice note)',
  category: 'media',
  async execute({ sock, msg, args, from, reply }) {
    // Allow optional language code: .tts fr Bonjour
    let lang = 'en';
    let text = args.join(' ');
    if (args.length > 1 && /^[a-z]{2}$/i.test(args[0])) {
      lang = args[0].toLowerCase();
      text = args.slice(1).join(' ');
    }
    if (!text) return reply('❌ Provide text.\nUsage: `.tts Hello how are you`\nOptional lang: `.tts fr Bonjour`');
    if (text.length > 500) return reply('❌ Text too long (max 500 chars)');

    await reply('⏳ Generating audio...');

    let audioBuffer = null;
    let source = '';

    // Method 1: Google Translate TTS (most reliable)
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
          'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
        },
        maxRedirects: 5,
      });

      if (res.data && res.status === 200) {
        audioBuffer = Buffer.from(res.data);
        if (audioBuffer.length > 1000) {  // sanity check
          source = 'Google Translate';
        } else {
          audioBuffer = null;
        }
      }
    } catch (e) {
      console.warn('[TTS] Google failed:', e.message);
    }

    // Method 2: VoiceRSS (free, no key for some endpoints)
    if (!audioBuffer) {
      try {
        const url = `https://api.voicerss.org/?key=0&hl=${lang}&src=${encodeURIComponent(text)}&c=MP3&f=48khz_16bit_mono`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        if (res.data) {
          audioBuffer = Buffer.from(res.data);
          if (audioBuffer.length > 1000) source = 'VoiceRSS';
          else audioBuffer = null;
        }
      } catch (e) {
        console.warn('[TTS] VoiceRSS failed:', e.message);
      }
    }

    // Method 3: StreamElements TTS (used by many bots — very reliable)
    if (!audioBuffer) {
      try {
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        if (res.data && res.status === 200) {
          audioBuffer = Buffer.from(res.data);
          if (audioBuffer.length > 1000) source = 'StreamElements';
          else audioBuffer = null;
        }
      } catch (e) {
        console.warn('[TTS] StreamElements failed:', e.message);
      }
    }

    if (!audioBuffer || audioBuffer.length < 1000) {
      return reply(
        `❌ All TTS services failed to generate audio.\n\n` +
        `_This usually happens when:\n` +
        `• Google blocks the request (rate limit)\n` +
        `• The text contains special characters\n` +
        `• Network issue\n\n` +
        `Please try again in a moment._`
      );
    }

    try {
      await sock.sendMessage(from, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: true,  // voice note format
        fileName: `tts-${Date.now()}.mp3`,
      }, { quoted: msg });

      await reply(
        `✅ *Voice note sent!*\n\n` +
        `📝 *Text:* ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}\n` +
        `🌐 *Language:* ${lang}\n` +
        `🔧 *Source:* ${source}\n` +
        `💾 *Size:* ${(audioBuffer.length / 1024).toFixed(1)} KB`
      );
    } catch (e) {
      console.error('[TTS] Send failed:', e);
      await reply(`❌ Audio generated but failed to send: ${e.message}`);
    }
  },
};
