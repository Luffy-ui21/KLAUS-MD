# 👑 KLAUS-MD v1.0 — Premium Multi-User WhatsApp Bot

> Multi-user WhatsApp bot built with the official Baileys library. **Anyone can pair + connect** — each user gets their own isolated bot instance. Pairing via code (no QR scanning), 50+ commands, anti-commands, JSON session DB, and a slick KLAUS-MD branded pairing site. **Built for everyone — every user who pairs owns their own bot. No session limit.**
>
> 👑 **Powered by KLAUS - NIK.ola**  ·  Global owner: `+254711815459` — receives pairing notifications and can use commands on any session.

![KLAUS-MD Banner](public/assets/menu-banner.png)

## ⚙️ Identity (defaults)

```env
BOT_NAME=KLAUS-MD
OWNER_NUMBER=254711815459
```

These are baked in as defaults in `server.js`, `lib/sessionManager.js`, `lib/handler.js`, and `lib/utils/permissions.js`, so the bot works out-of-the-box on Render / Railway / Vercel with zero config. Override them in your `.env` or hosting dashboard if you want to change them later.

## ✨ What's new in v1.0

- 👑 **Rebranded to KLAUS-MD** — Bot name updated everywhere (server defaults, welcome messages, menus, sticker pack name, pairing site title/footer, package.json, render.yaml).
- 📱 **Global owner: +254711815459** — `OWNER_NUMBER` env var is now set by default. The owner receives a notification whenever a new user pairs the bot. In private mode, the global owner can use commands on ANY paired session, not just their own.
- 🛡️ **`isBotOwner` now recognizes the global owner** in addition to the paired user (lib/utils/permissions.js).
- 🎨 **Sticker pack metadata** — Default pack: `KLAUS-MD`, default author: `254711815459`.
- 🔔 **New-pairing notification** — When a user pairs, the global owner receives a WhatsApp message with the new user's number and session ID.

## ✨ What was new in v4.3

- 🐛 **CRITICAL FIX: Baileys browser descriptor corrected** — Now uses `Browsers.appropriate('Chrome')` which returns a realistic `['Ubuntu', 'Chrome', '22.04.4']` fingerprint instead of leaking the bot name as the OS.
- ♾️ **No session limit** — Removed `MAX_SESSIONS` enforcement entirely. Bot is for everyone. (Each Baileys socket uses ~30-50MB RAM; scale your host accordingly.)
- 🧹 **Cleaned stale sessions.json** — All previously stuck "pairing" sessions cleared.
- 🚫 **Removed "Max" stat from UI** — Stats card now shows only "Active" and "Total Paired".
- 🧠 **Smarter connection.close handling** — 401 during pairing no longer auto-reconnects.
- ⚙️ **`markOnlineOnConnect: false`** + **`linkPreview: false`** — less suspicious to WhatsApp.

## 🚀 Quick Start

### Local development

```bash
git clone https://github.com/xtechkin-svg/YOBBY-MD.git
cd YOBBY-MD
# (or rename your local folder to KLAUS-MD-V1 if you prefer)
npm install
npm start            # No .env file needed — all defaults work
```

Open `http://localhost:3001` → enter your phone number → get pairing code.

> 💡 **No env vars needed!** All settings have sensible defaults (BOT_NAME=KLAUS-MD, OWNER_NUMBER=254711815459). Override them in `.env` if you want.

### Deploy on Render (zero-config!) 🚀

1. Fork this repo on GitHub
2. Go to **[render.com](https://render.com)** → sign up with GitHub (free)
3. Click **"New +"** → **"Web Service"**
4. Select your forked repo (renamed `KLAUS-MD-V1`)
5. Render auto-detects `render.yaml` — pre-fills everything:
   - **Build:** `npm install`
   - **Start:** `node server.js`
   - **Plan:** Free (or Starter for always-on + persistent disk)
6. Click **"Create Web Service"** — that's it!
7. Wait ~2 minutes for the build
8. Visit your Render URL → pair your WhatsApp

> ⚠️ **Free tier sleep:** Render free tier sleeps after 15 min of no traffic. Use [UptimeRobot](https://uptimerobot.com) (free) to ping your Render URL every 5 min and keep it awake.

## 📋 Commands

Prefix: `.` (period) — each user can have their own prefix (stored in DB)

### Main
| Command | Description |
|---|---|
| `.menu` | Show all commands **with KLAUS-MD banner image** |
| `.ping` | Check bot latency |
| `.alive` | Show bot status |
| `.owner` | Show owner contact |
| `.whoami` | Show YOUR session info (per-user) |
| `.dp` | Set bot display picture (reply to image) |
| `.dp view` | View current DP |
| `.disconnect` | Disconnect this WhatsApp from the bot |

### Group Admin
| Command | Description |
|---|---|
| `.tagall <msg>` | Mention everyone |
| `.kick @user` | Remove a user |
| `.promote @user` | Make admin |
| `.demote @user` | Remove admin |
| `.mute` / `.unmute` | Group only-admins / open |
| `.link` | Get invite link |
| `.revoke` | Reset invite link |
| `.setname <name>` | Change group name |
| `.setdesc <desc>` | Change group description |
| `.delete` | Delete replied message |

### Media
| Command | Description |
|---|---|
| `.sticker <pack>` | Convert image to sticker (pack: KLAUS-MD, author: 254711815459) |
| `.vv` | Unlock view-once media |
| `.tts <text>` | Text to speech |
| `.logo <text>` | Generate text logo |

### Tools
| Command | Description |
|---|---|
| `.url <long-url>` | Shorten URL |
| `.qr <text>` | Generate QR code |
| `.weather <city>` | Get weather |
| `.translate <lang> <text>` | Translate text |
| `.google <query>` | Search Google |
| `.wiki <query>` | Search Wikipedia |
| `.calculate <expr>` | Math calculator |

### Fun
| Command | Description |
|---|---|
| `.quote` `.joke` `.fact` | Random content |
| `.8ball <q>` `.coinflip` `.dice` | Games |
| `.truth` `.dare` | Truth or dare |

### Owner Only
| Command | Description |
|---|---|
| `.pp` | Set profile picture |
| `.block @user` `.unblock @user` | Block management |
| `.restart` `.shutdown` | Process control |

### Anti-Commands
| Command | Description |
|---|---|
| `.antilink on|off|kick` | Toggle anti-link per group |
| `.antibot on|off` | Toggle anti-bot detection |
| Auto-anti-delete | Enabled by default (per-user setting) |
| Welcome/Goodbye | Auto on group join/leave |

## ⚙️ Configuration

Edit `.env` (all optional — see `.env.example`):

```env
PORT=3001
BOT_NAME=KLAUS-MD
OWNER_NUMBER=254711815459
PREFIX=.
IDLE_TIMEOUT_HOURS=6        # Auto-disconnect idle sessions (frees RAM)
PAIRING_CODE_TTL=90         # Pairing code expiry (seconds)
SITE_PASSWORD=              # Optional — require password to access pairing site
ANTI_DELETE=true
AUTO_READ_STATUS=true
SUPPORT_GROUP_INVITE=CEzNfBdOYHj6pWzWOrgISb   # Auto-join this group after pairing (set to 'disabled' to turn off)
```

> **Multi-user note:** Every user who pairs owns their own bot instance. The `OWNER_NUMBER` above is the **global owner** — they receive notifications when anyone pairs, and in private mode they can use commands on any session. There is NO max session limit. Each Baileys socket uses ~30-50MB RAM; scale your host based on expected concurrent users.

## 🛠️ Adding New Commands

Drop any `.js` file in `lib/commands/` with this format — auto-loaded on startup:

```js
module.exports = {
  name: 'mycommand',
  aliases: ['mc', 'mycmd'],
  desc: 'Does something cool',
  category: 'fun',
  async execute({ sock, msg, args, reply, from, isGroup, dbSession, prefix, botName, pushName }) {
    await reply('Hello from my custom command!');
  },
};
```

Use it with `.mycommand` or `.mc`.

## 📁 Project Structure

```
KLAUS-MD-V1/
├── server.js              # Express pairing server + multi-user endpoints
├── package.json
├── render.yaml            # Render.com deployment (BOT_NAME=KLAUS-MD, OWNER_NUMBER set)
├── vercel.json            # Vercel config
├── .env.example           # Full env var reference
├── lib/
│   ├── db.js              # JSON-file session store (no external DB needed)
│   ├── sessionManager.js  # Multi-user session manager (Baileys)
│   ├── handler.js         # Message router + command loader
│   ├── bot.js             # Legacy single-user Baileys connector (kept for reference)
│   ├── utils/permissions.js  # isBotOwner / isGroupAdmin / isBotAdmin (respects OWNER_NUMBER)
│   ├── commands/          # 50+ command modules
│   └── anti/              # Anti-command modules
└── public/
    ├── index.html         # KLAUS-MD themed pairing site (Powered by KLAUS - NIK.ola)
    └── assets/
        ├── menu-banner.png  # ★ KLAUS-MD banner (used in .menu + welcome + site hero)
        ├── favicon.png      # Site favicon (same as banner)
        └── ...              # (legacy) svg logos
```

## ⚠️ Disclaimer

This bot is for educational purposes. Using automated bots on WhatsApp may violate their Terms of Service. Use at your own risk. The authors are not responsible for any account bans or legal issues.

## 📝 License

MIT — see [LICENSE](LICENSE).

## 👤 Author

**KLAUS - NIK.ola** — [GitHub](https://github.com/xtechkin-svg)

---

⭐ If you find this useful, star the repo!
