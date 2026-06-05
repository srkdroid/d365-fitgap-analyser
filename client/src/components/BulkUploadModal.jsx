import { useState, useRef } from 'react';

/**
 * BulkUploadModal — allows users to upload multiple requirements at once.
 *
 * Two input methods:
 *   1. Paste: one requirement per line in a textarea
 *   2. File upload: .txt (one per line) or .csv (first column)
 */
export default function BulkUploadModal({ isOpen, onClose, onSubmit, isAnalyzing }) {
  const [bulkText, setBulkText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function parseRequirements(raw) {
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 10); // skip blank or trivially short lines
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target.result;

      if (file.name.endsWith('.csv')) {
        // Parse CSV: take the first column (or a column named "requirement")
        const lines = raw.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) {
          setParseError('CSV file is empty.');
          return;
        }

        // Check if first row is a header
        const firstRow = lines[0].toLowerCase();
        const hasHeader = firstRow.includes('requirement') || firstRow.includes('description') || firstRow.includes('business');
        const startIdx = hasHeader ? 1 : 0;

        // Find the best column index
        let colIdx = 0;
        if (hasHeader) {
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const reqCol = headers.findIndex(h =>
            h.includes('requirement') || h.includes('description') || h.includes('business')
          );
          if (reqCol >= 0) colIdx = reqCol;
        }

        const reqs = lines.slice(startIdx).map(line => {
          // Simple CSV parse (handles basic quoting)
          const cols = line.match(/("(?:[^"]|"")*"|[^,]*)/g) || [line];
          const val = (cols[colIdx] || '').trim().replace(/^"|"$/g, '').replace(/""/g, '"');
          return val;
        }).filter(r => r.length > 10);

        setBulkText(reqs.join('\n'));
      } else {
        // Plain text: one requirement per line
        setBulkText(raw);
      }
    };
    reader.readAsText(file);
  }

  function handleSubmit() {
    const reqs = parseRequirements(bulkText);
    if (reqs.length === 0) {
      setParseError('No valid requirements found. Each requirement should be at least 10 characters.');
      return;
    }
    onSubmit(reqs);
    setBulkText('');
    setFileName('');
    setParseError('');
    onClose();
  }

  function handleClose() {
    setBulkText('');
    setFileName('');
    setParseError('');
    onClose();
  }

  const reqCount = parseRequirements(bulkText).length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">📋 Bulk Upload Requirements</h2>
          <button className="modal__close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        <div className="modal__body">
          <p className="modal__description">
            Paste your requirements below (one per line), or upload a <code>.txt</code> / <code>.csv</code> file.
          </p>

          {/* File upload */}
          <div className="bulk-upload__file-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileChange}
              className="bulk-upload__file-input"
              id="bulk-file-input"
            />
            <label htmlFor="bulk-file-input" className="bulk-upload__file-label">
              <span className="btn__icon">📁</span>
              {fileName || 'Choose .txt or .csv file'}
            </label>
          </div>

          {/* Textarea */}
          <textarea
            className="bulk-upload__textarea"
            placeholder={
              'Paste requirements here, one per line…\n\n' +
              'Example:\n' +
              'We need to auto-match bank statements to GL entries daily\n' +
              'Automate three-way matching for vendor invoices against PO\n' +
              'Generate monthly aged AR trial balance with auto credit hold'
            }
            value={bulkText}
            onChange={e => { setBulkText(e.target.value); setParseError(''); }}
            rows={12}
          />

          {parseError && (
            <div className="bulk-upload__error">⚠️ {parseError}</div>
          )}
        </div>

        <div className="modal__footer">
          <span className="bulk-upload__count">
            {reqCount > 0 ? `${reqCount} requirement${reqCount !== 1 ? 's' : ''} detected` : 'No requirements yet'}
          </span>

          <div className="modal__footer-actions">
            <button className="btn btn--ghost" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={reqCount === 0 || isAnalyzing}
            >
              <span className="btn__icon">⚡</span>
              Analyse {reqCount} Requirement{reqCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
