import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'underwater',
  alias: ['submerged'],
  description: 'Underwater muffled effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'underwater'); }
};
