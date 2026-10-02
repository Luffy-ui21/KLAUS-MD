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

export default {
  name: "restart",
  description: "Restart the bot with cleanup and dependency check",
  category: "owner",
  ownerOnly: true,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    const isOwner = m.key.fromMe || sender.includes("947") || sender.includes("owner-number");
    if (!isOwner) {
      return sock.sendMessage(jid, {
        text: '❌ Only bot owner can use .restart command'
      }, { quoted: m });
    }

    let statusMessage;
    try {
      statusMessage = await sock.sendMessage(jid, {
        text: `🔄 *${getBotName()} Restart v1.1.5*\nStarting restart process...`
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

      const softRestart = args.includes('soft') || args.includes('no-restart');
      const skipClean = args.includes('fast') || args.includes('quick');
      const skipGit = args.includes('fast') || args.includes('quick') || args.includes('nogit');
      const installDeps = args.includes('deps') || args.includes('install');

      if (!skipClean) {
        await editStatus('🧹 *Cleaning media & temp files...*\nSettings & configs preserved.');
        try {
          const cleanCmds = [
            'rm -rf tmp_update_fast tmp_preserve_fast /tmp/*.zip /tmp/*.tar.gz 2>/dev/null || true',
            'rm -rf ./data/antidelete/media/* ./data/antidelete/status/media/* 2>/dev/null || true',
            'find ./session -name "sender-key-*" -o -name "pre-key-*" -o -name "app-state-sync-version-*" | xargs rm -f 2>/dev/null || true',
            'rm -rf session_backup ./temp/* ./logs/* 2>/dev/null || true',
            'find ./data -name "*.bak" -delete 2>/dev/null || true',
          ];
          await Promise.allSettled(cleanCmds.map(cmd => run(cmd, 8000)));
          await editStatus('💾 *Media cleanup done!*\n✅ Settings & configs preserved\nContinuing restart...');
        } catch (diskErr) {}
      }

      if (!skipGit) {
        await editStatus('🌐 *Checking for updates...*');
        try {
          const oldRev = await run('git rev-parse HEAD').catch(() => 'unknown');
          await run(`git fetch ${_R} --depth=5 --prune`, 30000);
          const currentBranch = await run('git rev-parse --abbrev-ref HEAD').catch(() => 'main');
          let newRev;
          try {
            newRev = await run(`git rev-parse ${_R}/${currentBranch}`);
          } catch {
            newRev = await run(`git rev-parse ${_R}/main`);
          }
          if (oldRev === newRev) {
            await editStatus(`✅ *Already up to date*\nCommit: ${newRev?.slice(0, 7) || 'N/A'}`);
          } else {
            // Try fast-forward first; fall back to regular merge if histories diverged
            try {
              await run(`git merge --ff-only ${newRev}`);
            } catch {
              await run(`git merge --no-edit --allow-unrelated-histories ${newRev}`);
            }
            const updatedRev = await run('git rev-parse HEAD').catch(() => newRev);
            await editStatus(`✅ *Updated to latest!*\nCommit: ${updatedRev?.slice(0, 7) || 'N/A'}`);
          }
        } catch (gitErr) {
          await editStatus(`⚠️ *Git update skipped:* ${sanitizeGitErr(gitErr.message)}\nContinuing with current version...`);
        }
      }

      if (installDeps) {
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
      }

      if (softRestart) {
        await editStatus('✅ **Cleanup Complete!**\nSoft restart - no process restart.\nBot continues running.');
        return;
      }

      await editStatus('✅ **Restart Complete!**\nRestarting bot in 3 seconds...');

      await new Promise(resolve => setTimeout(resolve, 3000));

      await sock.sendMessage(jid, {
        text: '🔄 **Restarting Now...**\nBot will be back in a moment!'
      }, { quoted: m });

      if (typeof globalThis.preExitSave === 'function') {
        try { await globalThis.preExitSave(); } catch {}
      }
      try {
        await run('pm2 restart all', 10000);
      } catch {
        process.exit(0);
      }

    } catch (err) {
      let errorText = `❌ **Restart Failed**\nError: ${sanitizeGitErr(err.message || '')}\n\n`;

      if ((err.message || '').includes('timeout')) {
        errorText += '**Reason:** Operation timed out\n';
        errorText += '**Solution:** Try again or use `.restart fast`\n';
      }

      errorText += '\n**Available Options:**\n';
      errorText += '`.restart` - Cleanup + update + restart\n';
      errorText += '`.restart fast` - Skip cleanup, update + restart\n';
      errorText += '`.restart soft` - Cleanup + update only, no restart\n';
      errorText += '`.restart deps` - Cleanup + update + install deps + restart\n';

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
