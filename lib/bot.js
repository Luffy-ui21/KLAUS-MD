/**
 * ⚠️ LEGACY / UNUSED — kept for reference only.
 *
 * The live server (server.js) uses `lib/sessionManager.js` instead,
 * which is the multi-user version. Each paired user gets their own
 * Baileys socket via sessionManager.startSocket().
 *
 * This file is a single-user Baileys connector and is NOT loaded by
 * server.js. Don't add new features here — add them to sessionManager.js.
 *
 * KLAUS-MD — Baileys WhatsApp connection (legacy single-user)
 * Uses pairing code (NOT QR code) — phone number based linking
 */

const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  proto,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const { handleMessage, handleAnti } = require('./handler');

const SESSION_NAME = process.env.SESSION_NAME || 'megh-md';
const AUTH_DIR = path.join(__dirname, '..', 'auth_state');
const BOT_NAME = process.env.BOT_NAME || 'KLAUS-MD';

// Ensure auth dir exists
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// State
let sock = null;
let connectionState = { connected: false, user: null, connectionInfo: null };
let pendingPairings = new Map(); // phone -> { resolve, timeout }
let isShuttingDown = false;

const logger = P({ level: 'warn' }, P.destination({ sync: true }));

/**
 * Start the bot. If no auth state exists, waits for a pairing code.
 */
async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[BOT] Using Baileys v${version}`);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    browser: Browsers.appropriate('Chrome'),
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  // ============ EVENT HANDLERS ============

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // We don't use QR — only pairing code
      console.log('[BOT] QR received but ignored (we use pairing code only).');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !isShuttingDown;

      console.log(`[BOT] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        // Retry after 2 seconds
        setTimeout(() => startBot().catch(e => console.error('[BOT] Reconnect failed:', e)), 2000);
      } else {
        // Logged out — clear auth state
        console.log('[BOT] Logged out. Clearing auth state.');
        clearAuthState();
        connectionState = { connected: false, user: null, connectionInfo: null };
      }
    } else if (connection === 'open') {
      const user = sock.user;
      connectionState = {
        connected: true,
        user: { id: user.id, name: user.name },
        connectionInfo: {
          number: user.id.split(':')[0],
          name: user.name || 'Unknown',
          platform: user.platform || 'unknown',
        },
      };
      console.log(`\n╔══════════════════════════════════════════════╗`);
      console.log(`║  ✅ ${BOT_NAME} CONNECTED SUCCESSFULLY!         ║`);
      console.log(`╠══════════════════════════════════════════════╣`);
      console.log(`║  👤 Number: ${user.id.split(':')[0].padEnd(34)}║`);
      console.log(`║  📛 Name:   ${(user.name || 'Unknown').padEnd(34)}║`);
      console.log(`╚══════════════════════════════════════════════╝\n`);

      // Resolve any pending pairing that just succeeded
      for (const [phone, pending] of pendingPairings.entries()) {
        pending.resolve({ success: true, user: connectionState.user });
        clearTimeout(pending.timeout);
      }
      pendingPairings.clear();

      // Send connection confirmation to owner
      sendConnectionMessage();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    try {
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        // Don't process old messages (only 'notify' = real-time)
        if (type !== 'notify') continue;

        await handleMessage(sock, msg);
        await handleAnti(sock, msg);
      }
    } catch (e) {
      console.error('[BOT] Message handler error:', e);
    }
  });

  // Anti-delete: store messages so we can restore them
  sock.ev.on('messages.update', async (updates) => {
    const { handleAntiDelete } = require('./anti/antiDelete');
    for (const update of updates) {
      try {
        await handleAntiDelete(sock, update);
      } catch (e) {
        // ignore
      }
    }
  });

  // Group participants update (welcome/goodbye)
  sock.ev.on('group-participants.update', async (event) => {
    const { handleGroupJoin, handleGroupLeave } = require('./anti/welcome');
    try {
      if (event.action === 'add') await handleGroupJoin(sock, event);
      else if (event.action === 'remove') await handleGroupLeave(sock, event);
    } catch (e) {
      // ignore
    }
  });

  // Auto-view + auto-react status
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (process.env.AUTO_READ_STATUS !== 'true') return;
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') {
        try { await sock.readMessages([msg.key]); } catch {}
        if (process.env.AUTO_REACT_STATUS === 'true') {
          try { await sock.sendMessage(msg.key.remoteJid, { react: { text: '❤️', key: msg.key } }); } catch {}
        }
      }
    }
  });
}

/**
 * Get a pairing code for a phone number
 * Returns the code as a string (e.g. "ABCD-EFGH")
 */
async function getPairingCode(phoneNumber) {
  if (!sock) throw new Error('Bot not initialized');

  // Wait up to 30s for socket to be ready
  let waited = 0;
  while (!sock.wsReady && waited < 30) {
    await new Promise(r => setTimeout(r, 1000));
    waited++;
  }
  if (!sock.wsReady) throw new Error('WhatsApp socket not ready. Try again in a moment.');

  // Request pairing code
  const code = await sock.requestPairingCode(phoneNumber);
  return code;
}

/**
 * Send the connection confirmation message to the owner
 */
async function sendConnectionMessage() {
  const ownerNumber = process.env.OWNER_NUMBER || '254711815459';
  if (!ownerNumber) {
    console.log('[BOT] No OWNER_NUMBER set — skipping connection message');
    return;
  }
  const jid = `${ownerNumber}@s.whatsapp.net`;
  const message = `╔════════════════════════════════════╗
║      Welcome to ${BOT_NAME}!          ║
╚════════════════════════════════════╝

✅ *Connection Successful!*

📡 *Bot Name:* ${BOT_NAME}
👤 *Connected As:* ${connectionState.connectionInfo?.name || 'Unknown'}
📱 *Number:* ${connectionState.connectionInfo?.number || 'Unknown'}
⚡ *Prefix:* ${process.env.PREFIX || '.'}
🟢 *Status:* Online

Type *${process.env.PREFIX || '.'}menu* to see all commands.

_You're all set to rock!_ 🚀`;

  try {
    await sock.sendMessage(jid, { text: message });
    console.log('[BOT] Connection message sent to owner');
  } catch (e) {
    console.warn('[BOT] Failed to send connection message:', e.message);
  }
}

function getBotState() {
  return connectionState;
}

function getConnectionInfo() {
  return connectionState.connectionInfo;
}

async function logout() {
  if (sock) {
    isShuttingDown = true;
    try { await sock.logout(); } catch {}
    clearAuthState();
    isShuttingDown = false;
  }
  connectionState = { connected: false, user: null, connectionInfo: null };
}

function clearAuthState() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('[BOT] Failed to clear auth state:', e);
  }
}

module.exports = { startBot, getBotState, getPairingCode, getConnectionInfo, logout };
