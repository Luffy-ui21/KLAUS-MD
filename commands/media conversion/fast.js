import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'fast',
  alias: ['2x', 'doublespeed'],
  description: 'Double speed audio',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'fast'); }
};
