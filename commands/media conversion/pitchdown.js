import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'pitchdown',
  alias: ['lowpitch'],
  description: 'Lower audio pitch',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'pitchdown'); }
};
