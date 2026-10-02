import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'superboost',
  alias: ['maxboost'],
  description: 'Maximum volume & bass boost',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'superboost'); }
};
