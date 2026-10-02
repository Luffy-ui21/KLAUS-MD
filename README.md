<h1 align="center">KLAUS-MD</h1>

<p align="center">
  <img src="public/assets/menu-banner.png" alt="KLAUS-MD WhatsApp bot banner" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2E8B57?style=for-the-badge" alt="License: MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&style=for-the-badge" alt="Node.js 18 or newer" /></a>
  <a href="https://github.com/WhiskeySockets/Baileys"><img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&style=for-the-badge" alt="WhatsApp via Baileys" /></a>
</p>

<p align="center">A multi-user WhatsApp bot with phone-number pairing, isolated sessions, group tools and a web-based pairing interface.</p>

<p align="center"><strong>Powered by KLAUS - NIK.ola</strong> | Global owner: <code>+254711815459</code></p>

KLAUS-MD runs a separate Baileys connection for each paired WhatsApp number. Users request a pairing code from the web interface, then manage their bot with commands in WhatsApp. Session records are stored in a JSON file, while WhatsApp authentication files are stored separately on disk.

## Disclaimer

KLAUS-MD is provided for educational and personal use. Automated use may violate WhatsApp's terms of service. Use it responsibly, respect people's privacy and get permission before adding it to groups or contacting others. The authors are not responsible for misuse or resulting account restrictions.

> [!CAUTION]
> WhatsApp may suspend or ban accounts that violate its terms. Use KLAUS-MD at your own risk.

## Features

- **Phone-number pairing:** Pair WhatsApp using a code from the web page instead of scanning a QR code.
- **Isolated bot sessions:** Each paired number gets its own connection, command settings and authentication directory.
- **Group administration:** Manage participants, group links, group details and chat access.
- **Chat utilities:** Create stickers and audio, look up information, translate text, generate QR codes and more.
- **Anti-features:** Configure protections for links, bots, calls and deleted messages; welcome and goodbye messages are handled automatically.
- **Session recovery:** Reconnect stored sessions after a server restart, subject to the host retaining local files.
- **Pairing site and status API:** Request pairing codes, check service health and view session status.

There is no configured maximum session count. Each active Baileys connection uses memory, so the practical capacity depends on the host. Allow roughly 30–50 MB of RAM per active connection and monitor actual usage.

## Prerequisites

- Node.js 18 or newer and npm
- Git, if cloning the repository
- A WhatsApp account to pair
- A persistent filesystem for reliable session and authentication recovery

Check your installed tools:

```bash
node --version
npm --version
git --version
```

## Quick Start

Clone the repository and install its dependencies:

```bash
git clone https://github.com/Luffy-ui21/KLAUS-MD.git
cd KLAUS-MD
npm install
npm start
```

The server listens on port `3001` by default. Open `http://localhost:3001` to request a pairing code.

To pair an account:

1. Enter the phone number with its country code on the pairing page. Punctuation is removed; the resulting number must contain 8–15 digits.
2. On the phone, open **WhatsApp > Settings > Linked Devices > Link a Device**.
3. Choose **Link with phone number instead** and enter the code shown on the page.
4. Once connected, send `.menu` to the bot to see its command menu.

No `.env` file is required for the defaults. The application reads configuration from the process environment; when running locally, export any variables in your shell or configure them in your hosting provider.

## Commands

The default prefix is `.`. Prefixes are stored per paired session and can be changed with `.setprefix`.

| Category                 | Examples                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| General                  | `.menu`, `.ping`, `.alive`, `.owner`, `.whoami`, `.repo`, `.disconnect`                                              |
| Group administration     | `.tagall`, `.kick`, `.promote`, `.demote`, `.mute`, `.unmute`, `.link`, `.revoke`, `.setname`, `.setdesc`, `.delete` |
| Media and creative tools | `.sticker`, `.vv`, `.tts`, `.song`, `.logo`, `.dp`                                                                   |
| Search and utilities     | `.weather`, `.wiki`, `.google`, `.translate`, `.calculate`, `.qr`, `.url`                                            |
| Fun                      | `.quote`, `.joke`, `.fact`, `.8ball`, `.coinflip`, `.dice`, `.truth`, `.dare`                                        |
| Owner controls           | `.private`, `.public`, `.setprefix`, `.pp`, `.block`, `.unblock`, `.restart`, `.shutdown`                            |
| Anti features            | `.antilink`, `.antibot`, `.antidelete`, `.anticall`                                                                  |

Use `.menu all` for the full command list. Commands may require the bot or the person issuing them to have appropriate group permissions.

### Anti-command examples

- `.antilink delete`, `.antilink remove`, `.antilink off`, `.antilink status`
- `.antibot on` or `.antibot off`
- `.antidelete on` or `.antidelete off`
- `.anticall on` or `.anticall off`

Anti-link behavior is configured per group. The bot needs the relevant group permissions to delete messages or remove participants. Welcome and goodbye messages are sent automatically when group membership changes.

## Configuration

All settings are optional unless your hosting environment requires them.

| Variable               | Default           | Description                                                            |
| ---------------------- | ----------------- | ---------------------------------------------------------------------- |
| `SERVER_PORT`          | unset             | Port override used first, including by some panel hosts.               |
| `PORT`                 | `3001`            | HTTP server port when `SERVER_PORT` is not set.                        |
| `BOT_NAME`             | `KLAUS-MD`        | Display name used by the bot and web API.                              |
| `OWNER_NUMBER`         | `254711815459`    | Global owner number, digits with country code.                         |
| `PREFIX`               | `.`               | Fallback command prefix; paired sessions have their own stored prefix. |
| `IDLE_TIMEOUT_HOURS`   | `6`               | Hours before an idle session is disconnected.                          |
| `PAIRING_CODE_TTL`     | `90`              | Pairing-code expiry advertised by the pairing endpoint, in seconds.    |
| `SITE_PASSWORD`        | unset             | If set, pairing requests must include this password.                   |
| `DB_FILE`              | `./sessions.json` | Path to the JSON session store.                                        |
| `ANTI_DELETE`          | enabled           | Set to `false` to disable anti-delete globally.                        |
| `ANTI_CALL`            | enabled           | Set to `false` to disable anti-call globally.                          |
| `ANTI_BADWORD`         | disabled          | Set to `true` to enable the bad-word filter.                           |
| `GEMINI_API_KEY`       | unset             | Optional API key for AI-assisted auto-responses.                       |
| `SUPPORT_GROUP_INVITE` | project default   | Support group invite code; set to `disabled` to skip auto-join.        |

Example for a local shell:

```bash
export PORT=3001
export OWNER_NUMBER=254711815459
npm start
```

Do not commit secrets, WhatsApp authentication files or session data to source control.

## Web Interface and API

| Path                  | Purpose                                 |
| --------------------- | --------------------------------------- |
| `/`                   | Pairing page                            |
| `/health`             | Service health and active session count |
| `/api/status`         | Bot name and session status summary     |
| `/api/pair`           | Request a pairing code (`POST`)         |
| `/api/disconnect`     | Disconnect a session (`POST`)           |
| `/api/session/:phone` | Retrieve a session record               |

If `SITE_PASSWORD` is configured, the pairing endpoint checks the supplied password. The status and session endpoints are not protected by that setting; place the service behind suitable access controls if exposing session metadata publicly.

## Deployment

The repository includes a Render service definition in [`render.yaml`](render.yaml) and routing configuration in [`vercel.json`](vercel.json). For a multi-user bot, use a host that supports a persistent, long-running Node.js process and persistent disk storage. The JSON session file and `auth_state/` credentials must both survive restarts; ephemeral storage can lose them. Serverless hosting may not preserve the long-lived WhatsApp connections this bot requires.

For Render, configure a persistent disk and mount it where both the session store and authentication directories can be retained. Set `DB_FILE` to a path on that disk. Review your host's memory limits and expected concurrent sessions before making the service public.

## Data and Privacy

- Session records are stored in `sessions.json` by default. Set `DB_FILE` to change the path.
- WhatsApp authentication state is stored under `auth_state/`.
- Anti-link, anti-bot and welcome settings use local JSON files in the project root.
- Anti-delete temporarily keeps up to 2,000 recent messages in process memory to handle deletion events; this message cache is not persisted across restarts.
- Treat these files as sensitive. Restrict filesystem access and back them up only to a trusted location.
- The pairing site exposes session status and session record endpoints. Do not expose them to untrusted users without appropriate network or application-level protection.

## Project Structure

| Path                                             | Purpose                                                  |
| ------------------------------------------------ | -------------------------------------------------------- |
| [`server.js`](server.js)                         | Express pairing site and HTTP API                        |
| [`lib/sessionManager.js`](lib/sessionManager.js) | Per-number Baileys connections, pairing and reconnection |
| [`lib/handler.js`](lib/handler.js)               | Message routing and dynamic command loading              |
| [`lib/db.js`](lib/db.js)                         | JSON-backed session store                                |
| [`lib/commands/`](lib/commands/)                 | WhatsApp command modules                                 |
| [`lib/anti/`](lib/anti/)                         | Anti-feature handlers and settings commands              |
| [`lib/utils/`](lib/utils/)                       | Shared permission and response utilities                 |
| [`public/`](public/)                             | Pairing page and static assets                           |

## Adding a Command

Add a JavaScript file under `lib/commands/`. The handler loads command modules at startup when they export a `name` and an `execute` function.

```js
module.exports = {
  name: 'hello',
  aliases: ['hi'],
  desc: 'Greet the chat',
  category: 'general',
  async execute({ reply }) {
    await reply('Hello!');
  },
};
```

Use `.hello` or `.hi` in WhatsApp. Keep permission checks close to commands that perform administrative actions.

## License

KLAUS-MD is available under the [MIT License](LICENSE).

## Author

**KLAUS - NIK.ola** [GitHub](https://github.com/xtechkin-svg)
