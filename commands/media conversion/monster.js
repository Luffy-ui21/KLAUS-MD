import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'monster',
  alias: ['ogre'],
  description: 'Deep monster voice',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'monster'); }
};
