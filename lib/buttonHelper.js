import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from 'wolfsocket';
import { getBotName, buildMenuHeader, createFakeContact, createFadedEffect, createReadMoreEffect, getMenuImageBuffer, sendLoadingMessage } from './menuHelper.js';
import { isButtonModeEnabled } from './buttonMode.js';
import { ANIME, BRAND, ETHICAL, GAMES, GITHUB, MEDIA, SOCIAL, STALKER, STATUS, UI } from './emojis.js';

export function isButtonMode() {
  return isButtonModeEnabled();
}

export function isWolfBtnsAvailable() {
  return typeof generateWAMessageFromContent === 'function' && !!proto;
}

// Alias used by several commands (mode.js, deploy.js, antiedit.js, gitrepos.js).
// The upstream repo references `isGiftedBtnsAvailable` but never declared it —
// functionally identical to isWolfBtnsAvailable().
export const isGiftedBtnsAvailable = isWolfBtnsAvailable;

export async function sendButtonMenu(sock, jid, options = {}) {
  const {
    title = '',
    text = '',
    footer = '',
    buttons = [],
    image = null,
    quoted = null
  } = options;

  let fullText = '';
  if (title) fullText += `*${title}*\n\n`;
  fullText += text;
  if (footer) fullText += `\n\n${footer}`;
  await sock.sendMessage(jid, { text: fullText }, quoted ? { quoted } : {});
}

export async function sendInteractiveWithImage(sock, jid, { bodyText, footerText, buttons, imageBuffer, videoBuffer, mimetype }) {
  if (!generateWAMessageFromContent || !proto) {
    throw new Error('Baileys proto not available');
  }

  let headerObj = { title: '', subtitle: '', hasMediaAttachment: false };

  if ((imageBuffer || videoBuffer) && prepareWAMessageMedia) {
    try {
      const mediaContent = videoBuffer ? { video: videoBuffer, gifPlayback: true } : { image: imageBuffer };
      const mediaMsg = await prepareWAMessageMedia(
        mediaContent,
        { upload: sock.waUploadToServer }
      );
      if (mediaMsg?.imageMessage) {
        headerObj = {
          title: '',
          subtitle: '',
          hasMediaAttachment: true,
          imageMessage: mediaMsg.imageMessage
        };
      } else if (mediaMsg?.videoMessage) {
        headerObj = {
          title: '',
          subtitle: '',
          hasMediaAttachment: true,
          videoMessage: mediaMsg.videoMessage
        };
      }
    } catch (uploadErr) {
      console.log('[ButtonHelper] Image upload failed, sending without image:', uploadErr.message);
    }
  }

  const nativeButtons = buttons.map(btn => ({
    name: btn.name,
    buttonParamsJson: typeof btn.buttonParamsJson === 'string'
      ? btn.buttonParamsJson
      : JSON.stringify(btn.buttonParamsJson)
  }));

  const msgContent = {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      header: proto.Message.InteractiveMessage.Header.create(headerObj),
      body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: nativeButtons,
        messageParamsJson: ''
      })
    })
  };

  // Required for WhatsApp clients to recognize and render this as an
  // interactive (native-flow) message -- without it, the message relays
  // with no error but silently fails to render, especially in DMs.
  const interactiveStanzaNodes = [
    {
      tag: 'biz',
      attrs: {},
      content: [
        {
          tag: 'interactive',
          attrs: { type: 'native_flow', v: '1' },
          content: [
            { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
          ]
        }
      ]
    }
  ];

  try {
    const msg = generateWAMessageFromContent(jid, msgContent, { userJid: sock.user?.id });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: interactiveStanzaNodes });
    console.log('[ButtonHelper] Interactive message sent successfully');
    return msg;
  } catch (relayErr) {
    console.log('[ButtonHelper] relayMessage failed:', relayErr?.message || relayErr);
    throw relayErr;
  }
}

export async function sendMainMenuButtons(sock, jid, m, PREFIX) {
  const botName = getBotName();
  const fkontak = createFakeContact(m);

  const headerText = buildMenuHeader(`${BRAND.WOLF} MAIN MENU`, PREFIX);

  const menuCategories = [
    { text: `${SOCIAL.BOT} AI`, id: `${PREFIX}aimenu` },
    { text: `${GITHUB.GITHUB} Anime`, id: `${PREFIX}animemenu` },
    { text: `${UI.SETTINGS}️ Auto`, id: `${PREFIX}automenu` },
    { text: `${MEDIA.DESIGN} Logo`, id: `${PREFIX}logomenu` },
    { text: `${UI.DOWNLOAD}️ Download`, id: `${PREFIX}downloadmenu` },
    { text: `${STATUS.SPARKLE} Ephoto`, id: `${PREFIX}ephotomenu` },
    { text: `${SOCIAL.SHIELD}️ Security`, id: `${PREFIX}securitymenu` },
    { text: `${UI.CELEBRATE} Fun`, id: `${PREFIX}funmenu` },
    { text: `${GAMES.GAMEPAD} Games`, id: `${PREFIX}gamemenu` },
    { text: `${GITHUB.GITHUB} GitHub`, id: `${PREFIX}gitmenu` },
    { text: `${UI.HOME} Group`, id: `${PREFIX}groupmenu` },
    { text: `${MEDIA.IMAGE}️ ImageGen`, id: `${PREFIX}imagemenu` },
    { text: `${UI.REFRESH} Media`, id: `${PREFIX}mediamenu` },
    { text: `${MEDIA.MUSIC} Music`, id: `${PREFIX}musicmenu` },
    { text: `${SOCIAL.CROWN} Owner`, id: `${PREFIX}ownermenu` },
    { text: `${UI.CAMERA} PhotoFunia`, id: `${PREFIX}photofunia` },
    { text: `${GAMES.TROPHY} Sports`, id: `${PREFIX}sportsmenu` },
    { text: `${STALKER.STALKER}️ Stalker`, id: `${PREFIX}stalkermenu` },
    { text: `${UI.TOOL} Tools`, id: `${PREFIX}toolsmenu` },
    { text: `${ANIME.U1F49D} Valentine`, id: `${PREFIX}valentinemenu` },
    { text: `${MEDIA.VIDEO} Videos`, id: `${PREFIX}videomenu` },
  ];

  let menuText = `${headerText}\n\n${UI.CLIPBOARD} *Tap a button below to open a category:*`;

  const interactiveButtons = menuCategories.map(cat => ({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: cat.text,
      id: cat.id
    })
  }));

  interactiveButtons.push({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: `${UI.DOCUMENT} All Commands`,
      id: `${PREFIX}menu2`
    })
  });

  interactiveButtons.push({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: `${ETHICAL.PINGPONG} Ping`,
      id: `${PREFIX}ping`
    })
  });

  try {
    const media = await getMenuImageBuffer();
    const imageBuffer = media?.buffer || null;

    await sendInteractiveWithImage(sock, jid, {
      bodyText: menuText,
      footerText: `${BRAND.WOLF} ${botName}`,
      buttons: interactiveButtons,
      imageBuffer: imageBuffer,
      mimetype: 'image/jpeg'
    });
  } catch (err) {
    console.log('[ButtonMenu] Interactive with image failed:', err.message);
    let fallback = `${headerText}\n\n${UI.CLIPBOARD} *Menu Categories:*\n\n`;
    menuCategories.forEach(cat => {
      fallback += `├─ ${cat.text} → *${cat.id}*\n`;
    });
    fallback += `\n${UI.DOCUMENT} Full list: *${PREFIX}menu2*\n${ETHICAL.PINGPONG} Ping: *${PREFIX}ping*`;
    fallback += `\n\n${BRAND.WOLF} *POWERED BY ${botName.toUpperCase()}* ${BRAND.WOLF}`;

    try {
      const media = await getMenuImageBuffer();
      if (media) {
        await sock.sendMessage(jid, { image: media.buffer, caption: fallback, mimetype: "image/jpeg" }, { quoted: fkontak });
      } else {
        await sock.sendMessage(jid, { text: fallback }, { quoted: fkontak });
      }
    } catch {
      await sock.sendMessage(jid, { text: fallback }, { quoted: fkontak });
    }
  }
}

export async function sendResponseWithButtons(sock, jid, options = {}, m = null) {
  const {
    text = '',
    footer = '',
    buttons = [],
    image = null
  } = options;

  await sock.sendMessage(jid, { text }, m ? { quoted: m } : {});
}
