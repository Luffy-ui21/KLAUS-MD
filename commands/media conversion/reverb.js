import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'reverb',
  alias: ['hall'],
  description: 'Add reverb/hall effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'reverb'); }
};
