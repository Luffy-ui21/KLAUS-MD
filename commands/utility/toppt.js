import { getBotName } from '../../lib/botname.js';
import pptxgen from 'pptxgenjs';

const TITLE_COLOR   = '1F3864';
const BULLET_COLOR  = '333333';
const BG_COLORS     = ['FFFFFF', 'F2F7FF', 'FFF8F0', 'F0FFF4', 'FFF0F5'];
const ACCENT_COLORS = ['1F3864', '2E75B6', 'C55A11', '375623', '833C6E'];

function parseSlides(text) {
    return text.split(/\n?---\n?/).map(block => {
        const lines  = block.split('\n').map(l => l.trim()).filter(Boolean);
        const title  = lines[0] || 'Slide';
        const bullets = lines.slice(1).map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
        return { title, bullets };
    }).filter(s => s.title);
}

export default {
    name: 'toppt',
    alias: ['topptx', 'txt2ppt', 'makeppt', 'makepptx', 'makeslides'],
    description: 'Convert text into a PowerPoint (.pptx) presentation',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedText  = contextInfo?.quotedMessage?.conversation
                         || contextInfo?.quotedMessage?.extendedTextMessage?.text;

        const inputText = args.join(' ').trim() || quotedText?.trim();

        if (!inputText) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📊 TEXT TO PPTX 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ ${PREFIX}toppt <slides>\n` +
                      `│   — OR reply to a text message —\n` +
                      `│\n` +
                      `├⊷ *Format:*\n` +
                      `│  Slide 1 Title\n` +
                      `│  First bullet point\n` +
                      `│  Second bullet point\n` +
                      `│  ---\n` +
                      `│  Slide 2 Title\n` +
                      `│  Another bullet\n` +
                      `│\n` +
                      `├⊷ *Tips:*\n` +
                      `├⊷ Separate slides with ---\n` +
                      `├⊷ First line of each block = slide title\n` +
                      `└⊷ Remaining lines = bullet points\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const slides = parseSlides(inputText);

            if (slides.length === 0) {
                throw new Error('No slides detected — make sure your text has content');
            }

            const prs = new pptxgen();
            prs.layout   = 'LAYOUT_WIDE';
            prs.author   = getBotName();
            prs.subject  = 'Generated Presentation';

            slides.forEach(({ title, bullets }, idx) => {
                const bgColor     = BG_COLORS[idx % BG_COLORS.length];
                const accentColor = ACCENT_COLORS[idx % ACCENT_COLORS.length];

                const slide = prs.addSlide();

                slide.background = { color: bgColor };

                slide.addShape(prs.ShapeType.rect, {
                    x: 0, y: 0, w: '100%', h: 1.2,
                    fill: { color: accentColor }
                });

                slide.addText(title, {
                    x: 0.4, y: 0.1, w: '90%', h: 1.0,
                    fontSize: 28,
                    bold: true,
                    color: 'FFFFFF',
                    fontFace: 'Calibri',
                    valign: 'middle'
                });

                slide.addText(`${idx + 1} / ${slides.length}`, {
                    x: '88%', y: 0.1, w: '10%', h: 1.0,
                    fontSize: 11,
                    color: 'CCCCCC',
                    align: 'right',
                    valign: 'middle'
                });

                if (bullets.length > 0) {
                    const bulletObjs = bullets.map(b => ({
                        text: b,
                        options: {
                            bullet: { indent: 15 },
                            fontSize: 20,
                            color: BULLET_COLOR,
                            fontFace: 'Calibri',
                            breakLine: true,
                            paraSpaceAfter: 6
                        }
                    }));

                    slide.addText(bulletObjs, {
                        x: 0.5, y: 1.4, w: '95%', h: 4.2,
                        valign: 'top'
                    });
                }

                slide.addText(getBotName(), {
                    x: 0, y: '92%', w: '100%', h: 0.35,
                    fontSize: 9,
                    color: 'AAAAAA',
                    align: 'center',
                    fontFace: 'Calibri'
                });
            });

            const buffer  = await prs.write({ outputType: 'nodebuffer' });
            const botName = getBotName();

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                document: Buffer.from(buffer),
                mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                fileName: `${botName}_${Date.now()}.pptx`,
                caption: `╭⊷『 📊 PPTX READY 』\n│\n` +
                         `├⊷ *Slides:* ${slides.length}\n` +
                         `├⊷ *Size:* ${(buffer.byteLength / 1024).toFixed(1)} KB\n` +
                         `╰⊷ *${botName} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📊 TEXT TO PPTX 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Please check your format and try again\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
