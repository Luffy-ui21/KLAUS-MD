import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'treble',
  alias: ['highfreq'],
  description: 'Boost treble/high frequencies',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'treble'); }
};
