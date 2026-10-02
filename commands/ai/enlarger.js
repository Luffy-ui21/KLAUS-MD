import axios from 'axios';
import { downloadContentFromMessage } from 'wolfsocket';
import FormData from 'form-data';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const XCASPER_ENLARGER = 'https://apis.xcasper.space/api/ai/enlarger';
const CATBOX_UPLOAD    = 'https://catbox.moe/user/api.php';

function getImageMessage(msg) {
    return (
        msg.message?.imageMessage ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
        msg.message?.viewOnceMessage?.message?.imageMessage ||
        null
    );
}

async function downloadImageBuffer(imageMsg) {
    const stream = await downloadContentFromMessage(imageMsg, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function uploadToCatbox(buffer, filename = 'image.jpg') {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename, contentType: 'image/jpeg' });

    const resp = await axios.post(CATBOX_UPLOAD, form, {
        headers: form.getHeaders(),
        timeout: 20000
    });

    const url = resp.data?.trim?.() || resp.data;
    if (!url || !url.startsWith('http')) throw new Error('Upload failed — no URL returned');
    return url;
}

async function enlargeImage(imageUrl) {
    const resp = await axios.get(XCASPER_ENLARGER, {
        params: { url: imageUrl },
        timeout: 60000
    });
    if (!resp.data?.success) {
        throw new Error(resp.data?.error || resp.data?.message || 'Enlarger API failed');
    }
    const b64 = resp.data?.output_base64;
    if (!b64) throw new Error('No image data returned by API');
    return Buffer.from(b64, 'base64');
}

export default {
    name:        'enlarger',
    alias:       ['enhance', 'upscale', 'aienlarge', 'hdimage', 'enlargeimg'],
    category:    'ai',
    description: 'AI-enlarge / upscale an image using xcasper API',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        const imageMsg = getImageMessage(msg);
        if (!imageMsg) {
            return reply(
                `╭─⌈ *ENLARGER* ⌋\n` +
                `│\n` +
                `├─⊷ *Usage:* Reply to an image with\n` +
                `│  ${PREFIX}enlarger\n` +
                `│\n` +
                `├─⊷ AI upscales & enhances the image\n` +
                `│  resolution using xcasper AI\n` +
                `│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        let imageBuffer;
        try {
            imageBuffer = await downloadImageBuffer(imageMsg);
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Failed to download the image.\n\n_${err.message}_`);
        }

        let publicUrl;
        try {
            publicUrl = await uploadToCatbox(imageBuffer);
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Failed to upload image for processing.\n\n_${err.message}_`);
        }

        let enlargedBuffer;
        try {
            enlargedBuffer = await enlargeImage(publicUrl);
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Image enlargement failed.\n\n_${err.message}_`);
        }

        try {
            await sock.sendMessage(chatId, {
                image:   enlargedBuffer,
                caption: `✅ *Image Enlarged*\n${getFooter(msg.key.participant || msg.key.remoteJid)}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Failed to send the enlarged image.\n\n_${err.message}_`);
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
