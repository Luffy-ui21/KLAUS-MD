/** .coinflip — Flip a coin */
module.exports = {
  name: 'coinflip',
  aliases: ['flip', 'coin'],
  desc: 'Flip a coin',
  category: 'fun',
  async execute({ reply }) {
    const result = Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙';
    await reply(`🪙 *Coin Flip Result: ${result}*`);
  },
};
