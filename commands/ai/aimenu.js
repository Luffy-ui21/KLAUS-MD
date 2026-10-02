import { sendSubMenu, getBotName } from '../../lib/menuHelper.js';

export default {
  name: 'aimenu',
  description: 'AI Commands Menu',
  category: 'ai',
  aliases: ['aihelp', 'ai-cmds'],

  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const botName = getBotName();

    const commandsText = `╭─⊷ *🔍 AI SCANNERS & ANALYZERS*
│
│  • aiscanner
│  • analyze
│  • removebg
│  • summarize
│  • vision
│  • visionpro
│
╰─⊷

╭─⊷ *🤖 MAJOR AI MODELS*
│
│  • bard
│  • bing
│  • blackbox
│  • chatgpt
│  • claudeai
│  • cohere
│  • copilot
│  • deepseek
│  • deepseekv4
│  • flux
│  • gemini
│  • gemma
│  • glm
│  • gpt
│  • grok
│  • groq
│  • ilama
│  • kimi
│  • metai
│  • mistral
│  • perplexity
│  • qwenai
│  • venice
│  • wormgpt
│
╰─⊷

╭─⊷ *🧠 OPEN SOURCE AI MODELS*
│
│  • chatglm
│  • codellama
│  • command
│  • dolphin
│  • falcon
│  • internlm
│  • mixtral
│  • nemotron
│  • neural
│  • nous
│  • openchat
│  • openhermes
│  • orca
│  • phi
│  • replitai
│  • solar
│  • starcoder
│  • tinyllama
│  • vicuna
│  • wizard
│  • yi
│  • zephyr
│
╰─⊷

╭─⊷ *🎨 AI IMAGE GENERATION*
│
│  • brandlogo
│  • companylogo
│  • logoai
│  • suno
│
╰─⊷

╭─⊷ *📝 WRITING & CONTENT*
│
│  • humanizer
│  • speechwriter
│
╰─⊷

╭─⊷ * WOLF AI ASSISTANT*
│
│  • wolf on/off — Toggle Wolf AI
│  • wolf status — Show Wolf AI stats
│  • wolf clear — Reset conversations
│  ───────────────
│  When active, just say "wolf"
│  followed by anything to chat!
│
╰─⊷`;

    await sendSubMenu(sock, jid, '🤖 AI MENU', commandsText, m, PREFIX);
  }
};
