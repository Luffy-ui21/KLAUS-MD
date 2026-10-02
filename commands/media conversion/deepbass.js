import { applyAudioEffect } from '../../lib/audioEffects.js';
export default {
  name: 'deepbass',
  alias: ['subbass'],
  description: 'Deep sub-bass boost',
  category: 'audio',
  async execute(sock, m, args) { await applyAudioEffect(sock, m, 'deepbass'); }
};
