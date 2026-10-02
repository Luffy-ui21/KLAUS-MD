import axios from 'axios';
import { setActionSession, getActionSession, deleteActionSession } from '../../lib/actionSession.js';
import { sendInteractiveWithImage, isGiftedBtnsAvailable } from '../../lib/buttonHelper.js';
import { getOwnerName, getMenuImageBuffer, getFooter} from '../../lib/menuHelper.js';

const GH_API = 'https://api.github.com';
const PER_PAGE = 100;
const MAX_PAGES = 30;             // safety cap → 3000 repos absolute max
const REPOS_PER_MESSAGE = 40;     // chunk long lists so WhatsApp doesn't truncate

// Build a stable session key per (sender, chat) so the button-click handler
// finds the same data the original .gitrepos call stored.
function makeSessionKey(m) {
    const sender = (m.key.participant || m.key.remoteJid || '').split(':')[0].split('@')[0];
    const chat = (m.key.remoteJid || '').split('@')[0];
    return `gitrepos:${sender}:${chat}`;
}

// Best-effort token redaction: if the original message contains the token,
// try to delete it. Falls back silently — protocol delete needs admin in groups.
async function tryRedactTokenMessage(sock, m) {
    try {
        await sock.sendMessage(m.key.remoteJid, { delete: m.key });
    } catch {
        // Non-fatal. Token still won't be echoed back in any of our replies.
    }
}

async function fetchAllRepos(token) {
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'WolfBot-RepoLister',
        'X-GitHub-Api-Version': '2022-11-28'
    };

    // Validate token + get login first so we can show a friendly identity in the result.
    let login = '';
    try {
        const me = await axios.get(`${GH_API}/user`, { headers, timeout: 10000 });
        login = me.data?.login || '';
    } catch (err) {
        const status = err.response?.status;
        if (status === 401) throw new Error('Invalid or revoked token (401).');
        if (status === 403) throw new Error('Token rejected — likely missing scopes or rate-limited (403).');
        throw new Error(`Auth check failed: ${err.message}`);
    }

    // Paginate /user/repos. Default lists owner+collaborator+org_member, which matches
    // "all repos this token can see" — exactly what the user wants.
    const all = [];
    let truncated = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
        const r = await axios.get(`${GH_API}/user/repos`, {
            headers,
            params: { per_page: PER_PAGE, page, sort: 'updated', affiliation: 'owner,collaborator,organization_member' },
            timeout: 15000
        });
        const batch = r.data || [];
        all.push(...batch);
        if (batch.length < PER_PAGE) break;
        // Hit our safety cap with a still-full page → there are more we didn't fetch.
        if (page === MAX_PAGES) truncated = true;
    }

    return { login, repos: all, truncated };
}

function partition(repos) {
    const privates = [];
    const publics = [];
    for (const r of repos) {
        // GitHub uses `private: true|false`. Forks/archived still count.
        (r.private ? privates : publics).push({
            full_name: r.full_name,
            name: r.name,
            owner: r.owner?.login || '',
            url: r.html_url,
            stars: r.stargazers_count || 0,
            language: r.language || '',
            fork: !!r.fork,
            archived: !!r.archived,
            updated_at: r.updated_at
        });
    }
    return { privates, publics };
}

function formatRepoLine(repo, idx) {
    const tags = [];
    if (repo.fork) tags.push('🍴');
    if (repo.archived) tags.push('📦');
    const tagStr = tags.length ? ' ' + tags.join('') : '';
    const langStr = repo.language ? ` · ${repo.language}` : '';
    const starStr = repo.stars > 0 ? ` ⭐${repo.stars}` : '';
    return `${String(idx).padStart(3, ' ')}. ${repo.full_name}${tagStr}${langStr}${starStr}`;
}

async function sendRepoList(sock, jid, m, kind, repos, login) {
    const icon = kind === 'private' ? '🔒' : '🌐';
    const title = kind === 'private' ? 'PRIVATE REPOS' : 'PUBLIC REPOS';

    if (!repos.length) {
        return sock.sendMessage(jid, {
            text: `${icon} *${title}*\n\nNo ${kind} repos found for *${login}*.`
        }, { quoted: m });
    }

    // Chunk into multiple messages so WhatsApp doesn't truncate huge lists.
    const total = repos.length;
    const chunks = [];
    for (let i = 0; i < total; i += REPOS_PER_MESSAGE) {
        chunks.push(repos.slice(i, i + REPOS_PER_MESSAGE));
    }

    for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        const startIdx = c * REPOS_PER_MESSAGE + 1;
        const lines = chunk.map((r, i) => formatRepoLine(r, startIdx + i));

        const header =
            `╭─⌈ ${icon} *${title}* ⌋\n` +
            `├─⊷ User    : ${login}\n` +
            `├─⊷ Total   : ${total}\n` +
            `├─⊷ Showing : ${startIdx}-${startIdx + chunk.length - 1}` +
            (chunks.length > 1 ? `  (page ${c + 1}/${chunks.length})` : '') + `\n` +
            `│\n`;

        const footer = `\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;

        await sock.sendMessage(jid, {
            text: header + '```\n' + lines.join('\n') + '\n```' + footer
        }, c === 0 ? { quoted: m } : {});
    }
}

async function sendCategoryButtons(sock, jid, m, PREFIX, login, totalCount, privateCount, publicCount, truncated) {
    const truncNote = truncated
        ? `├─⊷ ⚠️ Capped at ${totalCount} (more exist)\n`
        : '';
    const bodyText =
        `╭─⌈ 🐙 *GITHUB REPOS LOADED* ⌋\n` +
        `├─⊷ Account : ${login}\n` +
        `├─⊷ Total   : *${totalCount}* repos\n` +
        `├─⊷ Private : 🔒 ${privateCount}\n` +
        `├─⊷ Public  : 🌐 ${publicCount}\n` +
        truncNote +
        `│\n` +
        `╰⊷ Tap a button to list them.`;

    const buttons = [
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: `🔒 Private (${privateCount})`,
                id: `${PREFIX}gitrepos private`
            })
        },
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: `🌐 Public (${publicCount})`,
                id: `${PREFIX}gitrepos public`
            })
        }
    ];

    // Try interactive buttons first; fall back to text + numbered hints if wolfbtns
    // isn't loaded or the relay fails (e.g. older WhatsApp clients).
    if (isGiftedBtnsAvailable()) {
        try {
            let imageBuffer = null;
            try { imageBuffer = (await getMenuImageBuffer())?.buffer || null; } catch {}
            await sendInteractiveWithImage(sock, jid, {
                bodyText,
                footerText: ` ${getOwnerName().toUpperCase()} TECH`,
                buttons,
                imageBuffer,
                mimetype: 'image/jpeg'
            });
            return;
        } catch (err) {
            console.log('[gitrepos] Interactive send failed, falling back:', err.message);
        }
    }

    await sock.sendMessage(jid, {
        text:
            bodyText + '\n\n' +
            `Or type:\n` +
            `• *${PREFIX}gitrepos private*\n` +
            `• *${PREFIX}gitrepos public*`
    }, { quoted: m });
}

export default {
    name: 'gitrepos',
    aliases: ['ghrepos', 'repos'],
    description: 'Load all GitHub repos accessible to a token, then list public/private via buttons.',
    category: 'github',
    ownerOnly: false,

    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;
        const sub = (args[0] || '').toLowerCase();

        // ─── Button-click handlers: read previously stored session ─────────
        if (sub === 'private' || sub === 'public') {
            const session = getActionSession(makeSessionKey(m));
            if (!session) {
                return sock.sendMessage(jid, {
                    text:
                        `❌ No loaded repos in this chat (or session expired).\n` +
                        `Run *${PREFIX}gitrepos <token>* again to refresh.`
                }, { quoted: m });
            }
            const list = sub === 'private' ? session.privates : session.publics;
            return sendRepoList(sock, jid, m, sub, list, session.login);
        }

        if (sub === 'clear' || sub === 'reset') {
            deleteActionSession(makeSessionKey(m));
            return sock.sendMessage(jid, { text: '🧹 Cleared loaded repo session for this chat.' }, { quoted: m });
        }

        // ─── Help ──────────────────────────────────────────────────────────
        if (!sub) {
            return sock.sendMessage(jid, {
                text:
                    `╭─⌈ 🐙 *GITHUB REPOS* ⌋\n` +
                    `│\n` +
                    `│ Loads every repo a token can see, then lets\n` +
                    `│ you tap *🔒 Private* or *🌐 Public* to list them.\n` +
                    `│\n` +
                    `│ *Usage:*\n` +
                    `│  • *${PREFIX}gitrepos <token>*\n` +
                    `│  • *${PREFIX}gitrepos private* (after loading)\n` +
                    `│  • *${PREFIX}gitrepos public*  (after loading)\n` +
                    `│  • *${PREFIX}gitrepos reset*   — clear session\n` +
                    `│\n` +
                    `│ ⚠️ *Send tokens in DM only* — anyone in a group\n` +
                    `│ chat can read the message. The bot tries to\n` +
                    `│ delete the original message but cannot guarantee it.\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }

        // ─── Treat first arg as the token and load repos ───────────────────
        const token = args[0];

        // Sanity-check the token shape so we don't burn an API call on obvious junk.
        // Accepts classic (ghp_/gho_/ghu_/ghs_/ghr_) and fine-grained (github_pat_) tokens,
        // plus 40-char hex (legacy) as a permissive fallback.
        const looksLikeToken =
            /^gh[pousr]_[A-Za-z0-9]{20,}$/.test(token) ||
            /^github_pat_[A-Za-z0-9_]{20,}$/.test(token) ||
            /^[a-f0-9]{40}$/.test(token);
        if (!looksLikeToken) {
            return sock.sendMessage(jid, {
                text:
                    `❌ That doesn't look like a GitHub token.\n` +
                    `Expected something starting with \`ghp_\`, \`gho_\`, or \`github_pat_\`.`
            }, { quoted: m });
        }

        // Try to wipe the message that contains the raw token before doing anything else.
        await tryRedactTokenMessage(sock, m);
        try { await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } }); } catch {}

        try {
            const { login, repos, truncated } = await fetchAllRepos(token);
            const { privates, publics } = partition(repos);

            // Stash the categorized lists (NOT the token) for the button handlers.
            // 5-minute TTL is plenty — user is right there clicking.
            setActionSession(makeSessionKey(m), {
                login,
                privates,
                publics,
                total: repos.length
            });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: m.key } }); } catch {}

            await sendCategoryButtons(sock, jid, m, PREFIX, login, repos.length, privates.length, publics.length, truncated);
        } catch (err) {
            console.error('[gitrepos] Load failed:', err.message);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: m.key } }); } catch {}
            await sock.sendMessage(jid, {
                text:
                    `╭─⌈ ❌ *LOAD FAILED* ⌋\n` +
                    `│\n` +
                    `│ ${err.message}\n` +
                    `│\n` +
                    `│ 💡 Make sure your token has the *repo* scope\n` +
                    `│    (or *Contents: Read* for fine-grained tokens).\n` +
                    `│\n` +
                    `╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
            }, { quoted: m });
        }
    }
};
