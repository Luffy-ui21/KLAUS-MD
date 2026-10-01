/** .dare — Dare command (separate file) */
const dares = [
  'Send a voice note singing a song.', 'Send your last selfie.',
  'Tell a joke right now.', 'Compliment the person who sent this message.',
  'Send a sticker of the first thing that comes to your mind.', 'Speak in a funny voice for the next 5 messages.',
  'Send your most-used emoji.', 'Describe yourself in 3 words.',
  'Send a screenshot of your home screen.', 'Pretend to be a robot for the next 5 minutes.',
];
module.exports = {
  name: 'dare',
  aliases: ['challenge'],
  desc: 'Get a dare challenge',
  category: 'fun',
  async execute({ reply }) {
    await reply(`🎯 *Dare:*\n\n${dares[Math.floor(Math.random() * dares.length)]}`);
  },
};
