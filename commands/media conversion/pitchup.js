import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'pitchup',
  alias: ['highpitch'],
  description: 'Raise audio pitch',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'pitchup'); }
};
