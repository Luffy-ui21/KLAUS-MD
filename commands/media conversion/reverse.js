import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'reverse',
  alias: ['backwards'],
  description: 'Reverse the audio',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'reverse'); }
};
