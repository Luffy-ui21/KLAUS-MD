import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'robot',
  alias: ['robotic'],
  description: 'Robotic voice effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'robot'); }
};
