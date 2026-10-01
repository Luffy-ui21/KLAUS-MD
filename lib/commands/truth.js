/** .truth / .dare — Truth or dare */
const truths = [
  'What is your biggest fear?', 'Have you ever lied to your best friend?',
  'What\'s the most embarrassing thing you\'ve ever done?', 'Who is your secret crush?',
  'Have you ever cheated on a test?', 'What\'s the worst gift you\'ve ever received?',
  'Have you ever pretended to be sick to skip school/work?', 'What\'s your biggest regret?',
  'If you could swap lives with anyone for a day, who would it be?', 'What\'s your weirdest habit?',
];
const dares = [
  'Send a voice note singing a song.', 'Send your last selfie.',
  'Tell a joke right now.', 'Compliment the person who sent this message.',
  'Send a sticker of the first thing that comes to your mind.', 'Speak in a funny voice for the next 5 messages.',
  'Send your most-used emoji.', 'Describe yourself in 3 words.',
  'Send a screenshot of your home screen.', 'Pretend to be a robot for the next 5 minutes.',
];

module.exports = {
  name: 'truth',
  aliases: ['truth'],
  desc: 'Get a truth question',
  category: 'fun',
  async execute({ reply }) {
    await reply(`💭 *Truth:*\n\n${truths[Math.floor(Math.random() * truths.length)]}`);
  },
};

module.exports.dare = {
  name: 'dare',
  aliases: ['dare'],
  desc: 'Get a dare challenge',
  category: 'fun',
  async execute({ reply }) {
    await reply(`🎯 *Dare:*\n\n${dares[Math.floor(Math.random() * dares.length)]}`);
  },
};
