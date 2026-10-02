import { createRequire } from 'module';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

const GROUP_LINK_RE = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/i;
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{10,}$/;

export default {
  name: 'getid',
  description: 'Get the group ID (invite code) from a group link',
  category: 'utility',
  aliases: ['groupid', 'gid', 'inviteid'],

  async execute(sock, m, args) {
    const chatJid = m.key.remoteJid;

    try {
      let raw =
        (args && args.join(' ').trim()) ||
        (m.quoted?.text || '').trim() ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim() ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text?.trim() ||
        '';

      let inviteCode = null;
      let groupJid = null;

      // 1. Full link → extract code
      const linkMatch = raw.match(GROUP_LINK_RE);
      if (linkMatch) {
        inviteCode = linkMatch[1];
      } else if (raw && INVITE_CODE_RE.test(raw)) {
        // 2. Bare invite code pasted
        inviteCode = raw;
      } else if (!raw && chatJid.endsWith('@g.us')) {
        // 3. No args, run inside a group → fetch its invite link
        try {
          const code = await sock.groupInviteCode(chatJid);
          if (code) inviteCode = code;
          groupJid = chatJid;
        } catch {
          groupJid = chatJid;
        }
      }

      if (!inviteCode && !groupJid) {
        return sock.sendMessage(chatJid, {
          text:
            `❌ *No group link found*\n\n` +
            `Send a WhatsApp group link, e.g.:\n` +
            `\`.getid https://chat.whatsapp.com/AbCdEf1234567890\`\n\n` +
            `Or run \`.getid\` inside a group to get its ID.`
        }, { quoted: m });
      }

      // Try to resolve the JID from the invite code
      if (inviteCode && !groupJid) {
        try {
          const meta = await sock.groupGetInviteInfo(inviteCode);
          if (meta?.id) groupJid = meta.id;
        } catch {}
      }

      await this.sendId(sock, m, { inviteCode, groupJid });

    } catch (err) {
      await sock.sendMessage(chatJid, { text: `❌ ${err.message}` }, { quoted: m });
    }
  },

  async sendId(sock, m, { inviteCode, groupJid }) {
    const chatJid = m.key.remoteJid;
    const owner = getOwnerName().toUpperCase();

    const lines = [];
    if (inviteCode) lines.push(`*Group ID*\n${inviteCode}`);
    if (groupJid)   lines.push(`*Group JID*\n${groupJid}`);
    lines.push(`${getFooter(m.key.participant || m.key.remoteJid)}`);
    const text = lines.join('\n\n');

    if (giftedBtns?.sendInteractiveMessage) {
      try {
        const buttons = [];
        if (inviteCode) {
          buttons.push({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: '📋 Copy Group ID',
              copy_code: inviteCode
            })
          });
        }
        if (groupJid) {
          buttons.push({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: '📋 Copy Group JID',
              copy_code: groupJid
            })
          });
        }

        await giftedBtns.sendInteractiveMessage(sock, chatJid, {
          text,
          interactiveButtons: buttons
        });
        return;
      } catch {}
    }

    // Fallback — plain text with backticks for tap-to-copy on most clients
    const fallback = [];
    if (inviteCode) fallback.push(`*Group ID*\n\`${inviteCode}\``);
    if (groupJid)   fallback.push(`*Group JID*\n\`${groupJid}\``);
    fallback.push(`${getFooter(m.key.participant || m.key.remoteJid)}`);

    await sock.sendMessage(chatJid, { text: fallback.join('\n\n') }, { quoted: m });
  }
};
