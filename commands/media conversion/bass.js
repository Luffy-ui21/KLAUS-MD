import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'bass',
  alias: ['bassup'],
  description: 'Boost bass frequencies',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'bass'); }
};
