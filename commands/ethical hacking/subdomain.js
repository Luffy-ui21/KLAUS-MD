import dns from 'dns';
import { getBotName } from '../../lib/botname.js';
import { promisify } from 'util';
import axios from 'axios';
import { getOwnerName } from '../../lib/menuHelper.js';

const resolve4 = promisify(dns.resolve4);

const COMMON_SUBDOMAINS = [
    'www', 'mail', 'ftp', 'api', 'dev', 'test', 'staging', 'admin',
    'blog', 'shop', 'cdn', 'app', 'portal', 'secure', 'vpn', 'git',
    'ci', 'status', 'docs', 'support', 'help', 'forum', 'wiki', 'store',
    'media', 'img', 'images', 'static', 'assets', 'files', 'download',
    'login', 'auth', 'sso', 'accounts', 'dashboard', 'panel', 'console',
    'beta', 'alpha', 'demo', 'sandbox', 'preview', 'release',
    'ns1', 'ns2', 'ns3', 'dns', 'dns1', 'dns2',
    'smtp', 'pop', 'imap', 'webmail', 'exchange', 'mx',
    'db', 'database', 'mysql', 'postgres', 'redis', 'mongo',
    'proxy', 'gateway', 'lb', 'loadbalancer', 'edge',
    'monitor', 'metrics', 'grafana', 'kibana', 'logs',
    'jenkins', 'gitlab', 'bitbucket', 'jira', 'confluence',
    's3', 'storage', 'backup', 'archive',
    'chat', 'slack', 'teams', 'meet',
    'www2', 'www3', 'web', 'web1', 'web2',
    'cloud', 'aws', 'gcp', 'azure',
    'internal', 'intranet', 'corp', 'office', 'remote',
    'go', 'link', 'links', 'redirect', 'short',
    'pay', 'payment', 'billing', 'checkout', 'cart',
    'search', 'analytics', 'tracking', 'events', 'webhook'
];

async function fetchCrtShSubdomains(domain) {
    try {
        const { data } = await axios.get(`https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`, {
            timeout: 15000,
            headers: { 'User-Agent': 'WolfBot/1.0' }
        });
        if (!Array.isArray(data)) return [];
        const subs = new Set();
        for (const entry of data) {
            const name = (entry.name_value || '').trim().toLowerCase();
            if (!name || name.includes('*')) continue;
            name.split('\n').forEach(n => {
                const clean = n.trim().toLowerCase();
                if (clean.endsWith(`.${domain}`) && clean !== domain) {
                    subs.add(clean);
                }
            });
        }
        return Array.from(subs);
    } catch {
        return [];
    }
}

export default {
    name: 'subdomain',
    alias: ['subenum', 'subdomains', 'subfinder'],
    description: 'Subdomain enumeration using DNS + Certificate Transparency',
    category: 'ethical hacking',
    usage: 'subdomain <domain>',
    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;
        if (!args[0]) {
            return sock.sendMessage(jid, { text: `╭─⌈ 🌍 *SUBDOMAIN FINDER* ⌋\n│\n├─⊷ *${PREFIX}subdomain <domain>*\n│  └⊷ Find subdomains via DNS + crt.sh\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}subdomain google.com\n│  └⊷ ${PREFIX}subdomain github.com\n│\n├─⊷ *Methods:*\n│  └⊷ DNS bruteforce (${COMMON_SUBDOMAINS.length} names)\n│  └⊷ Certificate Transparency (crt.sh)\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
        }
        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
        try {
            const domain = args[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
            const allFound = new Map();

            const [, crtSubdomains] = await Promise.all([
                (async () => {
                    const checks = COMMON_SUBDOMAINS.map(async (sub) => {
                        try {
                            const host = `${sub}.${domain}`;
                            const ips = await resolve4(host);
                            if (ips && ips.length > 0) {
                                allFound.set(host, { subdomain: host, ips, source: 'dns' });
                            }
                        } catch {}
                    });
                    await Promise.all(checks);
                })(),
                fetchCrtShSubdomains(domain)
            ]);

            for (const sub of crtSubdomains) {
                if (!allFound.has(sub)) {
                    try {
                        const ips = await resolve4(sub);
                        if (ips && ips.length > 0) {
                            allFound.set(sub, { subdomain: sub, ips, source: 'crt.sh' });
                        }
                    } catch {
                        allFound.set(sub, { subdomain: sub, ips: ['(no A record)'], source: 'crt.sh' });
                    }
                }
            }

            const found = Array.from(allFound.values()).sort((a, b) => a.subdomain.localeCompare(b.subdomain));
            const dnsCount = found.filter(f => f.source === 'dns').length;
            const crtCount = found.filter(f => f.source === 'crt.sh').length;

            let result = `╭─⌈ 🌍 *SUBDOMAIN FINDER* ⌋\n│\n`;
            result += `├─⊷ *Target:* ${domain}\n`;
            result += `├─⊷ *DNS Checked:* ${COMMON_SUBDOMAINS.length} names\n`;
            result += `├─⊷ *Cert Transparency:* ${crtSubdomains.length} found\n`;
            result += `├─⊷ *Total Active:* ${found.length} subdomains\n`;
            result += `├─⊷ *Sources:* DNS: ${dnsCount} | crt.sh: ${crtCount}\n│\n`;

            if (found.length > 0) {
                const displayLimit = 40;
                found.slice(0, displayLimit).forEach(({ subdomain, ips, source }) => {
                    const tag = source === 'crt.sh' ? ' 📜' : ' 🔍';
                    result += `├─⊷ *${subdomain}*${tag}\n`;
                    ips.slice(0, 2).forEach(ip => { result += `│  └⊷ ${ip}\n`; });
                });
                if (found.length > displayLimit) {
                    result += `│\n├─⊷ _... and ${found.length - displayLimit} more_\n`;
                }
            } else {
                result += `├─⊷ No subdomains found\n`;
            }

            result += `│\n├─⊷ 🔍 = DNS bruteforce | 📜 = Certificate Transparency\n`;
            result += `╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

            await sock.sendMessage(jid, { text: result }, { quoted: m });
            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
        }
    }
};
