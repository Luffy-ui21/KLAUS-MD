import axios from 'axios';
import { downloadContentFromMessage } from 'wolfsocket';
import FormData from 'form-data';
import { getOwnerName, getFooter } from '../../lib/menuHelper.js';

const XCASPER_ERASE = 'https://apis.xcasper.space/api/ai/nanobanana';
const CATBOX_UPLOAD = 'https://catbox.moe/user/api.php';

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

async function eraseObject(imageUrl, prompt) {
    const params = { url: imageUrl };
    if (prompt) params.prompt = prompt;

    const resp = await axios.get(XCASPER_ERASE, {
        params,
        timeout: 90000
    });

    if (!resp.data?.success) {
        throw new Error(resp.data?.error || resp.data?.message || 'Object eraser failed');
    }

    const b64 = resp.data?.output_base64 || resp.data?.result;
    if (b64 && typeof b64 === 'string' && b64.length > 100) {
        return Buffer.from(b64, 'base64');
    }

    const url = resp.data?.result_url || resp.data?.url || resp.data?.output;
    if (url && url.startsWith('http')) {
        const imgResp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        return Buffer.from(imgResp.data);
    }

    throw new Error('No image data in API response');
}

export default {
    name:        'erase',
    alias:       ['eraseobj', 'removobj', 'objecterase', 'airemove'],
    category:    'ai',
    description: 'AI object eraser — removes objects from an image',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;
        const reply  = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

        const imageMsg = getImageMessage(msg);

        if (!imageMsg) {
            return reply(
                `╭─⌈ *OBJECT ERASER* ⌋\n` +
                `│\n` +
                `├─⊷ *Usage:* Reply to an image with\n` +
                `│  ${PREFIX}erase [what to remove]\n` +
                `│\n` +
                `├─⊷ *Examples:*\n` +
                `│  • ${PREFIX}erase remove the tree\n` +
                `│  • ${PREFIX}erase remove text\n` +
                `│  • ${PREFIX}erase (no prompt = auto)\n` +
                `│\n` +
                `├─⊷ AI detects & erases the object\n` +
                `│  then fills in the background\n` +
                `│\n` +
                `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`
            );
        }

        const prompt = args.join(' ').trim() || null;

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

        let resultBuffer;
        try {
            resultBuffer = await eraseObject(publicUrl, prompt);
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Object eraser failed.\n\n_${err.message}_`);
        }

        try {
            const caption = prompt
                ? `✅ *Object Erased*\n🗑️ _Removed: ${prompt}_\n _${getOwnerName().toUpperCase()} TECH_`
                : `✅ *Object Erased*\n _${getOwnerName().toUpperCase()} TECH_`;

            await sock.sendMessage(chatId, {
                image:   resultBuffer,
                caption
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return reply(`❌ Failed to send the result image.\n\n_${err.message}_`);
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    }
};
