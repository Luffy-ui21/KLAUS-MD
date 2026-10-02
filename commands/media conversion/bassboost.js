import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'bassboost',
  alias: ['heavybass'],
  description: 'Heavy bass frequency boost',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'bassboost'); }
};
