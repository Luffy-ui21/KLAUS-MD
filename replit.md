# Silent WolfBot

Silent WolfBot is a WhatsApp bot that integrates AI, anime features, group management, and automation to enhance user experience.

## Run & Operate

The bot runs on Node.js via the **"WhatsApp Bot"** workflow.
*   **Run:** `npm start` (or use the WhatsApp Bot workflow in Replit)
*   **Required Env Vars:** `PORT` (for health check server, default 3000)
*   **Optional Env Vars:**
    *   `SESSION_ID` — pre-encoded WhatsApp session string (KLAUS MD: prefix or base64/JSON). Paste your pair code output here to auto-authenticate on startup.
    *   `DATABASE_URL` — PostgreSQL connection string (optional; SQLite used by default)
    *   `BOT_PREFIX` — command prefix (default `/`)
    *   `BOT_MODE` — `public` / `private` / `groups` / `dms`
    *   `BOT_TIMEZONE` — e.g. `Africa/Nairobi`
*   **WhatsApp Pairing:** Get a session string from https://7-w.vercel.app/wolf.html, then set it as `SESSION_ID` in Secrets.

## Stack

*   **Runtime:** Node.js 20 (ESM)
*   **Frameworks:** Express (for health check)
*   **ORM:** `better-sqlite3` (native synchronous SQLite)
*   **Build Tool:** _Populate as you build_
*   **Libraries:** `wolfsocket`, `axios`, `chalk`, `dotenv`, `ffmpeg`, `mumaker`, `wolfbtns`, `chess.js`

## Where things live

*   `index.js`: Main bot logic, WhatsApp connection, command routing.
*   `lib/`: Shared modules (`lib/database.js` for DB, `lib/botname.js` for dynamic bot name, `lib/commandButtons.js` for interactive buttons, `lib/actionSession.js` for temporary command sessions).
*   `commands/`: Command handlers organized by category (e.g., `commands/group/antibug.js`).
*   `data/`: Persistent storage (`bot.sqlite`, `critical_backup.json`, `bot_name.json`, `commands/economy/users.json`, `data/games/sessions.json`).
*   `settings.js`: Bot configuration.
*   `app.json`: Application settings.

## Architecture decisions

*   **SQLite as Primary Data Store**: Migrated all configurations and persistent data from JSON files to a local SQLite database (`bot.sqlite`) using `better-sqlite3` for zero-config persistence and performance.
*   **Performance Optimization (Prepared Statements)**: Implemented a prepared statement cache for `better-sqlite3` queries to significantly reduce memory consumption and prevent OOM errors, especially during connection floods.
*   **Heroku Ephemeral Filesystem Fix (pg→SQLite restore)**: On Heroku, `data/bot.sqlite` and `data/critical_backup.json` are wiped on every dyno restart. All writes now mirror to PostgreSQL (`setConfig`, `setAutoConfig`, `setAutoConfigSync`, `setConfigSync`, `addSudo`, `removeSudo`, `setSudoMode`, `mapLidToPhone`). `initDatabase()` waits up to 12 s for pg then calls `restoreFromPg()` (INSERT OR IGNORE) before `initSudo()`/`runDataMigrations()` so settings survive restarts. `auto_configs` are stored in pg `bot_configs` with key prefix `auto_config:`; sudomode as key `__sudomode__`.
*   **Interactive Button Mode by Default**: Integrated `wolfbtns` to wrap bot responses in interactive buttons, with a fallback for older WhatsApp clients in group chats.
*   **Comprehensive Anti-Abuse Systems**: Implemented robust Anti-Delete, Anti-Edit, Anti-Bug, Anti-Link, Anti-Spam, Anti-ViewOnce, Anti-Demote/Promote systems to maintain group integrity and combat malicious behavior.
*   **Dynamic AI Backend Integration**: Adopted Pollinations.ai for the W.O.L.F Chatbot with a fallback chain across various model slots, and a broader suite of AI commands leveraging `apis.wolf.space`.

## Product

*   **AI Chatbot & Commands**: W.O.L.F Chatbot with conversational memory and diverse AI models for various tasks.
*   **Group Management**: Welcome/Goodbye messages, Anti-Spam, Anti-Link, Anti-Bug, Anti-Demote/Promote systems, approval/rejection of join requests.
*   **Games & Economy**: Wordle, Hangman, Number Guess, Memory, Slots, Blackjack, Trivia, Chess, and persistent in-bot economy features.
*   **Ethical Hacking Tools**: Suite of reconnaissance, network analysis, web security, vulnerability, password, and forensic commands.
*   **Pterodactyl cPanel Integration**: Commands for managing Pterodactyl panels (owner-only).

## User preferences

I prefer iterative development, with a focus on delivering functional, tested components.
When I ask for a feature, please propose a high-level design first.
Before making any significant changes to the codebase, please ask for my approval.
I prefer clear and concise explanations for complex technical concepts.
Do not make changes to files within the `node_modules` directory.
Always ensure that new features are accompanied by appropriate documentation.

## Gotchas

*   **Message Age Filtering**: Messages older than 60 seconds are silently discarded on connection, and reactions older than 30 seconds are ignored to prevent processing stale data.
*   **Disk Space Management**: The bot actively monitors disk usage and performs cleanups; low disk space can trigger emergency cleanups.
*   **Startup Flood Lockout**: `antideleteStoreMessage`, `statusAntideleteStoreMessage` writes, and media downloads are locked out for 60-90 seconds after connection to prevent heap spikes during startup.
*   **Button Mode Interaction**: In group chats, button messages are followed by plain text for compatibility. In DMs, only interactive messages are sent.

## Pointers

*   **Baileys Documentation**: [https://docs.whiskeysockets.dev/](https://docs.whiskeysockets.dev/)
*   **`better-sqlite3` Documentation**: [https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md)
*   **`wolfbtns` Package**: Interactive WhatsApp button support.
*   **Pterodactyl API Documentation**: [https://pterodactyl.io/api/](https://pterodactyl.io/api/)
*   **`chess.js` Documentation**: [https://github.com/jhlywa/chess.js](https://github.com/jhlywa/chess.js)
