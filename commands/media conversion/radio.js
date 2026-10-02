import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'radio',
  alias: ['fm'],
  description: 'Old radio/AM effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'radio'); }
};
