import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'nightcore',
  alias: ['nc'],
  description: 'Nightcore effect (pitched up + fast)',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'nightcore'); }
};
