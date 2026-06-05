import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ── Color map for gap types ────────────────────────────── */
const GAP_COLORS = {
  'Standard Fit':    { fill: 'C6EFCE', font: '006100' },
  'Config Gap':      { fill: 'FFEB9C', font: '9C5700' },
  'Configuration Gap': { fill: 'FFEB9C', font: '9C5700' },
  'Dev Gap':         { fill: 'FFC7CE', font: '9C0006' },
  'Development Gap': { fill: 'FFC7CE', font: '9C0006' },
  'Out of Scope':    { fill: 'D9D9D9', font: '595959' },
};

/* ── Header style ───────────────────────────────────────── */
const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};

const HEADER_FONT = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
  name: 'Calibri',
};

const HEADER_BORDER = {
  bottom: { style: 'medium', color: { argb: 'FF0D2240' } },
};

const HEADER_ALIGNMENT = {
  vertical: 'middle',
  horizontal: 'center',
  wrapText: true,
};

/* ── Column definitions ─────────────────────────────────── */
const COLUMNS = [
  { header: 'ID',              key: 'id',              width: 8 },
  { header: 'Requirement',     key: 'requirement',     width: 50 },
  { header: 'Module',          key: 'module',          width: 20 },
  { header: 'Sub-Process',     key: 'subProcess',      width: 25 },
  { header: 'Gap Type',        key: 'gapType',         width: 18 },
  { header: 'Recommendation',  key: 'recommendation',  width: 50 },
  { header: 'Effort',          key: 'effort',          width: 10 },
  { header: 'Priority',        key: 'priority',        width: 10 },
  { header: 'ISV Suggestion',  key: 'isvSuggestion',   width: 25 },
  { header: 'Reasoning',       key: 'reasoning',       width: 50 },
];

/* ── Export ──────────────────────────────────────────────── */
export async function exportToExcel(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'D365 Fit-Gap Analyser';
  workbook.created = new Date();

  /* ──────────── Cover Sheet ──────────── */
  const cover = workbook.addWorksheet('Cover', {
    properties: { tabColor: { argb: 'FF3861FB' } },
  });

  cover.getColumn(1).width = 5;
  cover.getColumn(2).width = 60;

  // Title
  const titleRow = cover.getRow(3);
  titleRow.getCell(2).value = 'D365 Fit-Gap Analysis Report';
  titleRow.getCell(2).font = { bold: true, size: 22, color: { argb: 'FF1E3A5F' }, name: 'Calibri' };

  // Subtitle
  const subRow = cover.getRow(5);
  subRow.getCell(2).value = 'AI-Powered Requirements Analysis for Dynamics 365 Finance & Operations';
  subRow.getCell(2).font = { size: 12, color: { argb: 'FF6B7280' }, italic: true, name: 'Calibri' };

  // Date
  const dateRow = cover.getRow(7);
  dateRow.getCell(2).value = `Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  dateRow.getCell(2).font = { size: 11, color: { argb: 'FF374151' }, name: 'Calibri' };

  // Summary
  const total = rows.length;
  const fit = rows.filter(r => gapKey(r.gapType) === 'fit').length;
  const config = rows.filter(r => gapKey(r.gapType) === 'config').length;
  const dev = rows.filter(r => gapKey(r.gapType) === 'dev').length;
  const oos = rows.filter(r => gapKey(r.gapType) === 'oos').length;

  const summaryData = [
    ['Total Requirements', total],
    ['Standard Fit', fit],
    ['Configuration Gap', config],
    ['Development Gap', dev],
    ['Out of Scope', oos],
  ];

  cover.getRow(9).getCell(2).value = 'Summary';
  cover.getRow(9).getCell(2).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' }, name: 'Calibri' };

  summaryData.forEach((item, i) => {
    const row = cover.getRow(11 + i);
    row.getCell(2).value = item[0];
    row.getCell(2).font = { size: 11, name: 'Calibri' };
    row.getCell(3).value = item[1];
    row.getCell(3).font = { bold: true, size: 11, name: 'Calibri' };
  });

  // Disclaimer
  const discRow = cover.getRow(18);
  discRow.getCell(2).value = '⚠️ AI-assisted analysis — validate against your licensed D365FO environment';
  discRow.getCell(2).font = { size: 10, color: { argb: 'FFEF4444' }, italic: true, name: 'Calibri' };

  /* ──────────── FDD Sheet ──────────── */
  const fdd = workbook.addWorksheet('Fit-Gap Analysis', {
    properties: { tabColor: { argb: 'FF10B981' } },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Set columns
  fdd.columns = COLUMNS;

  // Style header row
  const headerRow = fdd.getRow(1);
  headerRow.height = 30;
  COLUMNS.forEach((_, ci) => {
    const cell = headerRow.getCell(ci + 1);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = HEADER_ALIGNMENT;
  });

  // Add data rows
  rows.forEach((r, ri) => {
    const isvText = r.isvSuggestion
      ? typeof r.isvSuggestion === 'string'
        ? r.isvSuggestion
        : r.isvSuggestion.name || ''
      : '';

    const dataRow = fdd.addRow({
      id: r.id,
      requirement: r.requirement || '',
      module: r.module || '',
      subProcess: r.subProcess || '',
      gapType: r.gapType || '',
      recommendation: r.recommendation || '',
      effort: r.effort || '',
      priority: r.priority || 'Medium',
      isvSuggestion: isvText,
      reasoning: r.reasoning || '',
    });

    dataRow.height = 28;
    dataRow.alignment = { vertical: 'middle', wrapText: true };

    // Alternate row shading
    if (ri % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      });
    }

    // Color-code Gap Type cell
    const gapCell = dataRow.getCell(5);
    const colors = GAP_COLORS[r.gapType];
    if (colors) {
      gapCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + colors.fill },
      };
      gapCell.font = {
        bold: true,
        color: { argb: 'FF' + colors.font },
        size: 10,
        name: 'Calibri',
      };
    }

    // Add thin borders
    dataRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (!cell.font) {
        cell.font = { size: 10, name: 'Calibri' };
      }
    });
  });

  // Auto-filter
  fdd.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: COLUMNS.length },
  };

  /* ──────────── Download ──────────── */
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const date = new Date().toISOString().split('T')[0];
  saveAs(blob, `FDD_FitGap_${date}.xlsx`);
}

/* ── Internal helper ────────────────────────────────────── */
function gapKey(gapType) {
  if (!gapType) return 'unknown';
  const k = gapType.toLowerCase();
  if (k.includes('standard')) return 'fit';
  if (k.includes('config'))   return 'config';
  if (k.includes('dev'))      return 'dev';
  if (k.includes('out'))      return 'oos';
  return 'unknown';
}
