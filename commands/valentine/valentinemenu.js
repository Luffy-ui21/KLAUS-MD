import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: 'valentinemenu',
  alias: ['vmenu', 'lovemenu'],
  category: 'valentine',
  description: 'Show all Valentine\'s Day commands',

  async execute(sock, msg, args, PREFIX) {
    const chatId = msg.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *💕 VALENTINE'S DAY*
│
│  • rosevine
│  • loveletter
│  • lovelock
│  • weddingday
│  • brooches
│  • valentine
│
╰─⊷`;

    await sendSubMenu(sock, chatId, '💕 Valentine Menu', commandsText, msg, PREFIX);
  }
};
