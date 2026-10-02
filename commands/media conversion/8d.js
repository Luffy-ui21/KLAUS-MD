import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: '8d',
  alias: ['8daudio', 'surround'],
  description: '8D surround sound effect',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, '8d'); }
};
