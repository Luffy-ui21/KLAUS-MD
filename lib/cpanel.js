// ====== lib/cpanel.js ======
// Pterodactyl Panel API helper + config management for the cPanel command suite.
//
// Provides:
//   loadConfig() / saveConfig()  — persist panel settings in data/cpanel_config.json
//   isConfigured()               — quick guard: API key + URL both set?
//   generatePassword()           — random 8-char alphanumeric password
//   usernameFromEmail()          — derive a clean username from an e-mail address
//   createUser()                 — POST /api/application/users
//   createServer()               — POST /api/application/servers
//   getUserByEmail/Username()    — look up an existing user before creating a server
//   listNests/Eggs/Nodes/        — helpers for nestconfig command
//   listLocations()
//   listAllocations()            — free allocations for a given node

import { fileURLToPath } from 'url';
import db from './database.js';

const DB_KEY = 'cpanel_config';

// ── Default config shape ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    apiKey:   '',
    panelUrl: '',
    nest: {
        nestId:         null,
        eggId:          null,
        nodeId:         null,
        locationId:     null,
        cpu:            100,
        memory:         512,
        disk:           1024,
        databases:      0,
        allocations:    1,
        backups:        0,
        startupCommand: '',
        dockerImage:    ''
    }
};

// ── Config I/O ──────────────────────────────────────────────────────────────

export function loadConfig() {
    try {
        const saved = db.getConfigSync(DB_KEY, null);
        if (saved && typeof saved === 'object') {
            return {
                ...DEFAULT_CONFIG,
                ...saved,
                nest: { ...DEFAULT_CONFIG.nest, ...(saved.nest || {}) }
            };
        }
    } catch {}
    return { ...DEFAULT_CONFIG, nest: { ...DEFAULT_CONFIG.nest } };
}

export function saveConfig(config) {
    db.setConfigSync(DB_KEY, config);
}

export function isConfigured() {
    const c = loadConfig();
    return !!(c.apiKey && c.panelUrl);
}

// ── Utilities ───────────────────────────────────────────────────────────────

/** 8-character password — uppercase + lowercase + digits */
export function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pass = '';
    for (let i = 0; i < 8; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)];
    }
    return pass;
}

/** Strip non-alphanumeric from the local part of an e-mail to build a Pterodactyl username */
export function usernameFromEmail(email) {
    return email.split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .substring(0, 20) || 'user' + Math.floor(Math.random() * 9999);
}

// ── Core Pterodactyl API wrapper ─────────────────────────────────────────────

async function pteroRequest(method, endpoint, body = null) {
    const config = loadConfig();

    if (!config.apiKey || !config.panelUrl) {
        throw new Error('cPanel is not configured yet.\n\nUse *setkey* and *setlink* first.');
    }

    const base = config.panelUrl.replace(/\/+$/, '');
    const url  = `${base}/api/application${endpoint}`;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type':  'application/json',
            'Accept':        'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    let res;
    try {
        res = await fetch(url, options);
    } catch (netErr) {
        throw new Error(`Network error — could not reach ${base}\n${netErr.message}`);
    }

    // Pterodactyl returns JSON even on errors
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const detail = data?.errors?.[0]?.detail
            || data?.errors?.[0]?.code
            || data?.message
            || `HTTP ${res.status}`;
        throw new Error(detail);
    }

    return data;
}

// ── Application API — Users ─────────────────────────────────────────────────

export async function createUser(email, username, password, firstName = 'Panel', lastName = 'User') {
    return pteroRequest('POST', '/users', {
        email,
        username,
        first_name: firstName,
        last_name:  lastName,
        password,
        root_admin: false,
        language:   'en'
    });
}

export async function updateUser(userId, fields) {
    return pteroRequest('PATCH', `/users/${userId}`, fields);
}

export async function getUserByEmail(email) {
    const data = await pteroRequest('GET', `/users?filter[email]=${encodeURIComponent(email)}&include=servers`);
    return data?.data?.[0] || null;
}

export async function getUserByUsername(username) {
    const data = await pteroRequest('GET', `/users?filter[username]=${encodeURIComponent(username)}&include=servers`);
    return data?.data?.[0] || null;
}

// ── Application API — Servers ───────────────────────────────────────────────

/**
 * Create a server for an existing Pterodactyl user.
 * @param {number} userId        - Pterodactyl internal user ID
 * @param {string} serverName    - Display name for the server
 * @param {object} [overrides]   - Optional per-call nest/resource overrides
 */
export async function createServer(userId, serverName, overrides = {}) {
    const config = loadConfig();
    const nest   = { ...config.nest, ...overrides };

    if (!nest.eggId)      throw new Error('Egg ID not configured. Run *nestconfig egg <id>* first.');
    if (!nest.locationId) throw new Error('Location ID not configured. Run *nestconfig location <id>* first.');

    // Fetch the first free allocation for the chosen location/node
    let allocationId = overrides.allocationId || null;

    if (!allocationId) {
        allocationId = await findFreeAllocation(nest.nodeId, nest.locationId);
    }

    if (!allocationId) {
        throw new Error('No free allocations found on the configured node/location. Add more ports in the Pterodactyl admin panel.');
    }

    return pteroRequest('POST', '/servers', {
        name:  serverName,
        user:  userId,
        egg:   nest.eggId,
        docker_image: nest.dockerImage || '',
        startup:      nest.startupCommand || '',
        environment:  {},
        limits: {
            memory: Number(nest.memory),
            swap:   0,
            disk:   Number(nest.disk),
            io:     500,
            cpu:    Number(nest.cpu)
        },
        feature_limits: {
            databases:   Number(nest.databases),
            allocations: Number(nest.allocations),
            backups:     Number(nest.backups)
        },
        allocation: { default: allocationId }
    });
}

// ── Application API — Info endpoints ────────────────────────────────────────

export async function listNests() {
    const data = await pteroRequest('GET', '/nests');
    return data?.data || [];
}

export async function listEggs(nestId) {
    const data = await pteroRequest('GET', `/nests/${nestId}/eggs`);
    return data?.data || [];
}

export async function listNodes() {
    const data = await pteroRequest('GET', '/nodes');
    return data?.data || [];
}

export async function listLocations() {
    const data = await pteroRequest('GET', '/locations');
    return data?.data || [];
}

export async function listAllocations(nodeId) {
    const data = await pteroRequest('GET', `/nodes/${nodeId}/allocations`);
    return data?.data || [];
}

export async function listUsers() {
    const data = await pteroRequest('GET', '/users?per_page=100');
    return data?.data || [];
}

export async function listServers() {
    const data = await pteroRequest('GET', '/servers?per_page=100');
    return data?.data || [];
}

export async function getUserById(userId) {
    const data = await pteroRequest('GET', `/users/${userId}?include=servers`);
    return data || null;
}

export async function deleteUser(userId) {
    return pteroRequest('DELETE', `/users/${userId}`);
}

export async function deleteServer(serverId) {
    return pteroRequest('DELETE', `/servers/${serverId}`);
}

export async function getServersByUserId(userId) {
    const data = await pteroRequest('GET', `/servers?filter[owner_id]=${userId}&per_page=100`);
    return data?.data || [];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Find the first unassigned allocation on a node.
 * Falls back to scanning all nodes in the location if nodeId is null.
 */
async function findFreeAllocation(nodeId, locationId) {
    try {
        if (nodeId) {
            const allocs = await listAllocations(nodeId);
            const free   = allocs.find(a => !a.attributes.assigned);
            return free?.attributes?.id || null;
        }

        // No specific node — scan all nodes in the location
        const nodes = await listNodes();
        const inLocation = nodes.filter(n => n.attributes.location_id === Number(locationId));

        for (const node of inLocation) {
            const allocs = await listAllocations(node.attributes.id);
            const free   = allocs.find(a => !a.attributes.assigned);
            if (free) return free.attributes.id;
        }
    } catch {}

    return null;
}
