import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'speed',
  alias: ['speedup'],
  description: 'Speed up audio 1.5x',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'speed'); }
};
