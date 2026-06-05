import { useState, useEffect, useCallback, useRef } from 'react';

const DEMO_REQUIREMENTS = [
  "We need to auto-match bank statements to GL entries daily and flag exceptions above $5,000",
  "Automate three-way matching for vendor invoices against PO and goods receipt with tolerance of 2%",
  "Implement intercompany accounting for 6 legal entities with automatic elimination entries at consolidation",
  "Generate monthly aged AR trial balance with automatic customer credit hold at 90 days overdue",
  "Configure multi-currency revaluation for unrealized gains/losses at month-end close with reporting in USD, EUR, and GBP",
  "Set up project cost tracking with WIP revenue recognition using completed percentage method for fixed-price projects",
  "Implement vendor payment proposals with positive pay file generation for Wells Fargo bank format",
  "Configure budget control with pre-encumbrance and encumbrance accounting for purchase orders and purchase requisitions",
  "Auto-generate recurring journal entries for monthly prepaid expense amortization across 12-month schedules",
  "Set up advanced bank reconciliation with matching rules for check number, amount tolerance ($0.01), and date range (±3 days)",
];

export function useAnalyzer() {
  const [rows, setRows] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bpcStatus, setBpcStatus] = useState({ loaded: false, chunks: 0 });
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [error, setError] = useState(null);
  const [nextIndex, setNextIndex] = useState(1);
  const indexRef = useRef(1);

  /* ── Health Check ─────────────────────────────────────── */
  useEffect(() => {
    checkHealth();
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health endpoint returned ' + res.status);
      const data = await res.json();
      setBpcStatus({ loaded: data.status === 'ok', chunks: data.chunksLoaded || 0 });
    } catch {
      setBpcStatus({ loaded: false, chunks: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Analyze Single Requirement ───────────────────────── */
  const analyzeRequirement = useCallback(async (text) => {
    const idx = indexRef.current++;
    const id = `REQ-${String(idx).padStart(3, '0')}`;
    setNextIndex(indexRef.current);

    const newRow = { id, requirement: text, status: 'analyzing' };
    setRows(prev => [...prev, newRow]);
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: text }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const result = await res.json();

      setRows(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                ...result,
                status: 'complete',
                priority: result.priority || 'Medium',
              }
            : r
        )
      );
    } catch (err) {
      setRows(prev =>
        prev.map(r =>
          r.id === id ? { ...r, status: 'error', error: err.message } : r
        )
      );
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  /* ── Run Demo (sequential) ────────────────────────────── */
  const runDemo = useCallback(async () => {
    setError(null);
    for (const req of DEMO_REQUIREMENTS) {
      const idx = indexRef.current++;
      const id = `REQ-${String(idx).padStart(3, '0')}`;
      setNextIndex(indexRef.current);

      const newRow = { id, requirement: req, status: 'analyzing' };
      setRows(prev => [...prev, newRow]);
      setIsAnalyzing(true);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: req }),
        });

        if (!res.ok) throw new Error(`Server responded with ${res.status}`);

        const result = await res.json();

        setRows(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, ...result, status: 'complete', priority: result.priority || 'Medium' }
              : r
          )
        );
      } catch (err) {
        setRows(prev =>
          prev.map(r =>
            r.id === id ? { ...r, status: 'error', error: err.message } : r
          )
        );
      }

      // Small delay between requests so the UI can breathe
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setIsAnalyzing(false);
  }, []);

  /* ── Analyze Batch (user-supplied list) ─────────────────── */
  const analyzeBatch = useCallback(async (requirements) => {
    setError(null);
    for (const req of requirements) {
      const idx = indexRef.current++;
      const id = `REQ-${String(idx).padStart(3, '0')}`;
      setNextIndex(indexRef.current);

      const newRow = { id, requirement: req, status: 'analyzing' };
      setRows(prev => [...prev, newRow]);
      setIsAnalyzing(true);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: req }),
        });

        if (!res.ok) throw new Error(`Server responded with ${res.status}`);

        const result = await res.json();

        setRows(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, ...result, status: 'complete', priority: result.priority || 'Medium' }
              : r
          )
        );
      } catch (err) {
        setRows(prev =>
          prev.map(r =>
            r.id === id ? { ...r, status: 'error', error: err.message } : r
          )
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setIsAnalyzing(false);
  }, []);

  /* ── CRUD helpers ─────────────────────────────────────── */
  const deleteRow = useCallback((id) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setExpandedRowId(prev => (prev === id ? null : prev));
  }, []);

  const updateRow = useCallback((id, changes) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...changes } : r)));
  }, []);

  const clearAll = useCallback(() => {
    setRows([]);
    setExpandedRowId(null);
    setNextIndex(1);
    indexRef.current = 1;
    setError(null);
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpandedRowId(prev => (prev === id ? null : id));
  }, []);

  return {
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
  };
}
