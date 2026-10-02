import { createRequire } from 'module';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

export default {
  name: 'getjid',
  description: 'Get the JID of a chat, user, group or channel',
  category: 'utility',
  aliases: ['jid', 'id'],

  async execute(sock, m, args) {
    const chatJid = m.key.remoteJid;

    try {
      let resolvedJid = chatJid;

      const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
      const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      if (quotedParticipant) {
        resolvedJid = await this.resolveJid(sock, quotedParticipant);
      } else if (mentionedJid) {
        resolvedJid = await this.resolveJid(sock, mentionedJid);
      } else if (args[0]) {
        const raw = args.join(' ').trim();

        const channelMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:whatsapp\.com\/channel|chat\.whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/i);
        if (channelMatch) {
          try {
            const meta = await sock.newsletterMetadata('invite', channelMatch[1]);
            if (meta?.id) resolvedJid = meta.id;
          } catch {}
        } else {
          const groupMatch = raw.match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
          if (groupMatch) {
            try {
              const meta = await sock.groupGetInviteInfo(groupMatch[1]);
              if (meta?.id) resolvedJid = meta.id;
            } catch {}
          } else {
            const clean = raw.replace(/\D/g, '');
            if (clean.length >= 7) resolvedJid = `${clean}@s.whatsapp.net`;
          }
        }
      } else {
        if (chatJid.endsWith('@g.us')) {
          resolvedJid = chatJid;
        } else {
          const sender = m.key.participant || chatJid;
          resolvedJid = await this.resolveJid(sock, sender);
        }
      }

      await this.sendJid(sock, m, resolvedJid);

    } catch (err) {
      await sock.sendMessage(chatJid, { text: `❌ ${err.message}` }, { quoted: m });
    }
  },

  async sendJid(sock, m, jid) {
    const chatJid = m.key.remoteJid;

    if (giftedBtns?.sendInteractiveMessage) {
      try {
        await giftedBtns.sendInteractiveMessage(sock, chatJid, {
          text: `*JID*\n${jid}\n\n${getFooter(m.key.participant || m.key.remoteJid)}`,
          interactiveButtons: [
            {
              name: 'cta_copy',
              buttonParamsJson: JSON.stringify({
                display_text: '📋 Copy JID',
                copy_code: jid
              })
            }
          ]
        });
        return;
      } catch {}
    }

    await sock.sendMessage(chatJid, { text: `*JID*\n\`${jid}\`\n\n${getFooter(m.key.participant || m.key.remoteJid)}` }, { quoted: m });
  },

  async resolveJid(sock, inputJid) {
    return resolveJid(sock, inputJid);
  }
};

// Named export so block/unblock can reuse the same resolution.
// Optional `chatJid` gives extra group-metadata resolution context.
export async function resolveJid(sock, inputJid, chatJid = null) {
    if (!inputJid) return inputJid;

    if (inputJid.endsWith('@g.us')) return inputJid;
    if (inputJid.endsWith('@newsletter')) return inputJid;

    if (inputJid.endsWith('@lid')) {
      // 1. Group metadata participant.phoneNumber (Baileys 7) — most reliable
      //    when we know the chat is a group and the LID belongs to a member
      if (chatJid && chatJid.endsWith('@g.us')) {
        try {
          const meta = await sock.groupMetadata(chatJid);
          const p = meta?.participants?.find(x => x.id === inputJid);
          if (p?.phoneNumber) {
            const num = String(p.phoneNumber).split('@')[0].split(':')[0].replace(/\D/g, '');
            if (num.length >= 7) return `${num}@s.whatsapp.net`;
          }
        } catch {}
      }

      // 2. Baileys internal LID → phone mapping
      try {
        if (sock.signalRepository?.lidMapping?.getPNForLID) {
          const pn = await sock.signalRepository.lidMapping.getPNForLID(inputJid);
          if (pn) {
            const num = String(pn).split('@')[0].split(':')[0].replace(/\D/g, '');
            if (num.length >= 7) return `${num}@s.whatsapp.net`;
          }
        }
      } catch {}

      // 3. globalThis LID → phone cache
      const lidNum = inputJid.split('@')[0];
      const cached = globalThis.lidPhoneCache?.get(lidNum);
      if (cached) return `${cached}@s.whatsapp.net`;

      // 4. Contact store lookup
      try {
        if (sock.store?.contacts) {
          for (const [contactJid, contact] of Object.entries(sock.store.contacts)) {
            if (contact.lid === inputJid || contact.lidJid === inputJid) {
              const num = contactJid.split('@')[0].replace(/\D/g, '');
              if (num.length >= 7) return `${num}@s.whatsapp.net`;
            }
          }
        }
      } catch {}

      return inputJid; // unresolvable — return as-is
    }

    const number = inputJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    return `${number}@s.whatsapp.net`;
}
