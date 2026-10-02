// ── Repository Config ────────────────────────────────────────────────────────
// Single source of truth for the bot's GitHub repository.
//
// If you ever need to switch to a NEW account or repo (e.g. the current one
// gets flagged), just edit the two values below — every command, menu,
// notice, button and downloader that points at GitHub will follow.
//
//   OWNER  → your GitHub username / organization
//   REPO   → the repository name
// ─────────────────────────────────────────────────────────────────────────────

export const OWNER = 'WOLVAREX';
export const REPO  = 'silentwolf';

// Optional: change if you ever rename the default branch.
export const BRANCH = 'main';

// ── Derived URLs (do not edit unless you know what you're doing) ─────────────
export const FULL_NAME   = `${OWNER}/${REPO}`;
export const PROFILE_URL = `https://github.com/${OWNER}`;
export const REPO_URL    = `https://github.com/${OWNER}/${REPO}`;
export const REPO_GIT    = `${REPO_URL}.git`;
export const REPO_ZIP    = `${REPO_URL}/archive/HEAD.zip`;
export const STAR_URL    = `${REPO_URL}/stargazers`;
export const FORK_URL    = `${REPO_URL}/fork`;
export const AVATAR_URL  = `https://github.com/${OWNER}.png`;
export const API_URL     = `https://api.github.com/repos/${OWNER}/${REPO}`;

export default {
    OWNER, REPO, BRANCH, FULL_NAME,
    PROFILE_URL, REPO_URL, REPO_GIT, REPO_ZIP,
    STAR_URL, FORK_URL, AVATAR_URL, API_URL,
};
