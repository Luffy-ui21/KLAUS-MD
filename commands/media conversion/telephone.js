import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'telephone',
  alias: ['phone', 'call'],
  description: 'Phone call audio effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'telephone'); }
};
