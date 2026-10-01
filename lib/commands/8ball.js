/** .8ball — Magic 8 ball */
const answers = [
  'Yes, definitely.', 'Without a doubt.', 'You may rely on it.', 'Yes.', 'Most likely.', 'Outlook good.',
  'Signs point to yes.', 'Reply hazy try again.', 'Ask again later.', 'Cannot predict now.',
  "Don't count on it.", 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.',
];

module.exports = {
  name: '8ball',
  aliases: ['8b', 'magicball', 'ask'],
  desc: 'Ask the magic 8-ball a question',
  category: 'fun',
  async execute({ args, reply }) {
    const question = args.join(' ');
    if (!question) return reply('🎱 Ask a question.\nUsage: `.8ball Will I be rich?`');
    const answer = answers[Math.floor(Math.random() * answers.length)];
    await reply(`🎱 *Magic 8-Ball*\n\n❓ ${question}\n\n🔮 ${answer}`);
  },
};
