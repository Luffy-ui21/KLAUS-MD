import { getBotName } from '../../lib/botname.js';
import ExcelJS from 'exceljs';

const HEADER_COLOR  = 'FF1F4E79';
const HEADER_FONT   = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12, name: 'Calibri' };
const ROW_FONT      = { size: 11, name: 'Calibri' };
const ALT_ROW_COLOR = 'FFD9E1F2';

function parseRows(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const sep   = lines[0].includes('|') ? '|' : ',';
    return lines.map(line =>
        line.split(sep).map(cell => cell.trim()).filter((_, i, arr) =>
            !(i === 0 && arr[0] === '') && !(i === arr.length - 1 && arr[arr.length - 1] === '')
        )
    );
}

export default {
    name: 'toexcel',
    alias: ['toxlsx', 'txt2excel', 'makeexcel', 'makexlsx'],
    description: 'Convert comma/pipe-separated text into an Excel (.xlsx) spreadsheet',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedText  = contextInfo?.quotedMessage?.conversation
                         || contextInfo?.quotedMessage?.extendedTextMessage?.text;

        const inputText = args.join(' ').trim() || quotedText?.trim();

        if (!inputText) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📊 TEXT TO EXCEL 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ ${PREFIX}toexcel <data>\n` +
                      `│   — OR reply to a text message —\n` +
                      `│\n` +
                      `├⊷ *Format (comma-separated):*\n` +
                      `│  Name, Age, City\n` +
                      `│  Alice, 25, Nairobi\n` +
                      `│  Bob, 30, Mombasa\n` +
                      `│\n` +
                      `├⊷ *Format (pipe-separated):*\n` +
                      `│  Name | Age | City\n` +
                      `│  Alice | 25 | Nairobi\n` +
                      `│\n` +
                      `├⊷ *First line = header row*\n` +
                      `└⊷ Each new line = a new row\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const rows = parseRows(inputText);

            if (rows.length < 1 || rows[0].length < 1) {
                throw new Error('Could not parse any columns — use commas or pipes to separate values');
            }

            const workbook  = new ExcelJS.Workbook();
            workbook.creator  = getBotName();
            workbook.created  = new Date();

            const sheet = workbook.addWorksheet('Sheet1', {
                views: [{ state: 'frozen', ySplit: 1 }]
            });

            const colCount = Math.max(...rows.map(r => r.length));
            sheet.columns  = Array.from({ length: colCount }, (_, i) => ({
                width: 18
            }));

            rows.forEach((rowData, rowIndex) => {
                const row = sheet.addRow(rowData);

                if (rowIndex === 0) {
                    row.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
                        cell.font = HEADER_FONT;
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        cell.border = {
                            top:    { style: 'thin', color: { argb: 'FF000000' } },
                            bottom: { style: 'thin', color: { argb: 'FF000000' } },
                            left:   { style: 'thin', color: { argb: 'FF000000' } },
                            right:  { style: 'thin', color: { argb: 'FF000000' } }
                        };
                    });
                    row.height = 22;
                } else {
                    const isAlt = rowIndex % 2 === 0;
                    row.eachCell({ includeEmpty: true }, cell => {
                        if (isAlt) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_COLOR } };
                        }
                        cell.font = ROW_FONT;
                        cell.alignment = { vertical: 'middle', wrapText: true };
                        cell.border = {
                            bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
                            left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
                            right:  { style: 'hair', color: { argb: 'FFCCCCCC' } }
                        };
                    });
                    row.height = 18;
                }
            });

            const buffer  = await workbook.xlsx.writeBuffer();
            const botName = getBotName();

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                document: Buffer.from(buffer),
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                fileName: `${botName}_${Date.now()}.xlsx`,
                caption: `╭⊷『 📊 EXCEL READY 』\n│\n` +
                         `├⊷ *Rows:* ${rows.length - 1} (+ 1 header)\n` +
                         `├⊷ *Columns:* ${colCount}\n` +
                         `├⊷ *Size:* ${(buffer.byteLength / 1024).toFixed(1)} KB\n` +
                         `╰⊷ *${botName} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📊 TEXT TO EXCEL 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Please check your format and try again\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
