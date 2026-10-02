import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'baby',
  alias: ['chipmunk'],
  description: 'High-pitched baby/chipmunk voice',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'baby'); }
};
