/** .dice — Roll a dice */
module.exports = {
  name: 'dice',
  aliases: ['roll', 'rolldice'],
  desc: 'Roll a 6-sided dice',
  category: 'fun',
  async execute({ args, reply }) {
    const sides = parseInt(args[0]) || 6;
    if (sides < 2 || sides > 1000) return reply('❌ Sides must be between 2 and 1000');
    const result = Math.floor(Math.random() * sides) + 1;
    await reply(`🎲 *Dice Roll (d${sides}): ${result}*`);
  },
};
