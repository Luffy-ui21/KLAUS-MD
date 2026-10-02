import { EPHOTO_EFFECTS } from './ephotoUtils.js';
import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: 'ephotomenu',
  alias: ['ephoto', 'ephotolist', 'ephotoeffects', 'neonmenu'],
  description: 'Shows all available ephoto text effects',
  category: 'ephoto',
  ownerOnly: false,
  usage: 'ephotomenu',

  async execute(sock, msg, args, PREFIX) {
    const chatId = msg.key.remoteJid;
    const botName = getBotName();

    const neonEffects = [];
    const threeDEffects = [];

    for (const [key, effect] of Object.entries(EPHOTO_EFFECTS)) {
      if (effect.apiId) {
        threeDEffects.push(`│  • ${key}`);
      } else {
        neonEffects.push(`│  • ${key}`);
      }
    }

    const commandsText = `╭─⊷ *💡 NEON & GLOW (${neonEffects.length})*
│
${neonEffects.join('\n')}
│
╰─⊷

╭─⊷ *🧊 3D TEXT EFFECTS (${threeDEffects.length})*
│
${threeDEffects.join('\n')}
│
╰─⊷

╭─⊷ *📋 HOW TO USE*
│
│  Type: ${PREFIX}<effect> <your text>
│  Example: ${PREFIX}neon ${getBotName()}
│  Example: ${PREFIX}wooden3d MyName
│
╰─⊷`;

    await sendSubMenu(sock, chatId, 'Ephoto Menu', commandsText, msg, PREFIX);
  }
};
