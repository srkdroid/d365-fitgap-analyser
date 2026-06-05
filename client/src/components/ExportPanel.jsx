import { useState } from 'react';
import { exportToExcel } from '../utils/excelExport';

export default function ExportPanel({ rows }) {
  const [exporting, setExporting] = useState(false);

  const completedRows = rows.filter(r => r.status === 'complete');
  const canExport = completedRows.length > 0;

  async function handleExport() {
    if (!canExport || exporting) return;
    setExporting(true);
    try {
      await exportToExcel(completedRows);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="export-panel">
      <button
        className="btn btn--success"
        onClick={handleExport}
        disabled={!canExport || exporting}
      >
        {exporting ? (
          <>
            <span className="btn__spinner" />
            Generating…
          </>
        ) : (
          <>
            <span className="btn__icon">📥</span>
            Export to Excel
          </>
        )}
      </button>
    </div>
  );
}
