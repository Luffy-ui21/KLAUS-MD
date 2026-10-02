import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'karaoke',
  alias: ['novocal', 'vocalremover', 'removevocal', 'removevocals', 'instrumental', 'novocals'],
  description: 'Remove vocals from a song (karaoke / instrumental)',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'karaoke'); }
};
