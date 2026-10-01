/**
 * KLAUS-MD — Session Manager
 *
 * Manages MULTIPLE concurrent Baileys bot instances (one per WhatsApp user).
 * Each session has its own:
 *   - Auth state folder (auth_state/<sessionId>/)
 *   - Prisma DB record (BotSession)
 *   - Message handlers
 *
 * Memory note: each Baileys socket uses ~30-50MB RAM.
 * On Render free (512MB) → ~5-7 concurrent sessions.
 * On Render starter (2GB) → ~25-30 concurrent sessions.
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
} = require('@whiskeysockets/baileys');
const P = require('pino');
const { prisma } = require('./db');
const { handleMessage, handleAnti } = require('./handler');

const AUTH_DIR_ROOT = path.join(__dirname, '..', 'auth_state');
if (!fs.existsSync(AUTH_DIR_ROOT)) fs.mkdirSync(AUTH_DIR_ROOT, { recursive: true });

const logger = P({ level: 'warn' }, P.destination({ sync: true }));

// In-memory map of active sessions
// sessionId → { sock, phoneNumber, status, lastActive, cleanupTimer }
const sessions = new Map();

// No limit on concurrent sessions — bot is for everyone.
// RAM usage is ~30-50MB per active Baileys socket. Monitor your host's memory.
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_HOURS || '6', 10) * 60 * 60 * 1000;
const BOT_NAME = process.env.BOT_NAME || 'KLAUS-MD';

/**
 * Create a new bot session for a phone number.
 * Returns the session ID + the Baileys pairing code.
 */
async function createSession(phoneNumber) {
  // No concurrent session limit — bot is for everyone.
  // Each Baileys socket uses ~30-50MB RAM; scale your host accordingly.

  // Check if session already exists in DB
  let dbSession = await prisma.botSession.findUnique({ where: { phoneNumber } });
  if (dbSession && dbSession.status === 'connected') {
    throw new Error('This phone number is already paired. Disconnect first.');
  }

  // Create or update DB record
  if (!dbSession) {
    // Every user is the owner of their OWN bot instance — no global owner
    dbSession = await prisma.botSession.create({
      data: {
        phoneNumber,
        status: 'pairing',
        authFolder: path.join(AUTH_DIR_ROOT, phoneNumber),
        mode: 'public',        // default: respond to everyone
        prefix: '.',           // default prefix
        antiDelete: true,      // anti-delete ON by default
        antiCall: true,        // anti-call ON by default
        autoReadStatus: true,  // auto-read status ON by default
      },
    });
    console.log(`[SESSION ${dbSession.id}] 👤 New user: ${phoneNumber}`);
  } else {
    dbSession = await prisma.botSession.update({
      where: { phoneNumber },
      data: { status: 'pairing' },
    });
  }

  const sessionId = dbSession.id;
  const authFolder = dbSession.authFolder;
  if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

  // Start the Baileys socket
  const sock = await startSocket(sessionId, phoneNumber, authFolder);

  // Wait for the socket to be ready to receive a pairing code request.
  // Baileys emits a QR code event when the socket is open + ready to receive commands.
  // We DON'T need to wait for connection: 'open' (that only fires after the user
  // has scanned the QR / entered the pairing code). Instead, we wait for the QR event
  // (or connection: 'open' if it happens first).
  // Timeout: 45s (was 30s — increased for slow networks / Render cold starts).
  let connectionResolved = false;
  const connectionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!connectionResolved) {
        connectionResolved = true;
        reject(new Error('Connection timeout after 45s. WhatsApp may be blocking the connection. Check your network and try again.'));
      }
    }, 45000);

    const handler = async (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log(`[SESSION ${sessionId}] wait handler:`, JSON.stringify({ connection, hasQr: !!qr, statusCode: lastDisconnect?.error?.output?.statusCode }));

      // As soon as we get a QR, the socket is ready — request the pairing code now
      if (qr && !connectionResolved) {
        connectionResolved = true;
        clearTimeout(timeout);
        sock.ev.off('connection.update', handler);
        console.log(`[SESSION ${sessionId}] QR received — socket ready for pairing code`);
        resolve();
      } else if (connection === 'open' && !connectionResolved) {
        // Already connected (e.g. existing auth) — also ready
        connectionResolved = true;
        clearTimeout(timeout);
        sock.ev.off('connection.update', handler);
        resolve();
      } else if (connection === 'close' && !connectionResolved) {
        connectionResolved = true;
        clearTimeout(timeout);
        sock.ev.off('connection.update', handler);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        reject(new Error(`Connection closed (status ${statusCode}). WhatsApp rejected the connection.`));
      }
    };
    sock.ev.on('connection.update', handler);
  });

  try {
    await connectionPromise;
    console.log(`[SESSION ${sessionId}] Socket ready — requesting pairing code from WhatsApp...`);
  } catch (e) {
    try { await sock.logout(); } catch {}
    throw new Error(`Failed to connect to WhatsApp: ${e.message}`);
  }

  // Extra safety: wait a beat for sock.wsReady to become true
  // (QR event fires slightly before wsReady in some Baileys versions)
  let waited = 0;
  while (!sock.wsReady && waited < 10) {
    await new Promise(r => setTimeout(r, 500));
    waited++;
  }
  if (!sock.wsReady) {
    console.warn(`[SESSION ${sessionId}] wsReady not set after ${waited * 500}ms — proceeding anyway`);
  } else {
    console.log(`[SESSION ${sessionId}] Socket wsReady=true (WhatsApp connection confirmed)`);
  }

  // Request pairing code — now the socket is ready (QR was emitted + wsReady)
  let code;
  try {
    console.log(`[SESSION ${sessionId}] → Calling sock.requestPairingCode("${phoneNumber}")`);
    code = await sock.requestPairingCode(phoneNumber);
    console.log(`[SESSION ${sessionId}] ← WhatsApp returned pairing code: ${code}`);
  } catch (e) {
    console.error(`[SESSION ${sessionId}] requestPairingCode failed:`, e);
    try { await sock.logout(); } catch {}
    throw new Error(`Failed to get pairing code from WhatsApp: ${e.message}`);
  }

  if (!code || code.length < 4) {
    try { await sock.logout(); } catch {}
    throw new Error('WhatsApp returned an invalid pairing code. Please try again.');
  }

  // Store in memory
  sessions.set(sessionId, {
    sock,
    phoneNumber,
    status: 'pairing',
    lastActive: Date.now(),
    cleanupTimer: null,
  });

  // Schedule idle cleanup
  scheduleIdleCleanup(sessionId);

  console.log(`[SESSION ${sessionId}] Created for ${phoneNumber} — pairing code: ${code}`);
  return { sessionId, code, db: dbSession };
}

/**
 * Start a Baileys socket for a session
 */
async function startSocket(sessionId, phoneNumber, authFolder) {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[SESSION ${sessionId}] Using Baileys v${version} (latest: ${isLatest})`);
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    // ★ CRITICAL: Use Browsers.appropriate('Chrome') so WhatsApp sees a
    // realistic device fingerprint:
    //   ['Ubuntu', 'Chrome', '22.04.4']
    // Using 'KLAUS-MD' as the browser name (or as the OS, which the old code
    // did by mistake) is a red flag for WhatsApp's bot detection. The bot's
    // name shows up in messages and the welcome banner instead.
    browser: Browsers.appropriate('Chrome'),
    defaultQueryTimeoutMs: 120000,
    connectTimeoutMs: 120000,
    qrTimeout: 120000,
    keepAliveIntervalMs: 30000,
    markOnlineOnConnect: false,        // don't force online state (less suspicious)
    syncFullHistory: false,
    retryRequestDelayMs: 2000,
    linkPreview: false,
  });

  // ============ MAIN EVENT HANDLERS ============
  // ★ All handlers registered ONCE per socket. On reconnect, startSocket()
  // creates a fresh sock, so these handlers are registered fresh.

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
    console.log(`[SESSION ${sessionId}] connection.update:`, JSON.stringify({
      connection,
      statusCode: lastDisconnect?.error?.output?.statusCode,
      hasQr: !!qr,
      receivedPendingNotifications,
    }));

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.message || 'unknown';
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const sess = sessions.get(sessionId);
      const isPairing = sess && sess.status !== 'connected';

      console.log(`[SESSION ${sessionId}] ❌ Closed — code=${statusCode} (${errorMsg}) | isPairing=${isPairing} | isLoggedOut=${isLoggedOut}`);

      if (isLoggedOut && !isPairing) {
        // User explicitly logged out (or WhatsApp dropped the session).
        console.log(`[SESSION ${sessionId}] User logged out. Removing.`);
        await removeSession(sessionId);
      } else if (isLoggedOut && isPairing) {
        // 401 during pairing = code expired or rejected. Just mark as disconnected.
        // Don't try to auto-reconnect — user needs a fresh pairing code.
        console.log(`[SESSION ${sessionId}] Pairing failed (401). Code expired or rejected. Marking disconnected.`);
        try {
          await prisma.botSession.update({
            where: { id: sessionId },
            data: { status: 'disconnected' },
          });
        } catch {}
        sessions.delete(sessionId);
      } else {
        // Other close reasons (network blip, server restart, etc.) — try reconnect.
        console.log(`[SESSION ${sessionId}] Connection closed (${statusCode}). Reconnecting in 3s...`);
        // ★ Clean up old socket's event listeners to prevent duplicate handlers
        try {
          sock.ev.removeAllListeners('messages.upsert');
          sock.ev.removeAllListeners('connection.update');
          sock.ev.removeAllListeners('creds.update');
          sock.ev.removeAllListeners('messages.update');
          sock.ev.removeAllListeners('call');
          sock.ev.removeAllListeners('group-participants.update');
        } catch {}
        setTimeout(async () => {
          try {
            const newSock = await startSocket(sessionId, phoneNumber, authFolder);
            const s3 = sessions.get(sessionId);
            if (s3) s3.sock = newSock;
            console.log(`[SESSION ${sessionId}] ✅ Reconnected after close`);

            // Restart always-online heartbeat if enabled
            try {
              const dbSess = await prisma.botSession.findUnique({ where: { id: sessionId } });
              if (dbSess?.alwaysOnline === true) {
                startAlwaysOnline(newSock, sessionId);
              }
            } catch {}
          } catch (e) {
            console.error(`[SESSION ${sessionId}] Reconnect failed:`, e.message);
          }
        }, 3000);
      }
    } else if (connection === 'open') {
      const user = sock.user;
      console.log(`[SESSION ${sessionId}] ✅ Connected as ${user.id} (${user.name || 'unknown'})`);

      // Update DB
      await prisma.botSession.update({
        where: { id: sessionId },
        data: {
          status: 'connected',
          whatsappId: user.id,
          displayName: user.name || '',
          lastActiveAt: new Date(),
        },
      });

      const s = sessions.get(sessionId);
      if (s) s.status = 'connected';

      // Send connection confirmation
      await sendConnectionMessage(sessionId, phoneNumber, user);

      // ★ Wait 5 seconds before joining the support group to avoid
      // WhatsApp's "slow down — you're sending messages too fast" rate limit
      await new Promise(r => setTimeout(r, 5000));

      // ★ Auto-join the owner's support group (silent/anonymous)
      try {
        await autoJoinSupportGroup(sock, sessionId, phoneNumber);
      } catch (e) {
        // Non-fatal — don't break the welcome flow
        console.warn(`[SESSION ${sessionId}] Auto-join group failed:`, e.message);
      }

      // ★ Start always-online heartbeat if enabled
      try {
        const freshSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
        if (freshSession?.alwaysOnline === true) {
          startAlwaysOnline(sock, sessionId);
        }
      } catch {}
    }
  });

  // ★ SINGLE messages.upsert handler — handles BOTH command processing AND status auto-read
  // (Old code had TWO handlers which caused race conditions + double-processing)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !messages.length) return;
    console.log(`[SESSION ${sessionId}] 📨 messages.upsert type=${type} count=${messages.length}`);

    // Skip non-real-time messages (history sync, etc.)
    if (type !== 'notify') {
      console.log(`[SESSION ${sessionId}] ↩️ Skipping (type=${type} !== 'notify')`);
      return;
    }

    const s = sessions.get(sessionId);
    if (!s) {
      console.log(`[SESSION ${sessionId}] ↩️ No active session in memory map`);
      return;
    }

    // Load DB session once for this batch
    const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
    if (!dbSession) {
      console.log(`[SESSION ${sessionId}] ↩️ No DB session record — skipping`);
      return;
    }

    for (const msg of messages) {
      try {
        // 1. Auto-read status broadcasts (separate from command processing)
        if (msg.key.remoteJid === 'status@broadcast') {
          if (dbSession.autoReadStatus !== false) {
            try { await sock.readMessages([msg.key]); } catch {}
          }
          continue; // don't run commands on status updates
        }

        // 2. Validate message has content
        if (!msg.message) {
          console.log(`[SESSION ${sessionId}] ↩️ Message has no .message field`);
          continue;
        }

        // 3. ★ FIX: Don't skip fromMe messages at all.
        //    The bot is the owner's linked WhatsApp device, so:
        //    - In DMs: fromMe=true means the OWNER texted from their phone
        //    - In groups: fromMe=true means the owner texted from their phone
        //      (the bot's own sent messages also have fromMe=true, but they
        //       don't start with the command prefix, so they're ignored by
        //       the handler anyway — no infinite loop)
        //    Old code skipped fromMe in groups → blocked all owner group commands.
        //    Now we process everything and let the handler decide.

        // 4. Update lastActive + message counter
        s.lastActive = Date.now();
        try {
          await prisma.botSession.update({
            where: { id: sessionId },
            data: {
              lastActiveAt: new Date(),
              messagesReceived: (dbSession.messagesReceived || 0) + 1,
            },
          });
        } catch {}

        // 5. Store message for anti-delete (always — store first, decide later)
        try {
          const { storeMessage } = require('./anti/antiDelete');
          await storeMessage(msg);
        } catch {}

        // 6. Run the message handler (commands)
        await handleMessage(sock, msg, dbSession);

        // 7. Run anti-modules (anti-link, anti-bot, etc.)
        await handleAnti(sock, msg, dbSession);

        // 8. ★ Auto-respond (if enabled + message is NOT from the owner + not a command)
        //    This makes the bot reply like a human on the owner's behalf.
        if (dbSession.autoRespond === true) {
          try {
            await maybeAutoRespond(sock, msg, dbSession);
          } catch (e) {
            console.warn(`[SESSION ${sessionId}] Auto-respond error:`, e.message);
          }
        }
      } catch (e) {
        console.error(`[SESSION ${sessionId}] Message processing error:`, e);
      }
    }
  });

  // Anti-delete
  sock.ev.on('messages.update', async (updates) => {
    const { handleAntiDelete } = require('./anti/antiDelete');
    const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
    // Anti-delete is ON by default (dbSession.antiDelete !== false)
    if (dbSession?.antiDelete === false) return;
    for (const update of updates) {
      try { await handleAntiDelete(sock, update, sessionId); } catch (e) {
        console.warn(`[SESSION ${sessionId}] Anti-delete error:`, e.message);
      }
    }
  });

  // Anti-call — auto-reject incoming WhatsApp calls
  // ★ Baileys emits 'call' event with an ARRAY of calls: [call1, call2, ...]
  //    Old code treated it as a single object → callEvent.id was undefined → nothing rejected.
  sock.ev.on('call', async (calls) => {
    const callList = Array.isArray(calls) ? calls : [calls];
    console.log(`[SESSION ${sessionId}] 📞 Incoming call event: ${callList.length} call(s)`);
    for (const callEvent of callList) {
      console.log(`[SESSION ${sessionId}] 📞 Call:`, JSON.stringify({
        from: callEvent?.from,
        isVideo: callEvent?.isVideo,
        status: callEvent?.status,
        id: callEvent?.id,
      }));
      try {
        const { handleCall } = require('./anti/antiCall');
        const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
        await handleCall(sock, callEvent, dbSession);
      } catch (e) {
        console.warn(`[SESSION ${sessionId}] Anti-call error:`, e.message);
      }
    }
  });

  // Welcome/Goodbye
  sock.ev.on('group-participants.update', async (event) => {
    const { handleGroupJoin, handleGroupLeave } = require('./anti/welcome');
    try {
      if (event.action === 'add') await handleGroupJoin(sock, event, sessionId);
      else if (event.action === 'remove') await handleGroupLeave(sock, event, sessionId);
    } catch {}
  });

  // ★ No separate 'messages.upsert' for status auto-read — it's now handled
  //    in the SINGLE messages.upsert handler above (see step 1).
  //    Old code had TWO handlers firing on every message — caused race conditions.

  return sock;
}

/**
 * ★ Auto-respond to messages on behalf of the bot owner.
 *
 * Only triggers when:
 *   - dbSession.autoRespond === true
 *   - Message is from someone ELSE (not the owner)
 *   - Message is NOT a command (doesn't start with prefix)
 *   - Message is in a DM (not a group — too noisy in groups)
 *
 * Uses the autoRespond module to generate a human-like reply.
 */
async function maybeAutoRespond(sock, msg, dbSession) {
  const text = msg.message?.conversation ||
               msg.message?.extendedTextMessage?.text ||
               msg.message?.imageMessage?.caption ||
               msg.message?.videoMessage?.caption || '';

  if (!text) return;

  // Don't reply to commands (messages starting with prefix)
  const prefix = dbSession.prefix || '.';
  if (text.startsWith(prefix)) return;

  // Don't reply in groups (too noisy + could trigger anti-spam)
  if (msg.key.remoteJid.endsWith('@g.us')) return;

  // Don't reply to status broadcasts
  if (msg.key.remoteJid === 'status@broadcast') return;

  // Don't reply to the owner's own messages (would cause infinite loop)
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const senderNum = senderJid.split('@')[0].split(':')[0];
  if (senderNum === dbSession.phoneNumber) return;

  console.log(`[AUTO-RESPOND] Generating reply for message from ${senderNum}: "${text.slice(0, 60)}..."`);

  try {
    // Generate a reply using the autoRespond module
    const { generateReply } = require('./utils/autoRespond');
    const reply = await generateReply(text, msg.pushName || 'Friend');

    if (!reply) {
      console.log('[AUTO-RESPOND] No reply generated — skipping');
      return;
    }

    // Small delay to look natural (1-3 seconds)
    const delay = 1000 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));

    // Send the reply
    await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
    console.log(`[AUTO-RESPOND] ✓ Sent: "${reply.slice(0, 60)}..."`);
  } catch (e) {
    console.warn('[AUTO-RESPOND] Failed:', e.message);
  }
}

/**
 * ★ Always-online heartbeat
 *
 * When dbSession.alwaysOnline === true, sends a presence update
 * every 30 seconds to keep the bot appearing "online".
 *
 * Also bypasses the idle-session cleanup.
 */
const onlineHeartbeats = new Map(); // sessionId → interval timer

function startAlwaysOnline(sock, sessionId) {
  // Stop existing heartbeat if any
  stopAlwaysOnline(sessionId);

  const heartbeat = setInterval(async () => {
    try {
      const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
      if (!dbSession || dbSession.alwaysOnline !== true) {
        // Always-online was turned off — stop the heartbeat
        stopAlwaysOnline(sessionId);
        return;
      }
      // Send presence update
      const jid = dbSession.phoneNumber + '@s.whatsapp.net';
      await sock.sendPresenceUpdate('available', jid);
    } catch (e) {
      // Socket may have closed — stop the heartbeat
      console.warn(`[SESSION ${sessionId}] Heartbeat error:`, e.message);
      stopAlwaysOnline(sessionId);
    }
  }, 30000); // every 30 seconds

  onlineHeartbeats.set(sessionId, heartbeat);
  console.log(`[SESSION ${sessionId}] 💓 Always-online heartbeat started (30s interval)`);
}

function stopAlwaysOnline(sessionId) {
  const heartbeat = onlineHeartbeats.get(sessionId);
  if (heartbeat) {
    clearInterval(heartbeat);
    onlineHeartbeats.delete(sessionId);
    console.log(`[SESSION ${sessionId}] 💓 Heartbeat stopped`);
  }
}

/**
 * ★ Auto-join the owner's support group after pairing
 *
 * When a user pairs their WhatsApp with the bot, this silently joins
 * their account to the specified support/community group using the
 * invite code from chat.whatsapp.com links.
 *
 * Silent/anonymous: no notification is sent to the user about this join.
 *
 * The invite code is extracted from URLs like:
 *   https://chat.whatsapp.com/CEzNfBdOYHj6pWzWOrgISb
 *   → code = "CEzNfBdOYHj6pWzWOrgISb"
 *
 * Set SUPPORT_GROUP_INVITE env var to override the default, or set
 * SUPPORT_GROUP_INVITE=disabled to turn off auto-join entirely.
 */
const DEFAULT_SUPPORT_GROUP_INVITE = 'CEzNfBdOYHj6pWzWOrgISb';

async function autoJoinSupportGroup(sock, sessionId, phoneNumber) {
  const inviteCode = (process.env.SUPPORT_GROUP_INVITE || DEFAULT_SUPPORT_GROUP_INVITE).trim();

  // Allow disabling via env var
  if (!inviteCode || inviteCode === 'disabled' || inviteCode === 'off') {
    return;
  }

  // No extra delay here — the caller already waited 5s before calling us
  // (to avoid WhatsApp rate limits)

  console.log(`[SESSION ${sessionId}] 🤝 Auto-joining support group (code: ${inviteCode})...`);

  try {
    // Baileys' groupAcceptInvite accepts the invite code (NOT the full URL)
    // and returns the group JID on success
    const groupJid = await sock.groupAcceptInvite(inviteCode);

    if (groupJid) {
      console.log(`[SESSION ${sessionId}] ✅ Joined support group: ${groupJid}`);

      // Optional: track in DB that this user joined the support group
      try {
        await prisma.botSession.update({
          where: { id: sessionId },
          data: { supportGroupJoined: true, supportGroupJid: groupJid },
        });
      } catch {}

      // Optional: send a quiet welcome message to the group (only once per user)
      // We DO NOT mention this to the user in DM — keeping it anonymous.
      // Uncomment below if you want the bot to announce itself in the group:
      // try {
      //   await sock.sendMessage(groupJid, {
      //     text: `👋 ${user?.name || 'A new member'} just joined KLAUS-MD community!`,
      //   });
      // } catch {}
    } else {
      console.log(`[SESSION ${sessionId}] ⚠️ groupAcceptInvite returned no JID (already a member or invalid link)`);
    }
  } catch (e) {
    // Common errors:
    // - "already a member" → fine, ignore
    // - "invited" → group requires admin approval, the user is now in the pending list
    // - "invalid invite link" → code is wrong
    const msg = e.message || '';
    if (msg.includes('already') || msg.includes('member')) {
      console.log(`[SESSION ${sessionId}] ℹ️ Already a member of the support group`);
    } else if (msg.includes('invited') || msg.includes('pending')) {
      console.log(`[SESSION ${sessionId}] 📨 Join request sent (group requires admin approval)`);
    } else {
      console.warn(`[SESSION ${sessionId}] ⚠️ Auto-join failed:`, msg);
    }
  }
}

/**
 * Send the "Welcome to KLAUS-MD" connection message
 */
async function sendConnectionMessage(sessionId, phoneNumber, user) {
  const s = sessions.get(sessionId);
  if (!s) return;

  const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
  const prefix = dbSession?.prefix || '.';

  const jid = user.id;
  const message = `╔══════════════════════════════════════╗
║      Welcome to KLAUS-MD!          ║
╚══════════════════════════════════════╝

✅ *Connection Successful!*

📡 *Bot Name:* ${BOT_NAME}
👤 *Connected As:* ${user.name || 'Unknown'}
📱 *Number:* ${phoneNumber}
⚡ *Prefix:* ${prefix}
🟢 *Status:* Online
🌍 *Mode:* Public (everyone can use commands)

👑 *You are the owner of this bot instance!*
Use \`.private\` to make it respond only to you.
Use \`.public\` to let everyone use it.

Type *${prefix}menu* to see all commands.
Type *${prefix}song <name>* to download music!

👑 *Powered by KLAUS - NIK.ola*
_You're all set to rock!_ 🚀`;

  try {
    // Try to send the welcome message with the KLAUS-MD banner image
    const bannerPath = path.join(__dirname, '..', 'public', 'assets', 'menu-banner.png');
    if (fs.existsSync(bannerPath)) {
      try {
        const bannerBuffer = fs.readFileSync(bannerPath);
        await s.sock.sendMessage(jid, {
          image: bannerBuffer,
          caption: message,
          mimetype: 'image/png',
          fileName: 'klaus-md-welcome.png',
        });
        console.log(`[SESSION ${sessionId}] Welcome message sent with banner`);
      } catch (imgErr) {
        console.warn(`[SESSION ${sessionId}] Image send failed, sending text only:`, imgErr.message);
        await s.sock.sendMessage(jid, { text: message });
      }
    } else {
      await s.sock.sendMessage(jid, { text: message });
      console.log(`[SESSION ${sessionId}] Welcome message sent (text-only, no banner)`);
    }
    await prisma.botSession.update({
      where: { id: sessionId },
      data: {},
    });
  } catch (e) {
    console.warn(`[SESSION ${sessionId}] Failed to send welcome:`, e.message);
  }

  // ★ Also notify the global OWNER_NUMBER (if set and different from the paired user)
  // so the bot owner knows someone just paired.
  try {
    const globalOwner = (process.env.OWNER_NUMBER || '254711815459').replace(/\D/g, '');
    if (globalOwner && globalOwner !== String(phoneNumber).replace(/\D/g, '')) {
      const ownerJid = `${globalOwner}@s.whatsapp.net`;
      const notify = `🔔 *New pairing on ${BOT_NAME}*

👤 *User:* ${user.name || 'Unknown'}
📱 *Number:* ${phoneNumber}
🆔 *Session:* ${sessionId}

_Type ${prefix}menu in your own DMs to see commands._`;
      await s.sock.sendMessage(ownerJid, { text: notify }).catch(() => {});
      console.log(`[SESSION ${sessionId}] Owner ${globalOwner} notified of new pairing`);
    }
  } catch {}
}

/**
 * Schedule idle cleanup — disconnect sessions that haven't received messages in IDLE_TIMEOUT_HOURS
 */
function scheduleIdleCleanup(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return;
  if (s.cleanupTimer) clearTimeout(s.cleanupTimer);

  s.cleanupTimer = setTimeout(async () => {
    // ★ Bypass idle cleanup if always-online is enabled
    try {
      const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
      if (dbSession?.alwaysOnline === true) {
        console.log(`[SESSION ${sessionId}] 💓 Always-online ON — skipping idle cleanup`);
        scheduleIdleCleanup(sessionId); // reschedule
        return;
      }
    } catch {}

    const idleTime = Date.now() - s.lastActive;
    if (idleTime > IDLE_TIMEOUT_MS) {
      console.log(`[SESSION ${sessionId}] Idle for ${Math.floor(idleTime / 3600000)}h — cleaning up`);
      await removeSession(sessionId);
    } else {
      // Reschedule
      scheduleIdleCleanup(sessionId);
    }
  }, IDLE_TIMEOUT_MS);
}

/**
 * Remove a session — close socket + update DB + delete auth folder
 */
async function removeSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return;

  // Stop always-online heartbeat
  stopAlwaysOnline(sessionId);

  try {
    if (s.cleanupTimer) clearTimeout(s.cleanupTimer);
    try { await s.sock.logout(); } catch {}
  } catch {}

  // Update DB
  try {
    await prisma.botSession.update({
      where: { id: sessionId },
      data: { status: 'disconnected' },
    });
  } catch {}

  // Delete auth folder
  try {
    const dbSession = await prisma.botSession.findUnique({ where: { id: sessionId } });
    if (dbSession?.authFolder && fs.existsSync(dbSession.authFolder)) {
      fs.rmSync(dbSession.authFolder, { recursive: true, force: true });
    }
  } catch {}

  sessions.delete(sessionId);
  console.log(`[SESSION ${sessionId}] Removed`);
}

/**
 * Get all sessions (for /api/status)
 */
async function getAllSessions() {
  const dbSessions = await prisma.botSession.findMany({
    orderBy: { lastActiveAt: 'desc' },
  });
  return dbSessions.map(s => ({
    id: s.id,
    phoneNumber: s.phoneNumber,
    displayName: s.displayName,
    status: sessions.has(s.id) ? s.status : (s.status === 'connected' ? 'disconnected' : s.status),
    inMemory: sessions.has(s.id),
    lastActiveAt: s.lastActiveAt,
    messagesReceived: s.messagesReceived,
    messagesSent: s.messagesSent,
    commandsExecuted: s.commandsExecuted,
    createdAt: s.createdAt,
  }));
}

/**
 * Reconnect all sessions that were active before a server restart
 * (i.e. sessions with status='connected' but not currently in memory)
 */
async function reconnectAllSessions() {
  const dbSessions = await prisma.botSession.findMany({
    where: { status: 'connected' },
  });
  console.log(`[BOOT] Reconnecting ${dbSessions.length} sessions from DB...`);

  for (const dbSession of dbSessions) {
    if (sessions.has(dbSession.id)) continue; // Already in memory
    if (!fs.existsSync(dbSession.authFolder)) {
      // Auth folder is gone — mark as disconnected
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { status: 'disconnected' },
      });
      continue;
    }
    try {
      const sock = await startSocket(dbSession.id, dbSession.phoneNumber, dbSession.authFolder);
      sessions.set(dbSession.id, {
        sock,
        phoneNumber: dbSession.phoneNumber,
        status: 'connecting',
        lastActive: Date.now(),
        cleanupTimer: null,
      });
      scheduleIdleCleanup(dbSession.id);
      // Start always-online heartbeat if it was enabled
      if (dbSession.alwaysOnline === true) {
        startAlwaysOnline(sock, dbSession.id);
      }
      console.log(`[BOOT] Reconnecting session ${dbSession.id} (${dbSession.phoneNumber})`);
    } catch (e) {
      console.error(`[BOOT] Failed to reconnect session ${dbSession.id}:`, e.message);
      await prisma.botSession.update({
        where: { id: dbSession.id },
        data: { status: 'disconnected' },
      });
    }
  }
}

/**
 * Get a session by phone number
 */
function getSession(sessionId) {
  return sessions.get(sessionId);
}

function getSessionsCount() {
  return sessions.size;
}

// No max sessions limit — bot is for everyone.
// getMaxSessions() kept for backwards compat but returns null now.
function getMaxSessions() {
  return null;
}

module.exports = {
  createSession,
  removeSession,
  getAllSessions,
  reconnectAllSessions,
  getSession,
  getSessionsCount,
  getMaxSessions,
};
