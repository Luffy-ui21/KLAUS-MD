import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'demon',
  alias: ['devil', 'satan'],
  description: 'Deep demonic voice',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'demon'); }
};
