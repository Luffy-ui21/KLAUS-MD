import fs from 'fs';
import path from 'path';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const ROOT = process.cwd();

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

function countFiles(dir, ext = null) {
  try {
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        count += countFiles(path.join(dir, e.name), ext);
      } else if (!ext || e.name.endsWith(ext)) {
        count++;
      }
    }
    return count;
  } catch { return 0; }
}

function dirSize(dir) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) total += dirSize(full);
      else { try { total += fs.statSync(full).size; } catch {} }
    }
  } catch {}
  return total;
}

function listDir(dirPath, depth = 1, maxDepth = 2, prefix = '') {
  let result = '';
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => !['node_modules', '.git', 'session', 'data', '.local', 'tmp'].includes(e.name))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch { return result; }

  entries.forEach((e, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '╰─' : '├─';
    const childPrefix = prefix + (isLast ? '   ' : '│  ');
    const full = path.join(dirPath, e.name);

    if (e.isDirectory()) {
      const jsCount = countFiles(full, '.js');
      result += `${prefix}${connector} 📁 *${e.name}/* (${jsCount} files)\n`;
      if (depth < maxDepth) {
        result += listDir(full, depth + 1, maxDepth, childPrefix);
      }
    } else {
      let size = '';
      try { size = ' _' + formatSize(fs.statSync(full).size) + '_'; } catch {}
      const icon = e.name.endsWith('.js') ? '📄' : e.name.endsWith('.json') ? '📋' : e.name.endsWith('.md') ? '📝' : '📎';
      result += `${prefix}${connector} ${icon} ${e.name}${size}\n`;
    }
  });
  return result;
}

export default {
  name: 'ls',
  aliases: ['tree', 'files', 'dirs', 'folder'],
  description: 'Show bot folder structure',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    const sub = args[0] || '';

    if (sub === 'commands' || sub === 'cmd') {
      const commandsDir = path.join(ROOT, 'commands');
      let categories;
      try {
        categories = fs.readdirSync(commandsDir, { withFileTypes: true })
          .filter(e => e.isDirectory())
          .map(e => {
            const full = path.join(commandsDir, e.name);
            const jsFiles = fs.readdirSync(full).filter(f => f.endsWith('.js'));
            return { name: e.name, count: jsFiles.length };
          })
          .sort((a, b) => b.count - a.count);
      } catch {
        categories = [];
      }

      const totalCmds = categories.reduce((s, c) => s + c.count, 0);
      let text = `╭─⌈ 📁 *COMMANDS STRUCTURE* ⌋\n│\n`;
      text += `├─⊷ *Total Categories:* ${categories.length}\n`;
      text += `├─⊷ *Total Command Files:* ${totalCmds}\n│\n`;

      categories.forEach((cat, i) => {
        const isLast = i === categories.length - 1;
        const con = isLast ? '╰─⊷' : '├─⊷';
        text += `${con} 📁 *${cat.name}/* — ${cat.count} file${cat.count !== 1 ? 's' : ''}\n`;
      });

      text += `│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      return sock.sendMessage(jid, { text }, { quoted: m });
    }

    if (sub && sub !== 'root' && sub !== 'all') {
      const targetDir = path.join(ROOT, sub);
      if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
        return sock.sendMessage(jid, {
          text: `╭─⌈ ❌ *LS ERROR* ⌋\n│\n├─⊷ Directory not found: *${sub}*\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
        }, { quoted: m });
      }
      const listing = listDir(targetDir, 1, 3, '│  ');
      let text = `╭─⌈ 📁 *${sub.toUpperCase()}/* ⌋\n`;
      text += listing || '│  _(empty)_\n';
      text += `│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
      return sock.sendMessage(jid, { text }, { quoted: m });
    }

    const topDirs = ['commands', 'lib', 'config', 'data', 'session'].filter(d =>
      fs.existsSync(path.join(ROOT, d))
    );
    const topFiles = fs.readdirSync(ROOT, { withFileTypes: true })
      .filter(e => !e.isDirectory() && (e.name.endsWith('.js') || e.name.endsWith('.json') || e.name.endsWith('.md')))
      .filter(e => !['package-lock.json'].includes(e.name));

    const cmdCount = countFiles(path.join(ROOT, 'commands'), '.js');
    const libCount = countFiles(path.join(ROOT, 'lib'), '.js');

    let text = `╭─⌈  *BOT FOLDER STRUCTURE* ⌋\n│\n`;
    text += `├─⊷ *Root:* ${ROOT.replace('/home/runner/', '~/')}\n`;
    text += `├─⊷ *Commands:* ${cmdCount} files\n`;
    text += `├─⊷ *Libraries:* ${libCount} files\n│\n`;
    text += `├─⊷ *📁 Directories*\n`;

    topDirs.forEach((d, i) => {
      const count = countFiles(path.join(ROOT, d), '.js');
      const sz = formatSize(dirSize(path.join(ROOT, d)));
      const isLast = i === topDirs.length - 1 && topFiles.length === 0;
      text += `│  ${isLast ? '╰─' : '├─'} 📁 *${d}/* (${count} js, ${sz})\n`;
    });

    if (topFiles.length > 0) {
      text += `├─⊷ *📄 Root Files*\n`;
      topFiles.forEach((f, i) => {
        const isLast = i === topFiles.length - 1;
        let size = '';
        try { size = ' _' + formatSize(fs.statSync(path.join(ROOT, f.name)).size) + '_'; } catch {}
        const icon = f.name.endsWith('.js') ? '📄' : f.name.endsWith('.json') ? '📋' : '📝';
        text += `│  ${isLast ? '╰─' : '├─'} ${icon} ${f.name}${size}\n`;
      });
    }

    text += `│\n├─⊷ *Usage:*\n`;
    text += `│  ├─ *${PREFIX}ls commands* — list all command categories\n`;
    text += `│  ├─ *${PREFIX}ls lib* — explore lib folder\n`;
    text += `│  ╰─ *${PREFIX}ls <folder>* — explore any folder\n`;
    text += `│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

    return sock.sendMessage(jid, { text }, { quoted: m });
  }
};
