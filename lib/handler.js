/**
 * KLAUS-MD — Message handler + command router (multi-user)
 *
 * Each call receives a `dbSession` (the BotSession DB record) so commands
 * can read the user's prefix + settings.
 */

const fs = require('fs');
const path = require('path');

const BOT_NAME = process.env.BOT_NAME || 'KLAUS-MD';
const GLOBAL_OWNER_NUMBER = (process.env.OWNER_NUMBER || '254711815459').replace(/\D/g, '');

// Load commands dynamically
const commands = new Map();
const commandsDir = path.join(__dirname, 'commands');
const antiDir = path.join(__dirname, 'anti');

function loadCommands() {
  commands.clear();

  // 1. Load regular commands from lib/commands/
  if (fs.existsSync(commandsDir)) {
    for (const file of fs.readdirSync(commandsDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        const cmd = require(path.join(commandsDir, file));
        if (cmd && cmd.name && cmd.execute) {
          commands.set(cmd.name.toLowerCase(), cmd);
          if (Array.isArray(cmd.aliases)) {
            for (const alias of cmd.aliases) {
              commands.set(alias.toLowerCase(), cmd);
            }
          }
        }
      } catch (e) {
        console.error(`[HANDLER] Failed to load ${file}:`, e.message);
      }
    }
  }

  // 2. Also load command-style exports from lib/anti/ (e.g. .antidelete, .anticall)
  //    These modules export both a check/handle function AND a command (name+execute)
  if (fs.existsSync(antiDir)) {
    for (const file of fs.readdirSync(antiDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        const mod = require(path.join(antiDir, file));
        if (mod && mod.name && mod.execute) {
          // Avoid duplicates (if a command with this name already exists)
          if (commands.has(mod.name.toLowerCase())) continue;
          commands.set(mod.name.toLowerCase(), mod);
          if (Array.isArray(mod.aliases)) {
            for (const alias of mod.aliases) {
              if (!commands.has(alias.toLowerCase())) {
                commands.set(alias.toLowerCase(), mod);
              }
            }
          }
        }
      } catch (e) {
        // Anti-module failed to load — non-fatal
      }
    }
  }

  console.log(`[HANDLER] Loaded ${commands.size} command aliases`);
}

loadCommands();

/**
 * Main message handler — now accepts dbSession for per-user settings
 * Respects private/public mode:
 *   - "public" (default): bot responds to everyone
 *   - "private": bot only responds to the owner (the user who paired)
 */
async function handleMessage(sock, msg, dbSession) {
  const text = extractText(msg);
  if (!text) return;

  // Use the user's own prefix (from DB)
  const prefix = dbSession?.prefix || process.env.PREFIX || '.';

  // Log every message we receive (helps debug "bot not responding")
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const senderNum = senderJid.split('@')[0].split(':')[0];
  const chatType = msg.key.remoteJid.endsWith('@g.us') ? 'GROUP' : 'DM';
  console.log(`[MSG] ${chatType} from ${senderNum}: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}" | prefix=${prefix} | mode=${dbSession?.mode || 'public'}`);

  // If no prefix → silently ignore (don't auto-reply with hints)
  if (!text.startsWith(prefix)) return;

  const body = text.slice(prefix.length).trim();
  if (!body) return;

  const [cmdName, ...args] = body.split(/\s+/);
  const command = commands.get(cmdName.toLowerCase());

  // Unknown command → tell the user (don't just silently return)
  if (!command) {
    console.log(`[MSG] Unknown command: ${prefix}${cmdName}`);
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❓ *Unknown command:* ${prefix}${cmdName}\n\nType *${prefix}menu* to see all available commands.`,
      }, { quoted: msg });
    } catch {}
    return;
  }

  // PRIVATE MODE: only the owner (the user who paired) OR the global OWNER_NUMBER can use commands
  if (dbSession?.mode === 'private') {
    const senderNumber = senderNum;
    const ownerNumber = dbSession.phoneNumber;
    const isOwner = senderNumber === ownerNumber || senderNumber === GLOBAL_OWNER_NUMBER;
    if (!isOwner) {
      // Not the owner — ignore silently (don't even mark as read)
      console.log(`[MSG] Ignored (private mode, not owner)`);
      return;
    }
  }

  console.log(`[MSG] → Running command: ${prefix}${cmdName}`);

  // Mark message as read
  try { await sock.readMessages([msg.key]); } catch {}

  // Set typing indicator
  try { await sock.sendPresenceUpdate('composing', msg.key.remoteJid); } catch {}

  try {
    await command.execute({
      sock,
      msg,
      args,
      text: body,
      fullText: text,
      from: msg.key.remoteJid,
      sender: msg.key.participant || msg.key.remoteJid,
      isGroup: msg.key.remoteJid.endsWith('@g.us'),
      pushName: msg.pushName || 'User',
      botName: BOT_NAME,
      prefix,
      dbSession,
      sessionId: dbSession?.id,
      reply: async (text, options) => {
        return await sock.sendMessage(msg.key.remoteJid, { text, ...options }, { quoted: msg });
      },
      replyWithImage: async (imageBuffer, caption) => {
        return await sock.sendMessage(msg.key.remoteJid, { image: imageBuffer, caption }, { quoted: msg });
      },
      replyWithSticker: async (stickerBuffer) => {
        return await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer }, { quoted: msg });
      },
      replyWithAudio: async (audioBuffer) => {
        return await sock.sendMessage(msg.key.remoteJid, { audio: audioBuffer, mimetype: 'audio/mpeg' }, { quoted: msg });
      },
    });

    // Increment per-user command count (JSON db supports this via update)
    if (dbSession) {
      try {
        const { prisma } = require('./db');
        await prisma.botSession.update({
          where: { id: dbSession.id },
          data: {
            commandsExecuted: (dbSession.commandsExecuted || 0) + 1,
            lastActiveAt: new Date().toISOString(),
          },
        });
      } catch (e) {
        // Non-fatal — don't break the user's command
        console.warn(`[HANDLER] Failed to update stats for ${dbSession.id}:`, e.message);
      }
    }
    console.log(`[MSG] ✓ Command ${prefix}${cmdName} completed`);
  } catch (e) {
    console.error(`[CMD:${cmdName}] Error:`, e);
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ *Error running ${cmdName}*\n\n${e.message || e}`,
      }, { quoted: msg });
    } catch {}
  } finally {
    try { await sock.sendPresenceUpdate('paused', msg.key.remoteJid); } catch {}
  }
}

function extractText(msg) {
  if (!msg.message) return '';
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
  return '';
}

/**
 * Anti-command router — uses per-session settings
 */
async function handleAnti(sock, msg, dbSession) {
  const antiModules = ['antiLink', 'antiBot', 'antiSpam', 'antiBadword'];
  for (const mod of antiModules) {
    try {
      const anti = require(`./anti/${mod}`);
      if (anti.check) await anti.check(sock, msg, dbSession);
    } catch {
      // Module not loaded
    }
  }
}

function getCommandsList() {
  const seen = new Set();
  const list = [];
  for (const [alias, cmd] of commands.entries()) {
    if (seen.has(cmd)) continue;
    seen.add(cmd);
    list.push({ name: cmd.name, aliases: cmd.aliases || [], desc: cmd.desc || '', category: cmd.category || 'misc' });
  }
  return list;
}

module.exports = { handleMessage, handleAnti, getCommandsList, loadCommands };
