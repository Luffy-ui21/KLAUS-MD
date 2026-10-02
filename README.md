# 👑 KLAUS-MD v1.0 — Premium Multi-User WhatsApp Bot

> A customized version of **WOLFBOT v1.1.5** (by WOLVAREX), pre-configured and rebranded for **KLAUS - NIK.ola**.
>
> 👑 **Global Owner:** `+254711815459` · 🕒 Timezone: `Africa/Nairobi` · 🔘 Prefix: `.` · 🌐 Mode: `public`
>
> **900+ commands** across 30+ categories: AI chat, image-gen, stickers, downloads, group admin, anti-spam, economy, games, stalker, ethical-hacking, paystack, channel automation, and more.

---

## 🚀 Quick Deploy on Render (Docker-based)

This bot ships with a `Dockerfile` and `render.yaml` already configured. Render will use them automatically.

1. **Push this repo to your GitHub** (already done if you're reading this on GitHub).
2. Go to https://render.com → **New +** → **Blueprint**
3. Select this repo (`Luffy-ui21/KLAUS-MD`)
4. Render auto-detects `render.yaml`:
   - **Runtime:** Docker
   - **Region:** Frankfurt
   - **Plan:** Free
   - **Env vars pre-set:** `BOT_NAME=KLAUS-MD`, `OWNER_NUMBER=254711815459`, `BOT_PREFIX=.`, `BOT_MODE=public`, `BOT_TIMEZONE=Africa/Nairobi`
5. Click **Apply** → wait ~5 min for the Docker image to build
6. Once deployed, open Render's **Logs** tab — the bot will print a pairing menu in the terminal
7. Choose option 1, enter your phone number, get the 8-character code (e.g. `AB12-CD34`)
8. On your phone: WhatsApp → Settings → Linked Devices → Link with phone number → enter code
9. The bot will print a `SESSION_ID=KLAUS-MD:eyJ...` string in the logs
10. Go to Render → Environment → set `SESSION_ID` to that string → Save → redeploy

> 💡 **Tip:** Use [UptimeRobot](https://uptimerobot.com) (free) to ping your Render URL every 5 min so the free tier doesn't sleep.

---

## 💻 Local Development

Requirements: **Node.js 22+** (the `engines` field is enforced), `ffmpeg` (for media commands).

```bash
git clone https://github.com/Luffy-ui21/KLAUS-MD.git
cd KLAUS-MD
npm install         # will also run the postinstall patch-modules script
npm start           # or: npm run dev
```

On first boot, the bot will print a pairing menu — follow the same flow as above. The `SESSION_ID` will be auto-written to your local `.env` file (since `.env` is git-ignored, it stays on your machine).

---

## ⚙️ Configuration

All settings live in `.env` (locally) or the Render Environment tab (in production). Copy `.env.example` to `.env` to get started.

| Variable | Default | Description |
|---|---|---|
| `BOT_NAME` | `KLAUS-MD` | Display name in menus, footers, status messages |
| `OWNER_NUMBER` | `254711815459` | Your WhatsApp number (international format, digits only) — becomes the bot owner with admin/sudo privileges |
| `BOT_PREFIX` | `.` | The character that prefixes every command |
| `BOT_MODE` | `public` | `public` / `private` / `group` / `solo` / `sudo` / `super` / `buttons` / `channel` |
| `BOT_TIMEZONE` | `Africa/Nairobi` | IANA timezone (see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) |
| `SESSION_ID` | *(empty)* | **Leave empty on first boot** — bot auto-fills it after pairing |
| `DATABASE_URL` | *(empty)* | PostgreSQL URL for persistent storage. Leave blank to use local SQLite |
| `XWOLF_API_KEY` | `wxa_u_xwk7sch6xj` | Pre-baked Wolf API key (internal — leave as-is) |

Optional integrations (all empty by default = disabled):

| Variable | Description |
|---|---|
| `PTERODACTYL_KEY` + `PTERODACTYL_URL` | Enable cpanel/* commands |
| `PAYSTACK_KEY` | Enable M-Pesa STK push payment commands |

---

## 📋 Command Categories

| Category | Examples |
|---|---|
| 🤖 AI | `.ai`, `.chat`, `.imagine`, `.gpt` |
| 🎨 Image-gen | `.imagine`, `.imagegen`, `.remini`, `.anime`, `.art` |
| 💞 Valentine | `.lovelock`, `.weddingday`, `.loveletter`, `.rosevine` |
| 🔍 Stalker | `.igstalk`, `.gitstalk`, `.ipstalk`, `.wachannel` |
| 🎵 Media | `.play`, `.song`, `.yta`, `.ytv`, `.video` |
| 🎮 Games | chess, math games, truth/dare, 8ball |
| 👥 Group | `.kick`, `.promote`, `.tagall`, `.mute`, `.link` |
| 🛡️ Anti | `.antilink`, `.antibot`, `.antidelete`, `.anticall` |
| 👑 Owner | `.setbotname`, `.setprefix`, `.setbotimage`, `.sessionid`, `.restart` |
| 🌍 Channel | `.channelreact`, WhatsApp channel broadcast tools |
| 💰 Economy | store, transfers, balance |
| 📰 News | BBC, tech news, sports |
| ⚡ Speed | performance tests |
| 🎁 Welcome | good morning/night, join/leave greetings |

Type `.menu` in WhatsApp to see the full command list with the KLAUS-MD banner.

---

## 📁 Project Structure

```
KLAUS-MD/
├── index.js                  # Main bot entrypoint (47K lines, all logic here)
├── settings.js               # Update config (disabled by default)
├── Dockerfile                # Render/Docker deployment
├── render.yaml               # Render Blueprint
├── fly.toml                  # Fly.io config
├── railway.json              # Railway config
├── heroku.yml                # Heroku config
├── package.json
├── .env.example              # Full env var reference
├── .replit                   # Replit config
├── bin/
│   └── yt-dlp                # YouTube downloader binary
├── lib/                      # Helper modules (webServer, authState, etc.)
├── commands/                 # 30+ subfolders, 900+ commands
│   ├── menus/                # Menu rendering (.menu, .menu2, buttonmenu)
│   ├── owner/                # Owner-only commands
│   ├── group/                # Group admin
│   ├── ai/                   # AI chat
│   ├── imagegen/             # AI image generation
│   ├── valentine/            # Valentine's Day commands
│   ├── stalker commands/     # Social media stalker
│   ├── economy/              # Economy/store
│   ├── ethical hacking/      # hashcheck, leakcheck, urlscan
│   └── ...                   # 20+ more categories
└── scripts/
    └── patch-modules.cjs     # Post-install patcher
```

---

## 🆘 Troubleshooting

**Bot doesn't respond after pairing:**
- Check Render logs for the `SESSION_ID=KLAUS-MD:eyJ...` line
- Make sure you pasted the SESSION_ID into the Render Environment tab
- Restart the service

**`npm install` fails on local:**
- Make sure you're on Node.js 22+ (`node --version`)
- The `wolfsocket` dependency pulls from GitHub — make sure your network can reach github.com

**Pairing code doesn't work:**
- Code expires after ~90 seconds
- Use the `.pair` command (in DM with the bot's number) to get a fresh code
- Or restart the service — the bot will print a fresh pairing menu on boot

**Commands not working in groups:**
- Check `BOT_MODE` — `private` blocks everyone except the owner
- Try `.mode public` (owner-only command) to switch modes

---

## ⚠️ Disclaimer

This bot is for educational purposes. Using automated bots on WhatsApp may violate their Terms of Service. Use at your own risk. The authors are not responsible for any account bans or legal issues.

---

## 📝 License

MIT — see [LICENSE](LICENSE).

## 👤 Author

**KLAUS - NIK.ola** · Global owner: `+254711815459` · [GitHub](https://github.com/Luffy-ui21/KLAUS-MD)

> _Based on WOLFBOT v1.1.5 by WOLVAREX — thanks for the upstream work._

---

⭐ If you find this useful, star the repo!
