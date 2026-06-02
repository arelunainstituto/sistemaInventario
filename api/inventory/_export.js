// Helpers de exportação para relatórios (§12).
// Suporta json (default), csv, xlsx e pdf.
//
// Uso típico em endpoints de relatório:
//   const { sendReport } = require('./_export');
//   sendReport(res, req.query.format, { title, columns, rows });

const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

function toCsv(columns, rows, totals) {
    const header = columns.map(c => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');
    const body = rows.map(r =>
        columns.map(c => {
            const v = r[c.key];
            if (v === null || v === undefined) return '';
            const s = String(v).replace(/"/g, '""');
            return /[",\n;]/.test(s) ? `"${s}"` : s;
        }).join(',')
    ).join('\n');
    let footer = '';
    if (totals) {
        const totalsRow = columns.map((c, i) => {
            if (i === 0) return '"TOTAL"';
            const v = totals[c.key];
            if (v === null || v === undefined) return '';
            const s = String(v).replace(/"/g, '""');
            return /[",\n;]/.test(s) ? `"${s}"` : s;
        }).join(',');
        footer = '\n' + totalsRow;
    }
    return header + '\n' + body + footer;
}

function toXlsx(columns, rows, sheetName = 'Relatório', totals) {
    const data = rows.map(r => {
        const obj = {};
        for (const c of columns) obj[c.label || c.key] = r[c.key] ?? '';
        return obj;
    });
    if (totals) {
        const totalRow = {};
        columns.forEach((c, i) => {
            if (i === 0) totalRow[c.label || c.key] = 'TOTAL';
            else totalRow[c.label || c.key] = totals[c.key] ?? '';
        });
        data.push(totalRow);
    }
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function streamPdf(res, { title, subtitle, columns, rows, totals }) {
    // Detecta se a tabela cabe em portrait. Caso contrário usa landscape, e
    // se ainda ultrapassar, escala todas as larguras proporcionalmente para
    // caber. Evita que colunas finais (como "Estado") fiquem cortadas fora
    // da página.
    const MARGIN_LR    = 30;
    const NUM_WIDTH    = 22;
    const PORTRAIT_W   = 595;
    const LANDSCAPE_W  = 842;
    const PAGE_H_LAND  = 595;
    const PAGE_H_PORT  = 842;

    const rawSum = NUM_WIDTH + columns.reduce((a, c) => a + (c.width || 80), 0);
    const portraitArea  = PORTRAIT_W  - 2 * MARGIN_LR;
    const landscapeArea = LANDSCAPE_W - 2 * MARGIN_LR;

    const layout = rawSum > portraitArea ? 'landscape' : 'portrait';
    const areaW  = layout === 'landscape' ? landscapeArea : portraitArea;
    const pageH  = layout === 'landscape' ? PAGE_H_LAND   : PAGE_H_PORT;
    const scale  = rawSum > areaW ? areaW / rawSum : 1;

    const numWidth = NUM_WIDTH * scale;
    const colWidths = columns.map(c => (c.width || 80) * scale);
    const totalWidth = numWidth + colWidths.reduce((a, b) => a + b, 0);

    const doc = new PDFDocument({ margin: MARGIN_LR, size: 'A4', layout });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(title || 'relatorio').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).fillColor('#1f2937').text(title || 'Relatório', { align: 'left' });
    if (subtitle) doc.fontSize(9).fillColor('#6b7280').text(subtitle);
    doc.fontSize(8).fillColor('#9ca3af').text(`Gerado em ${new Date().toLocaleString('pt-PT')}`).moveDown(0.5);

    const startX = MARGIN_LR;
    const pageBottom = pageH - MARGIN_LR - 20;  // 20pt de folga p/ rodapé
    let y = doc.y + 5;

    // Renderiza cabeçalho da tabela
    function drawHeader() {
        doc.rect(startX, y, totalWidth, 16).fill('#f3f4f6');
        doc.fillColor('#111827').fontSize(8).text('#', startX + 3, y + 4, { width: numWidth - 6 });
        let x = startX + numWidth;
        columns.forEach((c, i) => {
            doc.fillColor('#111827').fontSize(8).text(c.label || c.key, x + 3, y + 4, { width: colWidths[i] - 6, ellipsis: true });
            x += colWidths[i];
        });
        y += 16;
    }

    drawHeader();

    // Linhas — repete o cabeçalho ao quebrar página
    rows.forEach((r, idx) => {
        if (y > pageBottom) { doc.addPage({ size: 'A4', layout, margin: MARGIN_LR }); y = MARGIN_LR; drawHeader(); }
        if (idx % 2 === 0) doc.rect(startX, y, totalWidth, 14).fill('#fafafa');
        doc.fillColor('#9ca3af').fontSize(8).text(String(idx + 1), startX + 3, y + 3, { width: numWidth - 6 });
        let x = startX + numWidth;
        columns.forEach((c, i) => {
            const v = r[c.key];
            const text = v === null || v === undefined ? '' : String(v);
            doc.fillColor('#374151').fontSize(8).text(text, x + 3, y + 3, { width: colWidths[i] - 6, ellipsis: true });
            x += colWidths[i];
        });
        y += 14;
    });

    // Linha de totais
    if (totals && Object.keys(totals).length) {
        if (y > pageBottom) { doc.addPage({ size: 'A4', layout, margin: MARGIN_LR }); y = MARGIN_LR; drawHeader(); }
        doc.rect(startX, y, totalWidth, 16).fill('#e5e7eb');
        doc.fillColor('#111827').fontSize(8).text('TOTAL', startX + 3, y + 4, { width: numWidth + colWidths[0] - 6 });
        let x = startX + numWidth + colWidths[0];
        columns.slice(1).forEach((c, i) => {
            const w = colWidths[i + 1];
            const v = totals[c.key];
            const text = v === null || v === undefined ? '' : String(v);
            doc.fillColor('#111827').fontSize(8).text(text, x + 3, y + 4, { width: w - 6, ellipsis: true });
            x += w;
        });
        y += 16;
    }

    doc.end();
}

function sendReport(res, format, payload) {
    const fmt = (format || 'json').toLowerCase();
    const safeFilename = (payload.title || 'relatorio').replace(/[^a-zA-Z0-9-]/g, '_');

    if (fmt === 'csv') {
        const buffer = Buffer.from(toCsv(payload.columns, payload.rows, payload.totals), 'utf8');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.csv"`);
        return res.send(buffer);
    }
    if (fmt === 'xlsx') {
        const buffer = toXlsx(payload.columns, payload.rows, payload.title, payload.totals);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.xlsx"`);
        return res.send(buffer);
    }
    if (fmt === 'pdf') {
        return streamPdf(res, payload);
    }
    return res.json({
        success: true,
        data: payload.rows,
        columns: payload.columns,
        totals: payload.totals,
        meta: { title: payload.title, subtitle: payload.subtitle },
        ...(payload.extras || {})
    });
}

module.exports = { sendReport };
