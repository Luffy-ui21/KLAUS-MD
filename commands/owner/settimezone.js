import { getConfig, setConfig } from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const _tzDirname = path.dirname(fileURLToPath(import.meta.url));
const _tzEnvPath = path.join(_tzDirname, '../../.env');

function _saveTzToEnv(value) {
    try {
        let content = '';
        try { content = fs.readFileSync(_tzEnvPath, 'utf8'); } catch {}
        const line = `BOT_TIMEZONE=${value}`;
        const regex = /^BOT_TIMEZONE=.*$/m;
        content = regex.test(content) ? content.replace(regex, line) : content.trimEnd() + '\n' + line + '\n';
        fs.writeFileSync(_tzEnvPath, content, 'utf8');
        process.env.BOT_TIMEZONE = value;
    } catch {}
}

const COMMON_TIMEZONES = [
  'Africa/Lagos',        'Africa/Nairobi',     'Africa/Cairo',
  'Africa/Accra',        'Africa/Johannesburg',
  'America/New_York',    'America/Chicago',    'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo',
  'Europe/London',       'Europe/Paris',       'Europe/Berlin',
  'Europe/Moscow',       'Europe/Istanbul',
  'Asia/Dubai',          'Asia/Karachi',       'Asia/Kolkata',
  'Asia/Dhaka',          'Asia/Bangkok',       'Asia/Singapore',
  'Asia/Tokyo',          'Asia/Shanghai',
  'Australia/Sydney',    'Pacific/Auckland',
  'UTC',
];

function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export default {
  name: 'settimezone',
  aliases: ['stz', 'timezone', 'settz'],
  description: 'Set the bot timezone for time/date display',
  usage: 'settimezone <Timezone | list | reset>',

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const isOwner = m.sender === global.owner || m.sender === process.env.OWNER_NUMBER;
    if (!isOwner) {
      await sock.sendMessage(jid, { text: '❌ Owner only!' }, { quoted: m });
      return;
    }

    const p = global.prefix || '.';
    const ownerName = getOwnerName();

    // ── No args: show help ──────────────────────────────────────────────
    if (args.length === 0) {
      const current = globalThis._timezone || 'UTC (default)';
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🌐 *TIMEZONE* ⌋\n` +
          `├─⊷ *${p}settimezone <Timezone>*\n` +
          `│  └⊷ Set bot timezone\n` +
          `├─⊷ *${p}settimezone list*\n` +
          `│  └⊷ Show common timezones\n` +
          `├─⊷ *${p}settimezone reset*\n` +
          `│  └⊷ Revert to UTC\n` +
          `│\n` +
          `├─⊷ *Current:* ${current}\n` +
          `│\n` +
          `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    const arg = args[0].toLowerCase();

    // ── List common timezones ───────────────────────────────────────────
    if (arg === 'list' || arg === 'all') {
      const now = new Date();
      let text = `🌐 *Common Timezones*\n\n`;
      for (const tz of COMMON_TIMEZONES) {
        const time = now.toLocaleTimeString('en-US', {
          hour12: true, hour: '2-digit', minute: '2-digit', timeZone: tz
        });
        text += `• *${tz}* — ${time}\n`;
      }
      text += `\n💡 *${p}settimezone Africa/Lagos*`;
      return sock.sendMessage(jid, { text }, { quoted: m });
    }

    // ── Reset to UTC ────────────────────────────────────────────────────
    if (arg === 'reset' || arg === 'default' || arg === 'utc') {
      await setConfig('timezone_config', { timezone: 'UTC' });
      globalThis._timezone = 'UTC';
      _saveTzToEnv('UTC');
      return sock.sendMessage(jid, {
        text: `✅ Timezone reset to *UTC*`
      }, { quoted: m });
    }

    // ── Set a specific timezone ─────────────────────────────────────────
    const tzInput = args.join(' ').trim().replace(/\s+/g, '_');

    if (!isValidTimezone(tzInput)) {
      return sock.sendMessage(jid, {
        text:
          `❌ *Invalid timezone:* \`${tzInput}\`\n\n` +
          `Use standard IANA format, e.g:\n` +
          `• Africa/Lagos\n• Asia/Kolkata\n• America/New_York\n• Europe/London\n\n` +
          `Send *${p}settimezone list* to see options.`
      }, { quoted: m });
    }

    await setConfig('timezone_config', { timezone: tzInput });
    globalThis._timezone = tzInput;
    _saveTzToEnv(tzInput);

    const now = new Date();
    const previewTime = now.toLocaleTimeString('en-US', {
      hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tzInput
    });
    const previewDate = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tzInput
    });

    await sock.sendMessage(jid, {
      text:
        `✅ *Timezone set to:* ${tzInput}\n\n` +
        `🕐 Time: ${previewTime}\n` +
        `📅 Date: ${previewDate}`
    }, { quoted: m });
  },
};
