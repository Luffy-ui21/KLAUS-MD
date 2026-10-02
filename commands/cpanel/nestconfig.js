import {
    loadConfig, saveConfig,
    listNests, listEggs, listNodes, listLocations
} from '../../lib/cpanel.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name:        'nestconfig',
    alias:       ['nestconfiguration', 'nestcfg', 'cpanelnest'],
    category:    'cpanel',
    description: 'Configure the Pterodactyl Nest/Egg/Node template for createpanel',
    ownerOnly:   true,
    sudoAllowed: false,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const owner  = getOwnerName().toUpperCase();
        const { jidManager } = extra;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
        }

        const config = loadConfig();
        const nest   = config.nest;
        const sub    = (args[0] || '').toLowerCase();

        // ── no args → show status + compact help ────────────────────────────
        if (!sub || sub === 'show') {
            return sock.sendMessage(chatId, {
                text: `╭─⌈ 🏗️ *NEST CONFIG* ⌋\n` +
                      `│\n` +
                      `├─⊷ 🪺 *Current Settings*\n` +
                      `│  ├⊷ Nest: ${nest.nestId ?? '—'}  Egg: ${nest.eggId ?? '—'}  Node: ${nest.nodeId ?? '—'}\n` +
                      `│  └⊷ Location: ${nest.locationId ?? '—'}  CPU: ${nest.cpu}%  RAM: ${nest.memory}MB  Disk: ${nest.disk}MB\n` +
                      `│\n` +
                      `├─⊷ *${PREFIX}nestconfig nests*\n` +
                      `│  └⊷ List all available nests\n` +
                      `├─⊷ *${PREFIX}nestconfig eggs <nestId>*\n` +
                      `│  └⊷ List eggs inside a nest\n` +
                      `├─⊷ *${PREFIX}nestconfig nodes*\n` +
                      `│  └⊷ List all nodes\n` +
                      `├─⊷ *${PREFIX}nestconfig locations*\n` +
                      `│  └⊷ List all locations\n` +
                      `│\n` +
                      `├─⊷ *${PREFIX}nestconfig nest <id>*\n` +
                      `│  └⊷ Set the nest\n` +
                      `├─⊷ *${PREFIX}nestconfig egg <id>*\n` +
                      `│  └⊷ Set the egg\n` +
                      `├─⊷ *${PREFIX}nestconfig node <id>*\n` +
                      `│  └⊷ Set the node\n` +
                      `├─⊷ *${PREFIX}nestconfig location <id>*\n` +
                      `│  └⊷ Set the location\n` +
                      `│\n` +
                      `├─⊷ *${PREFIX}nestconfig cpu <value>*\n` +
                      `│  └⊷ Set CPU limit (e.g. 100)\n` +
                      `├─⊷ *${PREFIX}nestconfig ram <value>*\n` +
                      `│  └⊷ Set RAM in MB (e.g. 512)\n` +
                      `├─⊷ *${PREFIX}nestconfig disk <value>*\n` +
                      `│  └⊷ Set disk in MB (e.g. 2048)\n` +
                      `│\n` +
                      `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        }

        // ── list commands ───────────────────────────────────────────────────
        const listCmds = { nests: null, eggs: args[1], nodes: null, locations: null };

        if (sub === 'nests') {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
            try {
                const items = await listNests();
                if (!items.length) {
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(chatId, { text: '❌ No nests found.' }, { quoted: msg });
                }
                const lines = items.map(n => `  • *${n.attributes.id}* — ${n.attributes.name}`).join('\n');
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🪺 *NESTS* ⌋\n${lines}\n╰⊷ *${PREFIX}nestconfig nest <id>* to set`
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: msg });
            }
        }

        if (sub === 'eggs') {
            if (!args[1]) return sock.sendMessage(chatId, { text: `Usage: \`${PREFIX}nestconfig eggs <nestId>\`` }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
            try {
                const items = await listEggs(args[1]);
                if (!items.length) {
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(chatId, { text: '❌ No eggs found in that nest.' }, { quoted: msg });
                }
                const lines = items.map(e => `  • *${e.attributes.id}* — ${e.attributes.name}`).join('\n');
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🥚 *EGGS (Nest ${args[1]})* ⌋\n${lines}\n╰⊷ *${PREFIX}nestconfig egg <id>* to set`
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: msg });
            }
        }

        if (sub === 'nodes') {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
            try {
                const items = await listNodes();
                if (!items.length) {
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(chatId, { text: '❌ No nodes found.' }, { quoted: msg });
                }
                const lines = items.map(n => `  • *${n.attributes.id}* — ${n.attributes.name} (loc ${n.attributes.location_id})`).join('\n');
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 🖥️ *NODES* ⌋\n${lines}\n╰⊷ *${PREFIX}nestconfig node <id>* to set`
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: msg });
            }
        }

        if (sub === 'locations') {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
            try {
                const items = await listLocations();
                if (!items.length) {
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(chatId, { text: '❌ No locations found.' }, { quoted: msg });
                }
                const lines = items.map(l => `  • *${l.attributes.id}* — ${l.attributes.long || l.attributes.short}`).join('\n');
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: `╭─⌈ 📍 *LOCATIONS* ⌋\n${lines}\n╰⊷ *${PREFIX}nestconfig location <id>* to set`
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: msg });
            }
        }

        // ── setter commands ──────────────────────────────────────────────────
        const setters = {
            nest:     (v) => { nest.nestId        = Number(v); },
            egg:      (v) => { nest.eggId         = Number(v); },
            node:     (v) => { nest.nodeId        = Number(v); },
            location: (v) => { nest.locationId    = Number(v); },
            cpu:      (v) => { nest.cpu           = Number(v); },
            ram:      (v) => { nest.memory        = Number(v); },
            disk:     (v) => { nest.disk          = Number(v); },
            dbs:      (v) => { nest.databases     = Number(v); },
            backups:  (v) => { nest.backups       = Number(v); },
            startup:  ()  => { nest.startupCommand = args.slice(1).join(' '); },
            image:    ()  => { nest.dockerImage    = args.slice(1).join(' '); }
        };

        if (!setters[sub]) {
            return sock.sendMessage(chatId, {
                text: `❓ Unknown option: *${sub}*\n\nRun \`${PREFIX}nestconfig\` for help.`
            }, { quoted: msg });
        }

        const val = args[1];
        if (!val) {
            return sock.sendMessage(chatId, { text: `Usage: \`${PREFIX}nestconfig ${sub} <value>\`` }, { quoted: msg });
        }

        setters[sub](val);
        config.nest = nest;
        saveConfig(config);

        const display = (sub === 'startup' || sub === 'image') ? args.slice(1).join(' ') : val;
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(chatId, {
            text: `✅ *${sub}* → \`${display}\``
        }, { quoted: msg });
    }
};
