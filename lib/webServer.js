import http from 'http';
import chalk from 'chalk';
import { getPlatformInfo } from './platformDetect.js';

let _server = null;

/* ─────────────────────────────────────────────────────────
   LOG BUFFER  (ring buffer, max 300 lines, persists across
   hot-reloads via globalThis so lines aren't lost)
───────────────────────────────────────────────────────── */
const LOG_MAX = 300;
if (!globalThis._logBuffer)           globalThis._logBuffer           = [];
if (!globalThis._logSseClients)       globalThis._logSseClients       = new Set();
if (!globalThis._consolePatchedByWS)  globalThis._consolePatchedByWS  = false;

function _pushLog(level, args) {
  const text = args
    .map(a => (a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ');
  const entry = { ts: Date.now(), level, text };
  globalThis._logBuffer.push(entry);
  if (globalThis._logBuffer.length > LOG_MAX) globalThis._logBuffer.shift();
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of globalThis._logSseClients) {
    try { res.write(payload); } catch { globalThis._logSseClients.delete(res); }
  }
}

function _patchConsole() {
  if (globalThis._consolePatchedByWS) return;
  globalThis._consolePatchedByWS = true;
  const _orig = {
    log:   console.log.bind(console),
    error: console.error.bind(console),
    warn:  console.warn.bind(console),
    info:  console.info.bind(console),
  };
  for (const level of ['log', 'error', 'warn', 'info']) {
    console[level] = (...args) => {
      _orig[level](...args);
      _pushLog(level, args);
    };
  }
}

/* ─────────────────────────────────────────────────────────
   STATUS HELPERS
───────────────────────────────────────────────────────── */
function getStatus() {
  const s = globalThis._webStatus || {};
  const uptime = process.uptime();
  const h   = Math.floor(uptime / 3600);
  const m   = Math.floor((uptime % 3600) / 60);
  const sec = Math.floor(uptime % 60);

  const platform = getPlatformInfo();
  const mem = process.memoryUsage();

  // Read live state directly from the actual config globals — never stale
  const antilink     = !!(globalThis._antilinkConfig?.enabled);
  const antispam     = !!(globalThis._antispamConfig?.enabled);
  const antibug      = !!(globalThis._antibugConfig?.enabled);
  const antidelete   = !!(globalThis._antideleteEnabled  ?? s.antidelete  ?? false);
  const antiviewonce = !!(globalThis._antiviewonceEnabled ?? s.antiviewonce ?? false);
  const autoread     = !!(globalThis._autoreadEnabled     ?? s.autoread    ?? false);

  return {
    status:          (s.connected ?? false) ? 'ok' : 'degraded',
    botName:         s.botName       || global.BOT_NAME || 'WOLFBOT',
    version:         s.version       || global.VERSION  || '1.0.0',
    connected:       s.connected     ?? false,
    uptime:          `${h}h ${m}m ${sec}s`,
    uptimeSecs:      Math.floor(uptime),
    platform:        `${platform.icon} ${platform.name}`,
    commands:        s.commands      || 0,
    prefix:          s.prefix        || '.',
    botMode:         s.botMode       || 'public',
    owner:           s.owner         || 'Unknown',
    antispam,
    antibug,
    antilink,
    antidelete,
    antiviewonce,
    autoread,
    memoryMB:        parseFloat((mem.heapUsed  / 1024 / 1024).toFixed(1)),
    memoryTotalMB:   parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1)),
    nodeVersion:     process.version,
    timestamp:       new Date().toISOString(),
  };
}

function getPort() {
  if (process.env.PORT)        return parseInt(process.env.PORT);
  if (process.env.SERVER_PORT) return parseInt(process.env.SERVER_PORT);
  if (process.env.APP_PORT)    return parseInt(process.env.APP_PORT);
  return 3000;
}

/* ─────────────────────────────────────────────────────────
   LOG AUTH  (optional — set LOG_PASSWORD in env to protect)
───────────────────────────────────────────────────────── */
function logAuthOk(req) {
  const pw = process.env.LOG_PASSWORD;
  if (!pw) return true;
  try {
    const qs = new URL(req.url, 'http://localhost').searchParams;
    return qs.get('key') === pw;
  } catch { return false; }
}

/* ─────────────────────────────────────────────────────────
   STATUS PAGE HTML
───────────────────────────────────────────────────────── */
function getHTML(st) {
  const online      = st.connected;
  const statusLabel = online ? 'ONLINE' : 'OFFLINE';

  const pillStyle = online ? '' :
    'style="background:hsla(0,84%,60%,.06);color:hsl(0,84%,60%);border-color:hsl(0,84%,60%);text-shadow:0 0 8px hsl(0,84%,60%);box-shadow:0 0 14px hsla(0,84%,60%,.3),inset 0 0 14px hsla(0,84%,60%,.05)"';

  const dotStyle = online ? '' :
    'style="background:hsl(0,84%,60%);box-shadow:0 0 6px hsl(0,84%,60%),0 0 14px hsl(0,84%,60%);animation:none"';

  function badge(val, label) {
    const cls = val ? 'badge-on' : 'badge-off';
    const txt = val ? 'ON' : 'OFF';
    return `<span class="badge ${cls}">${label} <b>${txt}</b></span>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="refresh" content="30"/>
<title>${st.botName} — Status</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{
    --bg:hsl(120,100%,2%);--surface:hsl(120,100%,3%);--card:hsl(120,100%,4%);
    --neon:hsl(120,100%,50%);--neon-dim:hsl(120,80%,30%);
    --border:hsl(120,100%,20%);--border-faint:hsla(120,100%,50%,.15);
    --text:hsl(120,100%,50%);--muted:hsl(120,50%,40%);--warn:hsl(0,84%,60%);
    --radius:.75rem;--font-mono:'JetBrains Mono',monospace;--font-head:'Orbitron',sans-serif
  }
  html{scrollbar-color:var(--neon-dim) var(--bg);scrollbar-width:thin}
  ::-webkit-scrollbar{width:6px}
  ::-webkit-scrollbar-track{background:hsl(120,100%,3%)}
  ::-webkit-scrollbar-thumb{background:hsl(120,100%,20%);border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:hsl(120,100%,30%)}
  body{
    background-color:var(--bg);
    background-image:
      linear-gradient(0deg,transparent 24%,hsla(120,100%,50%,.025) 25%,hsla(120,100%,50%,.025) 26%,transparent 27%,transparent 74%,hsla(120,100%,50%,.025) 75%,hsla(120,100%,50%,.025) 76%,transparent 77%),
      linear-gradient(90deg,transparent 24%,hsla(120,100%,50%,.025) 25%,hsla(120,100%,50%,.025) 26%,transparent 27%,transparent 74%,hsla(120,100%,50%,.025) 75%,hsla(120,100%,50%,.025) 76%,transparent 77%);
    background-size:40px 40px;color:var(--text);font-family:var(--font-mono);
    min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 16px 32px
  }
  header{text-align:center;margin-bottom:40px;position:relative;width:100%;max-width:740px}
  .scan-line{
    position:absolute;left:0;right:0;height:2px;top:0;
    background:linear-gradient(90deg,transparent,var(--neon),transparent);opacity:.35;
    animation:scan 4s linear infinite
  }
  @keyframes scan{0%{top:-5%}100%{top:115%}}
  .wolf-icon{font-size:52px;line-height:1;margin-bottom:12px;filter:drop-shadow(0 0 12px var(--neon)) drop-shadow(0 0 28px hsla(120,100%,50%,.5))}
  h1{font-family:var(--font-head);font-size:30px;font-weight:900;letter-spacing:6px;text-transform:uppercase;color:#fff;text-shadow:0 0 4px var(--neon),0 0 10px hsla(120,100%,50%,.25)}
  .ver{font-size:11px;letter-spacing:3px;color:var(--muted);margin-top:6px;font-family:var(--font-mono)}
  .status-pill{display:inline-flex;align-items:center;gap:10px;padding:7px 20px;margin-top:14px;border-radius:.5rem;font-size:12px;font-weight:700;letter-spacing:2px;font-family:var(--font-mono);text-transform:uppercase;background:hsla(120,100%,50%,.06);color:var(--neon);border:1px solid var(--neon);box-shadow:0 0 14px hsla(120,100%,50%,.3),inset 0 0 14px hsla(120,100%,50%,.05);text-shadow:0 0 8px var(--neon)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--neon);box-shadow:0 0 6px var(--neon),0 0 14px var(--neon);animation:pulse-dot 1.6s ease-in-out infinite}
  @keyframes pulse-dot{0%,100%{opacity:1;box-shadow:0 0 6px var(--neon),0 0 14px var(--neon)}50%{opacity:.3;box-shadow:none}}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;width:100%;max-width:740px;margin-bottom:16px}
  .card{position:relative;overflow:hidden;background:hsla(120,100%,50%,.03);border:1px solid var(--border-faint);border-radius:var(--radius);padding:18px 20px;backdrop-filter:blur(12px);box-shadow:0 0 18px hsla(120,100%,50%,.08),inset 0 0 18px hsla(120,100%,50%,.02);transition:border-color .2s,box-shadow .2s}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,hsla(120,100%,50%,.5),transparent)}
  .card:hover{border-color:hsla(120,100%,50%,.35);box-shadow:0 0 28px hsla(120,100%,50%,.18),inset 0 0 28px hsla(120,100%,50%,.03)}
  .card-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:10px;font-family:var(--font-mono)}
  .card-value{font-size:22px;font-weight:700;color:#fff;word-break:break-word;text-shadow:0 0 10px hsla(120,100%,50%,.4);font-family:var(--font-mono)}
  .card-value.neon{color:var(--neon);text-shadow:0 0 4px hsla(120,100%,50%,.5)}
  .card-value.uptime{font-size:16px;color:#a3ffcc;font-variant-numeric:tabular-nums}
  .card-value.dim{font-size:13px;color:var(--muted)}
  .badges{display:flex;flex-wrap:wrap;gap:8px;width:100%;max-width:740px;margin-bottom:16px}
  .badge{font-size:11px;font-weight:600;padding:5px 14px;border-radius:.5rem;letter-spacing:1.5px;text-transform:uppercase;font-family:var(--font-mono)}
  .badge-on{background:hsla(120,100%,50%,.08);color:var(--neon);border:1px solid hsla(120,100%,50%,.35);text-shadow:0 0 6px var(--neon)}
  .badge-off{background:hsla(120,100%,50%,.02);color:hsl(120,20%,30%);border:1px solid hsl(120,20%,15%)}
  .platform-card{position:relative;overflow:hidden;background:hsla(120,100%,50%,.03);border:1px solid var(--border-faint);border-radius:var(--radius);padding:16px 24px;width:100%;max-width:740px;text-align:center;margin-bottom:20px;backdrop-filter:blur(12px);box-shadow:0 0 18px hsla(120,100%,50%,.08)}
  .platform-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,hsla(120,100%,50%,.5),transparent)}
  .p-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:6px;font-family:var(--font-mono)}
  .plat{font-size:15px;font-weight:700;color:var(--neon);letter-spacing:1px;text-shadow:0 0 8px var(--neon),0 0 18px hsla(120,100%,50%,.3);font-family:var(--font-mono)}
  .links{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:32px}
  a.btn{padding:11px 24px;border-radius:.75rem;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;font-family:var(--font-head);transition:all .2s}
  a.btn-primary{background:transparent;color:var(--neon);border:2px solid var(--neon);box-shadow:0 0 12px hsla(120,100%,50%,.3),inset 0 0 12px hsla(120,100%,50%,.05);text-shadow:0 0 8px var(--neon)}
  a.btn-primary:hover{background:hsla(120,100%,50%,.1);box-shadow:0 0 24px hsla(120,100%,50%,.5),inset 0 0 20px hsla(120,100%,50%,.1);transform:scale(1.02)}
  a.btn-ghost{background:transparent;color:hsl(120,60%,70%);border:2px solid hsl(120,40%,25%);box-shadow:0 0 10px hsla(120,100%,50%,.1)}
  a.btn-ghost:hover{border-color:hsl(120,60%,40%);color:var(--neon);box-shadow:0 0 18px hsla(120,100%,50%,.25);transform:scale(1.02)}
  footer{font-size:11px;color:var(--muted);text-align:center;letter-spacing:1.5px;text-transform:uppercase;font-family:var(--font-mono)}
  footer span{color:var(--neon);font-weight:700;text-shadow:0 0 8px var(--neon)}
  @media(max-width:480px){h1{font-size:22px;letter-spacing:3px}.card-value{font-size:17px}.grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<header>
  <div class="scan-line"></div>
  <div class="wolf-icon"></div>
  <h1>${st.botName}</h1>
  <div class="ver">v${st.version} // STATUS TERMINAL</div>
  <div class="status-pill" ${pillStyle}><div class="dot" ${dotStyle}></div>${statusLabel}</div>
</header>
<div class="grid">
  <div class="card"><div class="card-label">// UPTIME</div><div class="card-value uptime">${st.uptime}</div></div>
  <div class="card"><div class="card-label">// COMMANDS</div><div class="card-value neon">${st.commands}</div></div>
  <div class="card"><div class="card-label">// PREFIX</div><div class="card-value neon">${st.prefix === 'none' ? '(none)' : st.prefix}</div></div>
  <div class="card"><div class="card-label">// MODE</div><div class="card-value neon">${st.botMode.toUpperCase()}</div></div>
  <div class="card"><div class="card-label">// OWNER</div><div class="card-value" style="font-size:14px;color:#a3ffcc">+${st.owner}</div></div>
  <div class="card"><div class="card-label">// LAST PING</div><div class="card-value dim">${new Date().toLocaleTimeString()}</div></div>
</div>
<div class="badges">
  ${badge(st.antispam,'ANTI-SPAM')}
  ${badge(st.antibug,'ANTI-BUG')}
  ${badge(st.antilink,'ANTI-LINK')}
</div>
<div class="platform-card">
  <div class="p-label">// RUNTIME ENVIRONMENT</div>
  <div class="plat">${st.platform}</div>
</div>
<div class="links">
  <a class="btn btn-primary" href="/logs">[ LIVE CONSOLE ]</a>
  <a class="btn btn-primary" href="/api/status">[ JSON STATUS ]</a>
  <a class="btn btn-ghost" href="/health">[ HEALTH CHECK ]</a>
</div>
<footer>POWERED BY <span>WOLF TECH</span> &nbsp;//&nbsp; AUTO-REFRESH 30s</footer>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────
   LIVE CONSOLE PAGE HTML
───────────────────────────────────────────────────────── */
function getLogsHTML(initialLogs) {
  const escaped = JSON.stringify(initialLogs);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title> Live Console</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{
    --bg:hsl(120,100%,2%);--neon:hsl(120,100%,50%);--neon-dim:hsl(120,80%,30%);
    --border-faint:hsla(120,100%,50%,.15);--muted:hsl(120,50%,40%);
    --c-log:hsl(120,100%,60%);--c-error:hsl(0,84%,65%);
    --c-warn:hsl(45,100%,60%);--c-info:hsl(200,100%,65%);--c-ts:hsl(120,30%,35%);
    --font-mono:'JetBrains Mono',monospace;--font-head:'Orbitron',sans-serif
  }
  html,body{height:100%;scrollbar-color:var(--neon-dim) var(--bg);scrollbar-width:thin}
  ::-webkit-scrollbar{width:6px}
  ::-webkit-scrollbar-track{background:hsl(120,100%,3%)}
  ::-webkit-scrollbar-thumb{background:hsl(120,100%,20%);border-radius:4px}
  body{
    background:var(--bg);
    background-image:
      linear-gradient(0deg,transparent 24%,hsla(120,100%,50%,.018) 25%,hsla(120,100%,50%,.018) 26%,transparent 27%,transparent 74%,hsla(120,100%,50%,.018) 75%,hsla(120,100%,50%,.018) 76%,transparent 77%),
      linear-gradient(90deg,transparent 24%,hsla(120,100%,50%,.018) 25%,hsla(120,100%,50%,.018) 26%,transparent 27%,transparent 74%,hsla(120,100%,50%,.018) 75%,hsla(120,100%,50%,.018) 76%,transparent 77%);
    background-size:40px 40px;
    color:var(--neon);font-family:var(--font-mono);
    display:flex;flex-direction:column;height:100%
  }
  header{
    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;
    padding:14px 20px;border-bottom:1px solid var(--border-faint);
    background:hsla(120,100%,50%,.03);flex-shrink:0
  }
  .hdr-left{display:flex;align-items:center;gap:14px}
  h1{font-family:var(--font-head);font-size:16px;letter-spacing:4px;color:#fff;text-shadow:0 0 8px var(--neon)}
  .live-pill{
    display:flex;align-items:center;gap:7px;
    padding:4px 12px;border-radius:.4rem;font-size:10px;font-weight:700;letter-spacing:2px;
    background:hsla(120,100%,50%,.06);border:1px solid hsla(120,100%,50%,.3);
    color:var(--neon);text-shadow:0 0 6px var(--neon)
  }
  .live-dot{width:7px;height:7px;border-radius:50%;background:var(--neon);box-shadow:0 0 6px var(--neon);animation:pd 1.4s ease-in-out infinite}
  @keyframes pd{0%,100%{opacity:1}50%{opacity:.2}}
  .hdr-right{display:flex;gap:8px;flex-wrap:wrap}
  button{
    padding:6px 14px;border-radius:.5rem;font-size:10px;font-weight:700;
    letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;
    font-family:var(--font-mono);transition:all .15s;border:1px solid
  }
  .btn-clear{background:hsla(0,84%,60%,.07);color:hsl(0,84%,65%);border-color:hsl(0,84%,40%)}
  .btn-clear:hover{background:hsla(0,84%,60%,.18);border-color:hsl(0,84%,60%)}
  .btn-scroll{background:hsla(120,100%,50%,.06);color:var(--neon);border-color:var(--neon-dim)}
  .btn-scroll:hover{background:hsla(120,100%,50%,.15);border-color:var(--neon)}
  .btn-back{background:transparent;color:var(--muted);border-color:hsl(120,20%,20%);text-decoration:none;display:inline-flex;align-items:center;padding:6px 14px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:var(--font-mono);border-radius:.5rem}
  .btn-back:hover{color:var(--neon);border-color:var(--neon-dim)}
  #console{
    flex:1;overflow-y:auto;padding:12px 16px;
    display:flex;flex-direction:column;gap:1px
  }
  .line{display:flex;gap:10px;line-height:1.55;font-size:12.5px;padding:2px 4px;border-radius:3px;word-break:break-all}
  .line:hover{background:hsla(120,100%,50%,.04)}
  .ts{color:var(--c-ts);flex-shrink:0;user-select:none;font-size:11px;padding-top:1px}
  .lvl{flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:1px;width:34px;text-align:right;padding-top:2px}
  .lvl-log{color:hsl(120,60%,40%)}
  .lvl-error{color:var(--c-error)}
  .lvl-warn{color:var(--c-warn)}
  .lvl-info{color:var(--c-info)}
  .msg{color:#c8ffc8;flex:1;white-space:pre-wrap}
  .msg.error{color:var(--c-error)}
  .msg.warn{color:var(--c-warn)}
  .msg.info{color:var(--c-info)}
  .empty{color:var(--muted);font-size:12px;text-align:center;margin-top:60px;letter-spacing:2px}
  footer{
    padding:8px 20px;border-top:1px solid var(--border-faint);
    font-size:10px;color:var(--muted);display:flex;justify-content:space-between;
    letter-spacing:1px;flex-shrink:0
  }
  #conn-state{font-weight:700}
  #line-count{font-variant-numeric:tabular-nums}
</style>
</head>
<body>
<header>
  <div class="hdr-left">
    <h1> LIVE CONSOLE</h1>
    <div class="live-pill"><div class="live-dot"></div>STREAMING</div>
  </div>
  <div class="hdr-right">
    <button class="btn-clear" onclick="clearLogs()">CLEAR</button>
    <button class="btn-scroll" onclick="toggleAutoScroll()" id="scroll-btn">AUTO-SCROLL ON</button>
    <a class="btn-back" href="/">← STATUS</a>
  </div>
</header>

<div id="console"><div class="empty" id="empty-msg">// awaiting log output...</div></div>

<footer>
  <span>SSE &nbsp;|&nbsp; <span id="conn-state" style="color:var(--c-warn)">CONNECTING</span></span>
  <span><span id="line-count">0</span> / 300 lines</span>
</footer>

<script>
const consoleEl  = document.getElementById('console');
const emptyMsg   = document.getElementById('empty-msg');
const lineCount  = document.getElementById('line-count');
const connState  = document.getElementById('conn-state');
const scrollBtn  = document.getElementById('scroll-btn');

let autoScroll = true;
let lines = [];
const MAX = 300;

const COLORS = { log:'lvl-log', error:'lvl-error', warn:'lvl-warn', info:'lvl-info' };

function fmt(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0,8) + '.' + String(d.getMilliseconds()).padStart(3,'0');
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildLine(entry) {
  const div = document.createElement('div');
  div.className = 'line';
  div.innerHTML =
    '<span class="ts">' + fmt(entry.ts) + '</span>' +
    '<span class="lvl ' + (COLORS[entry.level]||'lvl-log') + '">' + entry.level.toUpperCase() + '</span>' +
    '<span class="msg ' + (entry.level === 'log' ? '' : entry.level) + '">' + esc(entry.text) + '</span>';
  return div;
}

function appendLine(entry) {
  if (emptyMsg.parentNode) emptyMsg.remove();
  lines.push(entry);
  if (lines.length > MAX) {
    lines.shift();
    if (consoleEl.firstChild) consoleEl.removeChild(consoleEl.firstChild);
  }
  consoleEl.appendChild(buildLine(entry));
  lineCount.textContent = lines.length;
  if (autoScroll) consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearLogs() {
  lines = [];
  consoleEl.innerHTML = '';
  consoleEl.appendChild(emptyMsg);
  lineCount.textContent = '0';
  fetch('/api/logs/clear', { method:'POST' }).catch(()=>{});
}

function toggleAutoScroll() {
  autoScroll = !autoScroll;
  scrollBtn.textContent = autoScroll ? 'AUTO-SCROLL ON' : 'AUTO-SCROLL OFF';
  if (autoScroll) consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Seed with buffered logs
const seed = ${escaped};
seed.forEach(appendLine);

// Connect SSE
function connect() {
  const es = new EventSource('/api/logs/stream');
  es.onopen = () => {
    connState.textContent = 'LIVE';
    connState.style.color = 'var(--c-log)';
  };
  es.onmessage = e => {
    try { appendLine(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => {
    connState.textContent = 'RECONNECTING';
    connState.style.color = 'var(--c-warn)';
    es.close();
    setTimeout(connect, 3000);
  };
}
connect();
</script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────
   HTTP SERVER
───────────────────────────────────────────────────────── */
export function setupWebServer() {
  if (_server) return Promise.resolve();

  // Start intercepting console output as early as possible
  _patchConsole();

  const PORT = getPort();

  _server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const st  = getStatus();

    /* ── Health / status endpoints ── */
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        status:       st.status,
        connected:    st.connected,
        botName:      st.botName,
        version:      st.version,
        uptime:       st.uptime,
        uptimeSecs:   st.uptimeSecs,
        memoryMB:     st.memoryMB,
        memoryTotalMB: st.memoryTotalMB,
        platform:     st.platform,
        nodeVersion:  st.nodeVersion,
        timestamp:    st.timestamp,
      }));
    }

    if (url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(st, null, 2));
    }

    /* ── Log endpoints ── */
    if (url === '/logs') {
      if (!logAuthOk(req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('403 Forbidden — set LOG_PASSWORD env var and pass ?key=<password>');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(getLogsHTML(globalThis._logBuffer));
    }

    if (url === '/api/logs') {
      if (!logAuthOk(req)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Forbidden' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(globalThis._logBuffer));
    }

    if (url === '/api/logs/stream') {
      if (!logAuthOk(req)) {
        res.writeHead(403); return res.end();
      }
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(': connected\n\n');
      globalThis._logSseClients.add(res);
      req.on('close', () => globalThis._logSseClients.delete(res));
      return;
    }

    if (url === '/api/logs/clear' && req.method === 'POST') {
      if (!logAuthOk(req)) { res.writeHead(403); return res.end(); }
      globalThis._logBuffer.length = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    /* ── Main status page ── */
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHTML(st));
  });

  return new Promise((resolve) => {
    let finalPort = PORT;

    _server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        finalPort = PORT + 1;
        _server.listen(finalPort, '0.0.0.0');
      }
    });

    _server.listen(PORT, '0.0.0.0', () => {
      const { name } = getPlatformInfo();

      const N  = '\x1b[38;2;0;255;156m';
      const NB = '\x1b[1m\x1b[38;2;0;255;156m';
      const B  = '\x1b[38;2;34;193;255m';
      const BB = '\x1b[1m\x1b[38;2;34;193;255m';
      const Y  = '\x1b[38;2;250;204;21m';
      const YB = '\x1b[1m\x1b[38;2;250;204;21m';
      const D  = '\x1b[2m\x1b[38;2;100;120;130m';
      const W  = '\x1b[38;2;200;215;225m';
      const R  = '\x1b[0m';

      // WOLFBOT signature style: ╭─⌈ icon TITLE ⌋ … ╰⊷
      const sep = `${D}·${R}`;
      process.stdout.write(`\n${NB}╭─⌈ KLAUS-MD CONTROL CORE ⌋${R}\n`);
      process.stdout.write(`${NB}» ${R}${Y}🏗️${R} ${W}${name}${R}  ${sep}  ${Y}🔌${R} ${W}${finalPort}${R}  ${sep}  ${Y}📂${R} ${W}/logs${R}\n`);
      process.stdout.write(`${NB}╰⊷${R}\n\n`);
      resolve();
    });
  });
}

export function updateWebStatus(data) {
  globalThis._webStatus = { ...(globalThis._webStatus || {}), ...data };
}
