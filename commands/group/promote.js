/**
 * .promote — robust admin-promotion command.
 *
 * Why this is non-trivial in 2026:
 *  • Modern WhatsApp groups use @lid participant IDs, not @s.whatsapp.net.
 *  • Mentions can arrive in either format depending on the sending client.
 *  • sock.groupParticipantsUpdate() does NOT throw on failure — it returns
 *    [{ status: '200' | '401' | '403' | '404' | ..., jid }] per participant.
 *    We must inspect that array, otherwise we silently lie to the user.
 *  • The bot itself must be admin before it can promote anyone.
 */

export default {
  name: 'promote',
  description: 'Promote a member to admin',
  category: 'group',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
      return;
    }

    /* ── 1. Group metadata + participant index ───────────────────── */
    let groupMetadata;
    try {
      groupMetadata = await sock.groupMetadata(jid);
    } catch {
      await sock.sendMessage(jid, { text: '❌ Failed to fetch group information.' }, { quoted: msg });
      return;
    }
    const participants = groupMetadata.participants || [];

    // Build a one-shot lookup: any known identifier → participant object.
    const stripDevice = j => (j ? String(j).split(':')[0] : '');
    const numberOf    = j => (j ? String(j).split('@')[0].split(':')[0] : '');

    const index = new Map();
    for (const p of participants) {
      const keys = [p.id, p.jid, p.lid, p.phoneNumber]
        .filter(Boolean)
        .flatMap(k => [k, stripDevice(k), numberOf(k)]);
      for (const k of keys) if (k) index.set(k, p);
    }
    const lookup = j => {
      if (!j) return null;
      return index.get(j)
          || index.get(stripDevice(j))
          || index.get(numberOf(j))
          || null;
    };

    /* ── 2. Sender must be admin ─────────────────────────────────── */
    const rawSender   = msg.key.participant || jid;
    const senderPart  = lookup(rawSender);
    const senderAdmin = senderPart?.admin === 'admin' || senderPart?.admin === 'superadmin';
    if (!senderAdmin) {
      await sock.sendMessage(jid, { text: '🛑 Only group admins can use this command.' }, { quoted: msg });
      return;
    }

    /* ── 3. Bot itself must be admin ─────────────────────────────── */
    const botJid   = sock.user?.id || '';
    const botLid   = sock.user?.lid || '';
    const botPart  = lookup(botJid) || lookup(botLid);
    const botAdmin = botPart?.admin === 'admin' || botPart?.admin === 'superadmin';
    if (!botAdmin) {
      await sock.sendMessage(jid, {
        text: '⚠️ I need to be a *group admin* before I can promote anyone.\nMake me admin and try again.'
      }, { quoted: msg });
      return;
    }

    /* ── 4. Resolve target ───────────────────────────────────────── */
    let targetHint = null;
    const ctx      = msg.message?.extendedTextMessage?.contextInfo;
    const mentions = ctx?.mentionedJid;
    if (mentions?.length)            targetHint = mentions[0];
    else if (ctx?.participant)       targetHint = ctx.participant;
    else if (args.length > 0) {
      const num = args[0].replace(/[^0-9]/g, '');
      if (num.length > 8) targetHint = num + '@s.whatsapp.net';
    }

    if (!targetHint) {
      await sock.sendMessage(jid, {
        text: '⚠️ Mention or reply to the member you want to promote.\nExample: *.promote @user*'
      }, { quoted: msg });
      return;
    }

    const target = lookup(targetHint);
    if (!target) {
      await sock.sendMessage(jid, {
        text: `⚠️ That user doesn't appear to be in this group.`
      }, { quoted: msg });
      return;
    }
    if (target.admin) {
      const tag = numberOf(target.phoneNumber || target.id);
      await sock.sendMessage(jid, {
        text: `⚠️ @${tag} is already an admin.`,
        mentions: [target.phoneNumber || target.id]
      }, { quoted: msg });
      return;
    }

    /* ── 5. Fire promote and CHECK the result ────────────────────── */
    // Always use the participant.id WhatsApp itself knows about (LID for modern
    // groups, s.whatsapp.net for legacy ones). Falling back to alternate IDs
    // only if the first attempt comes back with a non-200 status.
    const candidates = [target.id, target.lid, target.phoneNumber]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);   // dedup, preserve order

    let lastStatus  = null;
    let succeededAs = null;

    for (const candidate of candidates) {
      try {
        const result = await sock.groupParticipantsUpdate(jid, [candidate], 'promote');
        const entry  = Array.isArray(result) ? result[0] : null;
        lastStatus   = entry?.status || 'no-response';
        if (lastStatus === '200') { succeededAs = candidate; break; }
      } catch (err) {
        lastStatus = err?.message || 'exception';
      }
    }

    if (succeededAs) {
      const mentionJid = target.phoneNumber || target.id;
      const tag        = numberOf(mentionJid);
      await sock.sendMessage(jid, {
        text: `🆙 @${tag} has been promoted to *Alpha* rank! `,
        mentions: [mentionJid]
      }, { quoted: msg });

      // Best-effort DM (silently ignore if WhatsApp blocks bot→user DMs)
      try {
        await sock.sendMessage(target.phoneNumber || target.id, {
          text: `🎉 Congratulations! You've been promoted to admin in *${groupMetadata.subject}*.\n\nLead with wisdom, Alpha! `
        });
      } catch { /* nothing to do */ }
      return;
    }

    /* ── 6. Friendly error mapping ───────────────────────────────── */
    const reasons = {
      '401': 'WhatsApp rejected the request — usually means I don\'t have admin rights here.',
      '403': 'WhatsApp said forbidden — group settings may be blocking admin changes.',
      '404': 'WhatsApp couldn\'t find that participant in the group.',
      '408': 'Request timed out — try again in a moment.',
      '409': 'Conflict — the user may already be an admin (refresh and check).',
      '500': 'WhatsApp server error — try again in a moment.'
    };
    const reason = reasons[lastStatus] || `WhatsApp returned status ${lastStatus}.`;
    console.error(`[PROMOTE] Failed in ${jid} → tried [${candidates.join(', ')}], last status: ${lastStatus}`);

    await sock.sendMessage(jid, {
      text: `❌ *Promote failed*\n\n${reason}`
    }, { quoted: msg });
  }
};
