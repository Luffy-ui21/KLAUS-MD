import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

async function whoisLookup(domain) {
    const apis = [
        {
            name: 'rdap',
            url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            parse: (data) => {
                const events = data.events || [];
                const getEvent = (action) => events.find(e => e.eventAction === action)?.eventDate?.split('T')[0] || 'Unknown';
                const nameservers = (data.nameservers || []).map(ns => ns.ldhName || ns.objectClassName || '').filter(Boolean);
                const registrar = data.entities?.find(e => e.roles?.includes('registrar'));
                const registrarName = registrar?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || registrar?.handle || 'Unknown';
                const registrant = data.entities?.find(e => e.roles?.includes('registrant'));
                const org = registrant?.vcardArray?.[1]?.find(v => v[0] === 'org')?.[3] || '';
                const country = registrant?.vcardArray?.[1]?.find(v => v[0] === 'adr')?.[3]?.country || '';
                const status = (data.status || []).slice(0, 5);
                return {
                    domain: data.ldhName || domain,
                    registrar: registrarName,
                    created: getEvent('registration'),
                    updated: getEvent('last changed'),
                    expires: getEvent('expiration'),
                    nameservers,
                    status,
                    organization: org,
                    country: country
                };
            }
        },
        {
            name: 'whoisjson',
            url: `https://whoisjson.com/api/v1/whois?domain=${encodeURIComponent(domain)}`,
            parse: (data) => ({
                domain: data.domain_name || domain,
                registrar: data.registrar || 'Unknown',
                created: data.creation_date || 'Unknown',
                updated: data.updated_date || 'Unknown',
                expires: data.expiration_date || 'Unknown',
                nameservers: Array.isArray(data.name_servers) ? data.name_servers : (data.name_servers ? [data.name_servers] : []),
                status: Array.isArray(data.status) ? data.status.slice(0, 5) : (data.status ? [data.status] : []),
                organization: data.org || '',
                country: data.country || ''
            })
        },
        {
            name: 'ip2whois',
            url: `https://www.ip2whois.com/api/v2?key=free&domain=${encodeURIComponent(domain)}`,
            parse: (data) => ({
                domain: data.domain || domain,
                registrar: data.registrar?.name || 'Unknown',
                created: data.create_date || 'Unknown',
                updated: data.update_date || 'Unknown',
                expires: data.expire_date || 'Unknown',
                nameservers: data.nameservers || [],
                status: data.status ? [data.status] : [],
                organization: data.registrant?.organization || '',
                country: data.registrant?.country || ''
            })
        }
    ];

    for (const api of apis) {
        try {
            const { data } = await axios.get(api.url, {
                timeout: 12000,
                headers: { 'Accept': 'application/json', 'User-Agent': 'WolfBot/1.0' }
            });
            if (!data || data.error || data.errorCode) continue;
            const parsed = api.parse(data);
            if (parsed.domain && (parsed.registrar !== 'Unknown' || parsed.created !== 'Unknown')) {
                parsed.source = api.name;
                return parsed;
            }
        } catch {}
    }

    throw new Error('All WHOIS APIs failed. Try again later.');
}

export default {
    name: 'whois',
    alias: ['domaininfo', 'whoislookup'],
    description: 'WHOIS domain lookup - get registration details',
    category: 'ethical hacking',
    usage: 'whois <domain>',
    async execute(sock, m, args, PREFIX) {
        const jid = m.key.remoteJid;
        if (!args[0]) {
            return sock.sendMessage(jid, { text: `╭─⌈ 🔍 *WHOIS LOOKUP* ⌋\n│\n├─⊷ *${PREFIX}whois <domain>*\n│  └⊷ Get domain registration info\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}whois google.com\n│  └⊷ ${PREFIX}whois github.com\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
        }
        await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
        try {
            const domain = args[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
            const info = await whoisLookup(domain);

            let result = `╭─⌈ 🔍 *WHOIS LOOKUP* ⌋\n│\n`;
            result += `├─⊷ *Domain:* ${info.domain}\n`;
            result += `├─⊷ *Registrar:* ${info.registrar}\n`;
            result += `├─⊷ *Created:* ${info.created}\n`;
            result += `├─⊷ *Updated:* ${info.updated}\n`;
            result += `├─⊷ *Expires:* ${info.expires}\n`;
            if (info.organization) result += `├─⊷ *Organization:* ${info.organization}\n`;
            if (info.country) result += `├─⊷ *Country:* ${info.country}\n`;
            result += `│\n├─⊷ *Nameservers:*\n`;
            if (info.nameservers.length > 0) {
                info.nameservers.slice(0, 8).forEach(n => { result += `│  └⊷ ${n}\n`; });
            } else {
                result += `│  └⊷ None found\n`;
            }
            if (info.status.length > 0) {
                result += `│\n├─⊷ *Status:*\n`;
                info.status.forEach(s => { result += `│  └⊷ ${s}\n`; });
            }
            result += `│\n├─⊷ _Source: ${info.source}_\n`;
            result += `╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

            await sock.sendMessage(jid, { text: result }, { quoted: m });
            await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
        } catch (err) {
            await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
        }
    }
};
