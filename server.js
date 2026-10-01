/**
 * KLAUS-MD v2.0 — Multi-user WhatsApp bot pairing server
 *
 * Zero-config deployment:
 *   - Anyone can visit the site + pair their WhatsApp
 *   - The FIRST user to pair becomes the "owner" (stored in DB)
 *   - Each user gets their own Baileys bot instance
 *   - Sessions are tracked in Prisma DB (SQLite)
 *   - Idle sessions auto-disconnect after IDLE_TIMEOUT_HOURS
 *
 * Env vars (ALL optional — defaults work for Render free tier):
 *   PORT, BOT_NAME, PREFIX, DATABASE_URL, MAX_SESSIONS,
 *   IDLE_TIMEOUT_HOURS, PAIRING_CODE_TTL, SITE_PASSWORD,
 *   ANTI_DELETE, AUTO_READ_STATUS, OWNER_NUMBER
 *
 * Defaults:
 *   BOT_NAME       = KLAUS-MD
 *   OWNER_NUMBER   = 254711815459
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const { ensureDB, prisma } = require('./lib/db');
const sessionManager = require('./lib/sessionManager');

const app = express();
// Port logic:
//   - Pterodactyl auto-sets SERVER_PORT (e.g. 2532) → use that
//   - Render sets PORT → use that
//   - Else (mini-service alongside Next.js on port 3000), use 3001
const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;
const BOT_NAME = process.env.BOT_NAME || 'KLAUS-MD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '254711815459';
const PAIRING_CODE_TTL = parseInt(process.env.PAIRING_CODE_TTL || '90', 10);

/**
 * Normalize a phone number to international format (digits only, no leading 0).
 * - Strips + and spaces
 * - Strips a single leading 0 (local prefix) — user must still provide country code
 * - Validates length 8..15
 * Returns the normalized number, or null if invalid.
 */
function normalizePhone(input) {
  if (!input) return null;
  let p = String(input).replace(/[^\d]/g, ''); // digits only
  if (!p) return null;
  // Strip one leading 0 (e.g., "0712345678" → "712345678") — but ONLY if there's a
  // country code after it. If user typed "0254..." that's ambiguous, leave it.
  if (p.length > 10 && p.startsWith('0')) p = p.slice(1);
  if (!/^\d{8,15}$/.test(p)) return null;
  return p;
}

/**
 * Format a Baileys pairing code with a dash for readability.
 * Baileys may return "ABCDEFGH" or "ABCD-EFGH" — normalize to "ABCD-EFGH".
 */
function formatPairCode(code) {
  if (!code) return code;
  const c = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (c.length === 8) return c.slice(0, 4) + '-' + c.slice(4);
  return c;
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============ API ENDPOINTS ============

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    sessions: sessionManager.getSessionsCount(),
  });
});

// Bot status — overall + list of all sessions
app.get('/api/status', async (req, res) => {
  try {
    const sessions = await sessionManager.getAllSessions();
    const activeSessions = sessions.filter(s => s.status === 'connected').length;
    res.json({
      botName: BOT_NAME,
      version: '1.0.0',
      activeSessions,
      totalPaired: sessions.length,
      sessions: sessions.slice(0, 20),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Request a pairing code — creates a new session
app.post('/api/pair', async (req, res) => {
  try {
    const rawPhone = req.body?.phoneNumber;
    const phoneNumber = normalizePhone(rawPhone);

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Invalid phone number. Use digits only with country code. Example: 254712345678 (no +, no spaces, no leading 0).',
      });
    }

    if (process.env.SITE_PASSWORD && req.body?.password !== process.env.SITE_PASSWORD) {
      return res.status(401).json({ error: 'Wrong site password' });
    }

    // Check if this number is already paired AND active
    const existing = await prisma.botSession.findUnique({ where: { phoneNumber } });
    if (existing && existing.status === 'connected') {
      return res.status(409).json({
        error: 'This number is already paired. Send .disconnect from WhatsApp or use the disconnect button.',
      });
    }

    console.log(`[PAIR] Requesting pairing code for ${phoneNumber} (raw input: "${rawPhone}")`);

    // Create session
    const result = await sessionManager.createSession(phoneNumber);

    // Format the code with a dash for readability (e.g., "ABCD-EFGH")
    const prettyCode = formatPairCode(result.code);

    console.log(`[PAIR] ✓ Code generated for ${phoneNumber}: ${prettyCode} (raw: ${result.code})`);

    res.json({
      success: true,
      code: prettyCode,
      rawCode: result.code,
      sessionId: result.sessionId,
      phoneNumber,
      expiresIn: PAIRING_CODE_TTL,
      instructions: [
        '1. Open WhatsApp on your phone',
        '2. Tap Settings → Linked Devices → Link a Device',
        '3. When the QR scanner opens, tap "Link with phone number instead"',
        '4. Enter the code below (with or without the dash):',
      ],
    });
  } catch (e) {
    console.error('[PAIRING ERROR]', e);
    res.status(500).json({ error: e.message || 'Failed to generate pairing code' });
  }
});

// Disconnect a specific session by phone number
app.post('/api/disconnect', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });

    const session = await prisma.botSession.findUnique({ where: { phoneNumber } });
    if (!session) return res.json({ ok: true, message: 'Already disconnected' });

    await sessionManager.removeSession(session.id);
    res.json({ ok: true, message: 'Disconnected. Session cleared.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get details for a specific session (by phone number)
app.get('/api/session/:phone', async (req, res) => {
  try {
    const session = await prisma.botSession.findUnique({
      where: { phoneNumber: req.params.phone },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({
      ...session,
      inMemory: sessionManager.getSession(session.id) !== undefined,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ START ============
async function start() {
  await ensureDB();

  // Reconnect sessions from DB (survives server restart)
  try {
    await sessionManager.reconnectAllSessions();
  } catch (e) {
    console.error('[BOOT] reconnectAllSessions error:', e.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║     ${BOT_NAME} v1.0 — Multi-user pairing server  ║`);
    console.log(`╚══════════════════════════════════════════════╝`);
    console.log(`\n🌐 Pairing site: http://localhost:${PORT}`);
    console.log(`📡 API:          http://localhost:${PORT}/api/status`);
    console.log(`💚 Health:       http://localhost:${PORT}/health`);
    console.log(`👥 Active sessions: ${sessionManager.getSessionsCount()} (no limit — bot is for everyone)`);
    console.log(`💾 DB:           SQLite at ${process.env.DATABASE_URL || 'file:./prisma/boboh.db'}\n`);
  });

  // Keep process alive — handle uncaught errors gracefully
  process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT]', err);
  });
  process.on('unhandledRejection', (err) => {
    console.error('[UNHANDLED]', err);
  });
  process.on('exit', (code) => {
    console.error(`[EXIT] Process exiting with code ${code}`);
  });
  process.on('SIGTERM', () => {
    console.log('[SIGTERM] Received — shutting down');
  });
  process.on('SIGINT', () => {
    console.log('[SIGINT] Received — shutting down');
    process.exit(0);
  });
}

start().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
