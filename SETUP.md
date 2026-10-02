# KLAUS-MD — WhatsApp Bot Setup Guide

This is **KLAUS-MD** — a customized version of **WOLFBOT v1.1.5** (by WOLVAREX), pre-configured for your preferences. Follow this guide step-by-step to get your bot online.

---

## ✅ What's pre-configured for you

| Setting         | Value                   | Where to change later                          |
|-----------------|-------------------------|------------------------------------------------|
| Bot name        | `KLAUS-MD`              | `.env` → `BOT_NAME`  or runtime `.setbotname`  |
| Owner number    | `254711815459`          | `.env` → `OWNER_NUMBER`                          |
| Command prefix  | `.`                     | `.env` → `BOT_PREFIX` or runtime `.setprefix`    |
| Bot mode        | `public`                | `.env` → `BOT_MODE`   or runtime `.setmode`     |
| Timezone        | `Africa/Nairobi`        | `.env` → `BOT_TIMEZONE`                         |
| Deploy target   | Railway / Render        | Use `railway.json` / `render.yaml` / `Dockerfile`|
| AI chat         | ✅ Enabled (chatgpt, gemini, claudeai, deepseek, …) | Auto-on — uses bundled XWOLF_API_KEY |
| AI video        | ⛔ Not requested        | Set `PAYSTACK_KEY` / `XWOLF_API_KEY` to enable  |
| Wolf AI assistant | ⛔ Not requested      | Use runtime `.wolf on` to enable if needed       |
| Paystack M-Pesa | ⛔ Not requested        | Leave `PAYSTACK_KEY` empty to keep disabled     |

---

## 📦 1. Finalize your `.env`

Open `.env` (copy from `.env.example` if it doesn't exist) and **replace every placeholder**:

```env
BOT_NAME=KLAUS-MD
OWNER_NUMBER=254711815459
BOT_PREFIX=.
BOT_MODE=public
BOT_TIMEZONE=Africa/Nairobi
SESSION_ID=
DATABASE_URL=
PTERODACTYL_KEY=
PTERODACTYL_URL=
PAYSTACK_KEY=
XWOLF_API_KEY=wxa_u_xwk7sch6xj
```

> 🔐 **Never commit `.env` to git.** It is in `.gitignore`. On Railway/Render, set these as environment variables in the dashboard instead.

---

## 🚀 2. Pick a deploy path

### Option A — Local test (recommended first time)

```bash
npm install
npm start
```

On first boot you'll see a **pairing menu** printed in the terminal. Choose Option 1 → enter your phone number → you'll get an 8-char pair code. Open WhatsApp on your phone → **Settings → Linked Devices → Link with phone number** → enter the code. The bot will then print a `SESSION_ID` banner starting with `KLAUS MD:`. Copy it, paste into `.env` as `SESSION_ID=`, restart, and the bot is online.

### Option B — Railway

1. Push this folder to a new GitHub repo (private is fine).
2. Go to https://railway.app → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects `railway.json` (NIXPACKS builder).
4. In **Variables**, add at minimum: `BOT_NAME`, `OWNER_NUMBER`, `SESSION_ID` (leave empty first), `XWOLF_API_KEY=wxa_u_xwk7sch6xj`.
5. Click **Deploy**. Watch **Logs** — a QR code will be printed. Scan it from your phone. The bot will then print your `SESSION_ID` — paste that back into Variables and redeploy.

### Option C — Render

1. Push to GitHub.
2. Go to https://render.com → **New → Blueprint** → pick your repo.
3. Render reads `render.yaml` automatically and creates the service.
4. Set `SESSION_ID`, `BOT_NAME`, `OWNER_NUMBER` in the **Environment** tab.
5. First deploy prints a QR in the **Logs** — scan, copy SESSION_ID, save, redeploy.

### Option D — Fly.io / Heroku / Docker / Pterodactyl

- Fly.io → use `fly.toml`
- Heroku → use `Procfile` + `app.json`
- Plain Docker → `docker build -t mybot . && docker run --env-file .env mybot`
- Pterodactyl → import `egg-nodejs-wolfbot.json`

---

## 📲 3. Pair WhatsApp (first-time only)

The bot uses **Wolf Socket** (Baileys fork). When you start the bot with `SESSION_ID=` empty, it prints:

```
╭─⌈  WOLFBOT CONTROL CORE ⌋
» 🏗️ Linux · 🔌 3000 · 📂 /logs
╰⊷

[KLAUS-AUTH] ⏱️ 09:57:17
◆ 01 → Pairing Code Login     ⟪Recommended⟫
◆ 02 → Clean Session Reset    ⟪Fresh Boot⟫
◆ 03 → ENV Session Injection  ⟪Advanced⟫

⚡ INPUT REQUIRED ▸ Select [1-3] ⟶ (default: 1):
```

### Option 1 — Pairing Code (easiest)
1. Type `1` and press Enter.
2. Enter your WhatsApp phone number in international format (e.g. `254711815459`).
3. The bot returns an **8-character pairing code** like `AB12-CD34`.
4. On your phone, open WhatsApp → **Settings → Linked Devices → Link with phone number**.
5. Enter the 8-character code.
6. WhatsApp links your account → the bot prints a `SESSION_ID` starting with `KLAUS MD:` (a clearly-visible banner in the terminal/deploy logs).
7. The bot also auto-saves it to `.env` as `SESSION_ID="KLAUS MD:..."` (quoted so the space in `KLAUS MD:` is shell-safe). On Railway/Render, paste it into the Variables tab since there's no `.env` file.

### Option 2 — Clean session reset
Wipes local session files and starts fresh. Useful when pairing is broken or stale.

### Option 3 — ENV session injection
Use this if you already have a `SESSION_ID` from a previous pairing. It writes it into the session store and connects.

> 💡 On Railway/Render, you can't type interactive input. The bot auto-falls-back to "Option 1 + ENV" when `SESSION_ID` is empty and stdin is non-TTY — you'll see a pairing code printed in the deploy logs. Pair on your phone, then the bot saves the SESSION_ID and continues. For subsequent deploys, paste that SESSION_ID into Variables so it auto-connects.
>
> 💡 WhatsApp may log you out every 30–60 days. Just clear `SESSION_ID`, restart, re-pair.

---

## 💬 4. Test your bot

Once connected, send these in any chat where the bot is a participant:

| Command            | What it does                            |
|--------------------|-----------------------------------------|
| `.menu`            | Show the full command menu              |
| `.ping`            | Quick health check                      |
| `.chatgpt hello`   | Ask ChatGPT a question                  |
| `.gemini hi`       | Ask Gemini                              |
| `.claudeai hi`     | Ask Claude                              |
| `.deepseek hi`     | Ask DeepSeek                            |
| `.setbotname KLAUS-MD` | Rename the bot at runtime               |
| `.setprefix !`     | Change the prefix at runtime            |
| `.setmode private` | Lock commands to owner-only             |
| `.settimezone Africa/Nairobi` | Change timezone at runtime   |
| `.sessionid`       | Print your `KLAUS MD:` SESSION_ID for backup/redeploy |

Full command list: `.menu` → `.aimenu` for the AI section.

---

## 🧰 5. Project layout (what's where)

```
.
├── index.js              ← 9.8K-line main entry: Baileys socket, message router
├── package.json          ← Dependencies (wolfsocket, wolfbtns, baileys, ...)
├── lib/                   ← 50+ helper modules (botname, aiHelper, menuHelper, ...)
├── commands/             ← 30+ command categories (only `ai/` is enabled by default)
│   ├── ai/                ← ChatGPT, Gemini, Claude, DeepSeek, ... (ENABLED)
│   ├── AIVideos/          ← AI video generators (off unless API key added)
│   ├── paystack/          ← M-Pesa payments (off unless PAYSTACK_KEY set)
│   ├── owner/             ← Bot owner commands (.setbotname, .restart, ...)
│   ├── utility/           ← Tools (ping, uptime, translate, ...)
│   ├── menus/             ← The main `.menu` command tree
│   └── ...                ← Anime, games, sports, news, etc.
├── settings.js           ← Repository URLs for the in-bot `.update` command
├── scripts/               ← Postinstall patches + dev utilities
├── Dockerfile             ← Container image (Railway/Render/Docker)
├── railway.json           ← Railway.app deploy config (NIXPACKS builder)
├── render.yaml            ← Render.com Blueprint
├── nixpacks.toml          ← Nixpacks build config (used by Railway)
├── fly.toml               ← Fly.io config
├── heroku.yml             ← Heroku Docker deploy
├── Procfile               ← Heroku traditional deploy
├── app.json               ← Heroku app.json + env-var schema
├── egg-nodejs-wolfbot.json ← Pterodactyl egg
├── .env.example           ← COPY this to .env and fill in your values
├── .replit                ← Replit.com config
└── SETUP.md               ← You are here
```

---

## ❓ 6. Troubleshooting

**Bot boots but QR code doesn't appear**
- Check that `SESSION_ID` is empty (not set to garbage).
- Increase log level — set `LOG_LEVEL=debug` in your env.
- Make sure ports 3000/3001 aren't already in use.

**`SESSION_ID has expired or been revoked by WhatsApp`**
- WhatsApp logged you out. Clear `SESSION_ID`, restart, scan a fresh QR.

**Bot connected but `.chatgpt` returns an error**
- The `XWOLF_API_KEY` (Wolf API) may have hit its rate limit. Default key is bundled; for production usage get your own from the WOLFBOT community.

**`Cannot find module 'wolfsocket'` / install errors**
- Run `npm install` again. The package is loaded from GitHub (`github:WOLVAREX/wolfsocket#91f843a`).
- If on Apple Silicon, also install `brew install cairo pango libjpeg giflib` for canvas.
- If `better-sqlite3` fails to build, install `python3 make g++` on your system.

**Railway/Render deploy fails with `OOMKilled`**
- Bump the service plan to at least 512 MB RAM. The bot loads ~30 command categories at boot.

**Owner commands say "❌ Owner not set"**
- Make sure `OWNER_NUMBER=254711815459` matches the number you used to pair WhatsApp (without `+` or spaces).

---

## 📝 7. Where to plug your own customizations

| Want to change…       | Do this                                                       |
|----------------------|---------------------------------------------------------------|
| Bot name              | `.env` → `BOT_NAME=NEW_NAME`  or runtime `.setbotname NEW`    |
| Owner number          | `.env` → `OWNER_NUMBER=2547XXXXXXXX`                         |
| Command prefix        | `.env` → `BOT_PREFIX=!`  or runtime `.setprefix !`            |
| Operating mode        | `.env` → `BOT_MODE=private` or runtime `.setmode private`     |
| Timezone             | `.env` → `BOT_TIMEZONE=Africa/Lagos`                          |
| Add a new command     | Drop a `.js` file in `commands/<category>/` — auto-loaded     |
| Disable a category    | Delete or rename its folder, e.g. `commands/AIVideos` → `commands/AIVideos.disabled` |
| Update XWOLF_API_KEY  | `.env` → `XWOLF_API_KEY=your_new_key`                         |

---

Enjoy your **KLAUS-MD** WhatsApp bot! 
