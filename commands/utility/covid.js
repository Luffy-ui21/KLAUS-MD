// commands/utility/covid.js
import fetch from 'node-fetch';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

export default {
  name: 'covid',
  alias: ['covid19', 'corona'],
  description: '🦠 Get COVID-19 stats for any country',
  category: 'utility',
  usage: '.covid <country name>',

  async execute(sock, m, args, from, isGroup, sender) {
    if (!args.length) {
      return sock.sendMessage(
        typeof from === 'string' ? from : m.key.remoteJid,
        { text: `╭─⌈ 🦠 *COVID-19 STATS* ⌋\n│\n├─⊷ *covid <country>*\n│  └⊷ Get COVID-19 stats for a country\n│\n├─⊷ *Example:*\n│  └⊷ \`.covid Kenya\`\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}` },
        { quoted: m }
      );
    }

    const country = args.join(' ');
    const url = `https://disease.sh/v3/covid-19/countries/${encodeURIComponent(country)}?strict=true`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.message) {
        return sock.sendMessage(
          typeof from === 'string' ? from : m.key.remoteJid,
          { text: `❌ Could not find COVID-19 stats for "${country}".` },
          { quoted: m }
        );
      }

      const covidText = `🦠 COVID-19 Stats for *${data.country}*:
🌡 Cases: ${data.cases.toLocaleString()}
💀 Deaths: ${data.deaths.toLocaleString()}
💚 Recovered: ${data.recovered.toLocaleString()}
💉 Vaccinated: ${data.population ? ((data.vaccinated || data.population) / data.population * 100).toFixed(2) + '%' : 'N/A'}
📆 Last Update: ${new Date(data.updated).toLocaleString()}`;

      const jid = typeof from === 'string' ? from : m.key.remoteJid;
      await sock.sendMessage(jid, { text: covidText }, { quoted: m });

    } catch (err) {
      console.error('[COVID Error]', err);
      const jid = typeof from === 'string' ? from : m.key.remoteJid;
      if (typeof jid === 'string') {
        sock.sendMessage(jid, { text: '❌ Failed to fetch COVID-19 stats. Please try again later.' }, { quoted: m });
      }
    }
  }
};
