import { getBotName } from '../../lib/botname.js';
import { downloadMediaMessage } from 'wolfsocket';
import ExcelJS from 'exceljs';

const XLSX_MIMES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/excel',
    'application/x-excel',
    'application/x-msexcel'
];

function padCell(value, width) {
    const str = String(value ?? '');
    return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

function buildTextTable(headers, dataRows, colWidths) {
    const sep  = (left, mid, right, fill) =>
        left + colWidths.map(w => fill.repeat(w + 2)).join(mid) + right;

    const topLine  = sep('┌', '┬', '┐', '─');
    const midLine  = sep('├', '┼', '┤', '─');
    const botLine  = sep('└', '┴', '┘', '─');
    const rowLine  = (cells) =>
        '│ ' + cells.map((c, i) => padCell(c, colWidths[i])).join(' │ ') + ' │';

    const lines = [topLine, rowLine(headers), midLine];
    dataRows.forEach(row => lines.push(rowLine(row)));
    lines.push(botLine);
    return lines.join('\n');
}

export default {
    name: 'extractexcel',
    alias: ['excelreader', 'readexcel', 'readxlsx', 'xlsxreader', 'fromexcel'],
    description: 'Extract and read data from an Excel (.xlsx) spreadsheet',
    category: 'utility',

    async execute(sock, m, args, PREFIX) {
        const chatId = m.key.remoteJid;

        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;
        const docMsg      = quotedMsg?.documentMessage;

        if (!quotedMsg || !docMsg) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📊 EXCEL READER 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ Reply to an Excel file with ${PREFIX}extractexcel\n` +
                      `│\n` +
                      `├⊷ *Aliases:*\n` +
                      `├⊷ ${PREFIX}excelreader\n` +
                      `├⊷ ${PREFIX}readexcel\n` +
                      `└⊷ ${PREFIX}readxlsx\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        const mimeType = docMsg.mimetype || '';
        const fileName = docMsg.fileName || '';
        const isXlsx   = XLSX_MIMES.some(t => mimeType.includes(t.split('/').pop()))
                      || fileName.toLowerCase().endsWith('.xlsx')
                      || fileName.toLowerCase().endsWith('.xls');

        if (!isXlsx) {
            return sock.sendMessage(chatId, {
                text: `╭⊷『 📊 EXCEL READER 』\n│\n` +
                      `├⊷ *Error:* The replied file is not an Excel spreadsheet\n` +
                      `└⊷ Please reply to a valid .xlsx or .xls file\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        try {
            const fakeMsg = {
                key: {
                    id:          contextInfo.stanzaId,
                    remoteJid:   chatId,
                    participant: contextInfo.participant || undefined
                },
                message: quotedMsg
            };

            const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
            if (!buffer || buffer.length === 0) throw new Error('Failed to download Excel file');

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const results  = [];
            let totalSheets = 0;
            let totalRows   = 0;

            workbook.eachSheet((sheet) => {
                totalSheets++;
                const allRows = [];

                sheet.eachRow({ includeEmpty: false }, row => {
                    const cells = [];
                    row.eachCell({ includeEmpty: true }, cell => {
                        const v = cell.value;
                        if (v && typeof v === 'object' && 'richText' in v) {
                            cells.push(v.richText.map(r => r.text).join(''));
                        } else if (v && typeof v === 'object' && 'formula' in v) {
                            cells.push(String(v.result ?? ''));
                        } else {
                            cells.push(v ?? '');
                        }
                    });
                    allRows.push(cells);
                });

                if (allRows.length === 0) return;

                const colCount  = Math.max(...allRows.map(r => r.length));
                const colWidths = Array.from({ length: colCount }, (_, ci) =>
                    Math.min(20, Math.max(6, ...allRows.map(r => String(r[ci] ?? '').length)))
                );

                const headers  = allRows[0].map((h, i) => padCell(h, colWidths[i]));
                const dataRows = allRows.slice(1).map(r =>
                    Array.from({ length: colCount }, (_, i) => r[i] ?? '')
                );

                totalRows += allRows.length - 1;

                const table = buildTextTable(
                    allRows[0].map((h, i) => String(h ?? '')),
                    allRows.slice(1).map(r => Array.from({ length: colCount }, (_, i) => String(r[i] ?? ''))),
                    colWidths
                );

                results.push(`*Sheet: ${sheet.name}*\n\`\`\`\n${table}\n\`\`\``);
            });

            if (results.length === 0) {
                await sock.sendMessage(chatId, { react: { text: '⚠️', key: m.key } });
                return sock.sendMessage(chatId, {
                    text: `╭⊷『 📊 EXCEL READER 』\n│\n` +
                          `├⊷ *File:* ${fileName}\n` +
                          `├⊷ *Result:* No data found in spreadsheet\n` +
                          `└⊷ The file may be empty\n\n` +
                          `╰⊷ *${getBotName()} Utility*`
                }, { quoted: m });
            }

            const MAX_CHARS = 3500;
            let body = results.join('\n\n');
            if (body.length > MAX_CHARS) {
                body = body.slice(0, MAX_CHARS) + `\n\n… *(truncated — file has more data)*`;
            }

            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📊 EXCEL EXTRACTED 』\n│\n` +
                      `├⊷ *File:* ${fileName || 'spreadsheet.xlsx'}\n` +
                      `├⊷ *Sheets:* ${totalSheets}\n` +
                      `├⊷ *Data Rows:* ${totalRows}\n` +
                      `│\n` +
                      `${body}\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, {
                text: `╭⊷『 📊 EXCEL READER 』\n│\n` +
                      `├⊷ *Error:* ${err.message}\n` +
                      `└⊷ Make sure the file is a valid .xlsx spreadsheet\n\n` +
                      `╰⊷ *${getBotName()} Utility*`
            }, { quoted: m });
        }
    }
};
