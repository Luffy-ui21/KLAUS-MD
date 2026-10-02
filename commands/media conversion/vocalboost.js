import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'vocalboost',
  alias: ['vocals'],
  description: 'Enhance vocal frequencies',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'vocalboost'); }
};
