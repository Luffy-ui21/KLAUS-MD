import { downloadContentFromMessage, getContentType } from 'wolfsocket';
import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import FFMPEG from './ffmpegPath.js';

const execFileAsync = promisify(execFile);

export const AUDIO_EFFECTS = {
  bass: {
    name: 'bass',
    alias: ['bassup'],
    emoji: '🔊',
    title: 'BASS BOOST',
    desc: 'Boost bass frequencies',
    filter: 'bass=g=10:f=100:w=200'
  },
  bassboost: {
    name: 'bassboost',
    alias: ['heavybass'],
    emoji: '🔊',
    title: 'HEAVY BASS BOOST',
    desc: 'Heavy bass frequency boost',
    filter: 'bass=g=15:f=80:w=200'
  },
  deepbass: {
    name: 'deepbass',
    alias: ['subbass'],
    emoji: '🔊',
    title: 'DEEP BASS',
    desc: 'Deep sub-bass boost',
    filter: 'bass=g=20:f=50:w=100'
  },
  boost: {
    name: 'boost',
    alias: ['louder'],
    emoji: '🔈',
    title: 'VOLUME BOOST',
    desc: 'Increase overall volume',
    filter: 'volume=2.0'
  },
  superboost: {
    name: 'superboost',
    alias: ['maxboost'],
    emoji: '🔈',
    title: 'SUPER BOOST',
    desc: 'Maximum volume & bass boost',
    filter: 'volume=2.0,equalizer=f=100:width_type=h:width=200:g=10'
  },
  treble: {
    name: 'treble',
    alias: ['highfreq'],
    emoji: '🎵',
    title: 'TREBLE BOOST',
    desc: 'Boost treble/high frequencies',
    filter: 'treble=g=10:f=4000:w=2000'
  },
  vocalboost: {
    name: 'vocalboost',
    alias: ['vocals'],
    emoji: '🎤',
    title: 'VOCAL BOOST',
    desc: 'Enhance vocal frequencies',
    filter: 'equalizer=f=3000:width_type=h:width=2000:g=8'
  },
  speed: {
    name: 'speed',
    alias: ['speedup'],
    emoji: '⏩',
    title: 'SPEED UP',
    desc: 'Speed up audio 1.5x',
    filter: 'atempo=1.5,volume=1.2'
  },
  slow: {
    name: 'slow',
    alias: ['slowdown', 'slowmo'],
    emoji: '🐌',
    title: 'SLOW DOWN',
    desc: 'Slow down audio 0.75x',
    filter: 'atempo=0.75'
  },
  fast: {
    name: 'fast',
    alias: ['2x', 'doublespeed'],
    emoji: '⚡',
    title: 'FAST (2X)',
    desc: 'Double speed audio',
    filter: 'atempo=2.0'
  },
  nightcore: {
    name: 'nightcore',
    alias: ['nc'],
    emoji: '🌙',
    title: 'NIGHTCORE',
    desc: 'Nightcore effect (pitched up + fast)',
    filter: 'asetrate=44100*1.25,aresample=44100,atempo=1.0'
  },
  pitchup: {
    name: 'pitchup',
    alias: ['highpitch'],
    emoji: '⬆️',
    title: 'PITCH UP',
    desc: 'Raise audio pitch',
    filter: 'asetrate=44100*1.3,aresample=44100,atempo=0.77'
  },
  pitchdown: {
    name: 'pitchdown',
    alias: ['lowpitch'],
    emoji: '⬇️',
    title: 'PITCH DOWN',
    desc: 'Lower audio pitch',
    filter: 'asetrate=44100*0.75,aresample=44100,atempo=1.33'
  },
  echo: {
    name: 'echo',
    alias: ['echoeffect'],
    emoji: '🔁',
    title: 'ECHO',
    desc: 'Add echo effect',
    filter: 'aecho=0.8:0.88:60:0.4'
  },
  reverb: {
    name: 'reverb',
    alias: ['hall'],
    emoji: '🏛️',
    title: 'REVERB',
    desc: 'Add reverb/hall effect',
    filter: 'aecho=0.8:0.9:1000|500|250:0.3|0.2|0.1'
  },
  reverse: {
    name: 'reverse',
    alias: ['backwards'],
    emoji: '⏪',
    title: 'REVERSE',
    desc: 'Reverse the audio',
    filter: 'areverse'
  },
  robot: {
    name: 'robot',
    alias: ['robotic'],
    emoji: '🤖',
    title: 'ROBOT',
    desc: 'Robotic voice effect',
    filter: 'afftfilt=real=\'hypot(re\\,im)*sin(0)\':imag=\'hypot(re\\,im)*cos(0)\':win_size=512:overlap=0.75'
  },
  '8d': {
    name: '8d',
    alias: ['8daudio', 'surround'],
    emoji: '🎧',
    title: '8D AUDIO',
    desc: '8D surround sound effect',
    filter: 'aecho=0.8:0.88:6:0.4,apulsator=hz=0.125',
    stereo: true
  },
  karaoke: {
    name: 'karaoke',
    alias: ['novocal'],
    emoji: '🎤',
    title: 'KARAOKE',
    desc: 'Remove vocals (karaoke mode)',
    filter: 'pan=stereo|c0=c0-c1|c1=c1-c0',
    stereo: true
  },
  monster: {
    name: 'monster',
    alias: ['ogre'],
    emoji: '👹',
    title: 'MONSTER',
    desc: 'Deep monster voice',
    filter: 'asetrate=44100*0.7,aresample=44100,atempo=1.43'
  },
  baby: {
    name: 'baby',
    alias: ['chipmunk'],
    emoji: '👶',
    title: 'BABY VOICE',
    desc: 'High-pitched baby/chipmunk voice',
    filter: 'asetrate=44100*1.4,aresample=44100,atempo=0.71'
  },
  demon: {
    name: 'demon',
    alias: ['devil', 'satan'],
    emoji: '😈',
    title: 'DEMON',
    desc: 'Deep demonic voice',
    filter: 'asetrate=44100*0.6,aresample=44100,atempo=1.67'
  },
  radio: {
    name: 'radio',
    alias: ['fm'],
    emoji: '📻',
    title: 'RADIO',
    desc: 'Old radio/AM effect',
    filter: 'highpass=f=300,lowpass=f=3400,acrusher=bits=8:mix=0.5,volume=1.5'
  },
  telephone: {
    name: 'telephone',
    alias: ['phone', 'call'],
    emoji: '📞',
    title: 'TELEPHONE',
    desc: 'Phone call audio effect',
    filter: 'highpass=f=400,lowpass=f=3000,acrusher=bits=10:mix=0.3,volume=1.3'
  },
  underwater: {
    name: 'underwater',
    alias: ['submerged'],
    emoji: '🌊',
    title: 'UNDERWATER',
    desc: 'Underwater muffled effect',
    filter: 'lowpass=f=300,volume=0.7,aecho=0.8:0.7:20:0.5'
  }
};

export async function applyAudioEffect(sock, m, effectKey) {
  const jid = m.key.remoteJid;
  const effect = AUDIO_EFFECTS[effectKey];

  if (!effect) {
    await sock.sendMessage(jid, { text: '❌ Unknown audio effect.' }, { quoted: m });
    return;
  }

  const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  let audioMsg = null;
  let mediaType = null;

  if (quotedMsg) {
    const type = getContentType(quotedMsg);
    if (type === 'audioMessage') {
      audioMsg = quotedMsg.audioMessage;
      mediaType = 'audio';
    } else if (type === 'videoMessage') {
      audioMsg = quotedMsg.videoMessage;
      mediaType = 'video';
    } else if (type === 'documentMessage' && quotedMsg.documentMessage?.mimetype?.includes('audio')) {
      audioMsg = quotedMsg.documentMessage;
      mediaType = 'document';
    }
  } else if (m.message?.audioMessage) {
    audioMsg = m.message.audioMessage;
    mediaType = 'audio';
  }

  if (!audioMsg) {
    await sock.sendMessage(jid, {
      text: `╭⌈ ${effect.emoji} *${effect.title}* ⌋\n├⊷ Reply to an *audio* or *voice note*\n├⊷ to apply the ${effect.desc.toLowerCase()} effect\n╰⊷ _Use: ?${effect.name} [reply to audio]_`
    }, { quoted: m });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2);
  const inputRaw = `/tmp/wolfbot_fx_raw_${ts}_${rand}.ogg`;
  const inputPath = `/tmp/wolfbot_fx_in_${ts}_${rand}.wav`;
  const outputPath = `/tmp/wolfbot_fx_out_${ts}_${rand}.mp3`;

  try {
    const dlType = mediaType === 'document' ? 'document' : mediaType;
    const stream = await downloadContentFromMessage(audioMsg, dlType);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length < 100) {
      throw new Error('Audio file is too small or empty');
    }

    await fs.promises.writeFile(inputRaw, buffer);

    const decodeArgs = ['-i', inputRaw, '-ar', '44100'];
    if (effect.stereo) {
      decodeArgs.push('-ac', '2');
    }
    decodeArgs.push('-y', inputPath);
    await execFileAsync(FFMPEG, decodeArgs, { timeout: 30000 });

    const ffmpegArgs = [
      '-i', inputPath,
      '-af', effect.filter,
      '-c:a', 'libmp3lame',
      '-q:a', '4',
      '-y',
      outputPath
    ];

    await execFileAsync(FFMPEG, ffmpegArgs, { timeout: 60000 });

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg produced no output');
    }

    const outputBuffer = await fs.promises.readFile(outputPath);

    await sock.sendMessage(jid, {
      audio: outputBuffer,
      mimetype: 'audio/mpeg',
      fileName: `${effect.name}_wolfbot.mp3`
    }, { quoted: m });

    await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error(`❌ [${effect.name.toUpperCase()}] Error:`, error.message);

    let errorMsg = `❌ *${effect.title} failed*\n\n⚠️ ${error.message}`;
    if (error.message?.includes('timeout') || error.killed) {
      errorMsg = `❌ *Processing timed out*\n\n💡 The audio may be too long. Try a shorter clip.`;
    }

    await sock.sendMessage(jid, { text: errorMsg }, { quoted: m });
    await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
  } finally {
    try { if (fs.existsSync(inputRaw)) fs.unlinkSync(inputRaw); } catch {}
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
  }
}
