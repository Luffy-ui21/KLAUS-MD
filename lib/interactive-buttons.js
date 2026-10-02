import { proto } from 'wolfsocket';

export async function sendNativeInteractiveMessage(sock, jid, options = {}) {
    const {
        text = '',
        footer = '',
        buttons = [],
        image = null,
        quoted = null
    } = options;

    const interactiveButtons = buttons.map(btn => {
        if (btn.type === 'copy') {
            return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.display_text || btn.text,
                    copy_code: btn.copy_code || btn.value
                })
            };
        } else if (btn.type === 'url') {
            return {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.display_text || btn.text,
                    url: btn.url || btn.value,
                    merchant_url: btn.url || btn.value
                })
            };
        } else if (btn.type === 'reply') {
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.display_text || btn.text,
                    id: btn.id || btn.value || btn.text
                })
            };
        }
        return btn;
    });

    const headerType = image ? 4 : 1;
    const header = image ? {
        title: '',
        subtitle: '',
        hasMediaAttachment: true,
        imageMessage: image.url ? (await sock.prepareMessageMedia(
            { image: { url: image.url } },
            { upload: sock.waUploadToServer }
        ))?.imageMessage || null : null
    } : { title: '', subtitle: '', hasMediaAttachment: false };

    const interactiveMsg = {
        viewOnceMessage: {
            message: {
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({ text }),
                    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        title: '',
                        subtitle: '',
                        hasMediaAttachment: !!image
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: interactiveButtons.map(btn => ({
                            name: btn.name,
                            buttonParamsJson: btn.buttonParamsJson
                        }))
                    }),
                    contextInfo: quoted ? {
                        stanzaId: quoted.key?.id,
                        participant: quoted.key?.participant || quoted.key?.remoteJid,
                        quotedMessage: quoted.message
                    } : undefined
                })
            }
        }
    };

    return await sock.relayMessage(jid, interactiveMsg, {});
}

export function createCopyButton(text, copyCode) {
    return { type: 'copy', display_text: text, copy_code: copyCode };
}

export function createUrlButton(text, url) {
    return { type: 'url', display_text: text, url: url };
}

export function createReplyButton(text, id) {
    return { type: 'reply', display_text: text, id: id || text };
}
