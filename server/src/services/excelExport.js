/**
 * Excel Export — Functional Design Document (FDD) Generator
 *
 * Creates a professionally formatted .xlsx workbook with:
 * - Cover sheet with metadata and disclaimers
 * - Fit-Gap Analysis sheet with colour-coded gap types, filters, and frozen panes
 */

import ExcelJS from 'exceljs';

// ---------------------------------------------------------------------------
// Colour palette for gap types
// ---------------------------------------------------------------------------

const GAP_COLOURS = {
  'Standard Fit': 'C6EFCE',       // green
  'Configuration Gap': 'FFEB9C',  // yellow
  'Development Gap': 'FFC7CE',    // orange-red
  'Out of Scope': 'D9D9D9',       // gray
};

const HEADER_BG = '1E3A5F';  // dark blue
const HEADER_FG = 'FFFFFF';  // white

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS = [
  { header: 'Req #',           key: 'reqNum',         width: 8  },
  { header: 'Requirement',     key: 'requirement',    width: 50 },
  { header: 'Module',          key: 'module',         width: 20 },
  { header: 'Sub-Process',     key: 'subProcess',     width: 25 },
  { header: 'Gap Type',        key: 'gapType',        width: 18 },
  { header: 'Recommendation',  key: 'recommendation', width: 50 },
  { header: 'Effort',          key: 'effort',         width: 10 },
  { header: 'Priority',        key: 'priority',       width: 10 },
  { header: 'ISV Suggestion',  key: 'isvSuggestion',  width: 25 },
  { header: 'Config Steps',    key: 'configSteps',    width: 50 },
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Generate an FDD Excel workbook from analysed rows.
 *
 * @param {{ requirement: string, module: string, subProcess: string,
 *           gapType: string, recommendation: string, effort: string,
 *           priority: string, isvSuggestion: string|null,
 *           configSteps: string[] }[]} rows
 * @returns {Promise<Buffer>} — xlsx file as a Buffer
 */
export async function generateFDDExcel(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'D365 Fit-Gap Analyser';
  workbook.created = new Date();

  // -----------------------------------------------------------------------
  // 1. Cover Sheet
  // -----------------------------------------------------------------------

  const cover = workbook.addWorksheet('Cover');
  cover.getColumn(1).width = 80;

  const titleRow = cover.getRow(2);
  titleRow.getCell(1).value = 'D365 F&O Fit-Gap Analysis';
  titleRow.getCell(1).font = { bold: true, size: 18, color: { argb: HEADER_BG } };

  cover.getRow(4).getCell(1).value = `Generated: ${new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })}`;
  cover.getRow(4).getCell(1).font = { size: 12 };

  cover.getRow(5).getCell(1).value = `Total Requirements: ${rows.length}`;
  cover.getRow(5).getCell(1).font = { size: 12 };

  // Summary counts
  const gapCounts = {};
  for (const r of rows) {
    gapCounts[r.gapType] = (gapCounts[r.gapType] || 0) + 1;
  }
  let summaryRow = 6;
  for (const [gap, count] of Object.entries(gapCounts)) {
    const row = cover.getRow(summaryRow++);
    row.getCell(1).value = `  • ${gap}: ${count}`;
    row.getCell(1).font = { size: 11 };
  }

  const disclaimerRow1 = cover.getRow(summaryRow + 1);
  disclaimerRow1.getCell(1).value =
    'DISCLAIMER: AI-assisted analysis — validate against your licensed D365FO environment.';
  disclaimerRow1.getCell(1).font = { bold: true, size: 11, color: { argb: 'CC0000' } };

  const disclaimerRow2 = cover.getRow(summaryRow + 2);
  disclaimerRow2.getCell(1).value =
    'D365 Business Process Catalog used under MIT licence. Not Microsoft-endorsed.';
  disclaimerRow2.getCell(1).font = { italic: true, size: 10, color: { argb: '666666' } };

  // -----------------------------------------------------------------------
  // 2. Fit-Gap Analysis Sheet
  // -----------------------------------------------------------------------

  const fdd = workbook.addWorksheet('Fit-Gap Analysis');

  // Set up columns
  fdd.columns = COLUMNS;

  // Style header row
  const headerRow = fdd.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG },
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.height = 28;

  // Add data rows
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const configStepsText = Array.isArray(r.configSteps)
      ? r.configSteps.join('\n')
      : r.configSteps || '';

    const dataRow = fdd.addRow({
      reqNum: i + 1,
      requirement: r.requirement,
      module: r.module,
      subProcess: r.subProcess,
      gapType: r.gapType,
      recommendation: r.recommendation,
      effort: r.effort,
      priority: r.priority,
      isvSuggestion: r.isvSuggestion || '',
      configSteps: configStepsText,
    });

    // Colour-code Gap Type cell
    const gapCell = dataRow.getCell('gapType');
    const bgColour = GAP_COLOURS[r.gapType];
    if (bgColour) {
      gapCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColour },
      };
    }

    // Borders for all cells
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } },
      };
      cell.alignment = { vertical: 'top', wrapText: false };
    });

    // Wrap text on long-content columns
    dataRow.getCell('requirement').alignment = { vertical: 'top', wrapText: true };
    dataRow.getCell('recommendation').alignment = { vertical: 'top', wrapText: true };
    dataRow.getCell('configSteps').alignment = { vertical: 'top', wrapText: true };
  }

  // Auto-filter on headers
  fdd.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + rows.length, column: COLUMNS.length },
  };

  // Freeze panes — keep header visible
  fdd.views = [{ state: 'frozen', ySplit: 1 }];

  // -----------------------------------------------------------------------
  // 3. Write to buffer
  // -----------------------------------------------------------------------

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
