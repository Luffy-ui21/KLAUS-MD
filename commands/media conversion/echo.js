import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'echo',
  alias: ['echoeffect'],
  description: 'Add echo effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'echo'); }
};
