import { EFFECTS, CATEGORY_META, getEffectsByCategory, getAllCategories } from './photofuniaUtils.js';
import { sendSubMenu } from '../../lib/menuHelper.js';

export default {
  name: 'photofunia',
  description: 'PhotoFunia effects menu - Browse all 154 effects',
  category: 'photofunia',
  alias: ['pf', 'pfx', 'pfmenu', 'pflist', 'photofuniamenu'],

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    if (args.length && CATEGORY_META[args[0].toLowerCase()]) {
      const cat = args[0].toLowerCase();
      const effects = getEffectsByCategory(cat);
      const meta = CATEGORY_META[cat];

      let list = '';
      for (const [key, eff] of effects) {
        const cmdName = key.replace(/-/g, '');
        const typeLabel = eff.type === 'image' ? '[img]' : eff.type === 'text' ? '[txt]' : '[both]';
        list += `│  • ${typeLabel} ${cmdName}\n`;
      }

      const commandsText = `╭─⊷ *${meta.emoji || '🎨'} ${meta.name.toUpperCase()} EFFECTS*
│
${list}│
╰─⊷

╭─⊷ *📋 LEGEND*
│
│  [img] Reply to image
│  [txt] Text input only
│  [both] Text + image
│  Usage: ${PREFIX}<command> [text]
│
╰─⊷`;

      return await sendSubMenu(sock, jid, `PhotoFunia ${meta.name}`, commandsText, m, PREFIX);
    }

    const cats = getAllCategories();
    const totalEffects = Object.keys(EFFECTS).length;
    const catOrder = Object.keys(CATEGORY_META);

    let fullList = '';
    for (const cat of catOrder) {
      const effects = cats[cat];
      if (!effects || effects.length === 0) continue;
      const meta = CATEGORY_META[cat];

      fullList += `╭─⊷ *${meta.emoji || '🎨'} ${meta.name.toUpperCase()} (${effects.length})*\n│\n`;
      for (const eff of effects) {
        const cmdName = eff.key.replace(/-/g, '');
        const typeLabel = eff.type === 'image' ? '[img]' : eff.type === 'text' ? '[txt]' : '[both]';
        fullList += `│  • ${typeLabel} ${cmdName}\n`;
      }
      fullList += `│\n╰─⊷\n\n`;
    }

    const commandsText = `╭─⊷ *📋 LEGEND*
│
│  [img] Reply to image
│  [txt] Text input only
│  [both] Text + image
│  Multi-text: use | to separate
│
╰─⊷

${fullList}
╭─⊷ *📋 EXAMPLES*
│
│  ${PREFIX}smokeflare (reply to img)
│  ${PREFIX}einstein Hello World
│  ${PREFIX}breakingnews CNN | Title | Info
│
╰─⊷`;

    await sendSubMenu(sock, jid, 'PhotoFunia Menu', commandsText, m, PREFIX);
  }
};
