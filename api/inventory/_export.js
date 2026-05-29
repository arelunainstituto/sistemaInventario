// Helpers de exportação para relatórios (§12).
// Suporta json (default), csv, xlsx e pdf.
//
// Uso típico em endpoints de relatório:
//   const { sendReport } = require('./_export');
//   sendReport(res, req.query.format, { title, columns, rows });

const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

function toCsv(columns, rows) {
    const header = columns.map(c => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');
    const body = rows.map(r =>
        columns.map(c => {
            const v = r[c.key];
            if (v === null || v === undefined) return '';
            const s = String(v).replace(/"/g, '""');
            return /[",\n;]/.test(s) ? `"${s}"` : s;
        }).join(',')
    ).join('\n');
    return header + '\n' + body;
}

function toXlsx(columns, rows, sheetName = 'Relatório') {
    const ws = xlsx.utils.json_to_sheet(rows.map(r => {
        const obj = {};
        for (const c of columns) obj[c.label || c.key] = r[c.key] ?? '';
        return obj;
    }));
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function streamPdf(res, { title, subtitle, columns, rows }) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(title || 'relatorio').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).fillColor('#1f2937').text(title || 'Relatório', { align: 'left' });
    if (subtitle) doc.fontSize(9).fillColor('#6b7280').text(subtitle);
    doc.fontSize(8).fillColor('#9ca3af').text(`Gerado em ${new Date().toLocaleString('pt-PT')}`).moveDown(0.5);

    // Tabela simples (sem libs adicionais)
    const startX = 40;
    const colWidths = columns.map(c => c.width || 80);
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    let y = doc.y + 5;
    doc.fontSize(8).fillColor('#374151');

    // Cabeçalho
    doc.rect(startX, y, totalWidth, 16).fill('#f3f4f6');
    let x = startX;
    columns.forEach((c, i) => {
        doc.fillColor('#111827').text(c.label || c.key, x + 4, y + 4, { width: colWidths[i] - 8, ellipsis: true });
        x += colWidths[i];
    });
    y += 16;

    // Linhas
    rows.forEach((r, idx) => {
        if (y > 770) { doc.addPage(); y = 40; }
        if (idx % 2 === 0) doc.rect(startX, y, totalWidth, 14).fill('#fafafa');
        x = startX;
        columns.forEach((c, i) => {
            const v = r[c.key];
            const text = v === null || v === undefined ? '' : String(v);
            doc.fillColor('#374151').fontSize(8).text(text, x + 4, y + 3, { width: colWidths[i] - 8, ellipsis: true });
            x += colWidths[i];
        });
        y += 14;
    });

    doc.end();
}

function sendReport(res, format, payload) {
    const fmt = (format || 'json').toLowerCase();
    const safeFilename = (payload.title || 'relatorio').replace(/[^a-zA-Z0-9-]/g, '_');

    if (fmt === 'csv') {
        const buffer = Buffer.from(toCsv(payload.columns, payload.rows), 'utf8');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.csv"`);
        return res.send(buffer);
    }
    if (fmt === 'xlsx') {
        const buffer = toXlsx(payload.columns, payload.rows, payload.title);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.xlsx"`);
        return res.send(buffer);
    }
    if (fmt === 'pdf') {
        return streamPdf(res, payload);
    }
    return res.json({ success: true, data: payload.rows, columns: payload.columns, meta: { title: payload.title } });
}

module.exports = { sendReport };
