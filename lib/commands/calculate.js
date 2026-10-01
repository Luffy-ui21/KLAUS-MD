/** .calculate — Math calculator */
module.exports = {
  name: 'calculate',
  aliases: ['calc', 'math', 'c'],
  desc: 'Calculate a math expression',
  category: 'tools',
  async execute({ args, reply }) {
    const expr = args.join(' ').trim();
    if (!expr) return reply('❌ Provide an expression.\nUsage: `.calc 2 + 2 * 3`');

    // Safety: only allow digits, operators, parentheses, decimal point, space
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return reply('❌ Only digits and + - * / ( ) . are allowed.');
    }
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return reply('❌ Invalid expression.');
      }
      await reply(`🧮 *${expr} = ${result}*`);
    } catch (e) {
      await reply(`❌ Invalid math expression: ${e.message}`);
    }
  },
};
