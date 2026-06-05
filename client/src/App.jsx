import { useState } from 'react';
import { useAnalyzer } from './hooks/useAnalyzer';
import Header from './components/Header';
import RequirementInput from './components/RequirementInput';
import BulkUploadModal from './components/BulkUploadModal';
import StatsBar from './components/StatsBar';
import FitGapTable from './components/FitGapTable';
import ExportPanel from './components/ExportPanel';

export default function App() {
  const {
    rows,
    isAnalyzing,
    isLoading,
    bpcStatus,
    error,
    expandedRowId,
    analyzeRequirement,
    runDemo,
    analyzeBatch,
    deleteRow,
    updateRow,
    clearAll,
    toggleExpand,
  } = useAnalyzer();

  const [showBulkModal, setShowBulkModal] = useState(false);

  return (
    <div className="app-container">
      <Header bpcStatus={bpcStatus} isLoading={isLoading} />

      <main className="app-main">
        <RequirementInput
          onAnalyze={analyzeRequirement}
          onRunDemo={runDemo}
          onBulkUpload={() => setShowBulkModal(true)}
          onClear={clearAll}
          isAnalyzing={isAnalyzing}
          isLoading={isLoading}
          hasRows={rows.length > 0}
        />

        {rows.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <StatsBar rows={rows} />
              <ExportPanel rows={rows} />
            </div>
          </>
        )}

        <FitGapTable
          rows={rows}
          onDeleteRow={deleteRow}
          onUpdateRow={updateRow}
          expandedRowId={expandedRowId}
          onToggleExpand={toggleExpand}
        />

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </main>

      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSubmit={analyzeBatch}
        isAnalyzing={isAnalyzing}
      />
    </div>
  );
}
