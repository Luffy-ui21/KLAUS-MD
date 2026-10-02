import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'slow',
  alias: ['slowdown', 'slowmo'],
  description: 'Slow down audio 0.75x',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'slow'); }
};
