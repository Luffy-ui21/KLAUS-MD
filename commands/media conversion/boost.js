import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'boost',
  alias: ['louder'],
  description: 'Increase overall volume',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'boost'); }
};
