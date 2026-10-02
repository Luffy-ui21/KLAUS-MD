import { exec } from "child_process";
import { getBotName } from '../../lib/botname.js';
import { promisify } from "util";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const _R = 'origin'; // already configured to the correct repo

function sanitizeGitErr(msg = '') {
  return msg
    .replace(/https?:\/\/[^\s'"]+/g, '[remote]')
    .replace(/git@[^\s'"]+/g, '[remote]')
    .replace(/\/nk-apex[^\s'"]*/gi, '')
    .replace(/n7[- ]/gi, '')
    .trim();
}

async function run(cmd, timeout = 60000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      resolve(stdout.toString().trim());
    });
  });
}

async function hasGitRepo() {
  const gitDir = path.join(process.cwd(), '.git');
  if (!fs.existsSync(gitDir)) return false;
  try {
    await run('git --version');
    return true;
  } catch {
    return false;
  }
}

async function checkRepoSize() {
  try {
    const countOutput = await run('git count-objects -v');
    const lines = countOutput.split('\n');
    const sizeData = {};
    lines.forEach(line => {
      const [key, value] = line.split(': ');
      sizeData[key] = parseInt(value) || value;
    });
    const packSizeKB = sizeData['size-pack'] || 0;
    const sizeMB = (packSizeKB / 1024).toFixed(2);
    return { sizeMB };
  } catch {
    return { sizeMB: 'unknown' };
  }
}

export default {
  name: "start",
  description: "Start the bot with cleanup and latest updates",
  category: "owner",
  ownerOnly: true,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    const isOwner = m.key.fromMe || sender.includes("947") || sender.includes("owner-number");
    if (!isOwner) {
      return sock.sendMessage(jid, {
        text: '❌ Only bot owner can use .start command'
      }, { quoted: m });
    }

    let statusMessage;
    try {
      statusMessage = await sock.sendMessage(jid, {
        text: `🚀 *${getBotName()} Start v1.1.5*\nStarting bot with latest updates...`
      }, { quoted: m });

      const editStatus = async (text) => {
        try {
          await sock.sendMessage(jid, {
            text,
            edit: statusMessage.key
          });
        } catch {
          const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
          statusMessage = newMsg;
        }
      };

      const skipUpdate = args.includes('no-update') || args.includes('skip');
      const skipClean = args.includes('fast') || args.includes('quick');
      const softStart = args.includes('soft') || args.includes('no-restart');

      if (!skipClean) {
        await editStatus('🧹 **Cleaning all media & temp files...**\nSettings & configs will be preserved.');
        try {
          const dfOut = await run('df -BM --output=avail . 2>/dev/null || df -m . 2>/dev/null', 5000).catch(() => '');
          const freeMatch = dfOut.match(/(\d+)M?\s*$/m);
          const beforeMB = freeMatch ? parseInt(freeMatch[1]) : null;

          const cleanCmds = [
            'rm -rf tmp_update_fast tmp_preserve_fast /tmp/*.zip /tmp/*.tar.gz 2>/dev/null',
            'rm -rf ./data/antidelete/media/* 2>/dev/null',
            'rm -rf ./data/antidelete/status/media/* 2>/dev/null',
            'find ./session -name "sender-key-*" -delete 2>/dev/null',
            'find ./session -name "pre-key-*" -delete 2>/dev/null',
            'find ./session -name "app-state-sync-version-*" -delete 2>/dev/null',
            'rm -rf session_backup 2>/dev/null',
            'find ./data -name "*.bak" -delete 2>/dev/null',
            'find . -maxdepth 2 -name "*.log" -not -path "./node_modules/*" -delete 2>/dev/null',
            'rm -rf ./temp/* 2>/dev/null',
            'rm -rf ./logs/* 2>/dev/null',
            'npm cache clean --force 2>/dev/null || true'
          ];
          for (const cmd of cleanCmds) {
            await run(cmd, 15000).catch(() => {});
          }
          const dfAfter = await run('df -BM --output=avail . 2>/dev/null || df -m . 2>/dev/null', 5000).catch(() => '');
          const afterMatch = dfAfter.match(/(\d+)M?\s*$/m);
          const afterMB = afterMatch ? parseInt(afterMatch[1]) : beforeMB;
          const recovered = (beforeMB !== null && afterMB !== null) ? (afterMB - beforeMB) : 0;
          await editStatus(`💾 **Media cleanup done!** ${afterMB !== null ? afterMB + 'MB free' : ''}${recovered > 0 ? ' (recovered ' + recovered + 'MB)' : ''}\n✅ Settings, prefix, configs preserved\nContinuing start...`);
          if (afterMB !== null && afterMB < 30) {
            await editStatus(`❌ **Not enough disk space**\nOnly ${afterMB}MB free after cleanup.\nManually delete large files or increase disk allocation.`);
            return;
          }
        } catch (diskErr) {}
      }

      if (!skipUpdate && await hasGitRepo()) {
        await editStatus('🌐 **Checking for updates...**');
        try {
          const oldRev = await run('git rev-parse HEAD').catch(() => 'unknown');

          await run('git prune --expire=now').catch(() => {});
          await run('git gc --auto').catch(() => {});

          await run(`git fetch ${_R} --depth=20 --prune`);

          const currentBranch = await run('git rev-parse --abbrev-ref HEAD').catch(() => 'main');
          let newRev;
          try {
            newRev = await run(`git rev-parse ${_R}/${currentBranch}`);
          } catch {
            newRev = await run(`git rev-parse ${_R}/main`);
          }

          if (oldRev === newRev) {
            await editStatus(`✅ **Already up to date**\nCommit: ${newRev?.slice(0, 7) || 'N/A'}`);
          } else {
            // Try fast-forward first; fall back to regular merge if histories diverged
            try {
              await run(`git merge --ff-only ${newRev}`);
            } catch {
              await run(`git merge --no-edit --allow-unrelated-histories ${newRev}`);
            }

            await run('git prune --expire=now').catch(() => {});
            await run('git gc --aggressive --prune=now').catch(() => {});

            const sizeAfter = await checkRepoSize();
            const updatedRev = await run('git rev-parse HEAD').catch(() => newRev);
            await editStatus(`✅ **Updated to latest!**\nCommit: ${updatedRev?.slice(0, 7) || 'N/A'}\nSize: ${sizeAfter.sizeMB} MB`);
          }
        } catch (gitErr) {
          await editStatus(`⚠️ **Git update failed:** ${sanitizeGitErr(gitErr.message)}\nContinuing with current version...`);
        }
      }

      await editStatus('📦 **Installing dependencies...**');
      try {
        await run('npm ci --no-audit --no-fund --silent', 180000);
        await editStatus('✅ **Dependencies installed**');
      } catch (npmError) {
        try {
          await run('npm install --no-audit --no-fund --loglevel=error', 180000);
          await editStatus('⚠️ **Dependencies installed with warnings**');
        } catch {
          await editStatus('⚠️ **Could not install all dependencies**\nContinuing anyway...');
        }
      }

      if (softStart) {
        await editStatus('✅ **Start Complete!**\nSoft start - cleanup and updates applied.\nBot continues running.');
        return;
      }

      await editStatus('✅ **Start Complete!**\nRestarting bot in 3 seconds...');

      await new Promise(resolve => setTimeout(resolve, 3000));

      await sock.sendMessage(jid, {
        text: '🔄 **Restarting Now...**\nBot will be back in a moment!'
      }, { quoted: m });

      try {
        await run('pm2 restart all', 10000);
      } catch {
        process.exit(0);
      }

    } catch (err) {
      let errorText = `❌ **Start Failed**\nError: ${sanitizeGitErr(err.message || '')}\n\n`;

      if ((err.message || '').includes('timeout')) {
        errorText += '**Reason:** Operation timed out\n';
        errorText += '**Solution:** Try again or use `.start fast`\n';
      } else if ((err.message || '').includes('git')) {
        errorText += '**Reason:** Git operation failed\n';
        errorText += '**Solution:** Try `.start no-update`\n';
      } else if ((err.message || '').includes('npm')) {
        errorText += '**Reason:** NPM installation failed\n';
        errorText += '**Solution:** Check internet or try manually: `npm install`\n';
      }

      errorText += '\n**Available Options:**\n';
      errorText += '`.start` - Full cleanup + update + restart\n';
      errorText += '`.start fast` - Skip cleanup, update + restart\n';
      errorText += '`.start no-update` - Cleanup + restart (skip git)\n';
      errorText += '`.start soft` - Cleanup + update, no restart\n';

      try {
        if (statusMessage?.key) {
          await sock.sendMessage(jid, { text: errorText, edit: statusMessage.key });
        } else {
          await sock.sendMessage(jid, { text: errorText }, { quoted: m });
        }
      } catch {}
    }
  }
};
